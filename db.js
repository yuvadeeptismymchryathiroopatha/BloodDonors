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

// Indexes on User for high-throughput authentication & lookup
userSchema.index({ google_id: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ deleted_at: 1 });
userSchema.index({ is_available: 1, deleted_at: 1 });

// Flexible CSV/Dynamic Blood Donor Records Schema
const dataRecordSchema = new mongoose.Schema({
  data: { type: mongoose.Schema.Types.Mixed, required: true },
  search_text: { type: String, default: '' },
  deleted_at: { type: Date, default: null }
}, { timestamps: true });

// Performance Indexes for MongoDB fast search, lazy loading & multi-attribute sorting
dataRecordSchema.index({ deleted_at: 1, createdAt: -1 });
dataRecordSchema.index({ deleted_at: 1, createdAt: 1 });
dataRecordSchema.index({ deleted_at: 1, search_text: 1 });
dataRecordSchema.index({ deleted_at: 1, 'data.Blood Group': 1 });
dataRecordSchema.index({ deleted_at: 1, 'data.Zone': 1 });
dataRecordSchema.index({ deleted_at: 1, 'data.Forane': 1 });
dataRecordSchema.index({ deleted_at: 1, 'data.Name': 1 });
// Helpful composite index for combined dropdown filtering:
dataRecordSchema.index({ deleted_at: 1, 'data.Zone': 1, 'data.Blood Group': 1 });
dataRecordSchema.index({ 'data.Email': 1 });
dataRecordSchema.index({ 'data.Phone': 1, 'data.Name': 1 });

// Schema Metadata
const dataSchemaSchema = new mongoose.Schema({
  columns: { type: [String], default: [] },
  filterable_options: { type: mongoose.Schema.Types.Mixed, default: {} },
  total_records: { type: Number, default: 0 },
  uploaded_at: { type: Date, default: Date.now }
});

// Site Visitor Logs Schema for Traffic & Audience Analytics
const visitorLogSchema = new mongoose.Schema({
  visitor_id: { type: String, default: '', index: true },
  session_id: { type: String, default: '', index: true },
  ip: { type: String, default: '' },
  path: { type: String, default: '/', index: true },
  page_title: { type: String, default: '' },
  referrer: { type: String, default: 'Direct' },
  user_agent: { type: String, default: '' },
  device_type: { type: String, enum: ['Mobile', 'Desktop', 'Tablet', 'Other'], default: 'Desktop' },
  browser: { type: String, default: 'Unknown' },
  os: { type: String, default: 'Unknown' },
  screen_res: { type: String, default: '' },
  visited_at: { type: Date, default: Date.now, index: true }
}, { timestamps: true });

visitorLogSchema.index({ visited_at: -1 });
visitorLogSchema.index({ visitor_id: 1, visited_at: -1 });
visitorLogSchema.index({ path: 1, visited_at: -1 });

const AdminUser = mongoose.models.AdminUser || mongoose.model('AdminUser', adminUserSchema);
const User = mongoose.models.User || mongoose.model('User', userSchema);
const DataRecord = mongoose.models.DataRecord || mongoose.model('DataRecord', dataRecordSchema);
const DataSchema = mongoose.models.DataSchema || mongoose.model('DataSchema', dataSchemaSchema);
const VisitorLog = mongoose.models.VisitorLog || mongoose.model('VisitorLog', visitorLogSchema);

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
      bufferCommands: false,
      maxPoolSize: 20,
      minPoolSize: 2,
      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4 // Use IPv4 first to avoid slow DNS resolution
    };

    console.log('Connecting to MongoDB database with optimized pool...');
    cached.promise = mongoose.connect(mongoURI, opts).then((mongooseInstance) => {
      console.log('MongoDB connection established successfully.');
      // Ensure indexes in background
      Promise.all([
        DataRecord.createIndexes(),
        User.createIndexes(),
        AdminUser.createIndexes(),
        VisitorLog.createIndexes()
      ]).catch(idxErr => console.warn('Index verification notice:', idxErr.message));
      return mongooseInstance;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  // Seed / update default admin users (optimized with bcrypt check)
  try {
    const defaultPassword = "It'sAdmin@2026";
    const adminAccounts = ['smymchry@blood', 'admin'];

    for (const username of adminAccounts) {
      let admin = await AdminUser.findOne({ username });
      if (!admin) {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(defaultPassword, salt);
        await AdminUser.create({
          username,
          password_hash: hash
        });
        console.log(`Default admin user seeded: ${username}`);
      } else {
        const isMatch = await bcrypt.compare(defaultPassword, admin.password_hash);
        if (!isMatch) {
          const salt = await bcrypt.genSalt(10);
          admin.password_hash = await bcrypt.hash(defaultPassword, salt);
          await admin.save();
          console.log(`Admin user password updated for: ${username}`);
        }
      }
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
  DataSchema,
  VisitorLog
};
