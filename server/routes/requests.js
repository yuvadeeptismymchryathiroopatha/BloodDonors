const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateAdmin } = require('../middleware/auth');

// GET /api/requests - Public list of active requests
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM blood_requests ORDER BY CASE WHEN urgency = 'Emergency' THEN 1 ELSE 2 END, created_at DESC;`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching blood requests:', error);
    res.status(500).json({ error: 'Failed to retrieve blood requests.' });
  }
});

// POST /api/requests - Public submit urgent request
router.post('/', async (req, res) => {
  try {
    const { patientName, bloodGroup, unitsNeeded, hospitalName, city, contactName, contactPhone, urgency, details } = req.body;

    if (!patientName || !bloodGroup || !hospitalName || !city || !contactName || !contactPhone) {
      return res.status(400).json({ error: 'Please provide all required request details.' });
    }

    const query = `
      INSERT INTO blood_requests (patient_name, blood_group, units_needed, hospital_name, city, contact_name, contact_phone, urgency, status, details)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Pending', $9)
      RETURNING *;
    `;

    const values = [
      patientName.trim(),
      bloodGroup,
      parseInt(unitsNeeded || 1, 10),
      hospitalName.trim(),
      city.trim(),
      contactName.trim(),
      contactPhone.trim(),
      urgency || 'Normal',
      details ? details.trim() : ''
    ];

    const result = await pool.query(query, values);
    res.status(201).json({ message: 'Blood request submitted successfully!', request: result.rows[0] });
  } catch (error) {
    console.error('Error creating blood request:', error);
    res.status(500).json({ error: 'Failed to submit blood request.' });
  }
});

// PUT /api/requests/:id - Admin update request status
router.put('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, urgency, units_needed } = req.body;

    const query = `
      UPDATE blood_requests
      SET status = COALESCE($1, status), urgency = COALESCE($2, urgency), units_needed = COALESCE($3, units_needed)
      WHERE id = $4
      RETURNING *;
    `;

    const result = await pool.query(query, [status, urgency, units_needed, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Blood request not found.' });
    }

    res.json({ message: 'Blood request updated.', request: result.rows[0] });
  } catch (error) {
    console.error('Error updating blood request:', error);
    res.status(500).json({ error: 'Failed to update blood request.' });
  }
});

// DELETE /api/requests/:id - Admin delete request
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM blood_requests WHERE id = $1 RETURNING id;', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found.' });
    }

    res.json({ message: 'Request removed.', id });
  } catch (error) {
    console.error('Error deleting blood request:', error);
    res.status(500).json({ error: 'Failed to delete blood request.' });
  }
});

module.exports = router;
