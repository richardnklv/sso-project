// Script to add a new redirect URI to an existing client
require('dotenv').config();
const { Pool } = require('pg');

// Create a new database connection
const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME
});

// Client ID to update
const clientId = 'confidential-client';

// New redirect URI to add
const newRedirectUri = 'http://localhost:8080/';

async function addRedirectUri() {
  try {
    // First, get the current redirect URIs
    const getResult = await pool.query(
      'SELECT redirect_uris FROM clients WHERE client_id = $1',
      [clientId]
    );
    
    if (getResult.rows.length === 0) {
      console.error(`Client not found: ${clientId}`);
      return;
    }
    
    // Get current redirect URIs array
    const currentUris = getResult.rows[0].redirect_uris;
    console.log('Current redirect URIs:', currentUris);
    
    // Check if the URI already exists
    if (currentUris.includes(newRedirectUri)) {
      console.log(`Redirect URI ${newRedirectUri} already exists for client ${clientId}`);
      return;
    }
    
    // Add the new URI
    const updatedUris = [...currentUris, newRedirectUri];
    
    // Update the client record
    await pool.query(
      'UPDATE clients SET redirect_uris = $1 WHERE client_id = $2',
      [updatedUris, clientId]
    );
    
    console.log(`Successfully added redirect URI ${newRedirectUri} to client ${clientId}`);
    console.log('New redirect URIs:', updatedUris);
  } catch (error) {
    console.error('Error updating client:', error);
  } finally {
    pool.end();
  }
}

// Run the function
addRedirectUri();