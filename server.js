const express = require('express');
const session = require('express-session');
const multer = require('multer');
const csvParser = require('csv-parser');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const { pool, initDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Setup upload directory
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({ dest: uploadDir });

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'blood_donor_portal_secret_2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    sameSite: 'lax'
  }
}));

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));

// Admin Auth Middleware
function requireAdmin(req, res, next) {
  if (req.session && req.session.admin) {
    return next();
  }
  return res.status(401).json({ success: false, error: 'Unauthorized. Admin login required.' });
}

// ----------------- ADMIN API ROUTES -----------------

// Admin Login
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password are required.' });
    }

    const userRes = await pool.query('SELECT * FROM admin_users WHERE LOWER(username) = LOWER($1)', [username.trim()]);
    if (userRes.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid username or password.' });
    }

    const adminUser = userRes.rows[0];
    const isMatch = await bcrypt.compare(password, adminUser.password_hash);

    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid username or password.' });
    }

    req.session.admin = {
      id: adminUser.id,
      username: adminUser.username
    };

    return res.json({ success: true, message: 'Logged in successfully.', username: adminUser.username });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error during login.' });
  }
});

// Admin Status
app.get('/api/admin/status', (req, res) => {
  if (req.session && req.session.admin) {
    return res.json({ loggedIn: true, username: req.session.admin.username });
  }
  return res.json({ loggedIn: false });
});

// Admin Logout
app.post('/api/admin/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ success: false, error: 'Failed to log out.' });
    }
    res.clearCookie('connect.sid');
    return res.json({ success: true, message: 'Logged out successfully.' });
  });
});

// Change Admin Username and Password
app.post('/api/admin/change-credentials', requireAdmin, async (req, res) => {
  try {
    const { currentPassword, newUsername, newPassword } = req.body;
    if (!currentPassword) {
      return res.status(400).json({ success: false, error: 'Current password is required to make changes.' });
    }

    const adminId = req.session.admin.id;
    const userRes = await pool.query('SELECT * FROM admin_users WHERE id = $1', [adminId]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Admin account not found.' });
    }

    const adminUser = userRes.rows[0];
    const isMatch = await bcrypt.compare(currentPassword, adminUser.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Current password is incorrect.' });
    }

    let updatedUsername = adminUser.username;
    let updatedPasswordHash = adminUser.password_hash;

    if (newUsername && newUsername.trim() !== '') {
      const trimmedUser = newUsername.trim();
      // Check if username taken by another user
      const existing = await pool.query('SELECT id FROM admin_users WHERE LOWER(username) = LOWER($1) AND id != $2', [trimmedUser, adminId]);
      if (existing.rows.length > 0) {
        return res.status(400).json({ success: false, error: 'Username is already taken by another user.' });
      }
      updatedUsername = trimmedUser;
    }

    if (newPassword && newPassword.trim() !== '') {
      if (newPassword.length < 6) {
        return res.status(400).json({ success: false, error: 'New password must be at least 6 characters long.' });
      }
      const salt = await bcrypt.genSalt(10);
      updatedPasswordHash = await bcrypt.hash(newPassword, salt);
    }

    await pool.query(
      'UPDATE admin_users SET username = $1, password_hash = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
      [updatedUsername, updatedPasswordHash, adminId]
    );

    req.session.admin.username = updatedUsername;

    return res.json({
      success: true,
      message: 'Admin credentials updated successfully!',
      username: updatedUsername
    });
  } catch (err) {
    console.error('Credential change error:', err);
    return res.status(500).json({ success: false, error: 'Failed to update admin credentials.' });
  }
});

// CSV Upload & Parsing Endpoint
app.post('/api/admin/upload-csv', requireAdmin, upload.single('csvFile'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No CSV file uploaded.' });
  }

  const filePath = req.file.path;
  const results = [];
  const columnSet = new Set();
  const columnValueCounts = {};

  fs.createReadStream(filePath)
    .pipe(csvParser({
      mapHeaders: ({ header }) => header.trim().replace(/^[\uFEFF\uFFFE]/, '') // remove UTF-8 BOM if present
    }))
    .on('data', (row) => {
      const cleanRow = {};
      let rowSearchTextParts = [];

      Object.keys(row).forEach(colKey => {
        const cleanKey = colKey.trim();
        if (!cleanKey) return;
        const val = row[colKey] ? row[colKey].toString().trim() : '';

        columnSet.add(cleanKey);
        cleanRow[cleanKey] = val;

        if (val) {
          rowSearchTextParts.push(val);

          // Track unique values per column for filter dropdown building
          if (!columnValueCounts[cleanKey]) {
            columnValueCounts[cleanKey] = new Set();
          }
          if (val.length <= 100) { // store distinct values for filters
            columnValueCounts[cleanKey].add(val);
          }
        }
      });

      if (Object.keys(cleanRow).length > 0) {
        results.push({
          data: cleanRow,
          search_text: rowSearchTextParts.join(' | ')
        });
      }
    })
    .on('end', async () => {
      // Cleanup temporary file
      fs.unlink(filePath, (err) => {
        if (err) console.error('Failed to delete temp file:', err);
      });

      if (results.length === 0) {
        return res.status(400).json({ success: false, error: 'Uploaded CSV file contains no valid rows or data.' });
      }

      const columns = Array.from(columnSet);
      const filterableOptions = {};

      columns.forEach(col => {
        const uniqueValuesSet = columnValueCounts[col];
        if (uniqueValuesSet && uniqueValuesSet.size > 0 && uniqueValuesSet.size <= 200) {
          filterableOptions[col] = Array.from(uniqueValuesSet).sort();
        }
      });

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Clear existing data
        await client.query('DELETE FROM data_records');
        await client.query('DELETE FROM data_schema');

        // Batch Insert Data Records
        const insertText = 'INSERT INTO data_records (data, search_text) VALUES ($1, $2)';
        for (const record of results) {
          await client.query(insertText, [JSON.stringify(record.data), record.search_text]);
        }

        // Save Schema
        await client.query(
          'INSERT INTO data_schema (columns, filterable_options, total_records) VALUES ($1, $2, $3)',
          [JSON.stringify(columns), JSON.stringify(filterableOptions), results.length]
        );

        await client.query('COMMIT');

        return res.json({
          success: true,
          message: `Successfully processed and saved ${results.length} data records!`,
          totalRecords: results.length,
          columns,
          filterableOptions
        });
      } catch (dbErr) {
        await client.query('ROLLBACK');
        console.error('Database transaction error during CSV upload:', dbErr);
        return res.status(500).json({ success: false, error: 'Database transaction failed during CSV import.' });
      } finally {
        client.release();
      }
    })
    .on('error', (parseErr) => {
      fs.unlink(filePath, () => {});
      console.error('CSV Parsing error:', parseErr);
      return res.status(400).json({ success: false, error: 'Failed to parse CSV file. Please verify CSV syntax.' });
    });
});

// Clear Data Records
app.post('/api/admin/clear-data', requireAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM data_records');
    await client.query('DELETE FROM data_schema');
    await client.query('COMMIT');
    return res.json({ success: true, message: 'All database data records cleared.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Clear data error:', err);
    return res.status(500).json({ success: false, error: 'Failed to clear database records.' });
  } finally {
    client.release();
  }
});

// ----------------- PUBLIC API ROUTES -----------------

// Fetch active dataset schema & dynamic filter options
app.get('/api/schema', async (req, res) => {
  try {
    const schemaRes = await pool.query('SELECT columns, filterable_options, total_records, uploaded_at FROM data_schema ORDER BY id DESC LIMIT 1');
    if (schemaRes.rows.length === 0) {
      return res.json({
        success: true,
        columns: [],
        filterableOptions: {},
        totalRecords: 0
      });
    }

    const schema = schemaRes.rows[0];
    return res.json({
      success: true,
      columns: schema.columns || [],
      filterableOptions: schema.filterable_options || {},
      totalRecords: schema.total_records || 0,
      uploadedAt: schema.uploaded_at
    });
  } catch (err) {
    console.error('Fetch schema error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch search metadata schema.' });
  }
});

// Dynamic Data Search
app.get('/api/search', async (req, res) => {
  try {
    const queryStr = req.query.q ? req.query.q.toString().trim() : '';
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    let filterParams = {};
    if (req.query.filters) {
      try {
        filterParams = typeof req.query.filters === 'string' ? JSON.parse(req.query.filters) : req.query.filters;
      } catch (e) {
        filterParams = {};
      }
    }

    const whereConditions = [];
    const values = [];
    let paramIndex = 1;

    // Search Query Keyword filter across search_text
    if (queryStr) {
      whereConditions.push(`search_text ILIKE $${paramIndex}`);
      values.push(`%${queryStr}%`);
      paramIndex++;
    }

    // Specific Column Filters (JSONB match)
    if (filterParams && typeof filterParams === 'object') {
      Object.keys(filterParams).forEach(col => {
        const val = filterParams[col];
        if (val !== undefined && val !== null && val !== '') {
          whereConditions.push(`data ->> $${paramIndex} ILIKE $${paramIndex + 1}`);
          values.push(col);
          values.push(val);
          paramIndex += 2;
        }
      });
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Total Count query
    const countSql = `SELECT COUNT(*) FROM data_records ${whereClause}`;
    const countRes = await pool.query(countSql, values);
    const totalRecords = parseInt(countRes.rows[0].count, 10);

    // Data query with pagination
    const dataSql = `SELECT id, data FROM data_records ${whereClause} ORDER BY id ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    const dataValues = [...values, limit, offset];
    const dataRes = await pool.query(dataSql, dataValues);

    const totalPages = Math.ceil(totalRecords / limit) || 1;

    return res.json({
      success: true,
      records: dataRes.rows.map(r => ({ id: r.id, ...r.data })),
      pagination: {
        page,
        limit,
        totalRecords,
        totalPages
      }
    });
  } catch (err) {
    console.error('Search error:', err);
    return res.status(500).json({ success: false, error: 'Failed to perform search.' });
  }
});

// Start Server after initializing DB
initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`=================================================`);
      console.log(`Server running at http://localhost:${PORT}`);
      console.log(`=================================================`);
    });
  })
  .catch(err => {
    console.error('Failed to start server due to DB connection failure:', err);
  });
