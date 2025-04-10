import { UserModel } from '../db/models/user';
import { ClientModel } from '../db/models/client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Script to create test data for the OAuth2 server
 */
async function createTestData() {
  try {
    // Create a test user
    console.log('Creating test user...');
    const user = await UserModel.create('testuser', 'password123');
    console.log(`Test user created with ID: ${user.id}`);

    // Create a test confidential client
    console.log('Creating test confidential client...');
    const confidentialClient = await ClientModel.create({
      clientId: 'confidential-client',
      clientSecret: 'client-secret',
      clientType: 'confidential',
      redirectUris: ['http://localhost:3000/test-client/callback']
    });
    console.log(`Test confidential client created with ID: ${confidentialClient.id}`);

    // Create a test public client (for PKCE)
    console.log('Creating test public client...');
    const publicClient = await ClientModel.create({
      clientId: 'public-client',
      clientType: 'public',
      redirectUris: ['http://localhost:3000/test-client/callback']
    });
    console.log(`Test public client created with ID: ${publicClient.id}`);

    console.log('Test data creation complete!');
  } catch (error) {
    console.error('Error creating test data:', error);
  }
}

// Run the function
createTestData();