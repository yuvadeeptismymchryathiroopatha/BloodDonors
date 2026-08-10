const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { authenticateAdmin } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretblooddonationskey2026_antigravity';

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const result = await pool.query('SELECT * FROM users WHERE username = $1;', [username.trim()]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Error during login:', error);
    return res.status(500).json({ error: 'Internal server error during login.' });
  }
});

// GET /api/auth/me
router.get('/me', authenticateAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, role, created_at, updated_at FROM users WHERE id = $1;', [req.user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Admin user not found.' });
    }
    return res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Error fetching admin profile:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// PUT /api/auth/update-credentials
// Admin change username and/or password
router.put('/update-credentials', authenticateAdmin, async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newUsername, newPassword } = req.body;

    if (!currentPassword) {
      return res.status(400).json({ error: 'Current password is required to update credentials.' });
    }

    // 1. Verify user exists and verify current password
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1;', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const user = userResult.rows[0];
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Incorrect current password.' });
    }

    let updatedUsername = user.username;
    let updatedPasswordHash = user.password_hash;

    // 2. Check and validate new username
    if (newUsername && newUsername.trim() !== '') {
      const trimmedUsername = newUsername.trim();
      if (trimmedUsername !== user.username) {
        // Check if username is already taken
        const checkUsername = await pool.query('SELECT id FROM users WHERE username = $1 AND id != $2;', [trimmedUsername, userId]);
        if (checkUsername.rows.length > 0) {
          return res.status(400).json({ error: 'Username is already taken by another account.' });
        }
        updatedUsername = trimmedUsername;
      }
    }

    // 3. Check and validate new password
    if (newPassword && newPassword.trim() !== '') {
      if (newPassword.trim().length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
      }
      updatedPasswordHash = await bcrypt.hash(newPassword.trim(), 10);
    }

    // 4. Update in Database
    const updateResult = await pool.query(
      `UPDATE users 
       SET username = $1, password_hash = $2, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $3 
       RETURNING id, username, role, updated_at;`,
      [updatedUsername, updatedPasswordHash, userId]
    );

    const updatedUser = updateResult.rows[0];

    // Generate fresh JWT token with updated username
    const newToken = jwt.sign(
      { id: updatedUser.id, username: updatedUser.username, role: updatedUser.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.json({
      message: 'Admin credentials updated successfully!',
      token: newToken,
      user: updatedUser
    });
  } catch (error) {
    console.error('Error updating credentials:', error);
    return res.status(500).json({ error: 'Internal server error while updating credentials.' });
  }
});

module.exports = router;
