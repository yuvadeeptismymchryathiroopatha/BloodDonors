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

const { initDb, AdminUser, User, DataRecord, DataSchema } = require('./db');

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
  rolling: true,
  cookie: {
    maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
    httpOnly: true,
    sameSite: 'lax'
  }
}));

app.use(express.static(path.join(__dirname, 'public')));

let dbInitPromise = null;
app.use(async (req, res, next) => {
  try {
    if (!dbInitPromise) {
      dbInitPromise = initDb().catch(err => {
        console.error('MongoDB connection error:', err.message);
        dbInitPromise = null;
        throw err;
      });
    }
    await dbInitPromise;
    next();
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Database connection failed. Please check MONGODB_URI in your .env file.'
    });
  }
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

async function refreshSchemaMetadata() {
  const allRecords = await DataRecord.find({ deleted_at: null });
  if (allRecords.length === 0) {
    await DataSchema.deleteMany({});
    return { columns: [], filterableOptions: {}, totalRecords: 0 };
  }

  const columnSet = new Set();
  const columnValueCounts = {};

  allRecords.forEach(row => {
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

  await DataSchema.deleteMany({});
  await DataSchema.create({
    columns,
    filterable_options: filterableOptions,
    total_records: allRecords.length,
    uploaded_at: new Date()
  });

  return { columns, filterableOptions, totalRecords: allRecords.length };
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
  if (['edathua', 'pulincunnoo', 'pulinkunnoo', 'champakulam'].includes(f)) return 'Kuttanad Zone';
  if (['kollam-ayoor', 'kollam', 'ayoor'].includes(f)) return 'Kollam-ayoor Zone';
  if (['trivandrum', 'amboori'].includes(f)) return 'Trivandrum Zone';
  if (['chenganoor'].includes(f)) return 'Chenganoor Zone';
  return `${forane} Zone`;
}

// SYNC USER PROFILE TO PUBLIC DATA_RECORDS TABLE
async function syncUserProfileToDataRecords(userId) {
  try {
    const user = await User.findById(userId);
    if (!user || !user.name || !user.phone) return;

    let computedAge = user.age;
    if (user.dob) {
      computedAge = calculateAgeFromDob(user.dob);
    }

    const availText = user.is_available !== false ? "Available" : "Unavailable";
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
      "Last Donation Date": formatDateSafe(user.last_donation_date) || "",
      "Availability Status": availText,
      "Status": availText,
      "Availability": availText
    };

    const searchText = Object.values(formattedRecord).filter(Boolean).join(' | ');

    const existing = await DataRecord.findOne({
      $or: [
        { "data.Email": user.email },
        { "data.Phone": user.phone }
      ]
    });

    if (existing) {
      existing.data = formattedRecord;
      existing.search_text = searchText;
      await existing.save();
    } else {
      await DataRecord.create({
        data: formattedRecord,
        search_text: searchText
      });
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
    const email = payload.email.toLowerCase().trim();
    const name = payload.name || 'Donor User';
    const picture = payload.picture || '';

    let user = await User.findOne({
      $or: [
        { google_id: googleId },
        { email: email }
      ]
    });

    if (!user) {
      user = await User.create({
        google_id: googleId,
        email: email,
        name: name,
        picture: picture,
        is_available: true
      });
    } else {
      let updated = false;
      if (!user.google_id) { user.google_id = googleId; updated = true; }
      if (!user.picture && picture) { user.picture = picture; updated = true; }
      if (!user.name && name) { user.name = name; updated = true; }
      if (updated) await user.save();
    }

    req.session.user = {
      id: user._id.toString(),
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
      lastDonationDate: formatDateSafe(user.last_donation_date),
      isAvailable: user.is_available !== false
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

    const existingUser = await User.findOne({ email: email.trim().toLowerCase() });
    if (existingUser) {
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

    const user = await User.create({
      email: email.trim().toLowerCase(),
      password_hash: passwordHash,
      name: name.trim(),
      phone: cleanPhone,
      blood_group: bloodGroup ? bloodGroup.trim() : null,
      zone: computedZone ? computedZone.trim() : null,
      forona: forona ? forona.trim() : null,
      unit: unit ? unit.trim() : null,
      dob: dob ? new Date(dob) : null,
      age: computedAge,
      last_donation_date: lastDonationDate ? new Date(lastDonationDate) : null,
      is_available: true
    });

    req.session.user = {
      id: user._id.toString(),
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
      lastDonationDate: formatDateSafe(user.last_donation_date),
      isAvailable: user.is_available !== false
    };

    await syncUserProfileToDataRecords(user._id);

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

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    if (!user.password_hash) {
      return res.status(400).json({ success: false, error: 'This account uses Google Sign-In. Please sign in with Google.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    req.session.user = {
      id: user._id.toString(),
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
      lastDonationDate: formatDateSafe(user.last_donation_date),
      isAvailable: user.is_available !== false
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

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
      return res.status(404).json({ success: false, error: 'No account found with this email address.' });
    }

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
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    user.reset_token = resetCode;
    user.reset_token_expires = expiresAt;
    await user.save();

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

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User account not found.' });
    }

    if (!user.reset_token || user.reset_token !== resetCode.trim()) {
      return res.status(400).json({ success: false, error: 'Invalid verification code.' });
    }

    if (!user.reset_token_expires || new Date(user.reset_token_expires) < new Date()) {
      return res.status(400).json({ success: false, error: 'Verification code has expired. Please request a new one.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    user.password_hash = passwordHash;
    user.reset_token = null;
    user.reset_token_expires = null;
    await user.save();

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

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    if (name) user.name = name.trim();
    if (phone) user.phone = phone.trim();
    if (bloodGroup) user.blood_group = bloodGroup.trim();
    if (zone) user.zone = zone.trim();
    if (forona) user.forona = forona.trim();
    if (unit) user.unit = unit.trim();
    if (dob) user.dob = new Date(dob);
    if (computedAge !== null) user.age = computedAge;
    if (lastDonationDate) user.last_donation_date = new Date(lastDonationDate);

    await user.save();

    req.session.user = {
      id: user._id.toString(),
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
      lastDonationDate: formatDateSafe(user.last_donation_date),
      isAvailable: user.is_available !== false
    };

    await syncUserProfileToDataRecords(user._id);

    return res.json({
      success: true,
      message: 'Profile details updated and synced to public blood donor directory!',
      user: req.session.user
    });
  } catch (err) {
    console.error('Error updating user profile:', err);
    return res.status(500).json({ success: false, error: 'Failed to update profile.' });
  }
});

// UPDATE USER AVAILABILITY STATUS
app.put('/api/user/availability', requireUser, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { isAvailable } = req.body;
    const boolVal = isAvailable !== false;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    user.is_available = boolVal;
    await user.save();

    req.session.user = {
      ...req.session.user,
      isAvailable: user.is_available !== false
    };

    await syncUserProfileToDataRecords(user._id);

    return res.json({
      success: true,
      message: boolVal ? 'You are now marked as AVAILABLE for blood donation.' : 'You are now marked as UNAVAILABLE for blood donation.',
      isAvailable: boolVal,
      user: req.session.user
    });
  } catch (err) {
    console.error('Error updating availability status:', err);
    return res.status(500).json({ success: false, error: 'Failed to update availability status.' });
  }
});

// ----------------- ADMIN API ROUTES -----------------

app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password are required.' });
    }

    const adminUser = await AdminUser.findOne({ username: username.trim().toLowerCase() });
    if (!adminUser) {
      return res.status(401).json({ success: false, error: 'Invalid username or password.' });
    }

    const isMatch = await bcrypt.compare(password, adminUser.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid username or password.' });
    }

    req.session.admin = {
      id: adminUser._id.toString(),
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
    const adminUser = await AdminUser.findById(adminId);
    if (!adminUser) {
      return res.status(404).json({ success: false, error: 'Admin account not found.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, adminUser.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Current password is incorrect.' });
    }

    if (newUsername && newUsername.trim() !== '') {
      const trimmedUser = newUsername.trim().toLowerCase();
      const existing = await AdminUser.findOne({ username: trimmedUser, _id: { $ne: adminId } });
      if (existing) {
        return res.status(400).json({ success: false, error: 'Username is already taken by another user.' });
      }
      adminUser.username = trimmedUser;
    }

    if (newPassword && newPassword.trim() !== '') {
      if (newPassword.length < 6) {
        return res.status(400).json({ success: false, error: 'New password must be at least 6 characters long.' });
      }
      const salt = await bcrypt.genSalt(10);
      adminUser.password_hash = await bcrypt.hash(newPassword, salt);
    }

    await adminUser.save();
    req.session.admin.username = adminUser.username;

    return res.json({
      success: true,
      message: 'Admin credentials updated successfully!',
      username: adminUser.username
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
    const limit = (req.query.limit === 'all' || !req.query.limit) ? 100000 : Math.min(100000, Math.max(1, parseInt(req.query.limit, 10) || 100000));
    const q = req.query.q ? req.query.q.trim() : '';
    const statusFilter = req.query.statusFilter || 'all';

    let filterQuery = {};
    if (statusFilter === 'trash') {
      filterQuery.deleted_at = { $ne: null };
    } else {
      filterQuery.deleted_at = null;
    }

    const allRecordsDocs = await DataRecord.find(filterQuery).sort({ createdAt: -1 });
    const now = new Date();

    let records = allRecordsDocs.map(doc => {
      const rec = doc.data || {};
      const id = doc._id.toString();

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

      if (doc.deleted_at) {
        const delDate = new Date(doc.deleted_at);
        const daysAgo = Math.floor((now - delDate) / (1000 * 60 * 60 * 24));
        const daysRemaining = Math.max(0, 90 - daysAgo);
        status = 'Trash';
        statusBadge = `🗑️ Soft Deleted (${daysRemaining} Days Until Auto-Purge)`;
      } else if (!isAgeEligible) {
        status = 'Non-Active';
        statusBadge = `🔴 Ineligible Age (${rec[ageKey]})`;
      } else if (isCoolingPeriod) {
        status = 'Non-Active';
        statusBadge = `🟡 Donated (< 90 Days)`;
      }

      return {
        id: id,
        data: rec,
        search_text: doc.search_text,
        created_at: doc.createdAt,
        deleted_at: doc.deleted_at,
        isActive: status === 'Active',
        isDeleted: !!doc.deleted_at,
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

    const filtersParam = req.query.filters;
    let filters = {};
    if (filtersParam) {
      try {
        filters = JSON.parse(filtersParam);
      } catch (e) {}
    }

    if (Object.keys(filters).length > 0) {
      records = records.filter(r => {
        return Object.entries(filters).every(([col, targetVal]) => {
          if (!targetVal) return true;
          const matchingKey = Object.keys(r.data).find(k => k.toLowerCase().trim() === col.toLowerCase().trim());
          if (!matchingKey) return true;
          return (r.data[matchingKey] || '').toString().toLowerCase().trim() === targetVal.toString().toLowerCase().trim();
        });
      });
    }

    const totalRecords = records.length;
    const allFilteredIds = records.map(r => r.id);
    const offset = (page - 1) * limit;
    const paginatedRecords = records.slice(offset, offset + limit);

    return res.json({
      success: true,
      records: paginatedRecords,
      allFilteredIds,
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
    const recordId = req.params.id;
    const donationDate = req.body.donationDate || new Date().toISOString().split('T')[0];

    if (donationDate) {
      const dDate = new Date(donationDate);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (dDate > today) {
        return res.status(400).json({ success: false, error: 'Donation date cannot be in the future.' });
      }
    }

    const doc = await DataRecord.findById(recordId);
    if (!doc) {
      return res.status(404).json({ success: false, error: 'Record not found.' });
    }

    const currentData = doc.data || {};
    currentData['Last Donation Date'] = donationDate;
    currentData['Availability'] = `Donated on ${donationDate} (3 Month Cooling Period)`;

    const searchTextParts = Object.values(currentData).map(v => (v || '').toString().trim()).filter(Boolean);
    doc.data = currentData;
    doc.search_text = searchTextParts.join(' | ');

    await doc.save();
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
    const activeDocs = await DataRecord.find({ deleted_at: null });
    const trashCount = await DataRecord.countDocuments({ deleted_at: { $ne: null } });
    const records = activeDocs.map(r => r.data || {});

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
      trashCount,
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

    const newDoc = await DataRecord.create({
      data: data,
      search_text: searchText
    });

    await refreshSchemaMetadata();

    return res.json({
      success: true,
      message: 'Record created successfully!',
      record: { id: newDoc._id.toString(), data: newDoc.data, created_at: newDoc.createdAt }
    });
  } catch (err) {
    console.error('Create record error:', err);
    return res.status(500).json({ success: false, error: 'Failed to create record.' });
  }
});

// UPDATE Single Record
app.put('/api/admin/records/:id', requireAdmin, async (req, res) => {
  try {
    const recordId = req.params.id;
    const { data } = req.body;

    if (!data || typeof data !== 'object') {
      return res.status(400).json({ success: false, error: 'Valid record data is required.' });
    }

    const searchTextParts = Object.values(data).map(v => (v || '').toString().trim()).filter(Boolean);
    const searchText = searchTextParts.join(' | ');

    const doc = await DataRecord.findByIdAndUpdate(
      recordId,
      { data, search_text: searchText },
      { new: true }
    );

    if (!doc) {
      return res.status(404).json({ success: false, error: 'Record not found.' });
    }

    await refreshSchemaMetadata();

    return res.json({
      success: true,
      message: 'Record updated successfully!',
      record: { id: doc._id.toString(), data: doc.data, created_at: doc.createdAt }
    });
  } catch (err) {
    console.error('Update record error:', err);
    return res.status(500).json({ success: false, error: 'Failed to update record.' });
  }
});

// DELETE Single Record (SOFT DELETE)
app.delete('/api/admin/records/:id', requireAdmin, async (req, res) => {
  try {
    const recordId = req.params.id;

    const doc = await DataRecord.findOneAndUpdate(
      { _id: recordId, deleted_at: null },
      { deleted_at: new Date() },
      { new: true }
    );

    if (!doc) {
      return res.status(404).json({ success: false, error: 'Record not found or already deleted.' });
    }

    await refreshSchemaMetadata();

    return res.json({
      success: true,
      message: 'Record soft-deleted successfully (Will be permanently removed after 90 days).',
      id: recordId
    });
  } catch (err) {
    console.error('Delete record error:', err);
    return res.status(500).json({ success: false, error: 'Failed to delete record.' });
  }
});

// RESTORE Soft-Deleted Record
app.post('/api/admin/records/:id/restore', requireAdmin, async (req, res) => {
  try {
    const recordId = req.params.id;

    const doc = await DataRecord.findByIdAndUpdate(
      recordId,
      { deleted_at: null },
      { new: true }
    );

    if (!doc) {
      return res.status(404).json({ success: false, error: 'Record not found in trash.' });
    }

    await refreshSchemaMetadata();

    return res.json({
      success: true,
      message: `Record #${recordId} restored successfully!`,
      id: recordId
    });
  } catch (err) {
    console.error('Restore record error:', err);
    return res.status(500).json({ success: false, error: 'Failed to restore record.' });
  }
});

// BULK SOFT-DELETE Selected Records
app.post('/api/admin/records/bulk-delete', requireAdmin, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'No record IDs provided for bulk deletion.' });
    }

    const updateRes = await DataRecord.updateMany(
      { _id: { $in: ids }, deleted_at: null },
      { deleted_at: new Date() }
    );
    await refreshSchemaMetadata();

    return res.json({
      success: true,
      message: `Successfully soft-deleted ${updateRes.modifiedCount} record(s) (Will auto-purge in 90 days).`,
      deletedCount: updateRes.modifiedCount
    });
  } catch (err) {
    console.error('Bulk delete error:', err);
    return res.status(500).json({ success: false, error: 'Failed to perform bulk delete.' });
  }
});

// SOFT-DELETE ALL FILTERED Records
app.post('/api/admin/records/delete-filtered', requireAdmin, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'No matching filtered records found to delete.' });
    }

    const updateRes = await DataRecord.updateMany(
      { _id: { $in: ids }, deleted_at: null },
      { deleted_at: new Date() }
    );
    await refreshSchemaMetadata();

    return res.json({
      success: true,
      message: `Successfully soft-deleted all ${updateRes.modifiedCount} filtered record(s) (Will auto-purge in 90 days).`,
      deletedCount: updateRes.modifiedCount
    });
  } catch (err) {
    console.error('Delete filtered records error:', err);
    return res.status(500).json({ success: false, error: 'Failed to delete filtered records.' });
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

      try {
        await DataRecord.deleteMany({});
        await DataSchema.deleteMany({});

        await DataRecord.insertMany(results);
        await DataSchema.create({
          columns,
          filterable_options: filterableOptions,
          total_records: results.length,
          uploaded_at: new Date()
        });

        return res.json({
          success: true,
          message: `Successfully processed and saved ${results.length} data records!`,
          totalRecords: results.length,
          columns,
          filterableOptions
        });
      } catch (dbErr) {
        console.error('Database error during CSV upload:', dbErr);
        return res.status(500).json({ success: false, error: 'Database operations failed during CSV import.' });
      }
    })
    .on('error', (parseErr) => {
      fs.unlink(filePath, () => {});
      console.error('CSV Parsing error:', parseErr);
      return res.status(400).json({ success: false, error: 'Failed to parse CSV file.' });
    });
});

app.post('/api/admin/clear-data', requireAdmin, async (req, res) => {
  try {
    await DataRecord.deleteMany({});
    await DataSchema.deleteMany({});
    return res.json({ success: true, message: 'All database data records cleared.' });
  } catch (err) {
    console.error('Clear data error:', err);
    return res.status(500).json({ success: false, error: 'Failed to clear database records.' });
  }
});

// ----------------- PUBLIC API ROUTES -----------------

app.get('/api/schema', async (req, res) => {
  try {
    const schemaDoc = await DataSchema.findOne().sort({ _id: -1 });
    if (!schemaDoc) {
      return res.json({
        success: true,
        columns: [],
        filterableOptions: {},
        totalRecords: 0
      });
    }

    return res.json({
      success: true,
      columns: schemaDoc.columns || [],
      filterableOptions: schemaDoc.filterable_options || {},
      totalRecords: schemaDoc.total_records || 0,
      uploadedAt: schemaDoc.uploaded_at
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

    let filterParams = {};
    if (req.query.filters) {
      try {
        filterParams = typeof req.query.filters === 'string' ? JSON.parse(req.query.filters) : req.query.filters;
      } catch (e) {
        filterParams = {};
      }
    }

    const schemaDoc = await DataSchema.findOne().sort({ _id: -1 });
    const existingColumns = (schemaDoc && schemaDoc.columns) ? schemaDoc.columns : [];

    let mongoQuery = { deleted_at: null };

    if (queryStr) {
      mongoQuery.search_text = { $regex: queryStr, $options: 'i' };
    }

    if (filterParams && typeof filterParams === 'object') {
      Object.keys(filterParams).forEach(col => {
        const val = filterParams[col];
        if (val !== undefined && val !== null && val !== '') {
          const candidateKeys = getMatchingColumnKeys(col, existingColumns);
          if (candidateKeys.length > 0) {
            mongoQuery.$or = candidateKeys.map(k => ({
              [`data.${k}`]: { $regex: `^${val}$`, $options: 'i' }
            }));
          } else {
            mongoQuery[`data.${col}`] = { $regex: `^${val}$`, $options: 'i' };
          }
        }
      });
    }

    const totalRecords = await DataRecord.countDocuments(mongoQuery);
    const offset = (page - 1) * limit;

    const docs = await DataRecord.find(mongoQuery)
      .sort({ createdAt: 1 })
      .skip(offset)
      .limit(limit);

    const now = new Date();

    const records = docs.map(doc => {
      const rec = { id: doc._id.toString(), ...(doc.data || {}) };

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

      const isMarkedUnavailable = rec['Availability Status'] === 'Unavailable' || rec['Status'] === 'Unavailable' || rec['Availability'] === 'Unavailable' || rec['is_available'] === false;
      let isAvailable = isAgeEligible && !isCoolingPeriod && !isMarkedUnavailable;
      let statusBadge = '🟢 Available to Donate';

      if (!isAgeEligible) {
        statusBadge = `🔴 Ineligible Age (${rec[ageKey]})`;
      } else if (isMarkedUnavailable) {
        statusBadge = `🔴 Unavailable for Donation`;
        rec['Availability Status'] = 'Unavailable';
        rec['Status'] = 'Unavailable';
        rec['Availability'] = 'Unavailable';
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

async function purgeOldSoftDeletedRecords() {
  try {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const drRes = await DataRecord.deleteMany({ deleted_at: { $ne: null, $lt: cutoff } });
    const uRes = await User.deleteMany({ deleted_at: { $ne: null, $lt: cutoff } });

    if (drRes.deletedCount > 0 || uRes.deletedCount > 0) {
      console.log(`🧹 Auto-purged ${drRes.deletedCount} soft-deleted data records and ${uRes.deletedCount} users older than 90 days.`);
      await refreshSchemaMetadata();
    }
  } catch (err) {
    console.error('Error auto-purging 90-day soft deleted records:', err);
  }
}

module.exports = app;

if (require.main === module) {
  initDb()
    .then(() => {
      purgeOldSoftDeletedRecords();
      setInterval(purgeOldSoftDeletedRecords, 24 * 60 * 60 * 1000);
      app.listen(PORT, () => {
        console.log(`Server running locally at http://localhost:${PORT}`);
      });
    })
    .catch(err => {
      console.error('DB initialization failed:', err);
    });
}
