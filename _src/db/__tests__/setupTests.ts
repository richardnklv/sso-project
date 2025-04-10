import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// Path to connection info file
const CONNECTION_INFO_PATH = path.join(__dirname, 'connection-info.json');

// Define a pool that will be initialized later
let pool: Pool;

// Read connection info from file
function getConnectionUri(): string {
  try {
    if (!fs.existsSync(CONNECTION_INFO_PATH)) {
      throw new Error(`Connection info file not found at ${CONNECTION_INFO_PATH}`);
    }
    
    const data = fs.readFileSync(CONNECTION_INFO_PATH, 'utf8');
    const { connectionUri } = JSON.parse(data);
    
    if (!connectionUri) {
      throw new Error('Connection URI not found in connection info file');
    }
    
    return connectionUri;
  } catch (error) {
    console.error('Error reading connection info:', error);
    throw error;
  }
}

// Mock database module at file level (important for Jest to intercept all imports)
jest.mock('../database', () => ({
  query: jest.fn((text: string, params?: any[]) => {
    // Ensure pool is defined before using it
    if (!pool) {
      throw new Error('Database pool not initialized');
    }
    return pool.query(text, params);
  }),
  transaction: jest.fn(async (callback: any) => {
    // Ensure pool is defined before using it
    if (!pool) {
      throw new Error('Database pool not initialized');
    }
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }),
  DatabaseError: class DatabaseError extends Error {
    constructor(message: string, public originalError?: Error) {
      super(message);
      this.name = 'DatabaseError';
    }
  }
}));

// Initialize database connection before tests run
beforeAll(() => {
  try {
    // Get the connection URI from file
    const connectionUri = getConnectionUri();
    
    // Initialize the pool with the container's connection string
    pool = new Pool({ connectionString: connectionUri });
    
    console.log('Connected to test database');
  } catch (error) {
    console.error('Failed to initialize database connection:', error);
    throw error;
  }
});

// Clean up resources after all tests
afterAll(async () => {
  if (pool) {
    await pool.end();
    console.log('Closed database connection');
  }
});

// Clear database tables before each test
beforeEach(async () => {
  if (!pool) {
    throw new Error('Database pool not initialized');
  }

  try {
    // Delete all data from tables, but keep the tables themselves
    await pool.query('DELETE FROM authorization_codes');
    await pool.query('DELETE FROM access_tokens');
    await pool.query('DELETE FROM refresh_tokens');
    await pool.query('DELETE FROM clients');
    await pool.query('DELETE FROM users');
  } catch (error) {
    console.error('Error clearing test database:', error);
  }
});