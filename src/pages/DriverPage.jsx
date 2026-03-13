import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { useAuth, useToast } from "../App";
import { APP_CONFIG } from "../config";

// ── Map ───────────────────────────────────────────────────────────────────────
function DummyMap({ pickup, dropoff, locations, routePoints }) {
    const route = routePoints || [];
    const pathD = route.length >= 2 ? `M ${route.map(p => `${p.x} ${p.y}`).join(" L ")}` : "";
    const gridLines = [
        { x1: 0, y1: 22, x2: 100, y2: 22 }, { x1: 0, y1: 48, x2: 100, y2: 48 },
        { x1: 0, y1: 70, x2: 100, y2: 70 }, { x1: 14, y1: 0, x2: 14, y2: 100 },
        { x1: 52, y1: 0, x2: 52, y2: 100 }, { x1: 78, y1: 0, x2: 78, y2: 100 },
    ];
    return (
        <div className="map-wrap" style={{ height: 180 }}>
            <svg viewBox="0 0 100 100" className="map-svg">
                <rect width="100" height="100" fill="#141420" />
                {gridLines.map((l, i) => <line key={i} {...l} stroke="rgba(255,255,255,0.05)" strokeWidth="1.5" />)}
                {pathD && (
                    <>
                        <path d={pathD} fill="none" stroke="rgba(245,197,66,0.3)" strokeWidth="3" strokeDasharray="3 2" />
                        <path d={pathD} fill="none" stroke="#f5c542" strokeWidth="1.5" />
                    </>
                )}
                {locations.map(loc => {
                    const isP = pickup?.id === loc.id;
                    const isD = dropoff?.id === loc.id;
                    return (
                        <g key={loc.id}>
                            <circle cx={loc.x} cy={loc.y} r={isP || isD ? 4 : 2.5}
                                fill={isP ? "#22d37a" : isD ? "#ff5a5a" : "rgba(255,255,255,0.1)"}
                                stroke="rgba(0,0,0,0.4)" strokeWidth="0.5" />
                            {(isP || isD) && (
                                <text x={loc.x + 4.5} y={loc.y + 1.5} fontSize="4" fill="white" fontWeight="700" dominantBaseline="middle">
                                    {loc.name.split(" ")[0]}
                                </text>
                            )}
                        </g>
                    );
                })}
                {/* Driver car icon at pickup */}
                {pickup && (
                    <text x={pickup.x - 3} y={pickup.y - 5} fontSize="6" textAnchor="middle">🚗</text>
                )}
            </svg>
        </div>
    );
}

const fmt = n => "₹" + Number(n).toLocaleString("en-IN");
function timeAgo(iso) {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return Math.floor(diff / 60) + "m ago";
    return Math.floor(diff / 3600) + "h ago";
}
function statusDotClass(s) {
    if (s === "free") return "free";
    if (s === "offline") return "offline";
    return "on-trip";
}

// ── Trip Card ─────────────────────────────────────────────────────────────────
function TripCard({ trip, locations, onAccept, onReject, onStart, onComplete, loading }) {
    const pickup = locations.find(l => l.id === trip.pickupId);
    const dropoff = locations.find(l => l.id === trip.dropoffId);
    return (
        <div className="active-trip" style={{
            background: "linear-gradient(135deg, rgba(245,197,66,0.1) 0%, rgba(124,111,255,0.08) 100%)",
            border: "1px solid rgba(245,197,66,0.3)"
        }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 3 }}>
                        {trip.pickup?.name || trip.pickupId} → {trip.dropoff?.name || trip.dropoffId}
                    </div>
                    {trip.status === "pending_acceptance" && <span className="badge badge-yellow" style={{ animation: "pulse 1.5s infinite" }}>🚨 New Request</span>}
                    {trip.status === "assigned" && <span className="badge badge-yellow">Ready to Start</span>}
                    {trip.status === "in_progress" && <span className="badge badge-green">In Progress</span>}
                </div>
                <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "#f5c542" }}>{fmt(trip.driverPayout)}</div>
                    <div style={{ fontSize: 11, color: "var(--text3)" }}>your payout</div>
                </div>
            </div>

            <DummyMap pickup={pickup} dropoff={dropoff} locations={locations} routePoints={trip.routePoints} />

            {/* Trip details */}
            <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 13, color: "var(--text2)" }}>
                <span>📏 {Number(trip.distanceKm).toFixed(1)} km</span>
                <span>⏱ ~{trip.durationMin} min</span>
                <span>💳 {fmt(trip.fare)} total</span>
            </div>

            {/* Customer info */}
            {trip.customer && (
                <div style={{ marginTop: 12, background: "rgba(0,0,0,0.3)", borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                    <div className="avatar" style={{ background: "var(--bg4)", width: 32, height: 32, fontSize: 12 }}>
                        {trip.customer.name?.charAt(0) || "C"}
                    </div>
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{trip.customer.name}</div>
                        <div style={{ fontSize: 11, color: "var(--text3)" }}>{trip.customer.phone}</div>
                    </div>
                </div>
            )}

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                {trip.status === "pending_acceptance" && (
                    <>
                        <button className="btn btn-ghost" style={{ flex: 1, color: "var(--red)" }} onClick={() => onReject(trip.id)} disabled={loading}>
                            {loading ? "..." : "✕ Reject"}
                        </button>
                        <button className="btn btn-success" style={{ flex: 2 }} onClick={() => onAccept(trip.id)} disabled={loading}>
                            {loading ? <span className="spinner" /> : "✓ Accept Ride"}
                        </button>
                    </>
                )}
                {trip.status === "assigned" && (
                    <button className="btn btn-success" style={{ flex: 1 }} onClick={() => onStart(trip.id)} disabled={loading}>
                        {loading ? <span className="spinner" /> : "▶ Start Ride"}
                    </button>
                )}
                {(trip.status === "in_progress" || trip.status === "assigned") && (
                    <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => onComplete(trip.id)} disabled={loading}>
                        {loading ? <span className="spinner" /> : "✓ Complete Ride"}
                    </button>
                )}
            </div>
        </div>
    );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function DriverPage() {
    const { session, logout } = useAuth();
    const toast = useToast();
    const navigate = useNavigate();

    const [data, setData] = useState(null);
    const [locations, setLocations] = useState([]);
    const [actionLoading, setActionLoading] = useState(false);
    const pollRef = useRef(null);

    const load = useCallback(async () => {
        try {
            const [dash, boot] = await Promise.all([
                apiFetch("/api/driver/dashboard", { token: session.token }),
                apiFetch("/api/bootstrap")
            ]);
            setData(dash);
            setLocations(boot.locations || []);
        } catch (e) {
            if (e.message.includes("expired") || e.message.includes("valid")) { logout(); navigate("/login"); }
        }
    }, [session.token]);

    useEffect(() => {
        load();
        pollRef.current = setInterval(load, 7000);
        return () => clearInterval(pollRef.current);
    }, [load]);

    async function toggleAvailability() {
        const isAvailable = data.profile.status !== "free";
        setActionLoading(true);
        try {
            await apiFetch("/api/driver/availability", {
                method: "POST", token: session.token,
                body: { available: isAvailable }
            });
            toast(isAvailable ? "You're now online 🟢" : "You're now offline", isAvailable ? "success" : "info");
            await load();
        } catch (e) { toast(e.message, "error"); }
        finally { setActionLoading(false); }
    }

    async function acceptTrip(tripId) {
        setActionLoading(true);
        try {
            await apiFetch(`/api/driver/trips/${tripId}/accept`, { method: "POST", token: session.token });
            toast("Ride accepted!", "success");
            await load();
        } catch (e) { toast(e.message, "error"); }
        finally { setActionLoading(false); }
    }

    async function rejectTrip(tripId) {
        setActionLoading(true);
        try {
            await apiFetch(`/api/driver/trips/${tripId}/reject`, { method: "POST", token: session.token });
            toast("Ride rejected.", "info");
            await load();
        } catch (e) { toast(e.message, "error"); }
        finally { setActionLoading(false); }
    }

    async function startTrip(tripId) {
        setActionLoading(true);
        try {
            await apiFetch(`/api/driver/trips/${tripId}/start`, { method: "POST", token: session.token });
            toast("Trip started! Drive safe 🚗", "success");
            await load();
        } catch (e) { toast(e.message, "error"); }
        finally { setActionLoading(false); }
    }

    async function completeTrip(tripId) {
        setActionLoading(true);
        try {
            const trip = await apiFetch(`/api/driver/trips/${tripId}/complete`, { method: "POST", token: session.token });
            toast(`Trip completed! Earned ${fmt(trip.driverPayout)} 💰`, "success");
            await load();
        } catch (e) { toast(e.message, "error"); }
        finally { setActionLoading(false); }
    }

    if (!data) return (
        <div className="page" style={{ alignItems: "center", justifyContent: "center" }}>
            <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
        </div>
    );

    const { profile, activeTrip, tripHistory } = data;
    const statusDot = statusDotClass(profile.status);
    const isOnline = profile.status !== "offline";

    return (
        <div className="driver-layout">
            {/* Header */}
            <div className="driver-header">
                <div style={{ position: "relative" }}>
                    <div className="avatar" style={{ background: "var(--accent)", color: "#fff", width: 48, height: 48, fontSize: 18 }}>
                        {profile.name?.charAt(0)}
                    </div>
                    <div className={`status-dot ${statusDot} pulse-dot`}
                        style={{ position: "absolute", bottom: 1, right: 1 }} />
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{profile.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text2)" }}>
                        {profile.carType?.name} · {profile.vehicleNumber || "—"}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text3)" }}>⭐ {profile.rating} rating</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                    <button
                        onClick={() => window.confirm("Are you sure you want to sign out?") && logout() && navigate("/login")}
                        style={{ display: window.innerWidth > 600 ? "none" : "inline-flex", alignItems: "center", background: "none", border: "none", color: "var(--red)", padding: 0, cursor: "pointer", marginBottom: 4 }}
                        title="Sign Out"
                    >
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                            <polyline points="16 17 21 12 16 7"></polyline>
                            <line x1="21" y1="12" x2="9" y2="12"></line>
                        </svg>
                    </button>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, cursor: "pointer", color: isOnline ? "var(--green)" : "var(--text3)" }}>
                        <input type="checkbox" checked={isOnline} onChange={toggleAvailability} disabled={actionLoading}
                            style={{ width: 16, height: 16, accentColor: "var(--green)" }} />
                        Online
                    </label>
                    <button className="btn btn-ghost btn-sm" onClick={() => { logout(); navigate("/login"); }}>Exit</button>
                </div>
            </div>

            {/* Support Line */}
            <div style={{ padding: "8px 20px", background: "var(--bg2)", borderBottom: "1px solid var(--border)", fontSize: 12, display: "flex", justifyContent: "space-between", color: "var(--text2)" }}>
                <div><strong>{APP_CONFIG.appName}</strong> Driver App</div>
                <div>Support: {APP_CONFIG.phonePrimary}</div>
            </div>

            <div className="driver-body">
                {/* Earnings banner */}
                <div className="driver-earnings">
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <div>
                            <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Today's Earnings</div>
                            <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: -1 }}>
                                {fmt(profile.earningsToday || 0)}
                            </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Lifetime</div>
                            <div style={{ fontSize: 18, fontWeight: 700 }}>{fmt(profile.lifetimeEarnings || 0)}</div>
                        </div>
                    </div>
                    <div style={{ marginTop: 14, background: "rgba(0,0,0,0.2)", borderRadius: 8, padding: "8px 14px", fontSize: 13 }}>
                        Status: <span style={{ fontWeight: 700 }}>
                            {profile.status === "free" ? "🟢 Available" : profile.status === "offline" ? "⚫ Offline" : profile.status === "on_trip" ? "🟡 On Trip" : "🔵 Assigned"}
                        </span>
                    </div>
                </div>

                {/* Active trip */}
                {activeTrip ? (
                    <div>
                        <div className="section-title">
                            {activeTrip.status === "pending_acceptance" ? "🚨 Incoming Request" : "Current Trip"}
                        </div>
                        <TripCard
                            trip={activeTrip}
                            locations={locations}
                            onAccept={acceptTrip}
                            onReject={rejectTrip}
                            onStart={startTrip}
                            onComplete={completeTrip}
                            loading={actionLoading}
                        />
                    </div>
                ) : (
                    <div className="card" style={{ textAlign: "center", padding: "28px 20px" }}>
                        {isOnline ? (
                            <>
                                <div style={{ fontSize: 36, marginBottom: 10 }}>🔍</div>
                                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Waiting for a ride</div>
                                <div style={{ fontSize: 13, color: "var(--text3)" }}>Customers booking rides will be assigned to you automatically.</div>
                            </>
                        ) : (
                            <>
                                <div style={{ fontSize: 36, marginBottom: 10 }}>💤</div>
                                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>You're offline</div>
                                <div style={{ fontSize: 13, color: "var(--text3)", marginBottom: 14 }}>Go online to start receiving trip requests.</div>
                                <button className="btn btn-success" onClick={toggleAvailability} disabled={actionLoading}>
                                    Go Online 🟢
                                </button>
                            </>
                        )}
                    </div>
                )}

                {/* Trip history */}
                <div>
                    <div className="section-title">Recent Trips</div>
                    <div className="card" style={{ padding: "4px 16px" }}>
                        {tripHistory?.filter(t => t.status === "completed").length === 0 ? (
                            <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text3)", fontSize: 13 }}>
                                No completed trips yet.
                            </div>
                        ) : (
                            tripHistory?.filter(t => t.status === "completed").map(trip => (
                                <div key={trip.id} className="trip-row">
                                    <div className="trip-route">
                                        <div className="trip-from">{trip.pickup?.name || trip.pickupId}</div>
                                        <div className="trip-to">→ {trip.dropoff?.name || trip.dropoffId}</div>
                                        <div className="trip-meta">{timeAgo(trip.completedAt || trip.createdAt)}</div>
                                    </div>
                                    <div style={{ textAlign: "right" }}>
                                        <div style={{ fontWeight: 700, color: "var(--green)" }}>{fmt(trip.driverPayout)}</div>
                                        <div style={{ fontSize: 11, color: "var(--text3)" }}>{Number(trip.distanceKm).toFixed(1)} km</div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
