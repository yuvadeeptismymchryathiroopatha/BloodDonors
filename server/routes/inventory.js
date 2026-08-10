const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateAdmin } = require('../middleware/auth');

// GET /api/inventory - Get current stock levels
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM blood_inventory ORDER BY blood_group ASC;');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching blood inventory:', error);
    res.status(500).json({ error: 'Failed to retrieve blood inventory.' });
  }
});

// PUT /api/inventory - Admin update blood stock level
router.put('/', authenticateAdmin, async (req, res) => {
  try {
    const { bloodGroup, units } = req.body;

    if (!bloodGroup || units === undefined) {
      return res.status(400).json({ error: 'Blood group and units count are required.' });
    }

    const query = `
      INSERT INTO blood_inventory (blood_group, units, updated_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (blood_group)
      DO UPDATE SET units = EXCLUDED.units, updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;

    const result = await pool.query(query, [bloodGroup, parseInt(units, 10)]);
    res.json({ message: 'Inventory updated successfully.', item: result.rows[0] });
  } catch (error) {
    console.error('Error updating blood inventory:', error);
    res.status(500).json({ error: 'Failed to update blood inventory.' });
  }
});

module.exports = router;
