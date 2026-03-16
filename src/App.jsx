import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import CustomerPage from "./pages/CustomerPage";
import DriverPage from "./pages/DriverPage";
import AdminPage from "./pages/AdminPage";
import { APP_CONFIG } from "./config";
import { apiFetch } from "./lib/api";

// ─── Auth Context ─────────────────────────────────────────────────────────────
const AuthCtx = createContext(null);
export function useAuth() { return useContext(AuthCtx); }

// ─── Toast Context ────────────────────────────────────────────────────────────
const ToastCtx = createContext(null);
export function useToast() { return useContext(ToastCtx); }

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((msg, type = "info") => {
    const id = Date.now();
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toast-wrap">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>{t.msg}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// ─── Auth Provider ────────────────────────────────────────────────────────────
function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    try {
      const raw = localStorage.getItem("taxios_session");
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });

  const login = useCallback((token, user) => {
    const s = { token, user };
    localStorage.setItem("taxios_session", JSON.stringify(s));
    setSession(s);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("taxios_session");
    setSession(null);
  }, []);

  return (
    <AuthCtx.Provider value={{ session, login, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

// ─── Protected Route ──────────────────────────────────────────────────────────
function Protected({ role, children }) {
  const { session } = useAuth();
  if (!session) return <Navigate to="/login" replace />;
  if (role && session.user.role !== role) return <Navigate to="/login" replace />;
  return children;
}

// ─── Root redirect ────────────────────────────────────────────────────────────
function RootRedirect() {
  const { session } = useAuth();
  if (!session) return <Navigate to="/login" replace />;
  const map = { customer: "/customer", driver: "/driver", admin: "/admin" };
  return <Navigate to={map[session.user.role] ?? "/login"} replace />;
}

// ─── Demo Bootstrap (gates entire app in DEMO_MODE) ──────────────────────────
function DemoBootstrap({ children }) {
  const { session, login } = useAuth();
  const navigate = useNavigate();
  const [demoName, setDemoName] = useState(() => localStorage.getItem("demo_user_name") || "");
  const [nameInput, setNameInput] = useState("");
  const [booting, setBooting] = useState(true);
  const bootedRef = useRef(false);

  useEffect(() => {
    if (!APP_CONFIG.DEMO_MODE) { setBooting(false); return; }
    // Already have a session — done
    if (session) { setBooting(false); return; }
    // No name yet — wait for user to enter it
    if (!demoName) { setBooting(false); return; }
    // Already tried
    if (bootedRef.current) return;
    bootedRef.current = true;

    (async () => {
      try {
        const { token, user } = await apiFetch("/api/auth/customer/login", {
          method: "POST",
          body: { email: "riya@example.com", password: "customer123" }
        });
        user.displayName = demoName;
        login(token, user);
        navigate("/customer");
      } catch (err) {
        console.error("Demo auto-login failed:", err);
        // Fall through to normal app (will show login page)
      } finally {
        setBooting(false);
      }
    })();
  }, [demoName, session]);

  if (!APP_CONFIG.DEMO_MODE) return children;

  // Step 1: Ask for name (only once — saves to localStorage)
  if (!demoName) {
    return (
      <div className="login-page">
        <div className="login-box" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>👋</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Welcome!</div>
          <div style={{ fontSize: 14, color: "var(--text2)", marginBottom: 24, lineHeight: 1.5 }}>
            Enter your name to get started with the <strong>{APP_CONFIG.appName}</strong> demo.
          </div>
          <form onSubmit={(e) => {
            e.preventDefault();
            const name = nameInput.trim();
            if (!name) return;
            localStorage.setItem("demo_user_name", name);
            setDemoName(name);
          }}>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <input
                className="form-input"
                placeholder="Your name"
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                autoFocus
                required
                style={{ textAlign: "center", fontSize: 16 }}
              />
            </div>
            <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={!nameInput.trim()}>
              Continue →
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Step 2: Auto-login in progress
  if (booting || !session) {
    return (
      <div className="login-page">
        <div className="login-box" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "60px 30px" }}>
          <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
          <div style={{ color: "var(--text2)", fontSize: 14 }}>Starting demo…</div>
        </div>
      </div>
    );
  }

  // Step 3: Logged in — render the app
  return children;
}

// ─── Demo Role Switcher (only visible in DEMO_MODE) ──────────────────────────
function DemoRoleSwitcher() {
  const { session, login, logout } = useAuth();
  const navigate = useNavigate();
  const [switching, setSwitching] = useState(false);

  if (!APP_CONFIG.DEMO_MODE || !session) return null;

  const currentRole = session.user?.role || "customer";
  const demoName = localStorage.getItem("demo_user_name") || "Demo User";

  async function switchTo(targetRole) {
    if (targetRole === currentRole || switching) return;
    setSwitching(true);
    try {
      let endpoint, body;
      if (targetRole === "admin") {
        endpoint = "/api/auth/admin/login";
        body = { username: "admin", password: "admin" };
      } else {
        endpoint = "/api/auth/customer/login";
        body = { email: "riya@example.com", password: "customer123" };
      }
      const { token, user } = await apiFetch(endpoint, { method: "POST", body });
      user.displayName = demoName;
      logout();
      login(token, user);
      navigate("/" + user.role);
    } catch (err) {
      console.error("Demo switch failed:", err);
    } finally {
      setSwitching(false);
    }
  }

  const roles = ["customer", "admin"];

  return (
    <div style={{
      position: "fixed", bottom: 24, right: 20, zIndex: 9999,
      display: "flex", gap: 0, borderRadius: 14, overflow: "hidden",
      boxShadow: "0 6px 24px rgba(0,0,0,0.5)",
      border: "1px solid rgba(255,255,255,0.1)",
      backdropFilter: "blur(12px)",
      background: "rgba(20,20,32,0.9)",
      opacity: switching ? 0.6 : 1,
      transition: "opacity 0.2s",
      pointerEvents: switching ? "none" : "auto"
    }}>
      <div style={{
        padding: "6px 10px 6px 12px", fontSize: 10, fontWeight: 700,
        color: "rgba(255,255,255,0.4)", letterSpacing: "0.08em",
        textTransform: "uppercase", display: "flex", alignItems: "center"
      }}>DEMO</div>
      {roles.map(r => (
        <button
          key={r}
          onClick={() => switchTo(r)}
          style={{
            padding: "10px 16px", border: "none", cursor: "pointer",
            fontSize: 13, fontWeight: currentRole === r ? 800 : 500,
            background: currentRole === r
              ? "linear-gradient(135deg, #7c6fff 0%, #5a4fcc 100%)"
              : "transparent",
            color: currentRole === r ? "#fff" : "rgba(255,255,255,0.5)",
            transition: "all 0.2s"
          }}
        >
          {r === "customer" ? "👤 Customer" : "⚙️ Admin"}
        </button>
      ))}
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <DemoBootstrap>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/customer" element={
              <Protected role="customer"><CustomerPage /></Protected>
            } />
            <Route path="/driver" element={
              <Protected role="driver"><DriverPage /></Protected>
            } />
            <Route path="/admin" element={
              <Protected role="admin"><AdminPage /></Protected>
            } />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </DemoBootstrap>
        <DemoRoleSwitcher />
      </ToastProvider>
    </AuthProvider>
  );
}
