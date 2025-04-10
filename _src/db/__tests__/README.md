# Testing the Database Layer

This directory contains tests for the database models using testcontainers.

## Testing Architecture

We use a combination of:
- **Jest** - Testing framework
- **Testcontainers** - Runs a real PostgreSQL database in Docker containers
- **Real PostgreSQL** - Tests run against an actual PostgreSQL instance

This approach ensures our tests are running against a real PostgreSQL database, allowing us to test features like PL/pgSQL triggers, which in-memory databases often don't support.

## Requirements

- **Docker** must be installed and running on your system
- **Node.js** with npm for running tests

## How the Tests Work

1. When you run `npm test`, a Docker container with PostgreSQL is automatically started
2. Our database schema is loaded into this container
3. The tests run against this real database
4. After all tests complete, the container is automatically stopped and removed

This approach provides:
- Isolated test environment that won't affect your development/production databases
- Tests that run with a real PostgreSQL instance, testing all features including triggers and functions
- Automatic cleanup after tests complete

## Test Files

- **globalSetup.ts** - Starts the PostgreSQL container before all tests
- **globalTeardown.ts** - Stops the container after all tests
- **setupTests.ts** - Runs before each test to clean tables and setup mocks
- **user.test.ts** - Tests for the UserModel
- **client.test.ts** - Tests for the ClientModel
- **accessToken.test.ts** - Tests for the AccessTokenModel

## Running Tests

```
# Install dependencies first
npm install

# Run all tests
npm test

# Run tests and watch for changes
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

## Key Tests to Note

1. **Password Change Tests** - Verify tokens get invalidated when password changes
2. **PKCE Authorization Flow** - Verify code challenge/verifier mechanism
3. **Token Expiration** - Verify expired tokens are rejected
4. **Client Credentials** - Verify client authentication

These tests ensure our core security requirements are met.