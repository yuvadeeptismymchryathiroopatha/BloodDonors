const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

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

// Vercel / Serverless MongoDB Connection Caching
let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function initDb() {
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  const mongoURI = process.env.MONGODB_URI;
  if (!mongoURI) {
    const err = new Error('MONGODB_URI environment variable is missing. Please add MONGODB_URI in your Vercel project Environment Variables.');
    console.error(err.message);
    throw err;
  }

  if (mongoURI.includes('<db_password>')) {
    const err = new Error("MONGODB_URI in environment variables contains '<db_password>' placeholder. Please replace <db_password> with your actual MongoDB password in Vercel settings.");
    console.error(err.message);
    throw err;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false
    };

    console.log('Connecting to MongoDB database...');
    cached.promise = mongoose.connect(mongoURI, opts).then((mongooseInstance) => {
      console.log('MongoDB connection established successfully.');
      return mongooseInstance;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  // Seed default admin if no admin exists
  try {
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
    }
  } catch (seedErr) {
    console.error('Admin seed check error:', seedErr);
  }

  return cached.conn;
}

module.exports = {
  mongoose,
  initDb,
  AdminUser,
  User,
  DataRecord,
  DataSchema
};
