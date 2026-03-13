import crypto from "crypto";
import { query } from "../db.js";
import { locations } from "./math.js";
import { hashPassword } from "./auth.js";

export async function getAdminDashboard(_data) {
  const { rows: completedTrips } = await query("SELECT * FROM trips WHERE status = 'completed'");
  const { rows: activeTrips } = await query("SELECT * FROM trips WHERE status IN ('assigned', 'in_progress')");
  const { rows: freeDrivers } = await query("SELECT * FROM drivers WHERE status = 'free'");
  
  const grossRevenue = completedTrips.reduce((sum, t) => sum + parseFloat(t.fare), 0);
  const driverPayouts = completedTrips.reduce((sum, t) => sum + parseFloat(t.driver_payout), 0);
  const platformEarnings = grossRevenue - driverPayouts;

  const { rows: carTypes } = await query("SELECT * FROM car_types");
  const revenueByCarType = carTypes.map(c => {
    const total = completedTrips
      .filter(t => t.car_type_id === c.id)
      .reduce((sum, t) => sum + parseFloat(t.fare), 0);
    return { id: c.id, name: c.name, total };
  });

  return {
    grossRevenue,
    driverPayouts,
    platformEarnings,
    activeTrips: activeTrips.length,
    freeDrivers: freeDrivers.length,
    totalTrips: completedTrips.length + activeTrips.length,
    revenueByCarType
  };
}

export async function getPublicBootstrap(_data) {
  const { rows: carTypes } = await query("SELECT * FROM car_types");
  return {
    locations,
    carTypes: carTypes.map(c => ({
      ...c,
      ratePerKm: parseFloat(c.rate_per_km),
      baseFare: parseFloat(c.base_fare),
      minFare: parseFloat(c.min_fare)
    })),
    demoCredentials: {
      admin: { username: "admin", password: "admin" },
      drivers: [
        { username: "driver1", password: "driver123", label: "Hatchback" },
        { username: "driver2", password: "driver123", label: "Sedan" },
        { username: "driver3", password: "driver123", label: "SUV" },
        { username: "driver4", password: "driver123", label: "Luxury" }
      ],
      customer: { email: "riya@example.com", password: "customer123" }
    }
  };
}

export async function addCarType(_data, payload) {
  const id = payload.id || `car_${crypto.randomUUID().slice(0, 5)}`;
  await query(
    "INSERT INTO car_types (id, name, theme, seats, rate_per_km, base_fare, min_fare) VALUES ($1, $2, $3, $4, $5, $6, $7)",
    [id, payload.name, payload.theme || '#9bb8ff', payload.seats || 4, payload.ratePerKm, payload.baseFare, payload.minFare]
  );
  return { id, ...payload };
}

export async function addDriver(_data, payload) {
  const userId = `user-driver-${crypto.randomUUID().slice(0, 8)}`;
  const driverId = `driver-${crypto.randomUUID().slice(0, 8)}`;
  const password = payload.password || "driver123";

  // Create User
  await query(
    "INSERT INTO users (id, role, username, password_hash, display_name, phone) VALUES ($1, 'driver', $2, $3, $4, $5)",
    [userId, payload.username || `driver_${userId.slice(-4)}`, hashPassword(password), payload.name, payload.contact]
  );
  
  // Choose random drop location
  const locationId = locations[Math.floor(Math.random() * locations.length)].id;

  // Create Driver
  await query(
    "INSERT INTO drivers (id, user_id, name, status, location_id, car_type_id, vehicle_number, rating, lifetime_earnings) VALUES ($1, $2, $3, 'free', $4, $5, $6, 5.0, 0)",
    [driverId, userId, payload.name, locationId, payload.carTypeId, payload.vehicleNumber]
  );

  const { rows } = await query("SELECT * FROM drivers WHERE id = $1", [driverId]);
  return rows[0];
}
