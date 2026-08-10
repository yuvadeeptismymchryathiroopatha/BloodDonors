const express = require('express');
const session = require('express-session');
const multer = require('multer');
const csvParser = require('csv-parser');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const os = require('os');
require('dotenv').config();

const { pool, initDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

const uploadDir = process.env.VERCEL ? os.tmpdir() : path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir) && !process.env.VERCEL) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({ dest: uploadDir });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'blood_donor_portal_secret_2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax'
  }
}));

app.use(express.static(path.join(__dirname, 'public')));

let dbInitPromise = null;
app.use(async (req, res, next) => {
  if (!dbInitPromise) {
    dbInitPromise = initDb().catch(err => {
      console.error('DB init failed in request middleware:', err);
      dbInitPromise = null;
    });
  }
  await dbInitPromise;
  next();
});

function requireAdmin(req, res, next) {
  if (req.session && req.session.admin) {
    return next();
  }
  return res.status(401).json({ success: false, error: 'Unauthorized. Admin login required.' });
}

async function refreshSchemaMetadata(clientOrPool = pool) {
  const allRecordsRes = await clientOrPool.query('SELECT data FROM data_records');
  if (allRecordsRes.rows.length === 0) {
    await clientOrPool.query('DELETE FROM data_schema');
    return { columns: [], filterableOptions: {}, totalRecords: 0 };
  }

  const columnSet = new Set();
  const columnValueCounts = {};

  allRecordsRes.rows.forEach(row => {
    const data = row.data || {};
    Object.keys(data).forEach(col => {
      columnSet.add(col);
      const val = data[col] ? data[col].toString().trim() : '';
      if (val) {
        if (!columnValueCounts[col]) columnValueCounts[col] = new Set();
        if (val.length <= 150) columnValueCounts[col].add(val);
      }
    });
  });

  const columns = Array.from(columnSet);
  const filterableOptions = {};
  columns.forEach(col => {
    const uniqueSet = columnValueCounts[col];
    if (uniqueSet && uniqueSet.size > 0 && uniqueSet.size <= 250) {
      filterableOptions[col] = Array.from(uniqueSet).sort();
    }
  });

  await clientOrPool.query('DELETE FROM data_schema');
  await clientOrPool.query(
    'INSERT INTO data_schema (columns, filterable_options, total_records) VALUES ($1, $2, $3)',
    [JSON.stringify(columns), JSON.stringify(filterableOptions), allRecordsRes.rows.length]
  );

  return { columns, filterableOptions, totalRecords: allRecordsRes.rows.length };
}

// ----------------- ADMIN API ROUTES -----------------

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

app.get('/api/admin/status', (req, res) => {
  if (req.session && req.session.admin) {
    return res.json({ loggedIn: true, username: req.session.admin.username });
  }
  return res.json({ loggedIn: false });
});

app.post('/api/admin/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ success: false, error: 'Failed to log out.' });
    }
    res.clearCookie('connect.sid');
    return res.json({ success: true, message: 'Logged out successfully.' });
  });
});

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

// GET Admin Records
app.get('/api/admin/records', requireAdmin, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;
    const q = req.query.q ? req.query.q.trim() : '';

    let whereClause = '';
    const values = [];

    if (q) {
      whereClause = 'WHERE search_text ILIKE $1';
      values.push(`%${q}%`);
    }

    const countRes = await pool.query(`SELECT COUNT(*) FROM data_records ${whereClause}`, values);
    const totalRecords = parseInt(countRes.rows[0].count, 10);

    const dataSql = `SELECT id, data, created_at FROM data_records ${whereClause} ORDER BY id DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
    const dataRes = await pool.query(dataSql, [...values, limit, offset]);

    return res.json({
      success: true,
      records: dataRes.rows,
      pagination: {
        page,
        limit,
        totalRecords,
        totalPages: Math.ceil(totalRecords / limit) || 1
      }
    });
  } catch (err) {
    console.error('Fetch admin records error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch admin records.' });
  }
});

// MARK DONATION COMPLETED (Sets Last Donation Date and status)
app.post('/api/admin/records/:id/mark-donated', requireAdmin, async (req, res) => {
  try {
    const recordId = parseInt(req.params.id, 10);
    if (isNaN(recordId)) {
      return res.status(400).json({ success: false, error: 'Invalid record ID.' });
    }

    const donationDate = req.body.donationDate || new Date().toISOString().split('T')[0];

    const getRes = await pool.query('SELECT data FROM data_records WHERE id = $1', [recordId]);
    if (getRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Record not found.' });
    }

    const currentData = getRes.rows[0].data || {};
    currentData['Last Donation Date'] = donationDate;
    currentData['Availability'] = `Donated on ${donationDate} (3 Month Cooling Period)`;

    const searchTextParts = Object.values(currentData).map(v => (v || '').toString().trim()).filter(Boolean);
    const searchText = searchTextParts.join(' | ');

    await pool.query(
      'UPDATE data_records SET data = $1, search_text = $2 WHERE id = $3',
      [JSON.stringify(currentData), searchText, recordId]
    );

    await refreshSchemaMetadata();

    return res.json({
      success: true,
      message: `Successfully marked donation completed for record #${recordId} on ${donationDate}!`,
      donationDate
    });
  } catch (err) {
    console.error('Mark donated error:', err);
    return res.status(500).json({ success: false, error: 'Failed to mark donation completed.' });
  }
});

// GET ADMIN ANALYTICS
app.get('/api/admin/analytics', requireAdmin, async (req, res) => {
  try {
    const allRes = await pool.query('SELECT id, data FROM data_records');
    const records = allRes.rows.map(r => r.data);

    const totalRecords = records.length;
    const byZone = {};
    const byForona = {};
    const byBloodGroup = {};
    let eligibleCount = 0;
    let donatedRecentlyCount = 0;

    const now = new Date();

    records.forEach(r => {
      // Zone Breakdown
      const zoneKey = Object.keys(r).find(k => /zone|മേഖല/i.test(k)) || 'Zone (മേഖല)';
      const zoneVal = r[zoneKey] || 'Unassigned Zone';
      byZone[zoneVal] = (byZone[zoneVal] || 0) + 1;

      // Forona Breakdown
      const foronaKey = Object.keys(r).find(k => /forona|ഫൊറോന/i.test(k)) || 'Forona (ഫൊറോന)';
      const foronaVal = r[foronaKey] || 'Unassigned Forona';
      byForona[foronaVal] = (byForona[foronaVal] || 0) + 1;

      // Blood Group Breakdown
      const bgKey = Object.keys(r).find(k => /blood|group|bg/i.test(k)) || 'Blood Group';
      const bgVal = (r[bgKey] || 'Unknown').toString().trim();
      byBloodGroup[bgVal] = (byBloodGroup[bgVal] || 0) + 1;

      // Age & Donation Eligibility
      const ageKey = Object.keys(r).find(k => /age|വയസ്സ്/i.test(k));
      const ageNum = ageKey && r[ageKey] ? parseInt(r[ageKey], 10) : 25;
      const isAgeEligible = isNaN(ageNum) || (ageNum >= 18 && ageNum <= 55);

      let isDonatedRecently = false;
      const donationDateStr = r['Last Donation Date'];
      if (donationDateStr) {
        const dDate = new Date(donationDateStr);
        const diffDays = (now - dDate) / (1000 * 60 * 60 * 24);
        if (diffDays < 90) {
          isDonatedRecently = true;
          donatedRecentlyCount++;
        }
      }

      if (isAgeEligible && !isDonatedRecently) {
        eligibleCount++;
      }
    });

    return res.json({
      success: true,
      totalRecords,
      eligibleCount,
      donatedRecentlyCount,
      byZone,
      byForona,
      byBloodGroup
    });
  } catch (err) {
    console.error('Fetch analytics error:', err);
    return res.status(500).json({ success: false, error: 'Failed to generate analytics.' });
  }
});

// CREATE Single Record
app.post('/api/admin/records', requireAdmin, async (req, res) => {
  try {
    const { data } = req.body;
    if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
      return res.status(400).json({ success: false, error: 'Record data object is required.' });
    }

    const searchTextParts = Object.values(data).map(v => (v || '').toString().trim()).filter(Boolean);
    const searchText = searchTextParts.join(' | ');

    const insertRes = await pool.query(
      'INSERT INTO data_records (data, search_text) VALUES ($1, $2) RETURNING id, data, created_at',
      [JSON.stringify(data), searchText]
    );

    await refreshSchemaMetadata();

    return res.json({
      success: true,
      message: 'Record created successfully!',
      record: insertRes.rows[0]
    });
  } catch (err) {
    console.error('Create record error:', err);
    return res.status(500).json({ success: false, error: 'Failed to create record.' });
  }
});

// UPDATE Single Record
app.put('/api/admin/records/:id', requireAdmin, async (req, res) => {
  try {
    const recordId = parseInt(req.params.id, 10);
    const { data } = req.body;

    if (isNaN(recordId)) {
      return res.status(400).json({ success: false, error: 'Invalid record ID.' });
    }
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ success: false, error: 'Valid record data is required.' });
    }

    const searchTextParts = Object.values(data).map(v => (v || '').toString().trim()).filter(Boolean);
    const searchText = searchTextParts.join(' | ');

    const updateRes = await pool.query(
      'UPDATE data_records SET data = $1, search_text = $2 WHERE id = $3 RETURNING id, data, created_at',
      [JSON.stringify(data), searchText, recordId]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Record not found.' });
    }

    await refreshSchemaMetadata();

    return res.json({
      success: true,
      message: 'Record updated successfully!',
      record: updateRes.rows[0]
    });
  } catch (err) {
    console.error('Update record error:', err);
    return res.status(500).json({ success: false, error: 'Failed to update record.' });
  }
});

// DELETE Single Record
app.delete('/api/admin/records/:id', requireAdmin, async (req, res) => {
  try {
    const recordId = parseInt(req.params.id, 10);
    if (isNaN(recordId)) {
      return res.status(400).json({ success: false, error: 'Invalid record ID.' });
    }

    const deleteRes = await pool.query('DELETE FROM data_records WHERE id = $1 RETURNING id', [recordId]);
    if (deleteRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Record not found.' });
    }

    await refreshSchemaMetadata();

    return res.json({
      success: true,
      message: 'Record deleted successfully!',
      id: recordId
    });
  } catch (err) {
    console.error('Delete record error:', err);
    return res.status(500).json({ success: false, error: 'Failed to delete record.' });
  }
});

// BULK DELETE
app.post('/api/admin/records/bulk-delete', requireAdmin, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'Array of record IDs is required for bulk deletion.' });
    }

    const numericIds = ids.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
    if (numericIds.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid numeric record IDs provided.' });
    }

    const deleteRes = await pool.query(
      'DELETE FROM data_records WHERE id = ANY($1::int[]) RETURNING id',
      [numericIds]
    );

    await refreshSchemaMetadata();

    return res.json({
      success: true,
      count: deleteRes.rows.length,
      message: `Successfully deleted ${deleteRes.rows.length} selected record(s)!`
    });
  } catch (err) {
    console.error('Bulk delete error:', err);
    return res.status(500).json({ success: false, error: 'Failed to perform bulk deletion.' });
  }
});

// CSV Upload Endpoint
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
      mapHeaders: ({ header }) => header.trim().replace(/^[\uFEFF\uFFFE]/, '')
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

          if (!columnValueCounts[cleanKey]) {
            columnValueCounts[cleanKey] = new Set();
          }
          if (val.length <= 150) {
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
      fs.unlink(filePath, () => {});

      if (results.length === 0) {
        return res.status(400).json({ success: false, error: 'Uploaded CSV file contains no valid rows or data.' });
      }

      const columns = Array.from(columnSet);
      const filterableOptions = {};

      columns.forEach(col => {
        const uniqueValuesSet = columnValueCounts[col];
        if (uniqueValuesSet && uniqueValuesSet.size > 0 && uniqueValuesSet.size <= 250) {
          filterableOptions[col] = Array.from(uniqueValuesSet).sort();
        }
      });

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        await client.query('DELETE FROM data_records');
        await client.query('DELETE FROM data_schema');

        const insertText = 'INSERT INTO data_records (data, search_text) VALUES ($1, $2)';
        for (const record of results) {
          await client.query(insertText, [JSON.stringify(record.data), record.search_text]);
        }

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
      return res.status(400).json({ success: false, error: 'Failed to parse CSV file.' });
    });
});

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
    return res.status(500).json({ success: false, error: 'Failed to fetch schema.' });
  }
});

// PUBLIC SEARCH ROUTE (Enforces Age 18-55 and Cooling Period of 90 days)
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

    const schemaRes = await pool.query('SELECT columns FROM data_schema ORDER BY id DESC LIMIT 1');
    const existingColumns = (schemaRes.rows.length > 0 && schemaRes.rows[0].columns) ? schemaRes.rows[0].columns : [];

    const whereConditions = [];
    const values = [];
    let paramIndex = 1;

    // 1. Text Keyword Search
    if (queryStr) {
      whereConditions.push(`search_text ILIKE $${paramIndex}`);
      values.push(`%${queryStr}%`);
      paramIndex++;
    }

    // 2. Column Filters (Zone, Forona, Blood Group)
    if (filterParams && typeof filterParams === 'object') {
      Object.keys(filterParams).forEach(col => {
        const val = filterParams[col];
        if (val !== undefined && val !== null && val !== '') {
          const candidateKeys = getMatchingColumnKeys(col, existingColumns);

          if (candidateKeys.length > 0) {
            const colOrConditions = candidateKeys.map(k => {
              const cond = `data ->> $${paramIndex} ILIKE $${paramIndex + 1}`;
              values.push(k);
              values.push(val);
              paramIndex += 2;
              return cond;
            });
            whereConditions.push(`(${colOrConditions.join(' OR ')})`);
          } else {
            whereConditions.push(`data ->> $${paramIndex} ILIKE $${paramIndex + 1}`);
            values.push(col);
            values.push(val);
            paramIndex += 2;
          }
        }
      });
    }

    // 3. STRICT AGE RESTRICTION (18 to 55)
    const ageKeys = existingColumns.filter(c => /age|വയസ്സ്/i.test(c));
    if (ageKeys.length > 0) {
      const ageOrConds = ageKeys.map(k => {
        const p1 = paramIndex;
        paramIndex++;
        values.push(k);
        return `(
          (data ->> $${p1}) IS NULL OR 
          (data ->> $${p1}) = '' OR 
          NOT ((data ->> $${p1}) ~ '^[0-9]+$') OR 
          (
            ((data ->> $${p1})::int >= 18) AND 
            ((data ->> $${p1})::int <= 55)
          )
        )`;
      });
      whereConditions.push(`(${ageOrConds.join(' AND ')})`);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*) FROM data_records ${whereClause}`;
    const countRes = await pool.query(countSql, values);
    const totalRecords = parseInt(countRes.rows[0].count, 10);

    const dataSql = `SELECT id, data FROM data_records ${whereClause} ORDER BY id ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    const dataValues = [...values, limit, offset];
    const dataRes = await pool.query(dataSql, dataValues);

    const now = new Date();

    const validRecords = dataRes.rows.map(r => ({ id: r.id, ...r.data })).filter(rec => {
      // Age check
      const ageKey = Object.keys(rec).find(k => /age|വയസ്സ്/i.test(k));
      if (ageKey && rec[ageKey] !== undefined && rec[ageKey] !== null && rec[ageKey] !== '') {
        const numAge = parseInt(rec[ageKey], 10);
        if (!isNaN(numAge) && (numAge < 18 || numAge > 55)) return false;
      }

      // Cooling period check (90 days since donation)
      const lastDonated = rec['Last Donation Date'];
      if (lastDonated) {
        const dDate = new Date(lastDonated);
        const diffDays = (now - dDate) / (1000 * 60 * 60 * 24);
        if (diffDays < 90) return false;
      }

      return true;
    });

    const totalPages = Math.ceil(totalRecords / limit) || 1;

    return res.json({
      success: true,
      records: validRecords,
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

function getMatchingColumnKeys(filterName, columns) {
  const norm = filterName.toLowerCase().trim();

  const exact = columns.filter(c => c.toLowerCase().trim() === norm);
  if (exact.length > 0) return exact;

  if (norm.includes('zone') || norm.includes('മേഖല')) {
    const matches = columns.filter(c => /zone|മേഖല/i.test(c));
    if (matches.length > 0) return matches;
  }

  if (norm.includes('blood') || norm.includes('group') || norm === 'bg') {
    const matches = columns.filter(c => /blood|group|bg/i.test(c));
    if (matches.length > 0) return matches;
  }

  if (norm.includes('forona') || norm.includes('ഫൊറോന')) {
    const matches = columns.filter(c => /forona|ഫൊറോന/i.test(c));
    if (matches.length > 0) return matches;
  }

  if (norm.includes('unit') || norm.includes('യൂണിറ്റ്')) {
    const matches = columns.filter(c => /unit|യൂണിറ്റ്/i.test(c));
    if (matches.length > 0) return matches;
  }

  return [filterName];
}

module.exports = app;

if (require.main === module) {
  initDb()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`Server running locally at http://localhost:${PORT}`);
      });
    })
    .catch(err => {
      console.error('DB initialization failed:', err);
    });
}
