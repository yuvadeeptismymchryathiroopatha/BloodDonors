# BloodDonors - Light Data Search & Admin Portal

An ultra-lightweight, high-performance blood donor and data search website powered by Node.js, Express, and PostgreSQL (Neon DB).

## Features

- **Ultra-Fast & Lightweight**: Pure Vanilla HTML5/CSS3/JS frontend under 40 KB asset footprint for instant loading.
- **Dynamic Search & Filtering**: Real-time keyword search bar and dynamic dropdown filters generated automatically from uploaded CSV datasets (e.g. Blood Group, District, Location, Availability).
- **One-Click Contact Actions**: Automatic phone number detection with direct Call (`tel:`) and WhatsApp (`wa.me`) action buttons.
- **Secure Admin Portal**:
  - Pre-seeded admin authentication with password hashing (`bcryptjs`).
  - Drag-and-drop CSV file importer with live processing status.
  - Option to update Admin username and password after login.
- **PostgreSQL Database**: Configured for Neon serverless PostgreSQL connection with SSL support.

---

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- PostgreSQL database (or Neon DB connection string)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yuvadeeptismymchryathiroopatha/BloodDonors.git
   cd BloodDonors
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure Environment Variables:
   Create a `.env` file in the root directory:
   ```env
   DATABASE_URL=postgresql://neondb_owner:your_db_credentials@ep-icy-wind-aztndqrb.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   SESSION_SECRET=your_secure_session_secret
   PORT=3000
   ```

4. Start the Application:
   ```bash
   npm start
   ```

5. Open your browser and navigate to `http://localhost:3000`.

---

## Admin Credentials

- **Default Username**: `smymChry@blood`
- **Default Password**: `It'sAdmin@2026`

*Admin credentials can be changed after logging into the Admin Portal.*

---

## License

MIT License
