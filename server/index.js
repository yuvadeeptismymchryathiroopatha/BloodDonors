const express = require('express');
const cors = require('cors');
require('dotenv').config();
const initDb = require('./initDb');

const authRoutes = require('./routes/auth');
const donorRoutes = require('./routes/donors');
const requestRoutes = require('./routes/requests');
const inventoryRoutes = require('./routes/inventory');
const statsRoutes = require('./routes/stats');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/donors', donorRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/stats', statsRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Blood Donation API is running smoothly.', timestamp: new Date() });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err.stack);
  res.status(500).json({ error: 'An unexpected internal server error occurred.' });
});

// Initialize database and start server
initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`================================================`);
      console.log(`Blood Donation Backend Server active on port ${PORT}`);
      console.log(`Database connected: Neon PostgreSQL`);
      console.log(`================================================`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database. Server launch aborted.', err);
    process.exit(1);
  });
