import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import CustomerPage from "./pages/CustomerPage";
import DriverPage from "./pages/DriverPage";
import AdminPage from "./pages/AdminPage";
import { APP_CONFIG } from "./config";
import { apiFetch } from "./lib/api";
import { ThemeProvider, useTheme } from "./lib/ThemeContext";

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

  const [booting, setBooting] = useState(true);
  const bootedRef = useRef(false);

  useEffect(() => {
    if (!APP_CONFIG.DEMO_MODE) { setBooting(false); return; }
    if (session) { setBooting(false); return; }

    // If session is null in DEMO_MODE (initial load or after logout), boot into demo customer
    let isMounted = true;
    (async () => {
      setBooting(true);
      try {
        const { token, user } = await apiFetch("/api/auth/customer/login", {
          method: "POST",
          body: { email: "riya@example.com", password: "customer123" }
        });
        user.displayName = "Demo User";
        if (isMounted) {
          login(token, user);
          navigate("/customer", { replace: true });
        }
      } catch (err) {
        console.error("Demo auto-login failed:", err);
      } finally {
        if (isMounted) setBooting(false);
      }
    })();
    return () => { isMounted = false; };
  }, [session, login, navigate]);

  if (!APP_CONFIG.DEMO_MODE) return children;
  
  // Show spinner while booting the real demo session
  if (!session || booting) {
    return (
      <div className="login-page">
        <div className="login-box" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "60px 30px" }}>
          <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
          <div style={{ color: "var(--text2)", fontSize: 14 }}>Starting demo environment...</div>
        </div>
      </div>
    );
  }

  return children;
}

// ─── Demo Role Switcher (only visible in DEMO_MODE) ──────────────────────────
function DemoRoleSwitcher() {
  const { session, login, logout } = useAuth();
  const navigate = useNavigate();
  
  // Dragging state
  const [pos, setPos] = useState({ x: window.innerWidth - 240, y: window.innerHeight - 120 }); // Floating safely above bottom right
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0 });

  const [switching, setSwitching] = useState(false);

  if (!APP_CONFIG.DEMO_MODE || !session) return null;

  const currentRole = session.user?.role || "customer";

  async function switchTo(targetRole) {
    if (targetRole === currentRole || switching) return;
    setSwitching(true);
    
    // Automatically nudge the switcher up if transitioning to admin so it doesn't block the bottom nav
    if (targetRole === "admin") {
      setPos(p => ({ ...p, y: Math.min(p.y, window.innerHeight - 120) }));
    }
    
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
      user.displayName = "Demo " + (targetRole === "admin" ? "Admin" : "User");
      login(token, user);
      navigate("/" + user.role, { replace: true });
    } catch (err) {
      console.error("Demo switch failed:", err);
    } finally {
      setSwitching(false);
    }
  }

  const handlePointerDown = (e) => {
    e.preventDefault(); // Prevent text selection
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX || (e.touches && e.touches[0].clientX),
      startY: e.clientY || (e.touches && e.touches[0].clientY),
      initialX: pos.x,
      initialY: pos.y
    };
  };

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e) => {
      const clientX = e.clientX || (e.touches && e.touches[0].clientX);
      const clientY = e.clientY || (e.touches && e.touches[0].clientY);
      
      const dx = clientX - dragRef.current.startX;
      const dy = clientY - dragRef.current.startY;
      
      // Keep within bounds roughly
      let newX = dragRef.current.initialX + dx;
      let newY = dragRef.current.initialY + dy;
      
      // Basic bounds check to keep it somewhat on screen
      newX = Math.max(10, Math.min(window.innerWidth - 200, newX));
      newY = Math.max(10, Math.min(window.innerHeight - 60, newY));

      setPos({ x: newX, y: newY });
    };

    const handlePointerUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchmove', handlePointerMove, { passive: false });
    window.addEventListener('touchend', handlePointerUp);

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
    };
  }, [isDragging]);

  const roles = ["customer", "admin"];

  return (
    <div style={{
      position: "fixed", 
      left: pos.x,
      top: pos.y,
      zIndex: 9999,
      display: "flex", gap: 0, borderRadius: 14, overflow: "hidden",
      boxShadow: isDragging ? "0 12px 32px rgba(0,0,0,0.6)" : "0 6px 24px rgba(0,0,0,0.5)",
      border: "1px solid rgba(255,255,255,0.1)",
      backdropFilter: "blur(12px)",
      background: "rgba(20,20,32,0.9)",
      opacity: switching ? 0.6 : 1,
      pointerEvents: switching ? "none" : "auto",
      transform: isDragging ? "scale(1.02)" : "scale(1)",
      transition: isDragging ? "none" : "opacity 0.2s, transform 0.2s, box-shadow 0.2s, top 0.4s cubic-bezier(0.2, 0.8, 0.2, 1), left 0.4s ease-out",
      userSelect: "none",
      touchAction: "none",
      whiteSpace: "nowrap"
    }}>
      {/* Drag Handle */}
      <div 
        onMouseDown={handlePointerDown}
        onTouchStart={handlePointerDown}
        title="Drag to move"
        style={{
          padding: "6px", 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center",
          cursor: isDragging ? "grabbing" : "grab",
          background: "rgba(255,255,255,0.05)",
          borderRight: "1px solid rgba(255,255,255,0.08)"
        }}
      >
        <div style={{ display: "flex", gap: 2 }}>
          <div style={{ width: 3, height: 16, borderLeft: "2px dotted rgba(255,255,255,0.4)" }} />
          <div style={{ width: 3, height: 16, borderLeft: "2px dotted rgba(255,255,255,0.4)" }} />
        </div>
      </div>
      
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

// ─── Theme Switcher ──────────────────────────────────────────────────────────
function ThemeSwitcher() {
  const { theme, toggleTheme } = useTheme();
  
  const icons = {
    light: "☀️",
    dark: "🌙",
    system: "🖥️"
  };

  return (
    <button 
      onClick={toggleTheme}
      className="btn-ghost"
      title={`Current theme: ${theme}. Click to change.`}
      style={{
        width: 40, height: 40, borderRadius: 12,
        padding: 0, fontSize: 20, 
        display: "flex", alignItems: "center", justifyContent: "center",
        position: "fixed", top: 12, right: 12, zIndex: 1000,
        background: "var(--bg2)",
        border: "1px solid var(--border2)",
        boxShadow: "var(--shadow)"
      }}
    >
      {icons[theme]}
    </button>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <ThemeProvider>
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
          <ThemeSwitcher />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
