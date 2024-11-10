import "dotenv/config";
import express from 'express';
import cors from 'cors';
import { query, initializeTables, fetchAndStoreApiData } from './db';
import { processQuery } from './process-query';
import { queryAI } from './query-ai';
import { prompts } from './prompt-templates';
import path from 'path';

interface TriageResponse {
  queryType: 'DATA_QUESTION' | 'GENERAL_QUESTION' | 'OUT_OF_SCOPE';
}

interface SchemaAnalysisResponse {
  inScope: boolean;
  outOfScopeReason?: string;
  relevantTables: {
    tableName: string;
    fields: string[];
    reason: string;
  }[];
  relationships: string[];
}

interface ACLEDEvent {
  data_id: number;
  event_date: string;
  // ... add other fields that match your database schema
}

interface APIResponse {
  data: ACLEDEvent[];
  count: number;
  success: boolean;
}

async function startServer() {
  await initializeTables();

  const app = express();
  app.use(cors());
  app.use(express.json());

  // Static file serving
  const clientPath = path.join(__dirname, '../../client');
  app.use(express.static(clientPath));

  app.get('/', (req, res) => {
    res.sendFile(path.join(clientPath, 'index.html'));
  });

  // Initialize ACLED data
  const initializeData = async () => {
    try {
      // First, check if we already have data
      const existingCount = await query('SELECT COUNT(*) as count FROM acled_data');
      const lastEvent = await query('SELECT MAX(data_id) as last_id FROM acled_data');
      const lastEventId = lastEvent[0]?.last_id || 0;

      // Calculate how many records to fetch (ACLED usually limits to 500 per request)
      const PAGE_SIZE = 500;
      const baseUrl = 'https://api.acleddata.com/acled/read/';
      
      const fetchPage = async (page: number): Promise<APIResponse> => {
        const url = `${baseUrl}?key=${process.env.ACLED_API_KEY}&email=${process.env.ACLED_EMAIL}&limit=${PAGE_SIZE}&page=${page}`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`API request failed: ${response.statusText}`);
        }
        return response.json();
      };

      // Fetch first page to get total count
      const firstPage = await fetchPage(1);
      const totalRecords = firstPage.count;
      const totalPages = Math.ceil(totalRecords / PAGE_SIZE);

      console.log(`Total records available: ${totalRecords}`);
      console.log(`Existing records: ${existingCount[0].count}`);

      // If we have new data to fetch
      if (existingCount[0].count < totalRecords) {
        console.log('Fetching new records...');
        
        for (let page = 1; page <= totalPages; page++) {
          const response = await fetchPage(page);
          const newEvents = response.data.filter(event => event.data_id > lastEventId);
          
          if (newEvents.length > 0) {
            // Insert new records
            for (const event of newEvents) {
              await query(`
                INSERT OR IGNORE INTO acled_data 
                (data_id, event_date, /* other fields */) 
                VALUES (?, ?, /* other values */)
              `, [event.data_id, event.event_date /* other values */]);
            }
            console.log(`Inserted ${newEvents.length} new records from page ${page}`);
          }

          // Add a small delay to avoid hitting rate limits
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } else {
        console.log('Database is up to date');
      }

      console.log('ACLED data synchronization complete');
    } catch (error) {
      console.error('Failed to sync ACLED data:', 
        error instanceof Error ? error.message : 'Unknown error');
    }
  };

  app.get('/api/acled-data', async (req, res) => {
    try {
      const data = await query('SELECT * FROM acled_data');
      res.json({ success: true, data });
    } catch (error) {
      console.error('Error fetching ACLED data:', 
        error instanceof Error ? error.message : 'Unknown error');
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch ACLED data' 
      });
    }
  });

  app.get('/api/tables', async (req, res) => {
    try {
      const tables = await query(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `);
      res.json({ success: true, tables });
    } catch (error) {
      console.error('Error fetching tables:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch tables' });
    }
  });

  app.post('/query', express.json(), async (req, res) => {
    try {
      const { message } = req.body;
      
      // Get table schema
      const tables = await query('SELECT * FROM sqlite_master WHERE type="table"');
      const schemaContext = {
        tables: await Promise.all(tables.map(async (table) => ({
          tableName: table.name,
          analysis: await query(`PRAGMA table_info(${table.name})`)
        })))
      };

      // Analyze question
      const triageResponse = JSON.parse(await queryAI(
        prompts.triage(message).system,
        prompts.triage(message).user,
        true
      )) as TriageResponse;

      if (triageResponse.queryType === 'DATA_QUESTION') {
        // Analyze schema
        const schemaAnalysis = JSON.parse(await queryAI(
          prompts.schemaAnalysis(schemaContext, message).system,
          prompts.schemaAnalysis(schemaContext, message).user,
          true
        )) as SchemaAnalysisResponse;

        if (schemaAnalysis.inScope) {
          // Generate SQL
          const sqlResponse = JSON.parse(await queryAI(
            prompts.generateSQL(schemaAnalysis, message).system,
            prompts.generateSQL(schemaAnalysis, message).user,
            true
          ));

          console.log('Generated SQL:', sqlResponse.query); // Add this for debugging

          // Execute query
          const results = await query(sqlResponse.query);

          // Format answer
          const formattedResponse = JSON.parse(await queryAI(
            prompts.formatAnswer(message, sqlResponse.query, results).system,
            prompts.formatAnswer(message, sqlResponse.query, results).user,
            true
          ));

          res.json({
            success: true,
            answer: formattedResponse.answer,
            data: results,
            sql: sqlResponse.query
          });
        } else {
          res.json({
            success: false,
            error: schemaAnalysis.outOfScopeReason
          });
        }
      } else if (triageResponse.queryType === 'GENERAL_QUESTION') {
        const generalResponse = JSON.parse(await queryAI(
          prompts.generalAnswer(message).system,
          prompts.generalAnswer(message).user,
          true
        ));
        res.json({
          success: true,
          answer: generalResponse.answer
        });
      } else {
        res.json({
          success: false,
          error: 'Question is out of scope'
        });
      }
    } catch (error) {
      console.error('Error processing query:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to process query',
        details: error instanceof Error ? error.message : 'An unknown error occurred'
      });
    }
  });

  // Add a new endpoint to manually trigger updates
  app.post('/api/update-acled', async (req, res) => {
    try {
      await initializeData();
      res.json({ success: true, message: 'ACLED data update completed' });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: 'Failed to update ACLED data',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Schedule updates every 24 hours
  setInterval(async () => {
    console.log('Running scheduled ACLED data update...');
    await initializeData();
  }, 24 * 60 * 60 * 1000);

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
}); 