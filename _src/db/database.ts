import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
dotenv.config();

// Database connection configuration
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'sso_db',
  password: process.env.DB_PASSWORD || 'password',
  port: parseInt(process.env.DB_PORT || '5432'),
  // For security in production, enable SSL
  ...(process.env.NODE_ENV === 'production' && {
    ssl: {
      rejectUnauthorized: false // Consider setting to true in production with proper certificates
    }
  })
});

// Log connection events
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on PostgreSQL connection', err);
});

/**
 * Error class for database-related errors
 */
export class DatabaseError extends Error {
  constructor(message: string, public originalError?: Error) {
    super(message);
    this.name = 'DatabaseError';
  }
}

/**
 * Execute a query with parameters
 * @param text SQL query text
 * @param params Query parameters
 * @returns Query result
 */
export const query = async <T extends QueryResultRow = any>(text: string, params?: unknown[]): Promise<QueryResult<T>> => {
  const start = Date.now();
  try {
    const result = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    
    // Log slow queries (more than 100ms) in development
    if (process.env.NODE_ENV !== 'production' && duration > 100) {
      console.log('Slow query:', { text, duration, rows: result.rowCount });
    }
    
    return result;
  } catch (error) {
    console.error('Database query error:', error);
    throw new DatabaseError('Failed to execute database query', error as Error);
  }
};

/**
 * Get a client from the pool for transactions
 * @returns Client from the pool
 */
export const getClient = async (): Promise<PoolClient> => {
  const client = await pool.connect();
  return client;
};

/**
 * Execute multiple queries in a transaction
 * @param callback Function that executes queries within a transaction
 * @returns Result of the callback function
 */
export const transaction = async <T>(callback: (client: PoolClient) => Promise<T>): Promise<T> => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Transaction error:', error);
    throw new DatabaseError('Transaction failed', error as Error);
  } finally {
    client.release();
  }
};

/**
 * Initialize the database by ensuring all tables exist
 * This can be used to run the schema.sql file during application startup
 */
export const initDatabase = async (): Promise<void> => {
  const client = await pool.connect();
  
  try {
    // Read schema.sql and execute it
    // This is a simplified version - in production, consider using a migration tool
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    await client.query(schema);
    console.log('Database schema initialized successfully');
  } catch (error) {
    console.error('Error initializing database schema:', error);
    throw new DatabaseError('Failed to initialize database schema', error as Error);
  } finally {
    client.release();
  }
};

export default {
  query,
  getClient,
  transaction,
  initDatabase
};