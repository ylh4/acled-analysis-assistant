import sqlite3 from 'sqlite3';
import { Database, open } from 'sqlite';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

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
  if (db) return db;  // Return existing connection if available
  
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });
  return db;
};

export const initializeTables = async () => {
  if (!db) {
    db = await initializeDB();
  }

  try {
    // First, drop the table and its index to ensure clean slate
    await db.exec(`DROP TABLE IF EXISTS acled_data`);
    await db.exec(`DROP INDEX IF EXISTS indx_data_id`);
    
    // Create table with new structure
    await db.exec(`
      CREATE TABLE IF NOT EXISTS acled_data (
        data_id INTEGER PRIMARY KEY AUTOINCREMENT,
        iso INTEGER,
        event_id_cnty TEXT,
        event_id_no_cnty TEXT,
        event_date DATE,
        year INTEGER,
        time_precision INTEGER,
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
        timestamp DATE,
        iso3 TEXT
      )
    `);
    
    // Create index after table is created
    await db.exec(`CREATE INDEX IF NOT EXISTS indx_data_id ON acled_data (data_id)`);
    
    console.log('Tables initialized successfully');
    
    // Now load initial data
    await loadInitialData();
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
    
    const dataToProcess = Array.isArray(response.data) ? response.data : 
                         Array.isArray(response.data.data) ? response.data.data :
                         [];
    
    const stmt = await db!.prepare(`
      INSERT OR REPLACE INTO acled_data 
      (iso, event_id_cnty, event_id_no_cnty, event_date, year, time_precision,
       event_type, sub_event_type, actor1, assoc_actor_1, inter1, actor2, assoc_actor_2, 
       inter2, interaction, civilian_targeting, region, country, admin1, admin2, admin3, 
       location, latitude, longitude, geo_precision, source, source_scale, notes, fatalities, 
       tags, timestamp, iso3)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    for (const item of dataToProcess) {
      await stmt.run(
        item.iso,
        item.event_id_cnty,
        item.event_id_no_cnty,
        item.event_date,
        item.year,
        item.time_precision,
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
        item.timestamp,
        item.iso3
      );
    }
    
    await stmt.finalize();
    return true;
  } catch (error) {
    console.error('Error fetching/storing API data:', error);
    throw error;
  }
}

export const updateSchema = async () => {
  if (!db) await initializeDB();
  
  try {
    // Check if table exists first
    const tableExists = await db!.get(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='acled_data'
    `);
    
    if (!tableExists) {
      console.log('No table to update schema for');
      return;
    }

    // Create temporary table with new schema
    await db!.exec(`
      CREATE TABLE IF NOT EXISTS acled_data_new (
        data_id INTEGER PRIMARY KEY AUTOINCREMENT,
        iso INTEGER,
        event_id_cnty TEXT,
        event_id_no_cnty TEXT,
        event_date DATE,
        year INTEGER,
        time_precision INTEGER,
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
        timestamp DATE,
        iso3 TEXT
      )
    `);

    // Copy data from old table to new table
    await db!.exec(`
      INSERT INTO acled_data_new 
      SELECT data_id, iso, event_id_cnty, event_id_no_cnty, event_date, year, 
             time_precision, event_type, sub_event_type, actor1, assoc_actor_1, 
             inter1, actor2, assoc_actor_2, inter2, interaction, civilian_targeting, 
             region, country, admin1, admin2, admin3, location, latitude, longitude, 
             geo_precision, source, source_scale, notes, fatalities, tags, timestamp, 
             iso3
      FROM acled_data
    `);

    // Drop old table
    await db!.exec(`DROP TABLE acled_data`);

    // Rename new table to old table name
    await db!.exec(`ALTER TABLE acled_data_new RENAME TO acled_data`);

    // Recreate index
    await db!.exec(`CREATE INDEX IF NOT EXISTS indx_data_id ON acled_data (data_id)`);

    console.log('Schema updated successfully');
  } catch (error) {
    console.error('Error updating schema:', error);
    throw error;
  }
};

// Add a function to load initial data
export const loadInitialData = async () => {
  try {
    const apiUrl = 'https://api.acleddata.com/acled/read';
    
    // Convert all values to strings and handle undefined values
    const params: Record<string, string> = {
      key: process.env.ACLED_API_KEY ?? '',
      email: process.env.ACLED_EMAIL ?? '',
      //limit: '500'  // Convert number to string
    };

    const queryString = new URLSearchParams(params).toString();
    const fullUrl = `${apiUrl}?${queryString}`;
    
    await fetchAndStoreApiData(fullUrl);
    console.log('Initial data loaded successfully');
  } catch (error) {
    console.error('Error loading initial data:', error);
    throw error;
  }
};

// Initialize the database when the file is imported
const init = async () => {
  try {
    await initializeDB();
    await initializeTables();
  } catch (error) {
    console.error('Error during initialization:', error);
    throw error;
  }
};

init().catch(console.error);

export default db;