import cors from "cors";
import express from "express";
import jwt from "jsonwebtoken";
import path from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import {
  completeDriverTrip, createCustomer, createTrip, ensureStore, findUserByEmail, findUserByUsername,
  findUserFromTokenPayload, getAdminDashboard, getCustomerDashboard, getDriverDashboard, getPublicBootstrap,
  getSessionPayload, quoteTrip, setDriverAvailability, startDriverTrip, verifyPassword,
  addCarType, addDriver, acceptTrip, rejectTrip, getCustomerAvailability
} from "./store.js"; 

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "taxios-dev-secret";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, "..", "dist");

await ensureStore(); 

app.use(cors());
app.use(express.json());

function issueToken(user) {
  return jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: "12h" });
}

async function sendAuthResponse(res, user) {
  res.json({
    token: issueToken(user),
    user: await getSessionPayload(null, user)
  });
}

function getToken(req) {
  const auth = req.headers.authorization ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  return auth.slice("Bearer ".length);
}

function requireAuth(expectedRole) {
  return async (req, res, next) => {
    const token = getToken(req);
    if (!token) return res.status(401).json({ message: "Authentication required." });

    try {
      const payload = jwt.verify(token, JWT_SECRET);
      const user = await findUserFromTokenPayload(null, payload);

      if (!user) return res.status(401).json({ message: "Session is no longer valid." });
      if (expectedRole && user.role !== expectedRole) return res.status(403).json({ message: "This area is restricted." });

      req.authUser = user;
      next();
    } catch {
      return res.status(401).json({ message: "Invalid or expired session." });
    }
  };
}

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.get("/api/bootstrap", async (_req, res, next) => {
  try { res.json(await getPublicBootstrap(null)); } catch (err) { next(err); }
});

app.post("/api/auth/customer/signup", async (req, res, next) => {
  try {
    const user = await createCustomer(null, req.body);
    await sendAuthResponse(res, user);
  } catch (err) { next(err); }
});

app.post("/api/auth/customer/login", async (req, res, next) => {
  try {
    const user = await findUserByEmail(null, req.body.email ?? "");
    if (!user || !verifyPassword(req.body.password ?? "", user.password_hash)) {
      return res.status(401).json({ message: "Customer login is invalid." });
    }
    await sendAuthResponse(res, user);
  } catch (err) { next(err); }
});

app.post("/api/auth/driver/login", async (req, res, next) => {
  try {
    const user = await findUserByUsername(null, req.body.username ?? "", "driver");
    if (!user || !verifyPassword(req.body.password ?? "", user.password_hash)) {
      return res.status(401).json({ message: "Driver login is invalid." });
    }
    await sendAuthResponse(res, user);
  } catch (err) { next(err); }
});

app.post("/api/auth/admin/login", async (req, res, next) => {
  try {
    const user = await findUserByUsername(null, req.body.username ?? "", "admin");
    if (!user || !verifyPassword(req.body.password ?? "", user.password_hash)) {
      return res.status(401).json({ message: "Admin login is invalid." });
    }
    await sendAuthResponse(res, user);
  } catch (err) { next(err); }
});

app.get("/api/me", requireAuth(), async (req, res, next) => {
  try { res.json({ user: await getSessionPayload(null, req.authUser) }); } catch (err) { next(err); }
});

app.get("/api/customer/dashboard", requireAuth("customer"), async (req, res, next) => {
  try { res.json(await getCustomerDashboard(null, req.authUser.id)); } catch (err) { next(err); }
});

app.get("/api/customer/availability", requireAuth("customer"), async (req, res, next) => {
  try { res.json(await getCustomerAvailability(null, req.query.pickupId)); } catch (err) { next(err); }
});

app.post("/api/customer/quote", requireAuth("customer"), async (req, res, next) => {
  try { res.json(await quoteTrip(null, req.body)); } catch (err) { next(err); }
});

app.post("/api/customer/trips", requireAuth("customer"), async (req, res, next) => {
  try { res.json(await createTrip(null, req.authUser.id, req.body)); } catch (err) { next(err); }
});

app.post("/api/customer/trips/:tripId/complete", requireAuth("customer"), async (req, res, next) => {
  try {
     res.json(await completeDriverTrip(null, req.authUser.id, req.params.tripId));
  } catch (err) { next(err); }
});

app.get("/api/driver/dashboard", requireAuth("driver"), async (req, res, next) => {
  try { res.json(await getDriverDashboard(null, req.authUser.id)); } catch (err) { next(err); }
});

app.post("/api/driver/availability", requireAuth("driver"), async (req, res, next) => {
  try {
    const driver = await setDriverAvailability(null, req.authUser.id, Boolean(req.body.available));
    res.json({ status: driver.status });
  } catch (err) { next(err); }
});

app.post("/api/driver/trips/:tripId/start", requireAuth("driver"), async (req, res, next) => {
  try { res.json(await startDriverTrip(null, req.authUser.id, req.params.tripId)); } catch (err) { next(err); }
});

app.post("/api/driver/trips/:tripId/accept", requireAuth("driver"), async (req, res, next) => {
  try { res.json(await acceptTrip(null, req.authUser.id, req.params.tripId)); } catch (err) { next(err); }
});

app.post("/api/driver/trips/:tripId/reject", requireAuth("driver"), async (req, res, next) => {
  try { res.json(await rejectTrip(null, req.authUser.id, req.params.tripId)); } catch (err) { next(err); }
});

app.post("/api/driver/trips/:tripId/complete", requireAuth("driver"), async (req, res, next) => {
  try { res.json(await completeDriverTrip(null, req.authUser.id, req.params.tripId)); } catch (err) { next(err); }
});

app.get("/api/admin/dashboard", requireAuth("admin"), async (req, res, next) => {
  try { res.json(await getAdminDashboard(null)); } catch (err) { next(err); }
});

app.post("/api/admin/car-types", requireAuth("admin"), async (req, res, next) => {
  try { res.json(await addCarType(null, req.body)); } catch (err) { next(err); }
});

app.post("/api/admin/drivers", requireAuth("admin"), async (req, res, next) => {
  try { res.json(await addDriver(null, req.body)); } catch (err) { next(err); }
});

if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.use((error, req, res, next) => {
  console.error(error);
  const message = error instanceof Error ? error.message : "Unexpected server error.";
  const status = message.toLowerCase().includes("invalid") ? 400 : 500;
  res.status(status).json({ message });
});

app.listen(PORT, () => {
  console.log(`TaxiOS API running on http://localhost:${PORT}`);
});
