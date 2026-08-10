const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/stats - Aggregate system stats
router.get('/', async (req, res) => {
  try {
    const donorsCountRes = await pool.query('SELECT COUNT(*) FROM donors;');
    const availDonorsRes = await pool.query('SELECT COUNT(*) FROM donors WHERE is_available = TRUE;');
    const pendingReqRes = await pool.query("SELECT COUNT(*) FROM blood_requests WHERE status = 'Pending';");
    const emergencyReqRes = await pool.query("SELECT COUNT(*) FROM blood_requests WHERE urgency = 'Emergency' AND status = 'Pending';");
    const unitsRes = await pool.query('SELECT SUM(units) FROM blood_inventory;');

    res.json({
      totalDonors: parseInt(donorsCountRes.rows[0].count, 10),
      availableDonors: parseInt(availDonorsRes.rows[0].count, 10),
      pendingRequests: parseInt(pendingReqRes.rows[0].count, 10),
      emergencyRequests: parseInt(emergencyReqRes.rows[0].count, 10),
      totalBloodUnits: parseInt(unitsRes.rows[0].sum || 0, 10)
    });
  } catch (error) {
    console.error('Error fetching system stats:', error);
    res.status(500).json({ error: 'Failed to retrieve metrics.' });
  }
});

module.exports = router;
