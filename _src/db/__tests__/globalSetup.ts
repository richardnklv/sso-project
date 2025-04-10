import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import * as fs from 'fs';
import * as path from 'path';
import { Pool } from 'pg';

// Create a file path for sharing connection info
const CONNECTION_INFO_PATH = path.join(__dirname, 'connection-info.json');

declare global {
  // eslint-disable-next-line no-var
  var __POSTGRES_CONTAINER__: StartedPostgreSqlContainer;
  // eslint-disable-next-line no-var
  var __POSTGRES_URI__: string;
}

/**
 * This function runs once before all tests
 * It starts a PostgreSQL container and initializes it with our schema
 */
export default async function globalSetup(): Promise<void> {
  console.log('🚀 Starting PostgreSQL container...');

  // Start PostgreSQL container
  const postgresContainer = await new PostgreSqlContainer()
    .withDatabase('test_db')
    .withUsername('test_user')
    .withPassword('test_password')
    .withExposedPorts(5432)
    .start();

  // Get connection URI
  const connectionUri = postgresContainer.getConnectionUri();
  
  console.log('✅ PostgreSQL container started');
  console.log(`🔌 Connection URI: ${connectionUri}`);

  // Store container and URI in global variables so we can access them in tests and teardown
  global.__POSTGRES_CONTAINER__ = postgresContainer;
  global.__POSTGRES_URI__ = connectionUri;
  
  // IMPORTANT: Write connection info to a file so setupTests.ts can read it
  fs.writeFileSync(
    CONNECTION_INFO_PATH,
    JSON.stringify({ connectionUri }),
    'utf8'
  );

  // Initialize the database with our schema
  const schemaPath = path.join(__dirname, '..', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  
  // Create a connection pool
  const pool = new Pool({
    connectionString: connectionUri,
  });

  try {
    // Run our schema file to create all tables and functions
    await pool.query(schema);
    console.log('✅ Database schema initialized');
  } catch (error) {
    console.error('❌ Failed to initialize database schema:', error);
    throw error;
  } finally {
    // Close the pool
    await pool.end();
  }
}