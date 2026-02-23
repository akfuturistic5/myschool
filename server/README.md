# PreSkool Server API

Backend API for the PreSkool School Management System built with Express.js and PostgreSQL.

## Features

- ✅ PostgreSQL database connection with connection pooling
- ✅ Express.js REST API
- ✅ Health check endpoints
- ✅ Database connection testing
- ✅ Security middleware (Helmet, CORS)
- ✅ Request logging (Morgan)
- ✅ Environment configuration
- ✅ Graceful error handling

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL database
- npm or yarn

## Database Setup

Make sure you have PostgreSQL installed and running. Configure your database credentials in `.env` (see `.env.example`).

## Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables:
   ```bash
   cp env.example .env
   ```
   
   Edit the `.env` file with your database credentials if different from defaults.

3. Start the development server:
   ```bash
   npm run dev
   ```

4. For production:
   ```bash
   npm start
   ```

## API Endpoints

### Health Check
- `GET /` - Server status and information
- `GET /api/health` - Comprehensive health check including database status
- `GET /api/health/database` - Database connection and query test

## Project Structure

```
server/
├── src/
│   ├── config/
│   │   ├── database.js      # Database configuration and connection
│   │   └── server.js        # Server configuration
│   ├── controllers/
│   │   └── healthController.js  # Health check controllers
│   ├── routes/
│   │   └── healthRoutes.js      # Health check routes
│   ├── middleware/          # Custom middleware (future)
│   └── utils/              # Utility functions (future)
├── server.js               # Main server file
├── package.json
├── .env                    # Environment variables
└── README.md
```

## Database Connection

The server uses PostgreSQL with connection pooling for optimal performance. The connection is tested on startup and will prevent the server from starting if the database is not accessible.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| NODE_ENV | development | Environment mode |
| PORT | 5000 | Server port |
| DB_HOST | localhost | Database host |
| DB_PORT | 5432 | Database port |
| DB_NAME | schooldb | Database name |
| DB_USER | schooluser | Database username |
| DB_PASSWORD | (set in .env) | Database password |
| JWT_SECRET | your-super-secret-jwt-key-change-this-in-production | JWT secret key |
| JWT_EXPIRES_IN | 7d | JWT expiration time |
| CORS_ORIGIN | http://localhost:3000 | CORS allowed origin |
| LOG_LEVEL | debug | Logging level |

## Testing the Connection

Once the server is running, you can test the database connection by visiting:

- http://localhost:5000/api/health
- http://localhost:5000/api/health/database

These endpoints will show you the connection status and test basic database queries.
