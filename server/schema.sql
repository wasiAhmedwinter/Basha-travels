CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(50) PRIMARY KEY,
  role VARCHAR(20) NOT NULL,
  username VARCHAR(50) UNIQUE,
  email VARCHAR(100) UNIQUE,
  phone VARCHAR(20),
  password_hash TEXT NOT NULL,
  display_name VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS car_types (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  theme VARCHAR(20),
  seats INTEGER NOT NULL,
  rate_per_km DECIMAL(10, 2) NOT NULL,
  base_fare DECIMAL(10, 2) NOT NULL,
  min_fare DECIMAL(10, 2) NOT NULL
);

CREATE TABLE IF NOT EXISTS locations (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  x INTEGER NOT NULL,
  y INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS drivers (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL,
  location_id VARCHAR(50) REFERENCES locations(id) ON DELETE SET NULL,
  car_type_id VARCHAR(50) REFERENCES car_types(id) ON DELETE SET NULL,
  vehicle_number VARCHAR(50) NOT NULL,
  rating DECIMAL(3, 2) DEFAULT 5.0,
  lifetime_earnings DECIMAL(12, 2) DEFAULT 0,
  current_trip_id VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS trips (
  id VARCHAR(50) PRIMARY KEY,
  customer_user_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
  driver_id VARCHAR(50) REFERENCES drivers(id) ON DELETE SET NULL,
  car_type_id VARCHAR(50) REFERENCES car_types(id),
  pickup_id VARCHAR(50) REFERENCES locations(id),
  dropoff_id VARCHAR(50) REFERENCES locations(id),
  status VARCHAR(20) NOT NULL,
  scheduled_at VARCHAR(100),
  fare DECIMAL(10, 2),
  driver_payout DECIMAL(10, 2),
  distance_km DECIMAL(10, 2),
  duration_min INTEGER,
  created_at VARCHAR(100) NOT NULL,
  assigned_at VARCHAR(100),
  started_at VARCHAR(100),
  completed_at VARCHAR(100)
);
