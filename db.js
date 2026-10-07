const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const mongoURI = process.env.MONGODB_URI;

if (!mongoURI) {
  console.error('MONGODB_URI is missing in environment variables');
  process.exit(1);
}

// ----------------- SCHEMAS & MODELS -----------------

// Admin Users Schema
const adminUserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password_hash: { type: String, required: true }
}, { timestamps: true });

// Registered Users / Donors Schema
const userSchema = new mongoose.Schema({
  google_id: { type: String, default: null },
  email: { type: String, unique: true, lowercase: true, trim: true },
  name: { type: String, default: '' },
  password_hash: { type: String, default: null },
  picture: { type: String, default: '' },
  phone: { type: String, default: '' },
  blood_group: { type: String, default: '' },
  zone: { type: String, default: '' },
  forona: { type: String, default: '' },
  unit: { type: String, default: '' },
  age: { type: Number, default: null },
  dob: { type: Date, default: null },
  last_donation_date: { type: Date, default: null },
  reset_token: { type: String, default: null },
  reset_token_expires: { type: Date, default: null },
  is_available: { type: Boolean, default: true },
  deleted_at: { type: Date, default: null }
}, { timestamps: true });

// Flexible CSV/Dynamic Blood Donor Records Schema
const dataRecordSchema = new mongoose.Schema({
  data: { type: mongoose.Schema.Types.Mixed, required: true },
  search_text: { type: String, default: '' },
  deleted_at: { type: Date, default: null }
}, { timestamps: true });

// Schema Metadata
const dataSchemaSchema = new mongoose.Schema({
  columns: { type: [String], default: [] },
  filterable_options: { type: mongoose.Schema.Types.Mixed, default: {} },
  total_records: { type: Number, default: 0 },
  uploaded_at: { type: Date, default: Date.now }
});

const AdminUser = mongoose.models.AdminUser || mongoose.model('AdminUser', adminUserSchema);
const User = mongoose.models.User || mongoose.model('User', userSchema);
const DataRecord = mongoose.models.DataRecord || mongoose.model('DataRecord', dataRecordSchema);
const DataSchema = mongoose.models.DataSchema || mongoose.model('DataSchema', dataSchemaSchema);

async function initDb() {
  if (mongoose.connection.readyState >= 1) {
    return;
  }

  try {
    console.log('Connecting to MongoDB database...');
    await mongoose.connect(mongoURI);
    console.log('MongoDB connection established successfully.');

    // Seed default admin if no admin exists
    const adminCount = await AdminUser.countDocuments({});
    if (adminCount === 0) {
      const defaultUsername = 'smymChry@blood';
      const defaultPassword = "It'sAdmin@2026";
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(defaultPassword, salt);

      await AdminUser.create({
        username: defaultUsername,
        password_hash: hash
      });
      console.log(`Default admin user seeded: ${defaultUsername}`);
    } else {
      console.log('Admin user exists in database.');
    }
  } catch (err) {
    console.error('Error during MongoDB initialization:', err);
    throw err;
  }
}

module.exports = {
  mongoose,
  initDb,
  AdminUser,
  User,
  DataRecord,
  DataSchema
};
