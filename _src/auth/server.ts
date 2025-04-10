import express, { Request, Response, NextFunction } from 'express';
import session from 'express-session';
import bodyParser from 'body-parser';
import path from 'path';
import dotenv from 'dotenv';
import cors from 'cors';

// Import OAuth utilities and models
import * as oauth from './oauth';
import { AuthorizationRequest, TokenRequest } from './types';
import { UserModel } from '../db/models/user';
import { ClientModel } from '../db/models/client';
import { AuthCodeModel } from '../db/models/authCode';

// Load environment variables
dotenv.config();

// Constants
const SESSION_SECRET = process.env.SESSION_SECRET || 'oauth2-sso-dev-secret';
const SESSION_COOKIE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours
const DEFAULT_PORT = process.env.PORT || 3000;

// Initialize Express app
const app = express();
// Declare session interface
declare module 'express-session' {
  interface SessionData {
    userId?: string;
    username?: string;
    authRequest?: AuthorizationRequest;
  }
}

// Setup middleware
// Enable CORS for all routes
app.use(cors({
  origin: 'http://localhost:8080', // Allow our client app
  credentials: true, // Allow cookies to be sent
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


// Setup session handling
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_COOKIE_MAX_AGE
  }
}));

// Set up views for login/consent pages
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Basic test route
app.get('/', (req, res) => {
  res.send('OAuth2 Server Running');
});

// OAuth Authorization endpoint
app.get('/oauth/authorize', async (req, res, next) => {
  try {
    // Validate the authorization request
    const authReq: AuthorizationRequest = {
      client_id: req.query.client_id as string,
      redirect_uri: req.query.redirect_uri as string,
      response_type: req.query.response_type as string,
      scope: req.query.scope as string,
      state: req.query.state as string,
      code_challenge: req.query.code_challenge as string,
      code_challenge_method: req.query.code_challenge_method as 'plain' | 'S256'
    };

    // Validate the request parameters
    const validation = await oauth.validateAuthorizationRequest(authReq);
    
    if (!validation.valid) {
      // If the request is invalid, redirect with error if possible
      if (authReq.redirect_uri) {
        const redirectUrl = new URL(authReq.redirect_uri);
        redirectUrl.searchParams.append('error', validation.error || 'invalid_request');
        if (authReq.state) {
          redirectUrl.searchParams.append('state', authReq.state);
        }
        return res.redirect(redirectUrl.toString());
      }
      // Otherwise, show an error
      return res.status(400).json({ error: validation.error || 'invalid_request' });
    }

    // Store the authorization request in the session
    req.session.authRequest = authReq;

    // Check if the user is logged in
    if (!req.session.userId) {
      // If not logged in, redirect to login page
      return res.redirect(`/auth/login?client_id=${authReq.client_id}`);
    }

    // If user is logged in, redirect to consent page
    res.redirect(`/auth/consent?client_id=${authReq.client_id}`);
  } catch (error) {
    next(error);
  }
});

// OAuth Token endpoint
app.post('/oauth/token', async (req, res, next) => {
  try {
    console.log('Token request body:', req.body);

    // Validate the token request
    const tokenReq: TokenRequest = {
      grant_type: req.body.grant_type,
      code: req.body.code,
      redirect_uri: req.body.redirect_uri,
      client_id: req.body.client_id,
      client_secret: req.body.client_secret,
      code_verifier: req.body.code_verifier,
      refresh_token: req.body.refresh_token
    };

    // Handle based on grant type
    if (tokenReq.grant_type === 'authorization_code') {
      // Validate the token request
      const validation = await oauth.validateTokenRequest(tokenReq);
      
      if (!validation.valid) {
        console.log('Token validation failed:', validation.error);
        return res.status(400).json({
          error: validation.error || 'invalid_request',
          error_description: 'The token request is invalid'
        });
      }

      console.log('Token request validated successfully');

      // Exchange the authorization code for tokens
      const tokens = await oauth.generateTokens(
        validation.client!.id, // Use the client ID (UUID), not the client_id string
        validation.authCode!.user_id,
        validation.authCode!.scope || undefined
      );

      // Consume the authorization code
      await AuthCodeModel.consume(tokenReq.code!);

      // Return the tokens
      return res.json(tokens);
    }
    else if (tokenReq.grant_type === 'refresh_token') {
      // Validate the refresh token request
      const validation = await oauth.validateTokenRequest(tokenReq);
      
      if (!validation.valid) {
        console.log('Refresh validation failed:', validation.error);
        return res.status(400).json({
          error: validation.error || 'invalid_request',
          error_description: 'The refresh token request is invalid'
        });
      }

      console.log('Refresh token request validated successfully');

      // Refresh the access token
      const tokens = await oauth.refreshAccessToken(
        tokenReq.refresh_token!,
        validation.client!.id  // Use the client ID (UUID), not the client_id string
      );

      // Return the new tokens
      return res.json(tokens);
    }
    else {
      return res.status(400).json({
        error: 'unsupported_grant_type',
        error_description: 'The grant type is not supported'
      });
    }
  } catch (error) {
    // Handle specific OAuth errors
    if (error instanceof Error) {
      console.error('Token endpoint error:', error);
      if (error.message === 'invalid_grant') {
        return res.status(400).json({
          error: 'invalid_grant',
          error_description: 'The provided authorization grant is invalid'
        });
      }
    }
    next(error);
  }
});

// Token revocation endpoint
app.post('/oauth/revoke', async (req, res, next) => {
  try {
    console.log('Revoke request body:', req.body);
    const token = req.body.token;
    const clientId = req.body.client_id;
    const clientSecret = req.body.client_secret;
    
    if (!token || !clientId) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Missing required parameters'
      });
    }

    // Verify client
    const client = await ClientModel.findByClientId(clientId);
    if (!client) {
      return res.status(400).json({
        error: 'invalid_client',
        error_description: 'Invalid client'
      });
    }

    // For confidential clients, verify client_secret
    if (client.client_type === 'confidential') {
      if (!clientSecret) {
        return res.status(400).json({
          error: 'invalid_client',
          error_description: 'Missing client secret'
        });
      }
      
      const authenticated = await ClientModel.verifyClientCredentials(clientId, clientSecret);
      if (!authenticated) {
        return res.status(400).json({
          error: 'invalid_client',
          error_description: 'Invalid client credentials'
        });
      }
    }

    // Attempt to revoke the token
    await oauth.revokeToken(token, client.id);
    
    // Always return success, even if token doesn't exist (per spec)
    res.status(200).json({});
  } catch (error) {
    console.error('Revoke endpoint error:', error);
    next(error);
  }
});

// Login form
app.get('/auth/login', (req, res) => {
  // Render the login form
  res.render('login', {
    client_id: req.query.client_id,
    error: req.query.error
  });
});

// Login form submission
app.post('/auth/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    
    // Authenticate the user
    const user = await UserModel.authenticate(username, password);
    
    if (!user) {
      // If authentication fails, show the login form again with an error
      return res.redirect(`/auth/login?client_id=${req.body.client_id}&error=invalid_credentials`);
    }
    
    // Store the user ID in the session
    req.session.userId = user.id;
    req.session.username = user.username;
    
    // Redirect back to the authorization endpoint
    if (req.session.authRequest) {
      res.redirect(`/oauth/authorize?client_id=${req.session.authRequest.client_id}&redirect_uri=${req.session.authRequest.redirect_uri}&response_type=${req.session.authRequest.response_type}&state=${req.session.authRequest.state || ''}&scope=${req.session.authRequest.scope || ''}`);
    } else {
      res.redirect('/');
    }
  } catch (error) {
    next(error);
  }
});

// Consent form
app.get('/auth/consent', async (req, res, next) => {
  try {
    // Check if the user is logged in
    if (!req.session.userId) {
      return res.redirect(`/auth/login?client_id=${req.query.client_id}`);
    }
    
    // Get the client details
    const clientId = req.query.client_id as string;
    const client = await ClientModel.findByClientId(clientId);
    
    if (!client) {
      return res.status(400).json({ error: 'invalid_client' });
    }
    
    // Render the consent form
    res.render('consent', {
      client,
      scope: req.session.authRequest?.scope || '',
      user: { username: req.session.username }
    });
  } catch (error) {
    next(error);
  }
});

// Consent form submission
app.post('/auth/consent', async (req, res, next) => {
  try {
    // Check if the user is logged in
    if (!req.session.userId || !req.session.authRequest) {
      return res.redirect('/');
    }
    
    const { approved } = req.body;
    
    // If the user denied consent
    if (approved !== 'true') {
      // Redirect back to the client with an error
      const redirectUrl = new URL(req.session.authRequest.redirect_uri);
      redirectUrl.searchParams.append('error', 'access_denied');
      if (req.session.authRequest.state) {
        redirectUrl.searchParams.append('state', req.session.authRequest.state);
      }
      return res.redirect(redirectUrl.toString());
    }
    
    // Look up the client to get its UUID
    const client = await ClientModel.findByClientId(req.session.authRequest.client_id);
    if (!client) {
      throw new Error('Invalid client ID');
    }
    
    console.log('Debug - client lookup:', {
      clientIdString: req.session.authRequest.client_id,
      clientUUID: client.id
    });
    
    // Generate the authorization code using the client UUID
    const code = await oauth.generateAuthorizationCode(
      client.id, // Use the UUID, not the client_id string
      req.session.userId,
      req.session.authRequest.redirect_uri,
      req.session.authRequest.scope,
      req.session.authRequest.code_challenge,
      req.session.authRequest.code_challenge_method
    );
    
    // Build the redirect URL
    const redirectUrl = new URL(req.session.authRequest.redirect_uri);
    redirectUrl.searchParams.append('code', code);
    if (req.session.authRequest.state) {
      redirectUrl.searchParams.append('state', req.session.authRequest.state);
    }
    
    // Remove the authorization request from the session
    delete req.session.authRequest;
    
    // Redirect back to the client
    res.redirect(redirectUrl.toString());
  } catch (error) {
    next(error);
  }
});

// Test client page
app.get('/test-client', (req, res) => {
  // Render a simple test client page
  res.render('test-client');
});

// Handle the redirect URI callback for testing
app.get('/test-client/callback', (req, res) => {
  // Just redirect to the main test client page with the same query parameters
  res.redirect(`/test-client${req.url.substring(req.url.indexOf('?'))}`);
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  
  // Send error response
  res.status(500).json({
    error: 'server_error',
    error_description: process.env.NODE_ENV === 'production' 
      ? 'An internal server error occurred' 
      : err.message
  });
});

// Start the server
app.listen(DEFAULT_PORT, () => {
  console.log(`OAuth2 server running on port ${DEFAULT_PORT}`);
});

export default app;