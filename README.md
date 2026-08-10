# Yuva Blood Forum by YUVADEEPTI SMYM ARCHEPARCHY OF CHANGANASSERY

An ultra-lightweight, high-performance blood donor and data search portal powered by Node.js, Express, and PostgreSQL (Neon DB).

**Powered by ÉclatTech Technologies**

## Features

- **Ultra-Fast & Lightweight**: Pure Vanilla HTML5/CSS3/JS frontend under 40 KB asset footprint for instant loading.
- **Dynamic Search & Filtering**: Real-time keyword search bar and dynamic dropdown filters for **Zone (മേഖല)**, **Blood Group (രക്തഗ്രൂപ്പ്)**, and **Forane (ഫൊറോന)**.
- **Eligible Age Restriction**: Automatically filters public searches to show only eligible donors (**Ages 18 to 55**).
- **Donation Tracking & Cooling Period**: Option to mark donation completion in Admin portal, enforcing a 90-day cooling period.
- **Admin Analytics Breakdown**: Real-time stats and visual progress breakdowns by **Zone**, **Forane**, and **Blood Group**.
- **One-Click Contact Actions**: Automatic phone number detection with direct Call (`tel:`) and WhatsApp (`wa.me`) action buttons.
- **Dedicated Admin Portal (`admin.html`)**:
  - Pre-seeded admin authentication with password hashing (`bcryptjs`).
  - Interactive Admin Data Table with inline editing, single delete, and multi-select bulk delete.
  - Drag-and-drop CSV file importer with live processing status.
  - Option to update Admin username and password after login.

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
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   ```

4. Start the Application:
   ```bash
   npm start
   ```

5. Open your browser and navigate to `http://localhost:3000`.

---

## Admin Credentials

- **Username**: `smymChry@blood`
- **Password**: `It'sAdmin@2026`

---

## License & Attribution

Developed by **ÉclatTech Technologies** for **YUVADEEPTI SMYM ARCHEPARCHY OF CHANGANASSERY**.
