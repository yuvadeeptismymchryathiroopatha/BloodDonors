const express = require('express');
const router = express.Router();
const multer = require('multer');
const pool = require('../db');
const { authenticateAdmin } = require('../middleware/auth');

const storage = multer.memoryStorage();
const upload = multer({ storage });

// GET /api/donors - Public search donors
router.get('/', async (req, res) => {
  try {
    const { bloodGroup, city, search, availableOnly } = req.query;

    let query = `SELECT id, name, age, gender, blood_group, phone, email, city, address, last_donation_date, is_available, status, created_at FROM donors WHERE status = 'Approved'`;
    const params = [];

    if (bloodGroup && bloodGroup !== 'All') {
      params.push(bloodGroup);
      query += ` AND blood_group = $${params.length}`;
    }

    if (city && city.trim() !== '') {
      params.push(`%${city.trim()}%`);
      query += ` AND (city ILIKE $${params.length} OR address ILIKE $${params.length})`;
    }

    if (search && search.trim() !== '') {
      params.push(`%${search.trim()}%`);
      query += ` AND (name ILIKE $${params.length} OR city ILIKE $${params.length} OR blood_group ILIKE $${params.length})`;
    }

    if (availableOnly === 'true') {
      query += ` AND is_available = TRUE`;
    }

    query += ` ORDER BY created_at DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching donors:', error);
    res.status(500).json({ error: 'Failed to retrieve donors.' });
  }
});

// GET /api/donors/sample-csv - Download sample CSV file template
router.get('/sample-csv', (req, res) => {
  const sampleCsvContent = `name,age,gender,blood_group,phone,email,city,address,last_donation_date,is_available
Robert Johnson,30,Male,O+,+1 555-9012,robert@example.com,Downtown,100 High St,2026-05-10,true
Maria Garcia,26,Female,A-,+1 555-8901,maria@example.com,Westside,456 Elm St,2026-06-12,true
James Smith,34,Male,B+,+1 555-7890,james@example.com,North Park,789 Broad Ave,2026-04-01,true
Linda Davis,29,Female,AB+,+1 555-6789,linda@example.com,Eastside,321 Pine Rd,2026-07-15,true`;

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="sample_donors.csv"');
  res.send(sampleCsvContent);
});

// POST /api/donors/bulk - Admin Bulk Insert Donors from parsed CSV
router.post('/bulk', authenticateAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { donors } = req.body;

    if (!Array.isArray(donors) || donors.length === 0) {
      return res.status(400).json({ error: 'Invalid payload. Array of donors required.' });
    }

    await client.query('BEGIN');

    let insertedCount = 0;
    for (const d of donors) {
      if (!d.name || !d.blood_group || !d.phone || !d.city) continue;

      const query = `
        INSERT INTO donors (name, age, gender, blood_group, phone, email, city, address, last_donation_date, is_available, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'Approved')
      `;

      const values = [
        d.name.toString().trim(),
        parseInt(d.age || 25, 10),
        d.gender || 'Male',
        d.blood_group.toString().trim().toUpperCase(),
        d.phone.toString().trim(),
        d.email ? d.email.toString().trim() : null,
        d.city.toString().trim(),
        d.address ? d.address.toString().trim() : null,
        d.last_donation_date || null,
        d.is_available === false || d.is_available === 'false' ? false : true
      ];

      await client.query(query, values);
      insertedCount++;
    }

    await client.query('COMMIT');

    res.json({
      message: `Successfully imported ${insertedCount} donors into database!`,
      count: insertedCount
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error importing bulk donors:', error);
    res.status(500).json({ error: 'Failed to import CSV donor records.' });
  } finally {
    client.release();
  }
});

// POST /api/donors - Public register single donor
router.post('/', async (req, res) => {
  try {
    const { name, age, gender, bloodGroup, phone, email, city, address, lastDonationDate, isAvailable } = req.body;

    if (!name || !age || !gender || !bloodGroup || !phone || !city) {
      return res.status(400).json({ error: 'Name, age, gender, blood group, phone, and city are required.' });
    }

    const query = `
      INSERT INTO donors (name, age, gender, blood_group, phone, email, city, address, last_donation_date, is_available, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'Approved')
      RETURNING *;
    `;

    const values = [
      name.trim(),
      parseInt(age, 10),
      gender,
      bloodGroup.trim().toUpperCase(),
      phone.trim(),
      email ? email.trim() : null,
      city.trim(),
      address ? address.trim() : null,
      lastDonationDate || null,
      isAvailable !== undefined ? isAvailable : true
    ];

    const result = await pool.query(query, values);
    res.status(201).json({ message: 'Donor registered successfully!', donor: result.rows[0] });
  } catch (error) {
    console.error('Error registering donor:', error);
    res.status(500).json({ error: 'Failed to register donor.' });
  }
});

// GET /api/donors/admin/all - Admin get all donors
router.get('/admin/all', authenticateAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM donors ORDER BY created_at DESC;');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching all donors for admin:', error);
    res.status(500).json({ error: 'Failed to fetch donor list.' });
  }
});

// PUT /api/donors/:id - Admin update donor
router.put('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, age, gender, blood_group, phone, email, city, address, last_donation_date, is_available, status } = req.body;

    const query = `
      UPDATE donors
      SET name = $1, age = $2, gender = $3, blood_group = $4, phone = $5, email = $6, city = $7, address = $8, last_donation_date = $9, is_available = $10, status = $11
      WHERE id = $12
      RETURNING *;
    `;

    const values = [
      name, age, gender, blood_group, phone, email, city, address, last_donation_date, is_available, status, id
    ];

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Donor not found.' });
    }

    res.json({ message: 'Donor updated successfully', donor: result.rows[0] });
  } catch (error) {
    console.error('Error updating donor:', error);
    res.status(500).json({ error: 'Failed to update donor.' });
  }
});

// DELETE /api/donors/:id - Admin delete donor
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM donors WHERE id = $1 RETURNING id;', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Donor not found.' });
    }

    res.json({ message: 'Donor removed successfully.', id });
  } catch (error) {
    console.error('Error deleting donor:', error);
    res.status(500).json({ error: 'Failed to delete donor.' });
  }
});

module.exports = router;
