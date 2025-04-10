# Core
- Database
    - Users
    - Clients
    - Access Tokens
    - Refresh Tokens
    - Auth Codes

- OAuth2 implementation
    - API endpoints
    - Core logic
    - Flow orchestration
    - Error handling & responses


# Framework
    - PostgreSQL
    - Typescript
    - VueJS


# Database implementation
    - schema.sql - build db
    - database.ts - connect TS with SQL
    - /models - db
        - user.ts
        - client.ts
        - accessToken.ts
        - refreshToken.ts
        - authCode.ts

# Database Tables for OAuth2 SSO

## 1. Users Table
- `id` (UUID, Primary Key)
- `username` (VARCHAR, Unique, Not Null)
- `password_hash` (VARCHAR, Not Null)
- `password_changed_at` (TIMESTAMP, Not Null) - Crucial for invalidating sessions
- `created_at` (TIMESTAMP, Not Null)
- `updated_at` (TIMESTAMP, Not Null)

## 2. Clients Table
- `id` (UUID, Primary Key)
- `client_id` (VARCHAR, Unique, Not Null) - The OAuth client identifier
- `client_secret` (VARCHAR) - Null for public clients
- `client_type` (VARCHAR, Not Null) - 'confidential' or 'public'
- `redirect_uris` (TEXT[], Not Null) - Array of allowed redirect URIs
- `created_at` (TIMESTAMP, Not Null)

## 3. Access Tokens Table
- `id` (UUID, Primary Key)
- `token` (VARCHAR, Unique, Not Null)
- `user_id` (UUID, Foreign Key to Users)
- `client_id` (UUID, Foreign Key to Clients)
- `expires_at` (TIMESTAMP, Not Null)
- `scope` (VARCHAR)
- `created_at` (TIMESTAMP, Not Null)

## 4. Refresh Tokens Table
- `id` (UUID, Primary Key)
- `token` (VARCHAR, Unique, Not Null)
- `user_id` (UUID, Foreign Key to Users)
- `client_id` (UUID, Foreign Key to Clients)
- `expires_at` (TIMESTAMP, Not Null)
- `scope` (VARCHAR)
- `created_at` (TIMESTAMP, Not Null)

## 5. Authorization Codes Table
- `id` (UUID, Primary Key)
- `code` (VARCHAR, Unique, Not Null)
- `user_id` (UUID, Foreign Key to Users)
- `client_id` (UUID, Foreign Key to Clients)
- `redirect_uri` (TEXT, Not Null)
- `expires_at` (TIMESTAMP, Not Null)
- `scope` (VARCHAR)
- `code_challenge` (VARCHAR) - For PKCE
- `code_challenge_method` (VARCHAR) - 'S256' or 'plain'
- `created_at` (TIMESTAMP, Not Null)


Access Token = Temporary day pass (expires quickly)
Refresh Token = Special renewal card (get new day passes without going to front desk)
Authorization Code = Receipt you get when first checking in (exchange for your cards)
Code Challenge = Security measure that makes sure only YOU can use your receipt