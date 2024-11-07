import sqlite3 from 'sqlite3';
import { Database, open } from 'sqlite';
import path from 'path';
import fs from 'fs';
import axios from 'axios';

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'database.sqlite');

// Create a database instance
let db: Database | null = null;

// Initialize database connection
const initializeDB = async () => {
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Initialize tables
  await initializeTables();
};

export const initializeTables = async () => {
  if (!db) await initializeDB();
  
  try {
    // First, check if the table exists and get its structure
    const tableInfo = await db!.all(`PRAGMA table_info(acled_data)`);
    
    // If table exists and doesn't have all columns, drop and recreate it
    if (tableInfo.length > 0 && tableInfo.length < 26) {  // 26 is the number of columns we expect
      await db!.exec(`DROP TABLE IF EXISTS acled_data`);
      console.log('Dropped existing table with old structure');
    }

    // Create table if it doesn't exist or was just dropped
    await db!.exec(`
      CREATE TABLE IF NOT EXISTS acled_data (
        event_type TEXT,
        sub_event_type TEXT,
        actor1 TEXT,
        assoc_actor_1 TEXT,
        inter1 INTEGER,
        actor2 TEXT,
        assoc_actor_2 TEXT,
        inter2 INTEGER,
        interaction INTEGER,
        civilian_targeting TEXT,
        iso INTEGER,
        region TEXT,
        country TEXT,
        admin1 TEXT,
        admin2 TEXT,
        admin3 TEXT,
        location TEXT,
        latitude REAL,
        longitude REAL,
        geo_precision INTEGER,
        source TEXT,
        source_scale TEXT,
        notes TEXT,
        fatalities INTEGER,
        tags TEXT,
        timestamp INTEGER
      )
    `);

    console.log('Tables initialized successfully');
  } catch (error) {
    console.error('Error initializing tables:', error);
    throw error;
  }
};

export const query = async (text: string, params?: any[]) => {
  if (!db) await initializeDB();
  return db!.all(text, params);
};

// Add new interface for your API data structure
interface ApiData {
  // Define your expected API response structure here
  // Example:
  id: number;
  name: string;
  // ... other fields
}

// Add new function to fetch and store API data
export const fetchAndStoreApiData = async (apiUrl: string) => {
  if (!db) await initializeDB();
  
  try {
    const response = await axios.get(apiUrl);
    
    // Debug the API response
    console.log('API Response Structure:', JSON.stringify(response.data, null, 2));
    
    // Create table with all ACLED columns
    await db!.exec(`
      CREATE TABLE IF NOT EXISTS acled_data (
        event_type TEXT,
        sub_event_type TEXT,
        actor1 TEXT,
        assoc_actor_1 TEXT,
        inter1 INTEGER,
        actor2 TEXT,
        assoc_actor_2 TEXT,
        inter2 INTEGER,
        interaction INTEGER,
        civilian_targeting TEXT,
        iso INTEGER,
        region TEXT,
        country TEXT,
        admin1 TEXT,
        admin2 TEXT,
        admin3 TEXT,
        location TEXT,
        latitude REAL,
        longitude REAL,
        geo_precision INTEGER,
        source TEXT,
        source_scale TEXT,
        notes TEXT,
        fatalities INTEGER,
        tags TEXT,
        timestamp INTEGER
      )
    `);
    
    // Check if response.data is an array directly
    const dataToProcess = Array.isArray(response.data) ? response.data : 
                         Array.isArray(response.data.data) ? response.data.data :
                         [];
    
    const stmt = await db!.prepare(`
      INSERT OR REPLACE INTO acled_data 
      (event_type, sub_event_type, actor1, assoc_actor_1, inter1, actor2, assoc_actor_2, 
       inter2, interaction, civilian_targeting, iso, region, country, admin1, admin2, admin3, 
       location, latitude, longitude, geo_precision, source, source_scale, notes, fatalities, 
       tags, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    for (const item of dataToProcess) {
      await stmt.run(
        item.event_type,
        item.sub_event_type,
        item.actor1,
        item.assoc_actor_1,
        item.inter1,
        item.actor2,
        item.assoc_actor_2,
        item.inter2,
        item.interaction,
        item.civilian_targeting,
        item.iso,
        item.region,
        item.country,
        item.admin1,
        item.admin2,
        item.admin3,
        item.location,
        item.latitude,
        item.longitude,
        item.geo_precision,
        item.source,
        item.source_scale,
        item.notes,
        item.fatalities,
        item.tags,
        item.timestamp
      );
    }
    
    await stmt.finalize();
    return true;
  } catch (error) {
    console.error('Error fetching/storing API data:', error);
    throw error;
  }
}

// Initialize the database when the file is imported
initializeDB().catch(console.error);

export default db;