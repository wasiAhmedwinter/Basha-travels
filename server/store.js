import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import { mkdir, readFile, writeFile } from "fs/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "data");
const storePath = path.join(dataDir, "store.json");

export const locations = [
  { id: "kempegowda-airport", name: "Kempegowda Airport (Bangalore)", x: 14, y: 22 },
  { id: "majestic-east", name: "Majestic East (Bangalore)", x: 78, y: 34 },
  { id: "hubli", name: "Hubballi Junction (Hubli)", x: 71, y: 61 },
  { id: "sdm-college", name: "SDM College (Dharwad)", x: 23, y: 70 },
  { id: "belgaum-fort", name: "Belagavi Fort (Belgaum)", x: 36, y: 31 },
  { id: "gulbarga-uni", name: "Gulbarga University (Kalaburagi)", x: 52, y: 48 },
  { id: "gol-gumbaz", name: "Gol Gumbaz (Vijayapura)", x: 62, y: 79 },
  { id: "bidar-fort", name: "Bidar Fort (Bidar)", x: 34, y: 56 }
];

const today = new Date();
const isoMinusHours = (hours) =>
  new Date(today.getTime() - hours * 60 * 60 * 1000).toISOString();

export function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export function verifyPassword(password, passwordHash) {
  return hashPassword(password) === passwordHash;
}

function getLocation(id) {
  return locations.find((location) => location.id === id);
}

function calculateDistanceKm(pickupId, dropoffId) {
  const pickup = getLocation(pickupId);
  const dropoff = getLocation(dropoffId);

  if (!pickup || !dropoff) {
    throw new Error("Pickup or dropoff location is invalid.");
  }

  const dx = dropoff.x - pickup.x;
  const dy = dropoff.y - pickup.y;
  const baseDistance = Math.sqrt(dx * dx + dy * dy);

  return Number(Math.max(2.8, baseDistance * 0.48).toFixed(1));
}

function createRoutePoints(pickupId, dropoffId) {
  const pickup = getLocation(pickupId);
  const dropoff = getLocation(dropoffId);

  if (!pickup || !dropoff) {
    throw new Error("Pickup or dropoff location is invalid.");
  }

  const midX = Number(((pickup.x + dropoff.x) / 2).toFixed(1));
  const midY = Number(((pickup.y + dropoff.y) / 2).toFixed(1));
  const curve = ((pickup.x + dropoff.y) % 2 === 0 ? 6 : -6);

  return [
    { x: pickup.x, y: pickup.y },
    { x: Number((midX - curve).toFixed(1)), y: Number((midY - 4).toFixed(1)) },
    { x: Number((midX + curve).toFixed(1)), y: Number((midY + 6).toFixed(1)) },
    { x: dropoff.x, y: dropoff.y }
  ];
}

function calculateEta(driverLocationId, pickupId) {
  return Math.max(3, Math.round(calculateDistanceKm(driverLocationId, pickupId) * 1.6));
}

function calculateTripMetrics(carType, pickupId, dropoffId) {
  const distanceKm = calculateDistanceKm(pickupId, dropoffId);
  const durationMin = Math.max(10, Math.round(distanceKm * 3.8));
  const rawFare = carType.baseFare + distanceKm * carType.ratePerKm + durationMin * 1.35;
  const fare = Math.max(carType.minFare, Math.round(rawFare));
  const driverPayout = Math.round(fare * 0.74);

  return {
    distanceKm,
    durationMin,
    fare,
    driverPayout,
    platformRevenue: fare - driverPayout,
    routePoints: createRoutePoints(pickupId, dropoffId)
  };
}

function makeUserId(prefix) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function buildSeedData() {
  const adminUser = {
    id: "user-admin",
    role: "admin",
    username: "admin",
    passwordHash: hashPassword("admin"),
    displayName: "Admin"
  };

  const demoCustomer = {
    id: "user-customer-demo",
    role: "customer",
    email: "riya@example.com",
    passwordHash: hashPassword("customer123"),
    displayName: "Riya Sen"
  };

  const driverUsers = [
    { id: "user-driver-1", role: "driver", username: "driver1", passwordHash: hashPassword("driver123"), displayName: "Ramesh Kumar" },
    { id: "user-driver-2", role: "driver", username: "driver2", passwordHash: hashPassword("driver123"), displayName: "Suresh Yadav" },
    { id: "user-driver-3", role: "driver", username: "driver3", passwordHash: hashPassword("driver123"), displayName: "Abdul Khan" },
    { id: "user-driver-4", role: "driver", username: "driver4", passwordHash: hashPassword("driver123"), displayName: "Balraj Singh" },
    { id: "user-driver-5", role: "driver", username: "driver5", passwordHash: hashPassword("driver123"), displayName: "Amit Sharma" },
    { id: "user-driver-6", role: "driver", username: "driver6", passwordHash: hashPassword("driver123"), displayName: "Pramod Patel" },
    { id: "user-driver-7", role: "driver", username: "driver7", passwordHash: hashPassword("driver123"), displayName: "Vikram Reddy" },
    { id: "user-driver-8", role: "driver", username: "driver8", passwordHash: hashPassword("driver123"), displayName: "Arjun Nair" },
    { id: "user-driver-9", role: "driver", username: "driver9", passwordHash: hashPassword("driver123"), displayName: "Manoj Tiwari" },
    { id: "user-driver-10", role: "driver", username: "driver10", passwordHash: hashPassword("driver123"), displayName: "Dinesh Gowda" },
    { id: "user-driver-11", role: "driver", username: "driver11", passwordHash: hashPassword("driver123"), displayName: "Rajesh Pillai" },
    { id: "user-driver-12", role: "driver", username: "driver12", passwordHash: hashPassword("driver123"), displayName: "Kiran Chetri" }
  ];

  const carTypes = [
    { id: "mini", name: "Hatchback (Swift, i10)", ratePerKm: 14, baseFare: 60, minFare: 120, seats: 4, theme: "#9bb8ff" },
    { id: "sedan", name: "Sedan (Dzire, Aura)", ratePerKm: 18, baseFare: 90, minFare: 160, seats: 4, theme: "#d5b784" },
    { id: "suv", name: "SUV (Innova, Ertiga)", ratePerKm: 24, baseFare: 120, minFare: 220, seats: 6, theme: "#7dd0b8" },
    { id: "executive", name: "Luxury (Camry, Superb)", ratePerKm: 30, baseFare: 180, minFare: 320, seats: 4, theme: "#b3a0ff" }
  ];

  const drivers = [
    { id: "driver-1", userId: "user-driver-1", name: "Ramesh Kumar", username: "driver1", status: "free", carTypeId: "mini", vehicleNumber: "MH 01 AB 1234 • Maruti Swift", rating: 4.88, locationId: "kempegowda-airport", lifetimeEarnings: 12840, currentTripId: null },
    { id: "driver-2", userId: "user-driver-2", name: "Suresh Yadav", username: "driver2", status: "on_trip", carTypeId: "sedan", vehicleNumber: "DL 02 CD 5678 • Maruti Dzire", rating: 4.95, locationId: "majestic-east", lifetimeEarnings: 15560, currentTripId: "trip-live-1" },
    { id: "driver-3", userId: "user-driver-3", name: "Abdul Khan", username: "driver3", status: "free", carTypeId: "suv", vehicleNumber: "KA 03 EF 9012 • Toyota Innova", rating: 4.92, locationId: "hubli", lifetimeEarnings: 17620, currentTripId: null },
    { id: "driver-4", userId: "user-driver-4", name: "Balraj Singh", username: "driver4", status: "free", carTypeId: "executive", vehicleNumber: "PB 04 GH 3456 • Skoda Superb", rating: 4.97, locationId: "sdm-college", lifetimeEarnings: 20840, currentTripId: null },
    { id: "driver-5", userId: "user-driver-5", name: "Amit Sharma", username: "driver5", status: "free", carTypeId: "mini", vehicleNumber: "UP 14 XY 7788 • Hyundai i10", rating: 4.75, locationId: "belgaum-fort", lifetimeEarnings: 9400, currentTripId: null },
    { id: "driver-6", userId: "user-driver-6", name: "Pramod Patel", username: "driver6", status: "free", carTypeId: "sedan", vehicleNumber: "GJ 05 ZZ 1122 • Hyundai Aura", rating: 4.81, locationId: "gulbarga-uni", lifetimeEarnings: 11050, currentTripId: null },
    { id: "driver-7", userId: "user-driver-7", name: "Vikram Reddy", username: "driver7", status: "free", carTypeId: "suv", vehicleNumber: "TS 07 PQ 5544 • Maruti Ertiga", rating: 4.89, locationId: "gol-gumbaz", lifetimeEarnings: 16200, currentTripId: null },
    { id: "driver-8", userId: "user-driver-8", name: "Arjun Nair", username: "driver8", status: "free", carTypeId: "mini", vehicleNumber: "KL 01 RT 3344 • Tata Tiago", rating: 4.90, locationId: "bidar-fort", lifetimeEarnings: 14500, currentTripId: null },
    { id: "driver-9", userId: "user-driver-9", name: "Manoj Tiwari", username: "driver9", status: "free", carTypeId: "sedan", vehicleNumber: "BR 01 MN 9988 • Honda Amaze", rating: 4.82, locationId: "kempegowda-airport", lifetimeEarnings: 13400, currentTripId: null },
    { id: "driver-10", userId: "user-driver-10", name: "Dinesh Gowda", username: "driver10", status: "free", carTypeId: "suv", vehicleNumber: "KA 05 KL 6767 • Mahindra XUV700", rating: 4.96, locationId: "majestic-east", lifetimeEarnings: 19800, currentTripId: null },
    { id: "driver-11", userId: "user-driver-11", name: "Rajesh Pillai", username: "driver11", status: "free", carTypeId: "executive", vehicleNumber: "TN 02 BB 1111 • Toyota Camry", rating: 5.0, locationId: "hubli", lifetimeEarnings: 28000, currentTripId: null },
    { id: "driver-12", userId: "user-driver-12", name: "Kiran Chetri", username: "driver12", status: "free", carTypeId: "sedan", vehicleNumber: "AS 01 CC 2233 • Maruti Dzire", rating: 4.85, locationId: "sdm-college", lifetimeEarnings: 12500, currentTripId: null }
  ];

  const sedanType = carTypes.find((carType) => carType.id === "sedan");
  const suvType = carTypes.find((carType) => carType.id === "suv");
  const liveTripMetrics = calculateTripMetrics(sedanType, "kempegowda-airport", "majestic-east");
  const completedOne = calculateTripMetrics(suvType, "hubli", "belgaum-fort");
  const completedTwo = calculateTripMetrics(sedanType, "gol-gumbaz", "bidar-fort");

  const trips = [
    {
      id: "trip-live-1",
      customerUserId: demoCustomer.id,
      driverId: "driver-2",
      carTypeId: "sedan",
      pickupId: "kempegowda-airport",
      dropoffId: "majestic-east",
      status: "in_progress",
      createdAt: isoMinusHours(1.5),
      assignedAt: isoMinusHours(1.45),
      startedAt: isoMinusHours(1.2),
      completedAt: null,
      etaMin: 4,
      ...liveTripMetrics
    },
    {
      id: "trip-complete-1",
      customerUserId: demoCustomer.id,
      driverId: "driver-3",
      carTypeId: "suv",
      pickupId: "hubli",
      dropoffId: "belgaum-fort",
      status: "completed",
      createdAt: isoMinusHours(24),
      assignedAt: isoMinusHours(23.8),
      startedAt: isoMinusHours(23.5),
      completedAt: isoMinusHours(23),
      etaMin: 6,
      ...completedOne
    },
    {
      id: "trip-complete-2",
      customerUserId: demoCustomer.id,
      driverId: "driver-6",
      carTypeId: "sedan",
      pickupId: "gol-gumbaz",
      dropoffId: "bidar-fort",
      status: "completed",
      createdAt: isoMinusHours(48),
      assignedAt: isoMinusHours(47.9),
      startedAt: isoMinusHours(47.7),
      completedAt: isoMinusHours(47.2),
      etaMin: 5,
      ...completedTwo
    }
  ];

  const customers = [
    {
      userId: demoCustomer.id,
      name: demoCustomer.displayName,
      email: demoCustomer.email,
      phone: "+91 90000 00001",
      joinedAt: isoMinusHours(72)
    }
  ];

  return {
    carTypes,
    users: [adminUser, demoCustomer, ...driverUsers],
    drivers,
    customers,
    trips
  };
}

export async function ensureStore() {
  await mkdir(dataDir, { recursive: true });

  try {
    await readFile(storePath, "utf8");
  } catch {
    await writeFile(storePath, JSON.stringify(buildSeedData(), null, 2), "utf8");
  }
}

export async function readStore() {
  await ensureStore();
  const content = await readFile(storePath, "utf8");
  return JSON.parse(content);
}

async function writeStore(data) {
  await writeFile(storePath, JSON.stringify(data, null, 2), "utf8");
}

export async function withStore(mutator) {
  const data = await readStore();
  const result = await mutator(data);
  await writeStore(data);
  return result;
}

export function getPublicBootstrap(data) {
  return {
    locations,
    carTypes: data.carTypes,
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

export function findUserByEmail(data, email) {
  return data.users.find(
    (user) => user.role === "customer" && user.email?.toLowerCase() === email.toLowerCase()
  );
}

export function findUserByUsername(data, username, role) {
  return data.users.find(
    (user) => user.role === role && user.username?.toLowerCase() === username.toLowerCase()
  );
}

export function getCustomerProfile(data, userId) {
  return data.customers.find((customer) => customer.userId === userId);
}

export function getDriverProfile(data, userId) {
  return data.drivers.find((driver) => driver.userId === userId);
}

function getCarType(data, carTypeId) {
  return data.carTypes.find((carType) => carType.id === carTypeId);
}

function getCustomerUser(data, userId) {
  return data.users.find((user) => user.id === userId && user.role === "customer");
}

function getDriverById(data, driverId) {
  return data.drivers.find((driver) => driver.id === driverId);
}

function getUserById(data, userId) {
  return data.users.find((user) => user.id === userId);
}

function enrichTrip(data, trip) {
  const driver = trip.driverId ? getDriverById(data, trip.driverId) : null;
  const customer = getCustomerProfile(data, trip.customerUserId);
  const customerUser = getCustomerUser(data, trip.customerUserId);
  const carType = getCarType(data, trip.carTypeId);

  return {
    ...trip,
    carType,
    pickup: getLocation(trip.pickupId),
    dropoff: getLocation(trip.dropoffId),
    driver: driver
      ? {
          id: driver.id,
          name: driver.name,
          username: driver.username,
          status: driver.status,
          rating: driver.rating,
          vehicleNumber: driver.vehicleNumber
        }
      : null,
    customer: customer
      ? {
          name: customer.name ?? customerUser?.displayName ?? "Customer",
          phone: customer.phone ?? ""
        }
      : null
  };
}

function getDriverEarningsToday(data, driverId) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  return data.trips
    .filter((trip) => trip.driverId === driverId && trip.status === "completed" && trip.completedAt)
    .filter((trip) => new Date(trip.completedAt) >= startOfDay)
    .reduce((sum, trip) => sum + trip.driverPayout, 0);
}

function getAdminMetrics(data) {
  const completedTrips = data.trips.filter((trip) => trip.status === "completed");
  const activeTrips = data.trips.filter(
    (trip) => trip.status === "assigned" || trip.status === "in_progress"
  );
  const freeDrivers = data.drivers.filter((driver) => driver.status === "free");

  const grossRevenue = completedTrips.reduce((sum, trip) => sum + trip.fare, 0);
  const driverPayouts = completedTrips.reduce((sum, trip) => sum + trip.driverPayout, 0);
  const platformEarnings = completedTrips.reduce(
    (sum, trip) => sum + trip.platformRevenue,
    0
  );

  const revenueByCarType = data.carTypes.map((carType) => {
    const total = completedTrips
      .filter((trip) => trip.carTypeId === carType.id)
      .reduce((sum, trip) => sum + trip.fare, 0);

    return {
      id: carType.id,
      name: carType.name,
      total
    };
  });

  return {
    grossRevenue,
    driverPayouts,
    platformEarnings,
    activeTrips: activeTrips.length,
    freeDrivers: freeDrivers.length,
    totalTrips: data.trips.length,
    revenueByCarType
  };
}

export function getSessionPayload(data, user) {
  if (user.role === "admin") {
    return {
      id: user.id,
      role: "admin",
      displayName: user.displayName ?? "Admin"
    };
  }

  if (user.role === "driver") {
    const driver = getDriverProfile(data, user.id);
    const carType = driver ? getCarType(data, driver.carTypeId) : null;

    return {
      id: user.id,
      role: "driver",
      displayName: driver?.name ?? user.displayName,
      username: user.username,
      status: driver?.status ?? "offline",
      carType
    };
  }

  const customer = getCustomerProfile(data, user.id);

  return {
    id: user.id,
    role: "customer",
    displayName: customer?.name ?? user.displayName,
    email: customer?.email ?? user.email,
    phone: customer?.phone ?? ""
  };
}

export function createCustomer(data, payload) {
  const email = payload.email?.trim().toLowerCase();

  if (!payload.name?.trim() || !email || !payload.phone?.trim() || !payload.password?.trim()) {
    throw new Error("All customer signup fields are required.");
  }

  if (findUserByEmail(data, email)) {
    throw new Error("A customer with this email already exists.");
  }

  const userId = makeUserId("user-customer");
  const user = {
    id: userId,
    role: "customer",
    email,
    passwordHash: hashPassword(payload.password),
    displayName: payload.name.trim()
  };

  const customer = {
    userId,
    name: payload.name.trim(),
    email,
    phone: payload.phone.trim(),
    joinedAt: new Date().toISOString()
  };

  data.users.push(user);
  data.customers.push(customer);

  return user;
}

function chooseDriver(data, carTypeId, pickupId) {
  const eligibleDrivers = data.drivers
    .filter((driver) => driver.status === "free" && driver.carTypeId === carTypeId)
    .sort((first, second) => {
      const firstEta = calculateEta(first.locationId, pickupId);
      const secondEta = calculateEta(second.locationId, pickupId);

      return firstEta - secondEta;
    });

  return eligibleDrivers[0] ?? null;
}

export function quoteTrip(data, payload) {
  const carType = getCarType(data, payload.carTypeId);

  if (!carType) {
    throw new Error("Selected car type is invalid.");
  }

  const metrics = calculateTripMetrics(carType, payload.pickupId, payload.dropoffId);

  return {
    ...metrics,
    carType,
    pickup: getLocation(payload.pickupId),
    dropoff: getLocation(payload.dropoffId)
  };
}

export function createTrip(data, customerUserId, payload) {
  const carType = getCarType(data, payload.carTypeId);

  if (!carType) {
    throw new Error("Selected car type is invalid.");
  }

  if (payload.pickupId === payload.dropoffId) {
    throw new Error("Pickup and dropoff must be different.");
  }

  const existingActiveTrip = data.trips.find(
    (trip) =>
      trip.customerUserId === customerUserId &&
      (trip.status === "assigned" || trip.status === "in_progress")
  );

  if (existingActiveTrip) {
    throw new Error("Customer already has an active trip.");
  }

  const driver = chooseDriver(data, payload.carTypeId, payload.pickupId);

  if (!driver) {
    throw new Error("No free drivers are available for this car type right now.");
  }

  const metrics = calculateTripMetrics(carType, payload.pickupId, payload.dropoffId);
  const etaMin = calculateEta(driver.locationId, payload.pickupId);
  const trip = {
    id: makeUserId("trip"),
    customerUserId,
    driverId: driver.id,
    carTypeId: carType.id,
    pickupId: payload.pickupId,
    dropoffId: payload.dropoffId,
    status: "in_progress",
    scheduledAt: payload.scheduledAt || null,
    createdAt: new Date().toISOString(),
    assignedAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
    completedAt: null,
    etaMin,
    ...metrics
  };

  // Temporarily block the driver so they only get this trip request
  driver.status = "on_trip";
  driver.currentTripId = trip.id;
  data.trips.unshift(trip);

  return enrichTrip(data, trip);
}

export function setDriverAvailability(data, userId, isAvailable) {
  const driver = getDriverProfile(data, userId);

  if (!driver) {
    throw new Error("Driver not found.");
  }

  if (driver.currentTripId) {
    return driver;
  }

  driver.status = isAvailable ? "free" : "offline";
  return driver;
}

export function acceptTrip(data, userId, tripId) {
  const driver = getDriverProfile(data, userId);
  const trip = data.trips.find(t => t.id === tripId);

  if (!driver || !trip || trip.driverId !== driver.id) {
    throw new Error("Trip not found or unauthorized.");
  }

  if (trip.status !== "pending_acceptance") {
    throw new Error("Trip is no longer pending.");
  }

  trip.status = "assigned";
  driver.status = "assigned";
  
  return enrichTrip(data, trip);
}

export function rejectTrip(data, userId, tripId) {
  const driver = getDriverProfile(data, userId);
  const trip = data.trips.find(t => t.id === tripId);

  if (!driver || !trip || trip.driverId !== driver.id) {
    throw new Error("Trip not found or unauthorized.");
  }

  // Free the current driver that rejected the trip
  driver.status = "free";
  driver.currentTripId = null;

  if (trip.status !== "pending_acceptance") {
      throw new Error("Trip is no longer pending.");
  }

  // Find next best driver, EXCLUDING the driver who just rejected it
  const eligibleDrivers = data.drivers
    .filter((d) => d.status === "free" && d.carTypeId === trip.carTypeId && d.id !== driver.id)
    .sort((first, second) => {
      const firstEta = calculateEta(first.locationId, trip.pickupId);
      const secondEta = calculateEta(second.locationId, trip.pickupId);
      return firstEta - secondEta;
    });

  const nextDriver = eligibleDrivers[0] ?? null;

  if (nextDriver) {
      // Assign to the next driver and keep it pending
      trip.driverId = nextDriver.id;
      trip.etaMin = calculateEta(nextDriver.locationId, trip.pickupId);
      trip.assignedAt = new Date().toISOString();
      
      nextDriver.status = "assigned"; // Block them while pending
      nextDriver.currentTripId = trip.id;
  } else {
      // No more drivers available for this car type right now
      trip.status = "cancelled";
  }

  return enrichTrip(data, trip);
}

export function startDriverTrip(data, userId, tripId) {
  const driver = getDriverProfile(data, userId);
  const trip = data.trips.find((item) => item.id === tripId);

  if (!driver || !trip || trip.driverId !== driver.id) {
    throw new Error("Trip not available for this driver.");
  }

  if (trip.status !== "assigned") {
    throw new Error("Trip cannot be started in its current state.");
  }

  trip.status = "in_progress";
  trip.startedAt = new Date().toISOString();
  driver.status = "on_trip";
  driver.currentTripId = trip.id;

  return enrichTrip(data, trip);
}

export function completeDriverTrip(data, userId, tripId) {
  const driver = getDriverProfile(data, userId);
  const trip = data.trips.find((item) => item.id === tripId);

  if (!driver || !trip || trip.driverId !== driver.id) {
    throw new Error("Trip not available for this driver.");
  }

  if (trip.status !== "assigned" && trip.status !== "in_progress") {
    throw new Error("Trip cannot be completed in its current state.");
  }

  trip.status = "completed";
  trip.completedAt = new Date().toISOString();
  if (!trip.startedAt) {
    trip.startedAt = new Date().toISOString();
  }

  driver.status = "free";
  driver.currentTripId = null;
  driver.locationId = trip.dropoffId;
  driver.lifetimeEarnings += trip.driverPayout;

  return enrichTrip(data, trip);
}

export function addCarType(data, payload) {
  const name = payload.name?.trim();
  const baseFare = Number(payload.baseFare);
  const ratePerKm = Number(payload.ratePerKm);
  const minFare = Number(payload.minFare);
  const seats = Number(payload.seats);

  if (!name || !baseFare || !ratePerKm || !minFare || !seats) {
    throw new Error("All car type fields are required.");
  }

  const carType = {
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    name,
    baseFare,
    ratePerKm,
    minFare,
    seats,
    theme: payload.theme?.trim() || "#d5b784"
  };

  data.carTypes.unshift(carType);

  return carType;
}

export function getCustomerAvailability(data, pickupId) {
  // Return an array of carType IDs that have at least one free driver available
  const availableIds = new Set();
  for (const driver of data.drivers) {
      if (driver.status === "free") {
          availableIds.add(driver.carTypeId);
      }
  }
  return Array.from(availableIds);
}

export function getCustomerDashboard(data, userId) {
  const profile = getCustomerProfile(data, userId);
  const activeTrip = data.trips.find(
    (trip) =>
      trip.customerUserId === userId &&
      (trip.status === "assigned" || trip.status === "in_progress")
  );
  const tripHistory = data.trips
    .filter((trip) => trip.customerUserId === userId)
    .slice(0, 6)
    .map((trip) => enrichTrip(data, trip));

  return {
    profile,
    locations,
    carTypes: data.carTypes,
    activeTrip: activeTrip ? enrichTrip(data, activeTrip) : null,
    tripHistory
  };
}

export function getDriverDashboard(data, userId) {
  const driver = getDriverProfile(data, userId);

  if (!driver) {
    throw new Error("Driver not found.");
  }

  const activeTrip = driver.currentTripId
    ? data.trips.find((trip) => trip.id === driver.currentTripId)
    : null;

  const tripHistory = data.trips
    .filter((trip) => trip.driverId === driver.id)
    .slice(0, 6)
    .map((trip) => enrichTrip(data, trip));

  return {
    profile: {
      ...driver,
      carType: getCarType(data, driver.carTypeId),
      earningsToday: getDriverEarningsToday(data, driver.id)
    },
    activeTrip: activeTrip ? enrichTrip(data, activeTrip) : null,
    tripHistory
  };
}

export function getAdminDashboard(data) {
  const metrics = getAdminMetrics(data);
  const activeTrips = data.trips
    .filter((trip) => trip.status === "assigned" || trip.status === "in_progress")
    .map((trip) => enrichTrip(data, trip));
  const freeDrivers = data.drivers
    .filter((driver) => driver.status === "free")
    .map((driver) => ({
      ...driver,
      carType: getCarType(data, driver.carTypeId),
      location: getLocation(driver.locationId),
      auth: getUserById(data, driver.userId) // Attach auth details for Admin
    }));
  const drivers = data.drivers.map((driver) => ({
    ...driver,
    carType: getCarType(data, driver.carTypeId),
    location: getLocation(driver.locationId),
    auth: getUserById(data, driver.userId) // Attach auth details for Admin
  }));
  const recentTrips = data.trips.slice(0, 10).map((trip) => enrichTrip(data, trip));

  return {
    carTypes: data.carTypes,
    activeTrips,
    freeDrivers,
    drivers,
    recentTrips,
    metrics
  };
}

export function addDriver(data, payload) {
  const name = payload.name?.trim();
  const username = payload.username?.trim()?.toLowerCase();
  const password = payload.password?.trim();
  const contact = payload.contact?.trim();
  const vehicleNumber = payload.vehicleNumber?.trim();
  const carTypeId = payload.carTypeId;

  if (!name || !username || !password || !contact || !vehicleNumber || !carTypeId) {
    throw new Error("All driver fields are required.");
  }

  if (data.users.find(u => u.username?.toLowerCase() === username)) {
    throw new Error("Username is already taken.");
  }

  const userId = makeUserId("user-driver");
  const driverId = makeUserId("driver");

  const user = {
    id: userId,
    role: "driver",
    username,
    passwordHash: hashPassword(password),
    displayName: name
  };

  const driver = {
    id: driverId,
    userId,
    name,
    username,
    contact,
    status: "offline",
    carTypeId,
    vehicleNumber,
    rating: 5.0, // Default rating for new drivers
    locationId: "airport", // Default spawn location
    lifetimeEarnings: 0,
    currentTripId: null
  };

  data.users.push(user);
  data.drivers.push(driver);

  return driver;
}

export function findUserFromTokenPayload(data, payload) {
  return getUserById(data, payload.userId);
}
