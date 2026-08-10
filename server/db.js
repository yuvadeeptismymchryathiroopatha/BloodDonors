const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.on('connect', () => {
  console.log('Connected to PostgreSQL Database (Neon)');
});

pool.on('error', (err) => {
  console.error('Unexpected database connection error:', err);
});

module.exports = pool;
