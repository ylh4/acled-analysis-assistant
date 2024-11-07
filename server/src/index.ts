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
      await fetchAndStoreApiData('https://api.acleddata.com/acled/read/?key=AZWhjxyhAUb3eHhVL3rQ&email=yared.hurisa@unchealth.unc.edu&LIMIT=100');
      console.log('API data successfully loaded');
    } catch (error) {
      console.error('Failed to load initial data:', error);
    }
  };

  initializeData();

  app.get('/api/acled-data', async (req, res) => {
    try {
      const data = await query('SELECT * FROM acled_data');
      res.json({ success: true, data });
    } catch (error) {
      console.error('Error fetching ACLED data:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch ACLED data' });
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
        details: error.message 
      });
    }
  });

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
}); 