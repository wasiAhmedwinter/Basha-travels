import cors from "cors";
import express from "express";
import jwt from "jsonwebtoken";
import path from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import {
  completeDriverTrip,
  createCustomer,
  createTrip,
  ensureStore,
  findUserByEmail,
  findUserByUsername,
  findUserFromTokenPayload,
  getAdminDashboard,
  getCustomerDashboard,
  getDriverDashboard,
  getPublicBootstrap,
  getSessionPayload,
  quoteTrip,
  readStore,
  setDriverAvailability,
  startDriverTrip,
  verifyPassword,
  withStore,
  addCarType,
  addDriver,
  acceptTrip,
  rejectTrip,
  getCustomerAvailability
} from "./store.js";

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "taxios-dev-secret";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, "..", "dist");

await ensureStore();

app.use(cors());
app.use(express.json());

function issueToken(user) {
  return jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, {
    expiresIn: "12h"
  });
}

function sendAuthResponse(res, data, user) {
  res.json({
    token: issueToken(user),
    user: getSessionPayload(data, user)
  });
}

function getToken(req) {
  const authorization = req.headers.authorization ?? "";

  if (!authorization.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice("Bearer ".length);
}

function requireAuth(expectedRole) {
  return async (req, res, next) => {
    const token = getToken(req);

    if (!token) {
      return res.status(401).json({ message: "Authentication required." });
    }

    try {
      const payload = jwt.verify(token, JWT_SECRET);
      const data = await readStore();
      const user = findUserFromTokenPayload(data, payload);

      if (!user) {
        return res.status(401).json({ message: "Session is no longer valid." });
      }

      if (expectedRole && user.role !== expectedRole) {
        return res.status(403).json({ message: "This area is restricted." });
      }

      req.authUser = user;
      next();
    } catch {
      return res.status(401).json({ message: "Invalid or expired session." });
    }
  };
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/bootstrap", async (_req, res, next) => {
  try {
    const data = await readStore();
    res.json(getPublicBootstrap(data));
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/customer/signup", async (req, res, next) => {
  try {
    const response = await withStore((data) => {
      const user = createCustomer(data, req.body);
      return {
        token: issueToken(user),
        user: getSessionPayload(data, user)
      };
    });

    res.json(response);
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/customer/login", async (req, res, next) => {
  try {
    const data = await readStore();
    const user = findUserByEmail(data, req.body.email ?? "");

    if (!user || !verifyPassword(req.body.password ?? "", user.passwordHash)) {
      return res.status(401).json({ message: "Customer login is invalid." });
    }

    sendAuthResponse(res, data, user);
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/driver/login", async (req, res, next) => {
  try {
    const data = await readStore();
    const user = findUserByUsername(data, req.body.username ?? "", "driver");

    if (!user || !verifyPassword(req.body.password ?? "", user.passwordHash)) {
      return res.status(401).json({ message: "Driver login is invalid." });
    }

    sendAuthResponse(res, data, user);
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/admin/login", async (req, res, next) => {
  try {
    const data = await readStore();
    const user = findUserByUsername(data, req.body.username ?? "", "admin");

    if (!user || !verifyPassword(req.body.password ?? "", user.passwordHash)) {
      return res.status(401).json({ message: "Admin login is invalid." });
    }

    sendAuthResponse(res, data, user);
  } catch (error) {
    next(error);
  }
});

app.get("/api/me", requireAuth(), async (req, res, next) => {
  try {
    const data = await readStore();
    res.json({ user: getSessionPayload(data, req.authUser) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/customer/dashboard", requireAuth("customer"), async (req, res, next) => {
  try {
    const data = await readStore();
    res.json(getCustomerDashboard(data, req.authUser.id));
  } catch (error) {
    next(error);
  }
});

app.get("/api/customer/availability", requireAuth("customer"), async (req, res, next) => {
  try {
    const data = await readStore();
    res.json(getCustomerAvailability(data, req.query.pickupId));
  } catch (error) {
    next(error);
  }
});

app.post("/api/customer/quote", requireAuth("customer"), async (req, res, next) => {
  try {
    const data = await readStore();
    res.json(quoteTrip(data, req.body));
  } catch (error) {
    next(error);
  }
});

app.post("/api/customer/trips", requireAuth("customer"), async (req, res, next) => {
  try {
    const trip = await withStore((data) => createTrip(data, req.authUser.id, req.body));
    res.json(trip);
  } catch (error) {
    next(error);
  }
});

app.post("/api/customer/trips/:tripId/complete", requireAuth("customer"), async (req, res, next) => {
  try {
    const trip = await withStore((data) => {
      const t = data.trips.find(x => x.id === req.params.tripId);
      if (!t || t.customerUserId !== req.authUser.id) throw new Error("Trip not found");
      const d = data.drivers.find(drv => drv.id === t.driverId);
      if (!d) throw new Error("Driver not found");
      return completeDriverTrip(data, d.userId, t.id); // Hack: force driver to complete it
    });
    res.json(trip);
  } catch (error) {
    next(error);
  }
});

app.get("/api/driver/dashboard", requireAuth("driver"), async (req, res, next) => {
  try {
    const data = await readStore();
    res.json(getDriverDashboard(data, req.authUser.id));
  } catch (error) {
    next(error);
  }
});

app.post("/api/driver/availability", requireAuth("driver"), async (req, res, next) => {
  try {
    const result = await withStore((data) => {
      const driver = setDriverAvailability(data, req.authUser.id, Boolean(req.body.available));
      return { status: driver.status };
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/api/driver/trips/:tripId/start", requireAuth("driver"), async (req, res, next) => {
  try {
    const trip = await withStore((data) =>
      startDriverTrip(data, req.authUser.id, req.params.tripId)
    );
    res.json(trip);
  } catch (error) {
    next(error);
  }
});

app.post("/api/driver/trips/:tripId/accept", requireAuth("driver"), async (req, res, next) => {
  try {
    const trip = await withStore((data) =>
      acceptTrip(data, req.authUser.id, req.params.tripId)
    );
    res.json(trip);
  } catch (error) {
    next(error);
  }
});

app.post("/api/driver/trips/:tripId/reject", requireAuth("driver"), async (req, res, next) => {
  try {
    const trip = await withStore((data) =>
      rejectTrip(data, req.authUser.id, req.params.tripId)
    );
    res.json(trip);
  } catch (error) {
    next(error);
  }
});

app.post(
  "/api/driver/trips/:tripId/complete",
  requireAuth("driver"),
  async (req, res, next) => {
    try {
      const trip = await withStore((data) =>
        completeDriverTrip(data, req.authUser.id, req.params.tripId)
      );
      res.json(trip);
    } catch (error) {
      next(error);
    }
  }
);

app.get("/api/admin/dashboard", requireAuth("admin"), async (_req, res, next) => {
  try {
    const data = await readStore();
    res.json(getAdminDashboard(data));
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/car-types", requireAuth("admin"), async (req, res, next) => {
  try {
    const carType = await withStore((data) => addCarType(data, req.body));
    res.json(carType);
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/drivers", requireAuth("admin"), async (req, res, next) => {
  try {
    const newDriver = await withStore((data) => addDriver(data, req.body));
    res.json(newDriver);
  } catch (error) {
    next(error);
  }
});

if (existsSync(clientDist)) {
  app.use(express.static(clientDist));

  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }

    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.use((error, _req, res, _next) => {
  const message = error instanceof Error ? error.message : "Unexpected server error.";
  const status = message.toLowerCase().includes("invalid") ? 400 : 500;

  res.status(status).json({ message });
});

app.listen(PORT, () => {
  console.log(`TaxiOS API running on http://localhost:${PORT}`);
});
