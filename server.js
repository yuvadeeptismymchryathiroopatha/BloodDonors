const express = require('express');
const session = require('express-session');
const multer = require('multer');
const csvParser = require('csv-parser');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { OAuth2Client } = require('google-auth-library');
require('dotenv').config();

const { pool, initDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Google OAuth Client
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '788181288036-3q8gb7vubkp0raidlqkngd8j3l8aetcv.apps.googleusercontent.com';
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

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
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
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

function requireUser(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  return res.status(401).json({ success: false, error: 'Unauthorized. Please sign in.' });
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

function calculateAgeFromDob(dobStr) {
  if (!dobStr) return null;
  const dob = new Date(dobStr);
  if (isNaN(dob.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age >= 0 ? age : null;
}

function formatDateSafe(dateVal) {
  if (!dateVal) return null;
  if (dateVal instanceof Date) {
    if (isNaN(dateVal.getTime())) return null;
    return dateVal.toISOString().split('T')[0];
  }
  const str = String(dateVal).trim();
  if (!str) return null;
  if (str.includes('T')) return str.split('T')[0];
  return str.split(' ')[0];
}

function getZoneFromForane(forane) {
  if (!forane) return 'Changanacherry Zone';
  const f = forane.trim().toLowerCase();
  if (['kottayam', 'kudamaloor', 'athirampuzha', 'manimala', 'nedumkunnam'].includes(f)) return 'Kottayam Zone';
  if (['changanacherry', 'thuruthy', 'thrickodithanam', 'thrikodithanam', 'kurumpanadom'].includes(f)) return 'Changanacherry Zone';
  if (['alappuzha', 'muhamma'].includes(f)) return 'Alappuzha Zone';
  if (['edathua', 'pulinkunnoo', 'champakulam'].includes(f)) return 'Kuttanad Zone';
  if (['kollam-ayoor', 'kollam', 'ayoor'].includes(f)) return 'Kollam-ayoor Zone';
  if (['trivandrum', 'amboori'].includes(f)) return 'Trivandrum Zone';
  if (['chenganoor'].includes(f)) return 'Chenganoor Zone';
  return `${forane} Zone`;
}

// SYNC USER PROFILE TO PUBLIC DATA_RECORDS TABLE
async function syncUserProfileToDataRecords(userId) {
  try {
    const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (userRes.rows.length === 0) return;
    const user = userRes.rows[0];

    if (!user.name || !user.phone) return;

    let computedAge = user.age;
    if (user.dob) {
      computedAge = calculateAgeFromDob(user.dob);
    }

    const formattedRecord = {
      "Name": user.name,
      "Age": computedAge !== null && computedAge !== undefined ? computedAge.toString() : (user.age ? user.age.toString() : "25"),
      "Date of Birth": formatDateSafe(user.dob) || "",
      "Phone": user.phone,
      "Unit": user.unit || "",
      "Forane": user.forona || "Changanacherry",
      "Zone": user.zone || "Changanacherry Zone",
      "Blood Group": user.blood_group || "O+",
      "Email": user.email,
      "Last Donation Date": formatDateSafe(user.last_donation_date) || ""
    };

    const searchText = Object.values(formattedRecord).filter(Boolean).join(' | ');

    const existingRes = await pool.query(
      `SELECT id FROM data_records WHERE (data->>'Email') = $1 OR (data->>'Phone') = $2`,
      [user.email, user.phone]
    );

    if (existingRes.rows.length > 0) {
      await pool.query(
        'UPDATE data_records SET data = $1, search_text = $2 WHERE id = $3',
        [JSON.stringify(formattedRecord), searchText, existingRes.rows[0].id]
      );
    } else {
      await pool.query(
        'INSERT INTO data_records (data, search_text) VALUES ($1, $2)',
        [JSON.stringify(formattedRecord), searchText]
      );
    }

    await refreshSchemaMetadata();
  } catch (err) {
    console.error('Error syncing user profile to data_records:', err);
  }
}

// ----------------- GOOGLE & USER AUTH API ROUTES -----------------

// Config Endpoint
app.get('/api/auth/config', (req, res) => {
  res.json({
    googleClientId: GOOGLE_CLIENT_ID
  });
});

// Google Sign-In Endpoint
app.post('/api/auth/google', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ success: false, error: 'Google credential token is required.' });
    }

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: GOOGLE_CLIENT_ID
      });
      payload = ticket.getPayload();
    } catch (e) {
      try {
        const parts = credential.split('.');
        if (parts.length >= 2) {
          const jsonPayload = Buffer.from(parts[1], 'base64').toString('utf8');
          payload = JSON.parse(jsonPayload);
        }
      } catch (err2) {
        console.error('Payload decode error:', err2);
      }
    }

    if (!payload || !payload.email) {
      return res.status(400).json({ success: false, error: 'Invalid Google token payload.' });
    }

    const googleId = payload.sub || `google-${Date.now()}`;
    const email = payload.email;
    const name = payload.name || 'Donor User';
    const picture = payload.picture || '';

    // Check if user exists
    let userRes = await pool.query('SELECT * FROM users WHERE google_id = $1 OR LOWER(email) = LOWER($2)', [googleId, email]);
    let user;

    if (userRes.rows.length === 0) {
      // Insert new Google User
      const insertRes = await pool.query(
        'INSERT INTO users (google_id, email, name, picture) VALUES ($1, $2, $3, $4) RETURNING *',
        [googleId, email, name, picture]
      );
      user = insertRes.rows[0];
    } else {
      user = userRes.rows[0];
      if (!user.google_id || !user.picture) {
        const updateRes = await pool.query(
          'UPDATE users SET google_id = $1, picture = COALESCE(picture, $2), name = COALESCE(name, $3) WHERE id = $4 RETURNING *',
          [googleId, picture, name, user.id]
        );
        user = updateRes.rows[0];
      }
    }

    req.session.user = {
      id: user.id,
      googleId: user.google_id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      phone: user.phone,
      bloodGroup: user.blood_group,
      zone: user.zone,
      forona: user.forona,
      unit: user.unit,
      dob: formatDateSafe(user.dob),
      age: user.age,
      lastDonationDate: formatDateSafe(user.last_donation_date)
    };

    return res.json({
      success: true,
      message: 'Signed in with Google successfully!',
      user: req.session.user
    });
  } catch (err) {
    console.error('Google Sign-In error:', err);
    return res.status(500).json({ success: false, error: 'Google Sign-In authentication failed.' });
  }
});

// EMAIL REGISTRATION ENDPOINT
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name, phone, bloodGroup, zone, forona, unit, dob, age, lastDonationDate } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ success: false, error: 'Email, password, and name are required.' });
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ success: false, error: 'Please enter a valid email address.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long.' });
    }

    const cleanPhone = (phone || '').replace(/[\s\-\(\)\+]/g, '').replace(/^91/, '');
    const phoneNum = Number(cleanPhone);
    if (!/^[6-9]\d{9}$/.test(cleanPhone) || isNaN(phoneNum) || phoneNum < 6000000000 || phoneNum > 9999999999) {
      return res.status(400).json({ success: false, error: 'Phone number must be a valid 10-digit Indian number (between 6000000000 and 9999999999).' });
    }

    const computedZone = zone || getZoneFromForane(forona);

    const existingRes = await pool.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email.trim()]);
    if (existingRes.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'An account with this email already exists. Please sign in.' });
    }

    if (lastDonationDate) {
      const dDate = new Date(lastDonationDate);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (dDate > today) {
        return res.status(400).json({ success: false, error: 'Last donation date cannot be in the future.' });
      }
    }

    if (!dob) {
      return res.status(400).json({ success: false, error: 'Date of birth is required for donor registration.' });
    }

    const computedAge = calculateAgeFromDob(dob);
    if (computedAge === null || computedAge < 18 || computedAge > 55) {
      return res.status(400).json({ success: false, error: 'Only donors between 18 and 55 years of age are eligible to register.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const insertRes = await pool.query(
      `INSERT INTO users (email, password_hash, name, phone, blood_group, zone, forona, unit, dob, age, last_donation_date) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        email.trim(),
        passwordHash,
        name.trim(),
        cleanPhone,
        bloodGroup ? bloodGroup.trim() : null,
        computedZone ? computedZone.trim() : null,
        forona ? forona.trim() : null,
        unit ? unit.trim() : null,
        dob ? dob : null,
        computedAge,
        lastDonationDate ? lastDonationDate : null
      ]
    );

    const user = insertRes.rows[0];

    req.session.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      phone: user.phone,
      bloodGroup: user.blood_group,
      zone: user.zone,
      forona: user.forona,
      unit: user.unit,
      dob: formatDateSafe(user.dob),
      age: user.age,
      lastDonationDate: formatDateSafe(user.last_donation_date)
    };

    await syncUserProfileToDataRecords(user.id);

    return res.json({
      success: true,
      message: 'Account registered successfully!',
      user: req.session.user
    });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ success: false, error: 'Failed to register account.' });
  }
});

// Email/Password Login Endpoint
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required.' });
    }

    const userRes = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email.trim()]);
    if (userRes.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    const user = userRes.rows[0];
    if (!user.password_hash) {
      return res.status(400).json({ success: false, error: 'This account uses Google Sign-In. Please sign in with Google.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    req.session.user = {
      id: user.id,
      googleId: user.google_id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      phone: user.phone,
      bloodGroup: user.blood_group,
      zone: user.zone,
      forona: user.forona,
      unit: user.unit,
      dob: formatDateSafe(user.dob),
      age: user.age,
      lastDonationDate: formatDateSafe(user.last_donation_date)
    };

    return res.json({
      success: true,
      message: 'Logged in successfully!',
      user: req.session.user
    });
  } catch (err) {
    console.error('User login error:', err);
    return res.status(500).json({ success: false, error: 'Login failed.' });
  }
});

// FORGOT PASSWORD - STEP 1: VERIFY IDENTITY & GENERATE RESET CODE
app.post('/api/auth/forgot-password/verify', async (req, res) => {
  try {
    const { email, phone } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email address is required.' });
    }

    const userRes = await pool.query('SELECT id, email, phone, password_hash FROM users WHERE LOWER(email) = LOWER($1)', [email.trim()]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'No account found with this email address.' });
    }

    const user = userRes.rows[0];

    if (!user.password_hash) {
      return res.status(400).json({ success: false, error: 'This account was created with Google Sign-In. Please sign in using Google.' });
    }

    if (phone) {
      const cleanInputPhone = phone.replace(/[\s\-\(\)\+]/g, '').replace(/^91/, '');
      const cleanDbPhone = (user.phone || '').replace(/[\s\-\(\)\+]/g, '').replace(/^91/, '');
      if (cleanDbPhone && cleanInputPhone && cleanDbPhone !== cleanInputPhone) {
        return res.status(400).json({ success: false, error: 'Phone number does not match registered account details.' });
      }
    }

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await pool.query(
      'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
      [resetCode, expiresAt, user.id]
    );

    return res.json({
      success: true,
      message: 'Identity verified. Enter your 6-digit verification code and set a new password.',
      resetCode: resetCode
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    return res.status(500).json({ success: false, error: 'Failed to process password reset request.' });
  }
});

// FORGOT PASSWORD - STEP 2: RESET PASSWORD WITH VERIFICATION CODE
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email, resetCode, newPassword } = req.body;

    if (!email || !resetCode || !newPassword) {
      return res.status(400).json({ success: false, error: 'Email, verification code, and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'New password must be at least 6 characters long.' });
    }

    const userRes = await pool.query(
      'SELECT id, reset_token, reset_token_expires FROM users WHERE LOWER(email) = LOWER($1)',
      [email.trim()]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User account not found.' });
    }

    const user = userRes.rows[0];

    if (!user.reset_token || user.reset_token !== resetCode.trim()) {
      return res.status(400).json({ success: false, error: 'Invalid verification code.' });
    }

    if (!user.reset_token_expires || new Date(user.reset_token_expires) < new Date()) {
      return res.status(400).json({ success: false, error: 'Verification code has expired. Please request a new one.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await pool.query(
      'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [passwordHash, user.id]
    );

    return res.json({
      success: true,
      message: 'Password reset successfully! You can now sign in with your new password.'
    });
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(500).json({ success: false, error: 'Failed to reset password.' });
  }
});

// Get Current Logged-In User Profile
app.get('/api/auth/me', (req, res) => {
  if (req.session && req.session.user) {
    return res.json({ loggedIn: true, user: req.session.user });
  }
  return res.json({ loggedIn: false });
});

// User Logout Endpoint
app.post('/api/auth/logout', (req, res) => {
  if (req.session) {
    delete req.session.user;
  }
  return res.json({ success: true, message: 'Signed out successfully.' });
});

// UPDATE USER PROFILE
app.put('/api/user/profile', requireUser, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { name, phone, bloodGroup, zone, forona, unit, dob, age, lastDonationDate } = req.body;

    if (lastDonationDate) {
      const dDate = new Date(lastDonationDate);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (dDate > today) {
        return res.status(400).json({ success: false, error: 'Last donation date cannot be in the future.' });
      }
    }

    let computedAge = age ? parseInt(age, 10) : null;
    if (dob) {
      computedAge = calculateAgeFromDob(dob);
      if (computedAge === null || computedAge < 18 || computedAge > 55) {
        return res.status(400).json({ success: false, error: 'Only donors between 18 and 55 years of age are eligible to register.' });
      }
    }

    const updateRes = await pool.query(
      `UPDATE users SET 
        name = COALESCE($1, name),
        phone = COALESCE($2, phone),
        blood_group = COALESCE($3, blood_group),
        zone = COALESCE($4, zone),
        forona = COALESCE($5, forona),
        unit = COALESCE($6, unit),
        dob = COALESCE($7, dob),
        age = COALESCE($8, age),
        last_donation_date = COALESCE($9, last_donation_date),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $10 RETURNING *`,
      [
        name ? name.trim() : null,
        phone ? phone.trim() : null,
        bloodGroup ? bloodGroup.trim() : null,
        zone ? zone.trim() : null,
        forona ? forona.trim() : null,
        unit ? unit.trim() : null,
        dob ? dob : null,
        computedAge,
        lastDonationDate ? lastDonationDate : null,
        userId
      ]
    );

    const user = updateRes.rows[0];

    req.session.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      phone: user.phone,
      bloodGroup: user.blood_group,
      zone: user.zone,
      forona: user.forona,
      unit: user.unit,
      dob: formatDateSafe(user.dob),
      age: user.age,
      lastDonationDate: formatDateSafe(user.last_donation_date)
    };

    await syncUserProfileToDataRecords(user.id);

    return res.json({
      success: true,
      message: 'Profile updated successfully!',
      user: req.session.user
    });
  } catch (err) {
    console.error('Update profile error:', err);
    return res.status(500).json({ success: false, error: 'Failed to update user profile.' });
  }
});

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
  if (req.session) {
    delete req.session.admin;
  }
  return res.json({ success: true, message: 'Logged out successfully.' });
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
    const q = req.query.q ? req.query.q.trim() : '';
    const statusFilter = req.query.statusFilter || 'all';

    const allRes = await pool.query('SELECT id, data, created_at, search_text FROM data_records ORDER BY id DESC');
    const now = new Date();

    let records = allRes.rows.map(row => {
      const rec = row.data || {};
      
      const dobVal = rec['Date of Birth'] || rec['DOB'] || rec['dob'];
      if (dobVal) {
        const dynamicAge = calculateAgeFromDob(dobVal);
        if (dynamicAge !== null) {
          const aKey = Object.keys(rec).find(k => /age/i.test(k)) || 'Age';
          rec[aKey] = dynamicAge.toString();
        }
      }

      const ageKey = Object.keys(rec).find(k => /age/i.test(k));
      const ageNum = ageKey && rec[ageKey] ? parseInt(rec[ageKey], 10) : 25;
      const isAgeEligible = isNaN(ageNum) || (ageNum >= 18 && ageNum <= 55);

      let isCoolingPeriod = false;
      const lastDonated = rec['Last Donation Date'];
      if (lastDonated) {
        const dDate = new Date(lastDonated);
        const diffDays = (now - dDate) / (1000 * 60 * 60 * 24);
        if (diffDays < 90) isCoolingPeriod = true;
      }

      let status = 'Active';
      let statusBadge = '🟢 Active';

      if (!isAgeEligible) {
        status = 'Non-Active';
        statusBadge = `🔴 Ineligible Age (${rec[ageKey]})`;
      } else if (isCoolingPeriod) {
        status = 'Non-Active';
        statusBadge = `🟡 Donated (< 90 Days)`;
      }

      return {
        id: row.id,
        data: rec,
        search_text: row.search_text,
        created_at: row.created_at,
        isActive: status === 'Active',
        statusBadge
      };
    });

    if (q) {
      records = records.filter(r => (r.search_text || '').toLowerCase().includes(q.toLowerCase()));
    }

    if (statusFilter === 'active') {
      records = records.filter(r => r.isActive);
    } else if (statusFilter === 'non-active') {
      records = records.filter(r => !r.isActive);
    }

    const totalRecords = records.length;
    const offset = (page - 1) * limit;
    const paginatedRecords = records.slice(offset, offset + limit);

    return res.json({
      success: true,
      records: paginatedRecords,
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

// MARK DONATION COMPLETED
app.post('/api/admin/records/:id/mark-donated', requireAdmin, async (req, res) => {
  try {
    const recordId = parseInt(req.params.id, 10);
    if (isNaN(recordId)) {
      return res.status(400).json({ success: false, error: 'Invalid record ID.' });
    }

    const donationDate = req.body.donationDate || new Date().toISOString().split('T')[0];

    if (donationDate) {
      const dDate = new Date(donationDate);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (dDate > today) {
        return res.status(400).json({ success: false, error: 'Donation date cannot be in the future.' });
      }
    }

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
    let ineligibleAgeCount = 0;

    const now = new Date();

    records.forEach(r => {
      const zoneKey = Object.keys(r).find(k => /zone/i.test(k)) || 'Zone';
      const zoneVal = r[zoneKey] || 'Unassigned Zone';
      byZone[zoneVal] = (byZone[zoneVal] || 0) + 1;

      const foronaKey = Object.keys(r).find(k => /forona|forane|unit/i.test(k)) || 'Forane';
      const foronaVal = (r[foronaKey] || 'Unassigned Forane').toString().trim();
      byForona[foronaVal] = (byForona[foronaVal] || 0) + 1;

      const bgKey = Object.keys(r).find(k => /blood|group|bg/i.test(k)) || 'Blood Group';
      const bgVal = (r[bgKey] || 'Unknown').toString().trim();
      byBloodGroup[bgVal] = (byBloodGroup[bgVal] || 0) + 1;

      const ageKey = Object.keys(r).find(k => /age/i.test(k));
      const ageNum = ageKey && r[ageKey] ? parseInt(r[ageKey], 10) : 25;
      const isAgeEligible = isNaN(ageNum) || (ageNum >= 18 && ageNum <= 55);

      if (!isAgeEligible) {
        ineligibleAgeCount++;
      }

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

    const nonActiveCount = totalRecords - eligibleCount;

    return res.json({
      success: true,
      totalRecords,
      eligibleCount,
      nonActiveCount,
      donatedRecentlyCount,
      ineligibleAgeCount,
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

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*) FROM data_records ${whereClause}`;
    const countRes = await pool.query(countSql, values);
    const totalRecords = parseInt(countRes.rows[0].count, 10);

    const dataSql = `SELECT id, data FROM data_records ${whereClause} ORDER BY id ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    const dataValues = [...values, limit, offset];
    const dataRes = await pool.query(dataSql, dataValues);

    const now = new Date();

    const records = dataRes.rows.map(r => {
      const rec = { id: r.id, ...r.data };

      const dobVal = rec['Date of Birth'] || rec['DOB'] || rec['dob'];
      if (dobVal) {
        const dynamicAge = calculateAgeFromDob(dobVal);
        if (dynamicAge !== null) {
          const aKey = Object.keys(rec).find(k => /age/i.test(k)) || 'Age';
          rec[aKey] = dynamicAge.toString();
        }
      }

      const ageKey = Object.keys(rec).find(k => /age/i.test(k));
      const ageNum = ageKey && rec[ageKey] ? parseInt(rec[ageKey], 10) : 25;
      const isAgeEligible = isNaN(ageNum) || (ageNum >= 18 && ageNum <= 55);

      let isCoolingPeriod = false;
      let coolingDaysLeft = 0;
      const lastDonated = rec['Last Donation Date'];
      if (lastDonated) {
        const dDate = new Date(lastDonated);
        const diffDays = Math.floor((now - dDate) / (1000 * 60 * 60 * 24));
        if (diffDays < 90) {
          isCoolingPeriod = true;
          coolingDaysLeft = 90 - diffDays;
        }
      }

      let isAvailable = isAgeEligible && !isCoolingPeriod;
      let statusBadge = '🟢 Available to Donate';

      if (!isAgeEligible) {
        statusBadge = `🔴 Ineligible Age (${rec[ageKey]})`;
      } else if (isCoolingPeriod) {
        statusBadge = `🟡 In Cooling Period (${coolingDaysLeft} Days Left)`;
      }

      return {
        ...rec,
        _isAvailable: isAvailable,
        _statusBadge: statusBadge,
        _coolingDaysLeft: coolingDaysLeft
      };
    });

    const totalPages = Math.ceil(totalRecords / limit) || 1;

    return res.json({
      success: true,
      records: records,
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

  if (norm.includes('zone')) {
    const matches = columns.filter(c => /zone/i.test(c));
    if (matches.length > 0) return matches;
  }

  if (norm.includes('blood') || norm.includes('group') || norm === 'bg') {
    const matches = columns.filter(c => /blood|group|bg/i.test(c));
    if (matches.length > 0) return matches;
  }

  if (norm.includes('forona') || norm.includes('forane') || norm.includes('unit')) {
    const matches = columns.filter(c => /forona|forane|unit/i.test(c));
    if (matches.length > 0) return matches;
  }

  if (norm.includes('unit')) {
    const matches = columns.filter(c => /unit/i.test(c));
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
