import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import * as fs from 'fs';
import * as path from 'path';

// Path to connection info file
const CONNECTION_INFO_PATH = path.join(__dirname, 'connection-info.json');

/**
 * This function runs once after all tests
 * It stops the PostgreSQL container and cleans up resources
 */
export default async function globalTeardown(): Promise<void> {
  console.log('🧹 Cleaning up test resources...');

  // Get container from global variable
  const container = global.__POSTGRES_CONTAINER__ as StartedPostgreSqlContainer;
  
  if (container) {
    // Stop the container
    await container.stop();
    console.log('✅ PostgreSQL container stopped');
  } else {
    console.warn('⚠️ No PostgreSQL container found to stop');
  }
  
  // Clean up connection info file if it exists
  try {
    if (fs.existsSync(CONNECTION_INFO_PATH)) {
      fs.unlinkSync(CONNECTION_INFO_PATH);
    }
  } catch (error) {
    console.error('Error cleaning up connection info file:', error);
  }
}