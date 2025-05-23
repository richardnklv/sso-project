# OAuth2 SSO Provider

A standards-compliant OAuth 2.0 Single Sign-On (SSO) provider implementation with a sample client application.

## Overview

This project implements a complete OAuth 2.0 authorization server that enables single sign-on functionality across multiple client applications. It includes user authentication, token management, and a sample client application demonstrating the authentication flow.

## System Requirements

- Node.js 16+
- PostgreSQL 12+
- TypeScript 4.5+

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Create a PostgreSQL database and configure connection:
   - Copy `.env.example` to `.env`
   - Update database connection parameters

3. Run database migrations:
   ```
   npm run migrate
   ```

4. Start the server:
   ```
   npm run dev
   ```

## Project Structure

- `_src/auth`: OAuth server implementation
- `_src/db`: Database models and connection utilities
- `client-app`: Sample OAuth client implementation
- `docs-condensed`: OAuth2 protocol documentation

## Key Features

- OAuth 2.0 authorization code flow
- Username and password authentication
- Single sign-on across multiple applications
- Automatic session invalidation on password change
- Secure token management
- Refresh token support

## Usage

### Server

The server exposes the following OAuth2 endpoints:

- Authorization: `/oauth/authorize`
- Token: `/oauth/token`
- Token Revocation: `/oauth/revoke`
- User Info: `/oauth/userinfo`

### Client Registration

Register a new OAuth client with:

```
POST /oauth/clients
{
    "name": "Example Client",
    "redirectUri": "https://example.com/callback"
}
```

## Running the Client Application

### Setup and Configuration

1. Ensure the OAuth server is running on port 3000
2. Host the client application:
   ```
   # Using any HTTP server, e.g. Node http-server:
   npx http-server client-app -p 8080
   ```
3. Access the client at `http://localhost:8080`

### Client Configuration

The client is pre-configured with:
- Client ID: `confidential-client`
- Client Secret: `client-secret`
- Redirect URI: `http://localhost:8080/`

You can modify these settings in `client-app/index.html` if needed.

### Client Usage Flow

1. Click "Login with SSO" to initiate authorization
2. Enter credentials on the OAuth server login screen
3. After successful authorization, you'll be redirected back to the client
4. The client exchanges the authorization code for tokens
5. Access token is used for API requests
6. Click "Logout" to end the session

### Creating Additional Client Applications

To add more client applications:

1. Register a new client with the OAuth server:
   ```
   POST /oauth/clients
   {
     "name": "Another Client",
     "redirectUri": "http://localhost:8081/callback"
   }
   ```
2. Copy `client-app/index.html` to a new directory
3. Update the client configuration section (lines 76-83) with the new client ID and secret
4. Host the new client on a different port:
   ```
   npx http-server another-client -p 8081
   ```
5. Access the new client at `http://localhost:8081`

Both clients will share the SSO session, allowing users to authenticate once and access both applications.

## Security Features

- Password hashing using bcrypt
- PKCE support for public clients
- Automatic token invalidation when passwords change
- Token expiration and refresh capabilities
- Cross-site request forgery protection