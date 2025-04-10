# OAuth2 SSO Implementation Plan

## Core Components

### 1. Server Setup
- Express server config
- Session middleware
- View engine (EJS)
- Error handling

### 2. Routes & Endpoints
- `/oauth/authorize` - Main entry point for auth flow
- `/oauth/token` - Token exchange
- `/auth/login` - Login form
- `/auth/consent` - Consent form
- `/test-client` - Simple test client

### 3. Database Integration
- Use existing models from `_src/db`
- No schema changes required

## Implementation Checklist

### Phase 1: Authorization Flow (30 min)
- [ ] Basic Express server setup
- [ ] Authorization endpoint with validation:
  - [ ] client_id validation
  - [ ] redirect_uri validation  
  - [ ] response_type validation
  - [ ] state parameter handling
  - [ ] scope validation
  - [ ] PKCE parameter validation
- [ ] Login form (HTML template)
- [ ] User authentication logic
- [ ] Authorization code generation
- [ ] Consent form (HTML template)

### Phase 2: Token Exchange (30 min)
- [ ] Token endpoint with validation:
  - [ ] grant_type validation
  - [ ] client authentication
  - [ ] code validation
  - [ ] PKCE verification
  - [ ] redirect_uri validation
- [ ] Access token generation
- [ ] Refresh token generation
- [ ] Password change verification
- [ ] Token response format

### Phase 3: Test Client & End-to-End Testing (30 min)
- [ ] Static HTML test client
- [ ] Client-side JS for authorization flow
- [ ] Token storage on client
- [ ] Resource access simulation
- [ ] Refresh token usage
- [ ] Session validation

## Technical Decisions

- **Token Format**: Opaque tokens (random strings, not JWT)
- **Storage**: Existing database tables
- **UI**: Server-rendered templates (EJS)
- **Authentication**: Form-based, session cookie after login
- **Security Measures**:
  - PKCE for all clients
  - CSRF protection via state parameter
  - Password change timestamp validation
  - Strict redirect_uri validation

## File Structure

```
_src/auth/
├── server.ts           // Main Express config
├── routes/
│   ├── auth.ts         // Auth-related routes
│   └── oauth.ts        // OAuth endpoints
├── controllers/
│   ├── auth.ts         // Login/consent logic
│   └── oauth.ts        // OAuth flow logic
├── middleware/
│   ├── clientAuth.ts   // Client authentication
│   └── userAuth.ts     // User authentication
├── services/
│   ├── oauth.ts        // Core OAuth business logic
│   └── token.ts        // Token generation/validation
├── utils/
│   ├── crypto.ts       // PKCE, token generation
│   └── validation.ts   // Input validation
├── views/
│   ├── login.ejs       // Login form
│   └── consent.ejs     // Consent form
└── public/
    └── test-client/    // Demo client application