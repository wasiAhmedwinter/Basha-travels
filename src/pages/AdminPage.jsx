import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { useAuth, useToast } from "../App";
import { APP_CONFIG } from "../config";

const fmt = n => "₹" + Number(n).toLocaleString("en-IN");
function timeAgo(iso) {
    if (!iso) return "—";
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return Math.floor(diff / 60) + "m ago";
    return Math.floor(diff / 3600) + "h ago";
}

// ── Revenue bar chart ─────────────────────────────────────────────────────────
function RevenueChart({ data }) {
    const max = Math.max(...data.map(d => d.total), 1);
    const palette = ["#7c6fff", "#22d37a", "#f5c542", "#ff5a5a", "#60d0ff", "#ff9f5a"];
    return (
        <div>
            <div className="bar-chart">
                {data.map((d, i) => (
                    <div key={d.id} className="bar-wrap">
                        <div className="bar" style={{
                            height: `${Math.max(8, (d.total / max) * 100)}%`,
                            background: palette[i % palette.length],
                            opacity: d.total > 0 ? 1 : 0.2
                        }} />
                        <div className="bar-label">{d.name.split(" ")[0]}</div>
                    </div>
                ))}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", marginTop: 10 }}>
                {data.map((d, i) => (
                    <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text2)" }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: palette[i % palette.length] }} />
                        {d.name}: <strong style={{ color: "var(--text)" }}>{fmt(d.total)}</strong>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Trip status badge ─────────────────────────────────────────────────────────
function StatusBadge({ status }) {
    const map = {
        assigned: ["badge-yellow", "Assigned"],
        in_progress: ["badge-green", "In Progress"],
        completed: ["badge-purple", "Completed"],
        cancelled: ["badge-red", "Cancelled"],
    };
    const [cls, label] = map[status] || ["badge-gray", status];
    return <span className={`badge ${cls}`}>{label}</span>;
}

// ── Driver status dot ─────────────────────────────────────────────────────────
function DriverDot({ status }) {
    const cls = status === "free" ? "free" : status === "offline" ? "offline" : "on-trip";
    return <div className={`status-dot ${cls}`} />;
}

// ── Add Car Type Modal ────────────────────────────────────────────────────────
function AddCarModal({ token, onSaved, toast, onClose }) {
    const [form, setForm] = useState({ name: "", ratePerKm: "", baseFare: "", minFare: "", seats: "4", theme: "#7c6fff" });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    function set(k, v) { setForm(p => ({ ...p, [k]: v })); setError(""); }

    async function save(e) {
        e.preventDefault();
        setLoading(true);
        try {
            const ct = await apiFetch("/api/admin/car-types", {
                method: "POST", token,
                body: { ...form, ratePerKm: Number(form.ratePerKm), baseFare: Number(form.baseFare), minFare: Number(form.minFare), seats: Number(form.seats) }
            });
            toast("Car type added: " + ct.name, "success");
            onSaved();
        } catch (e) { setError(e.message); }
        finally { setLoading(false); }
    }

    return (
        <div style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20
        }}>
            <div className="card" style={{ width: "100%", maxWidth: 420, maxHeight: "90dvh", overflowY: "auto" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                    <div style={{ fontSize: 17, fontWeight: 700 }}>Add Car Type</div>
                    <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text2)", cursor: "pointer", fontSize: 18 }}>✕</button>
                </div>
                {error && <div className="error-msg" style={{ marginBottom: 12 }}>⚠ {error}</div>}
                <form className="form-stack" onSubmit={save}>
                    {[
                        { key: "name", label: "Type Name", placeholder: "e.g. Compact" },
                        { key: "ratePerKm", label: "Rate per km (₹)", placeholder: "16", type: "number" },
                        { key: "baseFare", label: "Base Fare (₹)", placeholder: "80", type: "number" },
                        { key: "minFare", label: "Minimum Fare (₹)", placeholder: "140", type: "number" },
                        { key: "seats", label: "Seats", placeholder: "4", type: "number" },
                    ].map(f => (
                        <div key={f.key} className="form-group">
                            <label className="form-label">{f.label}</label>
                            <input className="form-input" type={f.type || "text"} placeholder={f.placeholder}
                                value={form[f.key]} onChange={e => set(f.key, e.target.value)} required />
                        </div>
                    ))}
                    <div className="form-group">
                        <label className="form-label">Theme Colour</label>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <input type="color" value={form.theme} onChange={e => set("theme", e.target.value)}
                                style={{ width: 40, height: 36, border: "none", borderRadius: 6, cursor: "pointer", background: "none" }} />
                            <input className="form-input" value={form.theme} onChange={e => set("theme", e.target.value)} style={{ flex: 1 }} />
                        </div>
                    </div>
                    <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                        <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={loading}>
                            {loading ? <span className="spinner" /> : "Add Car Type"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ── Add Driver Modal ────────────────────────────────────────────────────────
function AddDriverModal({ token, carTypes, onSaved, toast, onClose }) {
    const [form, setForm] = useState({ name: "", username: "", contact: "", password: "", vehicleNumber: "", carTypeId: carTypes[0]?.id || "" });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    function set(k, v) { setForm(p => ({ ...p, [k]: v })); setError(""); }

    async function save(e) {
        e.preventDefault();
        setLoading(true);
        try {
            await apiFetch("/api/admin/drivers", {
                method: "POST", token,
                body: form
            });
            toast("Driver added successfully", "success");
            onSaved();
        } catch (e) { setError(e.message); }
        finally { setLoading(false); }
    }

    return (
        <div style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20
        }}>
            <div className="card" style={{ width: "100%", maxWidth: 420, maxHeight: "90dvh", overflowY: "auto" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                    <div style={{ fontSize: 17, fontWeight: 700 }}>Add Driver</div>
                    <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text2)", cursor: "pointer", fontSize: 18 }}>✕</button>
                </div>
                {error && <div className="error-msg" style={{ marginBottom: 12 }}>⚠ {error}</div>}
                <form className="form-stack" onSubmit={save}>
                    <div className="form-group">
                        <label className="form-label">Full Name</label>
                        <input className="form-input" value={form.name} onChange={e => set("name", e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Contact / Phone</label>
                        <input className="form-input" value={form.contact} onChange={e => set("contact", e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Login Username</label>
                        <input className="form-input" value={form.username} onChange={e => set("username", e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Login Password</label>
                        <input className="form-input" type="password" value={form.password} onChange={e => set("password", e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Vehicle Registration No.</label>
                        <input className="form-input" value={form.vehicleNumber} onChange={e => set("vehicleNumber", e.target.value)} required placeholder="e.g. MH 01 AB 1234" />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Car Type</label>
                        <select className="form-input" value={form.carTypeId} onChange={e => set("carTypeId", e.target.value)} required>
                            {carTypes.map(ct => <option key={ct.id} value={ct.id}>{ct.name} ({ct.seats} seats)</option>)}
                        </select>
                    </div>
                    
                    <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                        <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={loading}>
                            {loading ? <span className="spinner" /> : "Add Driver"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ── Sidebar nav items ─────────────────────────────────────────────────────────
const NAV = [
    { id: "overview", icon: "📊", label: "Overview" },
    { id: "trips", icon: "🗺️", label: "Live Trips" },
    { id: "drivers", icon: "🚗", label: "Drivers" },
    { id: "cartypes", icon: "🏷️", label: "Car Types" },
];

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AdminPage() {
    const { session, logout } = useAuth();
    const toast = useToast();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [nav, setNav] = useState("overview");
    const [showAdd, setShowAdd] = useState(false);
    const [showAddDriver, setShowAddDriver] = useState(false);
    const [expandedDriver, setExpandedDriver] = useState(null);

    const load = useCallback(async () => {
        try {
            const d = await apiFetch("/api/admin/dashboard", { token: session.token });
            setData(d);
        } catch (e) {
            if (e.message.includes("expired") || e.message.includes("valid")) { logout(); navigate("/login"); }
        }
    }, [session.token]);

    useEffect(() => {
        load();
        const t = setInterval(load, 10000);
        return () => clearInterval(t);
    }, [load]);

    function doLogout() { logout(); navigate("/login"); }

    if (!data) return (
        <div className="page" style={{ alignItems: "center", justifyContent: "center" }}>
            <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
        </div>
    );

    const { metrics, activeTrips, freeDrivers, drivers, recentTrips, carTypes } = data;

    const logoutBtn = (
        <button 
            onClick={() => window.confirm("Are you sure you want to sign out?") && doLogout()} 
            style={{ display: window.innerWidth > 600 ? "none" : "inline-flex", alignItems: "center", background: "none", border: "none", color: "var(--red)", marginRight: 12, padding: 0, cursor: "pointer" }}
            title="Sign Out"
        >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
        </button>
    );

    return (
        <div className="admin-layout">
            {/* Sidebar */}
            <aside className="admin-sidebar" style={{ display: window.innerWidth <= 600 ? "none" : "flex" }}>
                <div className="sidebar-logo">
                    {APP_CONFIG.appName.split(" ").length > 1 ? (
                        <>
                            {APP_CONFIG.appName.split(" ")[0]} <span>{APP_CONFIG.appName.split(" ").slice(1).join(" ")}</span>
                        </>
                    ) : (
                        APP_CONFIG.appName
                    )}
                </div>
                <nav className="sidebar-nav">
                    {NAV.map(n => (
                        <button key={n.id} className={`sidebar-item ${nav === n.id ? "active" : ""}`} onClick={() => setNav(n.id)}>
                            <span>{n.icon}</span> {n.label}
                            {n.id === "trips" && metrics.activeTrips > 0 && (
                                <span className="badge badge-green" style={{ marginLeft: "auto", padding: "1px 7px" }}>
                                    {metrics.activeTrips}
                                </span>
                            )}
                        </button>
                    ))}
                </nav>
                <div className="sidebar-bottom">
                    <div style={{ fontSize: 12, color: "var(--text3)", padding: "0 12px 10px" }}>
                        Signed in as <strong style={{ color: "var(--text2)" }}>{session.user.displayName}</strong>
                    </div>
                    <button className="sidebar-item" onClick={doLogout} style={{ color: "var(--red)", width: "100%" }}>
                        <span>🚪</span> Sign Out
                    </button>
                </div>
            </aside>
            {/* Content */}
            <main className="admin-content">
                {/* ── Overview ── */}
                {nav === "overview" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                        <div>
                            <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>{logoutBtn}Dashboard</h1>
                            <div style={{ fontSize: 13, color: "var(--text3)" }}>Real-time operations overview</div>
                        </div>

                        {/* Key metrics */}
                        <div className="stats-grid">
                            {[
                                { label: "Gross Revenue", value: fmt(metrics.grossRevenue), sub: "All time", color: "var(--accent)" },
                                { label: "Platform Earnings", value: fmt(metrics.platformEarnings), sub: "26% margin" },
                                { label: "Driver Payouts", value: fmt(metrics.driverPayouts), sub: "74% to drivers" },
                                { label: "Active Trips", value: metrics.activeTrips, sub: "Right now", color: "var(--yellow)" },
                                { label: "Free Drivers", value: metrics.freeDrivers, sub: "Available", color: "var(--green)" },
                                { label: "Total Trips", value: metrics.totalTrips, sub: "All time" },
                            ].map(s => (
                                <div key={s.label} className="stat-card">
                                    <div className="stat-label">{s.label}</div>
                                    <div className="stat-value" style={{ color: s.color || "var(--text)" }}>{s.value}</div>
                                    <div className="stat-sub">{s.sub}</div>
                                </div>
                            ))}
                        </div>

                        {/* Revenue by car type */}
                        <div className="card">
                            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Revenue by Car Type</div>
                            <RevenueChart data={metrics.revenueByCarType} />
                        </div>

                        {/* Recent trips */}
                        <div className="card">
                            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Recent Trips</div>
                            {recentTrips.slice(0, 5).map(trip => (
                                <div key={trip.id} className="trip-row">
                                    <div className="trip-route">
                                        <div className="trip-from">{trip.pickup?.name || trip.pickupId} → {trip.dropoff?.name || trip.dropoffId}</div>
                                        <div className="trip-to">
                                            {trip.driver?.name || "—"} · {trip.customer?.name || "—"}
                                        </div>
                                        <div className="trip-meta">{timeAgo(trip.createdAt)}</div>
                                    </div>
                                    <div style={{ textAlign: "right", minWidth: 90 }}>
                                        <div style={{ fontWeight: 700, fontSize: 15 }}>{fmt(trip.fare)}</div>
                                        <StatusBadge status={trip.status} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Live Trips ── */}
                {nav === "trips" && (
                    <div>
                        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>{logoutBtn}Live Trips</h1>
                        <div style={{ fontSize: 13, color: "var(--text3)", marginBottom: 20 }}>{activeTrips.length} active rides right now</div>
                        {activeTrips.length === 0 ? (
                            <div className="card" style={{ textAlign: "center", padding: "40px 20px", color: "var(--text3)" }}>
                                <div style={{ fontSize: 36, marginBottom: 10 }}>🏁</div>
                                No active trips right now.
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                {activeTrips.map(trip => (
                                    <div key={trip.id} className="card">
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: 15 }}>
                                                    {trip.pickup?.name} → {trip.dropoff?.name}
                                                </div>
                                                <div style={{ fontSize: 13, color: "var(--text2)", marginTop: 3 }}>
                                                    {trip.carType?.name} · {Number(trip.distanceKm).toFixed(1)} km
                                                </div>
                                            </div>
                                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                                                <StatusBadge status={trip.status} />
                                                <div style={{ fontWeight: 800, fontSize: 17 }}>{fmt(trip.fare)}</div>
                                            </div>
                                        </div>
                                        <div style={{ display: "flex", gap: 20, fontSize: 13, color: "var(--text2)" }}>
                                            <span>🚗 {trip.driver?.name || "—"}</span>
                                            <span>👤 {trip.customer?.name || "—"}</span>
                                            <span>⭐ {trip.driver?.rating}</span>
                                            <span>⏱ Started {timeAgo(trip.startedAt || trip.assignedAt)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Recent completed too */}
                        <div style={{ marginTop: 24 }}>
                            <div className="section-title">All Trips</div>
                            <div className="card" style={{ padding: "4px 16px" }}>
                                {recentTrips.map(trip => (
                                    <div key={trip.id} className="trip-row">
                                        <div className="trip-route">
                                            <div className="trip-from">{trip.pickup?.name} → {trip.dropoff?.name}</div>
                                            <div className="trip-to">{trip.driver?.name} · {trip.customer?.name}</div>
                                            <div className="trip-meta">{timeAgo(trip.createdAt)}</div>
                                        </div>
                                        <div style={{ textAlign: "right" }}>
                                            <div style={{ fontWeight: 700 }}>{fmt(trip.fare)}</div>
                                            <StatusBadge status={trip.status} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Drivers ── */}
                {nav === "drivers" && (
                    <div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                            <div>
                                <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>{logoutBtn}Drivers</h1>
                                <div style={{ fontSize: 13, color: "var(--text3)" }}>
                                    {freeDrivers.length} free · {drivers.length - freeDrivers.length} on trip or offline
                                </div>
                            </div>
                            <button className="btn btn-primary" onClick={() => setShowAddDriver(true)}>+ Add Driver</button>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
                            {drivers.map(d => {
                                const isExpanded = expandedDriver === d.id;
                                return (
                                <div key={d.id} className="card card-sm" style={{ cursor: "pointer", transition: "all 0.2s" }} onClick={() => setExpandedDriver(isExpanded ? null : d.id)}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                        <div style={{ position: "relative" }}>
                                            <div className="avatar" style={{ background: "var(--bg3)", color: "var(--text)", width: 42, height: 42 }}>
                                                {d.name.charAt(0)}
                                            </div>
                                            <DriverDot status={d.status} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 700, fontSize: 14 }}>{d.name}</div>
                                            <div style={{ fontSize: 12, color: "var(--text2)" }}>{d.carType?.name}</div>
                                            <div style={{ fontSize: 11, color: "var(--text3)" }}>{d.vehicleNumber}</div>
                                        </div>
                                        <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                                            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-color, var(--text))" }}>
                                                ⭐ {d.rating}
                                            </div>
                                            <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>@ {d.location?.name?.split(" ")[0]}</div>
                                            <div style={{ fontSize: 18, color: "var(--text3)", marginTop: 4, transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
                                                ▾
                                            </div>
                                        </div>
                                    </div>

                                    {/* Expanded Details Section */}
                                    {isExpanded && (
                                        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 12 }}>
                                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                                <div style={{ fontSize: 11, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 0.5 }}>Contact Information</div>
                                                <div style={{ fontSize: 14 }}>{d.contact || "—"}</div>
                                            </div>
                                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                                <div style={{ fontSize: 11, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 0.5 }}>Login Credentials</div>
                                                <div style={{ fontSize: 13, background: "var(--bg2)", padding: "10px", borderRadius: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                                                    <div><span style={{ color: "var(--text3)" }}>Username:</span> {d.auth?.username || d.username}</div>
                                                    <div><span style={{ color: "var(--text3)" }}>Hidden Pass Hash:</span> {d.auth?.passwordHash ? "••••••••" : "Unknown"}</div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
                                        <div style={{ flex: 1, background: "var(--bg2)", borderRadius: 8, padding: "8px 12px" }}>
                                            <div style={{ fontSize: 10, color: "var(--text3)", marginBottom: 2 }}>LIFETIME</div>
                                            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--green)" }}>{fmt(d.lifetimeEarnings)}</div>
                                        </div>
                                        <div style={{ flex: 1, background: "var(--bg2)", borderRadius: 8, padding: "8px 12px" }}>
                                            <div style={{ fontSize: 10, color: "var(--text3)", marginBottom: 2 }}>STATUS</div>
                                            <div style={{ fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>
                                                <DriverDot status={d.status} />
                                                {d.status === "free" ? "Free" : d.status === "offline" ? "Offline" : d.status === "on_trip" ? "On Trip" : "Assigned"}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )})}
                        </div>
                    </div>
                )}

                {/* ── Car Types ── */}
                {nav === "cartypes" && (
                    <div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                            <div>
                                <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>{logoutBtn}Car Types & Pricing</h1>
                                <div style={{ fontSize: 13, color: "var(--text3)" }}>Manage ride categories and rates</div>
                            </div>
                            <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add Type</button>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
                            {carTypes.map(ct => (
                                <div key={ct.id} className="card" style={{ borderTop: `3px solid ${ct.theme || "var(--accent)"}` }}>
                                    <div style={{ display: "flex", justify: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 700, fontSize: 16 }}>{ct.name}</div>
                                            <div style={{ fontSize: 12, color: "var(--text3)" }}>{ct.seats} seats</div>
                                        </div>
                                        <div style={{ width: 12, height: 12, borderRadius: "50%", background: ct.theme || "var(--accent)", marginTop: 4 }} />
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                        {[
                                            { label: "Rate per km", value: `₹${ct.ratePerKm}` },
                                            { label: "Base Fare", value: `₹${ct.baseFare}` },
                                            { label: "Min Fare", value: `₹${ct.minFare}` },
                                        ].map(row => (
                                            <div key={row.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                                                <span style={{ color: "var(--text2)" }}>{row.label}</span>
                                                <span style={{ fontWeight: 700 }}>{row.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>

            {/* Mobile Bottom Navigation */}
            <nav className="admin-mobile-nav">
                {NAV.map(n => (
                    <button key={n.id} className={`sidebar-item ${nav === n.id ? "active" : ""}`} onClick={() => setNav(n.id)}>
                        <span style={{ fontSize: 18, marginBottom: 2 }}>{n.icon}</span> 
                        {n.label}
                    </button>
                ))}
            </nav>

            {showAdd && (
                <AddCarModal
                    token={session.token}
                    toast={toast}
                    onSaved={() => { setShowAdd(false); load(); }}
                    onClose={() => setShowAdd(false)}
                />
            )}
            
            {showAddDriver && (
                <AddDriverModal
                    token={session.token}
                    carTypes={carTypes}
                    toast={toast}
                    onSaved={() => { setShowAddDriver(false); load(); }}
                    onClose={() => setShowAddDriver(false)}
                />
            )}
        </div>
    );
}
