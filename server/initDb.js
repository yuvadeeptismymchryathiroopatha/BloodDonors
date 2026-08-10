const pool = require('./db');
const bcrypt = require('bcryptjs');

async function initDb() {
  const client = await pool.connect();
  try {
    console.log('Initializing database schema...');

    // 1. Users table (Admin accounts)
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'admin',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Donors table
    await client.query(`
      CREATE TABLE IF NOT EXISTS donors (
        id SERIAL PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        age INT NOT NULL,
        gender VARCHAR(20) NOT NULL,
        blood_group VARCHAR(10) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        email VARCHAR(150),
        city VARCHAR(100) NOT NULL,
        address TEXT,
        last_donation_date DATE,
        is_available BOOLEAN DEFAULT TRUE,
        status VARCHAR(20) DEFAULT 'Approved',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Blood Requests table
    await client.query(`
      CREATE TABLE IF NOT EXISTS blood_requests (
        id SERIAL PRIMARY KEY,
        patient_name VARCHAR(150) NOT NULL,
        blood_group VARCHAR(10) NOT NULL,
        units_needed INT DEFAULT 1,
        hospital_name VARCHAR(200) NOT NULL,
        city VARCHAR(100) NOT NULL,
        contact_name VARCHAR(150) NOT NULL,
        contact_phone VARCHAR(50) NOT NULL,
        urgency VARCHAR(20) DEFAULT 'Normal',
        status VARCHAR(30) DEFAULT 'Pending',
        details TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 4. Blood Inventory table
    await client.query(`
      CREATE TABLE IF NOT EXISTS blood_inventory (
        id SERIAL PRIMARY KEY,
        blood_group VARCHAR(10) UNIQUE NOT NULL,
        units INT DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Seed default Admin if no admin exists
    const adminCheck = await client.query(`SELECT * FROM users WHERE role = 'admin' LIMIT 1;`);
    if (adminCheck.rows.length === 0) {
      console.log('Seeding default Admin account (username: admin)...');
      const hashedPassword = await bcrypt.hash('adminpassword123', 10);
      await client.query(
        `INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3);`,
        ['admin', hashedPassword, 'admin']
      );
      console.log('Default admin seeded successfully.');
    }

    // Seed Blood Inventory standard blood groups if empty
    const inventoryCheck = await client.query(`SELECT COUNT(*) FROM blood_inventory;`);
    if (parseInt(inventoryCheck.rows[0].count, 10) === 0) {
      console.log('Seeding initial blood inventory...');
      const groups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
      const defaultUnits = [12, 5, 18, 4, 8, 3, 25, 7];
      for (let i = 0; i < groups.length; i++) {
        await client.query(
          `INSERT INTO blood_inventory (blood_group, units) VALUES ($1, $2);`,
          [groups[i], defaultUnits[i]]
        );
      }
    }

    // Seed mock donors if empty for rich initial app experience
    const donorCheck = await client.query(`SELECT COUNT(*) FROM donors;`);
    if (parseInt(donorCheck.rows[0].count, 10) === 0) {
      console.log('Seeding sample donors...');
      const sampleDonors = [
        ['John Doe', 28, 'Male', 'O+', '+1 555-0192', 'john@example.com', 'Downtown', '123 Main St', '2026-05-15', true, 'Approved'],
        ['Sarah Smith', 32, 'Female', 'A+', '+1 555-0143', 'sarah@example.com', 'North Park', '456 Oak Ave', '2026-06-10', true, 'Approved'],
        ['Michael Johnson', 25, 'Male', 'B+', '+1 555-0188', 'michael@example.com', 'Westside', '789 Pine Rd', '2026-04-20', true, 'Approved'],
        ['Emily Davis', 29, 'Female', 'O-', '+1 555-0111', 'emily@example.com', 'Downtown', '101 Maple St', '2026-07-01', true, 'Approved'],
        ['David Wilson', 35, 'Male', 'AB+', '+1 555-0177', 'david@example.com', 'East End', '202 Cedar St', '2026-03-12', true, 'Approved']
      ];
      for (const d of sampleDonors) {
        await client.query(
          `INSERT INTO donors (name, age, gender, blood_group, phone, email, city, address, last_donation_date, is_available, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);`,
          d
        );
      }
    }

    // Seed mock blood requests if empty
    const reqCheck = await client.query(`SELECT COUNT(*) FROM blood_requests;`);
    if (parseInt(reqCheck.rows[0].count, 10) === 0) {
      console.log('Seeding sample blood requests...');
      const sampleRequests = [
        ['Robert Miller', 'O+', 2, 'City General Hospital', 'Downtown', 'Clara Miller', '+1 555-0999', 'Emergency', 'Pending', 'Urgent need for surgery tomorrow.'],
        ['Anita Patel', 'A-', 1, 'St. Jude Memorial Hospital', 'North Park', 'Rahul Patel', '+1 555-0888', 'Normal', 'Pending', 'Scheduled transfusion needed.']
      ];
      for (const r of sampleRequests) {
        await client.query(
          `INSERT INTO blood_requests (patient_name, blood_group, units_needed, hospital_name, city, contact_name, contact_phone, urgency, status, details)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);`,
          r
        );
      }
    }

    console.log('Database initialization completed successfully.');
  } catch (error) {
    console.error('Error during database initialization:', error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = initDb;
