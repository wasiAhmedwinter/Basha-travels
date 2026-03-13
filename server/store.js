export * from "./pg-store/math.js";
export * from "./pg-store/auth.js";
export * from "./pg-store/customer.js";
export * from "./pg-store/driver.js";
export * from "./pg-store/admin.js";

// Dummy legacy functions to ensure backwards compatibility with unmodified routes
export async function ensureStore() {
  const { initDb } = await import("./init-db.js");
  await initDb();
}

export async function readStore() {
  return {};
}

export async function withStore(cb) {
  return cb({});
}
