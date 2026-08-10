const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is missing in environment variables');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

async function initDb() {
  const client = await pool.connect();
  try {
    console.log('Connecting to PostgreSQL database and initializing tables...');
    
    // Create admin_users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create data_records table
    await client.query(`
      CREATE TABLE IF NOT EXISTS data_records (
        id SERIAL PRIMARY KEY,
        data JSONB NOT NULL,
        search_text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Index for fast search
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_data_records_search ON data_records USING gin(data);
    `);

    // Create data_schema table
    await client.query(`
      CREATE TABLE IF NOT EXISTS data_schema (
        id SERIAL PRIMARY KEY,
        columns JSONB NOT NULL,
        filterable_options JSONB NOT NULL,
        total_records INTEGER DEFAULT 0,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Seed default admin if no admin exists
    const res = await client.query('SELECT COUNT(*) FROM admin_users');
    if (parseInt(res.rows[0].count, 10) === 0) {
      const defaultUsername = 'smymChry@blood';
      const defaultPassword = "It'sAdmin@2026";
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(defaultPassword, salt);

      await client.query(
        'INSERT INTO admin_users (username, password_hash) VALUES ($1, $2)',
        [defaultUsername, hash]
      );
      console.log(`Default admin user seeded: ${defaultUsername}`);
    } else {
      console.log('Admin user exists in database.');
    }

    console.log('Database initialization completed successfully.');
  } catch (err) {
    console.error('Error during database initialization:', err);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  initDb
};
