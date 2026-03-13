import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { query } from "./db.js";
import crypto from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export async function initDb() {
  console.log("Initializing database...");
  
  // 1. Run Schema
  const schemaPath = path.join(__dirname, "schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf-8");
  await query(schemaSql);

  // 2. Check if already seeded
  const { rows } = await query("SELECT COUNT(*) FROM users");
  if (parseInt(rows[0].count, 10) > 0) {
    console.log("Database already seeded.");
    return;
  }

  console.log("Seeding initial data...");

  // 3. Seed Users
  const pAdmin = hashPassword("admin");
  const pCust  = hashPassword("customer123");
  const pDrv   = hashPassword("driver123");

  await query(`INSERT INTO users (id, role, username, email, phone, password_hash, display_name) VALUES 
    ('user-admin', 'admin', 'admin', NULL, NULL, $1, 'Admin'),
    ('user-customer-demo', 'customer', NULL, 'riya@example.com', '9876543210', $2, 'Riya Sen'),
    ('user-driver-1', 'driver', 'driver1', NULL, NULL, $3, 'Ramesh Kumar'),
    ('user-driver-2', 'driver', 'driver2', NULL, NULL, $3, 'Suresh Yadav'),
    ('user-driver-3', 'driver', 'driver3', NULL, NULL, $3, 'Abdul Khan'),
    ('user-driver-4', 'driver', 'driver4', NULL, NULL, $3, 'Balraj Singh'),
    ('user-driver-5', 'driver', 'driver5', NULL, NULL, $3, 'Amit Sharma'),
    ('user-driver-6', 'driver', 'driver6', NULL, NULL, $3, 'Pramod Patel'),
    ('user-driver-7', 'driver', 'driver7', NULL, NULL, $3, 'Vikram Reddy'),
    ('user-driver-8', 'driver', 'driver8', NULL, NULL, $3, 'Arjun Nair'),
    ('user-driver-9', 'driver', 'driver9', NULL, NULL, $3, 'Manoj Tiwari'),
    ('user-driver-10', 'driver', 'driver10', NULL, NULL, $3, 'Dinesh Gowda'),
    ('user-driver-11', 'driver', 'driver11', NULL, NULL, $3, 'Rajesh Pillai'),
    ('user-driver-12', 'driver', 'driver12', NULL, NULL, $3, 'Kiran Chetri')
  `, [pAdmin, pCust, pDrv]);

  // 4. Seed Car Types
  await query(`INSERT INTO car_types (id, name, theme, seats, rate_per_km, base_fare, min_fare) VALUES 
    ('mini', 'Hatchback (Swift, i10)', '#9bb8ff', 4, 14, 60, 120),
    ('sedan', 'Sedan (Dzire, Aura)', '#d5b784', 4, 18, 90, 160),
    ('suv', 'SUV (Innova, Ertiga)', '#7dd0b8', 6, 24, 120, 220),
    ('executive', 'Luxury (Camry, Superb)', '#b3a0ff', 4, 30, 180, 320)
  `);

  // 5. Seed Locations
  await query(`INSERT INTO locations (id, name, x, y) VALUES 
    ('kempegowda-airport', 'Kempegowda Airport (Bangalore)', 14, 22),
    ('majestic-east', 'Majestic East (Bangalore)', 78, 34),
    ('hubli', 'Hubballi Junction (Hubli)', 71, 61),
    ('sdm-college', 'SDM College (Dharwad)', 23, 70),
    ('belgaum-fort', 'Belagavi Fort (Belgaum)', 36, 31),
    ('gulbarga-uni', 'Gulbarga University (Kalaburagi)', 52, 48),
    ('gol-gumbaz', 'Gol Gumbaz (Vijayapura)', 62, 79),
    ('bidar-fort', 'Bidar Fort (Bidar)', 34, 56)
  `);

  // 6. Seed Drivers
  await query(`INSERT INTO drivers (id, user_id, name, status, location_id, car_type_id, vehicle_number, rating, lifetime_earnings, current_trip_id) VALUES 
    ('driver-1', 'user-driver-1', 'Ramesh Kumar', 'free', 'kempegowda-airport', 'mini', 'MH 01 AB 1234 • Maruti Swift', 4.88, 12840, NULL),
    ('driver-2', 'user-driver-2', 'Suresh Yadav', 'on_trip', 'majestic-east', 'sedan', 'DL 02 CD 5678 • Maruti Dzire', 4.95, 15560, 'trip-live-1'),
    ('driver-3', 'user-driver-3', 'Abdul Khan', 'free', 'hubli', 'suv', 'KA 03 EF 9012 • Toyota Innova', 4.92, 17620, NULL),
    ('driver-4', 'user-driver-4', 'Balraj Singh', 'free', 'sdm-college', 'executive', 'PB 04 GH 3456 • Skoda Superb', 4.97, 20840, NULL),
    ('driver-5', 'user-driver-5', 'Amit Sharma', 'free', 'belgaum-fort', 'mini', 'UP 14 XY 7788 • Hyundai i10', 4.75, 9400, NULL),
    ('driver-6', 'user-driver-6', 'Pramod Patel', 'free', 'gulbarga-uni', 'sedan', 'GJ 05 ZZ 1122 • Hyundai Aura', 4.81, 11050, NULL),
    ('driver-7', 'user-driver-7', 'Vikram Reddy', 'free', 'gol-gumbaz', 'suv', 'TS 07 PQ 5544 • Maruti Ertiga', 4.89, 16200, NULL),
    ('driver-8', 'user-driver-8', 'Arjun Nair', 'free', 'bidar-fort', 'mini', 'KL 01 RT 3344 • Tata Tiago', 4.90, 14500, NULL),
    ('driver-9', 'user-driver-9', 'Manoj Tiwari', 'free', 'kempegowda-airport', 'sedan', 'BR 01 MN 9988 • Honda Amaze', 4.82, 13400, NULL),
    ('driver-10', 'user-driver-10', 'Dinesh Gowda', 'free', 'majestic-east', 'suv', 'KA 05 KL 6767 • Mahindra XUV700', 4.96, 19800, NULL),
    ('driver-11', 'user-driver-11', 'Rajesh Pillai', 'free', 'hubli', 'executive', 'TN 02 BB 1111 • Toyota Camry', 5.0, 28000, NULL),
    ('driver-12', 'user-driver-12', 'Kiran Chetri', 'free', 'sdm-college', 'sedan', 'AS 01 CC 2233 • Maruti Dzire', 4.85, 12500, NULL)
  `);

  // 7. Seed Trips
  const ts1 = new Date(Date.now() - 1.5 * 3600000).toISOString();
  const ta1 = new Date(Date.now() - 1.45 * 3600000).toISOString();
  const ts1s= new Date(Date.now() - 1.4 * 3600000).toISOString();

  const ts2 = new Date(Date.now() - 24 * 3600000).toISOString();
  const ta2 = new Date(Date.now() - 23.8 * 3600000).toISOString();
  const ts2s= new Date(Date.now() - 23.7 * 3600000).toISOString();
  const tc2 = new Date(Date.now() - 23.2 * 3600000).toISOString();

  await query(`INSERT INTO trips (id, customer_user_id, driver_id, car_type_id, pickup_id, dropoff_id, status, scheduled_at, fare, driver_payout, distance_km, duration_min, created_at, assigned_at, started_at, completed_at) VALUES 
    ('trip-live-1', 'user-customer-demo', 'driver-2', 'sedan', 'kempegowda-airport', 'majestic-east', 'in_progress', NULL, 1319, 976, 65, 247, $1, $2, $3, NULL),
    ('trip-complete-1', 'user-customer-demo', 'driver-3', 'suv', 'hubli', 'belgaum-fort', 'completed', NULL, 1245, 921, 46.1, 175, $4, $5, $6, $7)
  `, [ts1, ta1, ts1s, ts2, ta2, ts2s, tc2]);

  console.log("Seeding complete!");
}
