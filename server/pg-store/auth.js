import crypto from "crypto";
import { query } from "../db.js";

export function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export function verifyPassword(password, passwordHash) {
  return hashPassword(password) === passwordHash;
}

export async function findUserByEmail(_data, email) {
  // We check both email and username since the customer login form allows both
  const { rows } = await query(
    "SELECT * FROM users WHERE role = 'customer' AND (LOWER(email) = $1 OR LOWER(username) = $1)", 
    [email.toLowerCase()]
  );
  return rows[0] || null;
}

export async function findUserByUsername(_data, username, role) {
  const { rows } = await query(
    "SELECT * FROM users WHERE role = $1 AND LOWER(username) = $2", 
    [role, username.toLowerCase()]
  );
  return rows[0] || null;
}

export async function findUserFromTokenPayload(_data, payload) {
  const { rows } = await query(
    "SELECT * FROM users WHERE id = $1 AND role = $2", 
    [payload.userId, payload.role]
  );
  return rows[0] || null;
}

export async function createCustomer(_data, payload) {
  const userId = `user-customer-${crypto.randomUUID().slice(0, 8)}`;
  const hash = hashPassword(payload.password);
  
  await query(
    `INSERT INTO users (id, role, username, email, phone, password_hash, display_name) 
     VALUES ($1, 'customer', $2, $3, $4, $5, $6)`,
    [userId, payload.username || null, payload.email, payload.phone, hash, payload.name]
  );
  
  const { rows } = await query("SELECT * FROM users WHERE id = $1", [userId]);
  return rows[0];
}

export async function getSessionPayload(_data, user) {
  if (user.role === "admin") {
    return {
      id: user.id,
      role: "admin",
      displayName: user.display_name ?? "Admin"
    };
  }

  if (user.role === "driver") {
    const { rows } = await query(`
      SELECT d.*, c.name as car_type_name, c.seats as car_type_seats 
      FROM drivers d 
      LEFT JOIN car_types c ON d.car_type_id = c.id 
      WHERE d.user_id = $1
    `, [user.id]);
    const driver = rows[0];

    return {
      id: user.id,
      role: "driver",
      displayName: driver?.name ?? user.display_name,
      username: user.username,
      status: driver?.status ?? "offline",
      carType: driver ? { name: driver.car_type_name, seats: driver.car_type_seats } : null
    };
  }

  // Customer role
  const { rows: trips } = await query(`
    SELECT id FROM trips 
    WHERE customer_user_id = $1 
      AND status != 'completed' 
      AND status != 'cancelled' 
    LIMIT 1
  `, [user.id]);

  return {
    id: user.id,
    role: "customer",
    displayName: user.display_name,
    email: user.email,
    activeTripId: trips[0]?.id || null
  };
}
