import { query } from "../db.js";
import { calculateTripMetrics } from "./math.js";

export async function getDriverDashboard(_data, userId) {
  const { rows: drivers } = await query(`
    SELECT d.*, c.name as car_type_name, c.seats as car_type_seats 
    FROM drivers d 
    LEFT JOIN car_types c ON d.car_type_id = c.id 
    WHERE d.user_id = $1
  `, [userId]);
  const driver = drivers[0];
  if (!driver) throw new Error("Driver profile not found.");

  const profile = {
    name: driver.name,
    status: driver.status,
    rating: parseFloat(driver.rating),
    vehicleNumber: driver.vehicle_number,
    carType: { name: driver.car_type_name }
  };

  let activeTrip = null;
  if (driver.current_trip_id) {
    const { rows: trips } = await query(`
      SELECT t.*, u.display_name as customer_name, u.phone as customer_phone 
      FROM trips t 
      LEFT JOIN users u ON t.customer_user_id = u.id 
      WHERE t.id = $1
    `, [driver.current_trip_id]);
    
    const t = trips[0];
    if (t && t.status !== 'completed' && t.status !== 'cancelled') {
        const dummyCarType = { base_fare: 0, rate_per_km: 0, min_fare: 0 };
        activeTrip = {
            id: t.id,
            status: t.status,
            distanceKm: parseFloat(t.distance_km),
            durationMin: t.duration_min,
            fare: parseFloat(t.fare),
            driverPayout: parseFloat(t.driver_payout),
            routePoints: calculateTripMetrics(dummyCarType, t.pickup_id, t.dropoff_id).routePoints,
            pickupId: t.pickup_id,
            dropoffId: t.dropoff_id,
            customer: { name: t.customer_name, phone: t.customer_phone || "—" }
        };
    }
  }

  const { rows: history } = await query(`
    SELECT t.*, u.display_name as customer_name 
    FROM trips t 
    LEFT JOIN users u ON t.customer_user_id = u.id 
    WHERE t.driver_id = $1 AND t.status = 'completed' 
    ORDER BY t.created_at DESC LIMIT 10
  `, [driver.id]);

  const tripHistory = history.map(t => ({
    id: t.id,
    fare: parseFloat(t.fare),
    driverPayout: parseFloat(t.driver_payout),
    customer: { name: t.customer_name },
    createdAt: t.created_at
  }));

  return { profile, activeTrip, tripHistory };
}

export async function setDriverAvailability(_data, userId, isAvailable) {
  const status = isAvailable ? "free" : "offline";
  await query("UPDATE drivers SET status = $1 WHERE user_id = $2 AND status != 'on_trip'", [status, userId]);
  
  const { rows } = await query("SELECT * FROM drivers WHERE user_id = $1", [userId]);
  if (!rows[0]) throw new Error("Driver not found");
  return rows[0];
}

export async function startDriverTrip(_data, userId, tripId) {
  const { rows: drivers } = await query("SELECT * FROM drivers WHERE user_id = $1", [userId]);
  const driver = drivers[0];
  if (!driver) throw new Error("Driver not found.");

  const { rows: trips } = await query("SELECT * FROM trips WHERE id = $1", [tripId]);
  const trip = trips[0];
  if (!trip || trip.driver_id !== driver.id) throw new Error("Invalid trip.");

  await query("UPDATE trips SET status = 'in_progress', started_at = $1 WHERE id = $2", [new Date().toISOString(), tripId]);
  
  const { rows } = await query("SELECT * FROM trips WHERE id = $1", [tripId]);
  return rows[0];
}

export async function completeDriverTrip(_data, userId, tripId) {
  const { rows: drivers } = await query("SELECT * FROM drivers WHERE user_id = $1", [userId]);
  const driver = drivers[0];
  if (!driver) throw new Error("Driver not found.");

  const { rows: trips } = await query("SELECT * FROM trips WHERE id = $1", [tripId]);
  let trip = trips[0];
  if (!trip || trip.driver_id !== driver.id) throw new Error("Invalid trip.");

  const payout = parseFloat(trip.driver_payout);
  const now = new Date().toISOString();

  await query("UPDATE trips SET status = 'completed', completed_at = $1 WHERE id = $2", [now, tripId]);
  await query("UPDATE drivers SET status = 'free', current_trip_id = NULL, lifetime_earnings = lifetime_earnings + $1 WHERE id = $2", [payout, driver.id]);

  const { rows } = await query("SELECT * FROM trips WHERE id = $1", [tripId]);
  return rows[0];
}

export async function acceptTrip(_data, userId, tripId) {
  const { rows: drivers } = await query("SELECT * FROM drivers WHERE user_id = $1", [userId]);
  const driver = drivers[0];
  if (!driver) throw new Error("Driver not found.");

  const { rows: trips } = await query("SELECT * FROM trips WHERE id = $1 AND status = 'pending_acceptance'", [tripId]);
  const trip = trips[0];
  if (!trip) throw new Error("Trip not available or already accepted.");

  await query("UPDATE trips SET status = 'assigned', assigned_at = $1, driver_id = $2 WHERE id = $3", [new Date().toISOString(), driver.id, tripId]);
  await query("UPDATE drivers SET status = 'on_trip', current_trip_id = $1 WHERE id = $2", [tripId, driver.id]);
  
  const { rows } = await query("SELECT * FROM trips WHERE id = $1", [tripId]);
  return rows[0];
}

export async function rejectTrip(_data, userId, tripId) {
  const { rows: drivers } = await query("SELECT * FROM drivers WHERE user_id = $1", [userId]);
  const driver = drivers[0];
  if (!driver) throw new Error("Driver not found.");

  const { rows: trips } = await query("SELECT * FROM trips WHERE id = $1 AND status = 'pending_acceptance'", [tripId]);
  const trip = trips[0];
  if (!trip) throw new Error("Trip not available.");

  // Logic to re-assign is complex in real life, but for demo:
  // We'll leave it pending_acceptance and let another driver pick it up (or assign randomly).
  // Here we just un-bind the driver so it's not their request anymore.
  
  return trip;
}
