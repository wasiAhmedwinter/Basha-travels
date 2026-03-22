import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { useAuth, useToast } from "../App";
import { APP_CONFIG } from "../config";
import { motion, AnimatePresence } from "framer-motion";

// ── Map component ─────────────────────────────────────────────────────────────
function DummyMap({ locations, pickup, dropoff, routePoints, driverPos, isSearching }) {
    const viewBox = "0 0 100 100";
    const route = routePoints || [];

    // Build road grid lines
    const gridLines = [
        { x1: 0, y1: 22, x2: 100, y2: 22 }, { x1: 0, y1: 48, x2: 100, y2: 48 },
        { x1: 0, y1: 70, x2: 100, y2: 70 }, { x1: 14, y1: 0, x2: 14, y2: 100 },
        { x1: 52, y1: 0, x2: 52, y2: 100 }, { x1: 78, y1: 0, x2: 78, y2: 100 },
    ];

    const pathD = route.length >= 2
        ? `M ${route.map(p => `${p.x} ${p.y}`).join(" L ")}`
        : "";

    function locDot(loc, isPickup, isDropoff) {
        if (!loc) return null;
        return (
            <g key={loc.id}>
                {isPickup && isSearching && (
                    <circle cx={loc.x} cy={loc.y} fill="var(--accent)">
                        <animate attributeName="r" values="3.5; 18" dur="1.5s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.5; 0" dur="1.5s" repeatCount="indefinite" />
                    </circle>
                )}
                <circle cx={loc.x} cy={loc.y} r="3.5" fill={isPickup ? "#22d37a" : isDropoff ? "#7c6fff" : "rgba(255,255,255,0.12)"} stroke="rgba(0,0,0,0.4)" strokeWidth="0.5" />
                {(isPickup || isDropoff) && (
                    <text x={loc.x + 4} y={loc.y + 1.5} fontSize="4" fill="white" fontWeight="700" dominantBaseline="middle">{loc.name.split(" ")[0]}</text>
                )}
            </g>
        );
    }

    return (
        <div className="map-wrap" style={{ height: 200 }}>
            <svg viewBox={viewBox} className="map-svg">
                {/* Background */}
                <rect width="100" height="100" fill="#141420" />
                {/* Grid roads */}
                {gridLines.map((l, i) => (
                    <line key={i} {...l} stroke="rgba(255,255,255,0.05)" strokeWidth="1.5" />
                ))}
                {/* Route path */}
                {pathD && (
                    <>
                        <path d={pathD} fill="none" stroke="rgba(124,111,255,0.3)" strokeWidth="2.5" strokeDasharray="3 2" />
                        <path d={pathD} fill="none" stroke="var(--accent)" strokeWidth="1.5" />
                    </>
                )}
                {/* All location dots */}
                {locations.map(loc => {
                    const isP = pickup?.id === loc.id;
                    const isD = dropoff?.id === loc.id;
                    return locDot(loc, isP, isD);
                })}
                {/* Driver car */}
                {driverPos && (
                    <g>
                        <circle cx={driverPos.x} cy={driverPos.y} r="4" fill="#f5c542" stroke="#000" strokeWidth="0.6" />
                        <text x={driverPos.x} y={driverPos.y} fontSize="4.5" textAnchor="middle" dominantBaseline="middle">🚗</text>
                    </g>
                )}
            </svg>
        </div>
    );
}

// ── Format helpers ────────────────────────────────────────────────────────────
const fmt = n => "₹" + Number(n).toLocaleString("en-IN");
const fmtKm = n => Number(n).toFixed(1) + " km";
const fmtMin = n => n + " min";
function timeAgo(iso) {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return Math.floor(diff / 60) + "m ago";
    return Math.floor(diff / 3600) + "h ago";
}

// ── Car icon by type ──────────────────────────────────────────────────────────
const carIcons = { mini: "🚘", sedan: "🚗", suv: "🚙", executive: "🖤" };
function carIcon(id) { return carIcons[id] || "🚕"; }

// ── Status badge ──────────────────────────────────────────────────────────────
function TripBadge({ status }) {
    const map = {
        assigned: ["badge-yellow", "Assigned"],
        in_progress: ["badge-green", "In Progress"],
        completed: ["badge-purple", "Completed"],
        cancelled: ["badge-red", "Cancelled"],
    };
    const [cls, label] = map[status] || ["badge-gray", status];
    return <span className={`badge ${cls}`}>{label}</span>;
}

// ── Booking flow ──────────────────────────────────────────────────────────────
function BookingFlow({ locations, carTypes, token, onBooked, toast }) {
    const [pickup, setPickup] = useState("");
    const [dropoff, setDropoff] = useState("");
    const [carTypeId, setCarTypeId] = useState("");
    const [quote, setQuote] = useState(null);
    const [step, setStep] = useState("location"); // location | cars | quote | loading
    const [error, setError] = useState("");
    const [availableCars, setAvailableCars] = useState([]);

    // Advance Booking State
    const [isAdvance, setIsAdvance] = useState(false);
    const [scheduledAt, setScheduledAt] = useState("");

    async function getQuote() {
        if (!pickup || !dropoff || pickup === dropoff) {
            setError("Please choose different pickup and dropoff."); return;
        }
        if (!carTypeId) {
            setError("Please select a ride type."); return;
        }
        setError("");
        setStep("loading");
        try {
            const bodyPayload = { pickupId: pickup, dropoffId: dropoff, carTypeId };
            if (isAdvance && scheduledAt) {
                bodyPayload.scheduledAt = new Date(scheduledAt).toISOString();
            }
            const q = await apiFetch("/api/customer/quote", {
                method: "POST", token,
                body: bodyPayload
            });
            setQuote(q);
            setStep("quote");
        } catch (e) { 
            setError(e.message); 
            setStep("cars");
        }
    }

    async function bookRide() {
        setStep("loading");
        try {
            const bodyPayload = { pickupId: pickup, dropoffId: dropoff, carTypeId };
            if (isAdvance && scheduledAt) {
                bodyPayload.scheduledAt = new Date(scheduledAt).toISOString();
            }

            const trip = await apiFetch("/api/customer/trips", {
                method: "POST", token,
                body: bodyPayload
            });
            
            // Stage 1: Show "Finding your ride..." radar animation
            const fakePendingTrip = { ...trip, status: "pending_acceptance", carTypeId: carTypeId };
            onBooked(fakePendingTrip, true);
            
            // Wait 3s for the searching animation
            await new Promise(res => setTimeout(res, 3000));
            
            // Stage 2: Auto-advance — assign driver & move to in_progress
            try {
                const advanced = await apiFetch(`/api/customer/trips/${trip.id}/demo-advance`, {
                    method: "POST", token
                });
                toast("Driver found! 🎉", "success");
                onBooked({ ...advanced, carTypeId: advanced.carTypeId || carTypeId }, false);
            } catch {
                // If advance fails, just refresh to get latest state
                toast("Driver assigned! 🚗", "success");
                onBooked(trip, false);
            }
            
            setStep("location");
            setQuote(null);
            setCarTypeId("");
        } catch (e) {
            setError(e.message);
            setStep("quote");
        }
    }

    const pickupLoc = locations.find(l => l.id === pickup);
    const dropoffLoc = locations.find(l => l.id === dropoff);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Step pills */}
            <div className="step-pills">
                <div className={`step-pill ${step !== "location" ? "done" : "active"}`}>1 Route</div>
                <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                <div className={`step-pill ${step === "cars" ? "active" : step === "quote" || step === "loading" ? "done" : ""}`}>2 Cars</div>
                <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                <div className={`step-pill ${step === "quote" || (step === "loading" && quote) ? "active" : ""}`}>3 Quote</div>
            </div>

            {error && <div className="error-msg">⚠ {error}</div>}

            {/* Mini map preview */}
            {(pickupLoc || dropoffLoc) && (
                <DummyMap
                    locations={locations}
                    pickup={pickupLoc}
                    dropoff={dropoffLoc}
                    routePoints={quote?.routePoints}
                />
            )}

            {/* Step 1: Locations */}
            {(step === "location" || step === "cars" || step === "quote") && (
                <>
                    <div className="form-group">
                        <label className="form-label">📍 Pickup</label>
                        <select className="form-input" value={pickup} onChange={e => { setPickup(e.target.value); setQuote(null); setStep("location"); }}>
                            <option value="">-- Select pickup --</option>
                            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="form-label">🏁 Dropoff</label>
                        <select className="form-input" value={dropoff} onChange={e => { setDropoff(e.target.value); setQuote(null); setStep("location"); }}>
                            <option value="">-- Select dropoff --</option>
                            {locations.filter(l => l.id !== pickup).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                        </select>
                    </div>

                    <div className="form-group" style={{ marginTop: 8 }}>
                        <div style={{ display: "flex", gap: 12, marginBottom: isAdvance ? 8 : 0 }}>
                            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                                <input type="radio" checked={!isAdvance} onChange={() => setIsAdvance(false)} style={{ accentColor: "var(--accent)" }} />
                                Ride Now
                            </label>
                            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                                <input type="radio" checked={isAdvance} onChange={() => setIsAdvance(true)} style={{ accentColor: "var(--accent)" }} />
                                Schedule Later
                            </label>
                        </div>
                        
                        {isAdvance && (
                            <div style={{ position: "relative" }}>
                                {!scheduledAt && (
                                    <div style={{ position: "absolute", left: 14, top: 12, color: "var(--text3)", pointerEvents: "none", fontSize: 14 }}>
                                        Select Date & Time...
                                    </div>
                                )}
                                <input 
                                    type="datetime-local" 
                                    className="form-input" 
                                    value={scheduledAt} 
                                    onChange={e => setScheduledAt(e.target.value)} 
                                    min={new Date().toISOString().slice(0, 16)}
                                    style={{ color: scheduledAt ? "var(--text)" : "transparent" }}
                                />
                            </div>
                        )}
                    </div>
                </>
            )}

            {step === "location" && (
                <button className="btn btn-primary btn-block btn-lg" onClick={async () => {
                    if (!pickup || !dropoff || pickup === dropoff) {
                        setError("Please choose valid pickup and dropoff locations.");
                        return;
                    }
                    if (isAdvance && !scheduledAt) {
                        setError("Please select a date and time for your scheduled ride.");
                        return;
                    }
                    setError("");
                    setStep("loading");
                    try {
                        const avail = await apiFetch(`/api/customer/availability?pickupId=${pickup}`, { token });
                        setAvailableCars(avail);
                        setStep("cars");
                    } catch (e) {
                        setError(e.message);
                        setStep("location");
                    }
                }} disabled={!pickup || !dropoff}>
                    Search Ride →
                </button>
            )}

            {/* Step 2: Car Selection */}
            {step === "cars" && (
                <div>
                    <div className="section-title">Available Rides</div>
                    {carTypes.filter(ct => availableCars.includes(ct.id)).length === 0 ? (
                        <div style={{ padding: "24px", background: "var(--bg2)", borderRadius: 12, textAlign: "center", color: "var(--text3)" }}>
                            <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
                            No cars currently available nearby.
                        </div>
                    ) : (
                        <div className="cartype-grid">
                            {carTypes.filter(ct => availableCars.includes(ct.id)).map(ct => (
                                <div
                                    key={ct.id}
                                    className={`cartype-card ${carTypeId === ct.id ? "selected" : ""}`}
                                    onClick={() => setCarTypeId(ct.id)}
                                >
                                    <div style={{ fontSize: 24 }}>{carIcon(ct.id)}</div>
                                    <div className="cartype-name">{ct.name}</div>
                                    <div className="cartype-rate">₹{ct.ratePerKm}/km · Base ₹{ct.baseFare}</div>
                                    <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>{ct.seats} seats</div>
                                </div>
                            ))}
                        </div>
                    )}
                    
                    <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setStep("location")}>Back</button>
                        <button className="btn btn-primary" style={{ flex: 2 }} onClick={getQuote} disabled={!carTypeId}>Get Quote →</button>
                    </div>
                </div>
            )}

            {/* Step 3: Quote details */}
            {quote && step === "quote" && (
                <div style={{ background: "var(--bg2)", borderRadius: 12, padding: "14px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <span className="section-title" style={{ margin: 0 }}>Trip Summary</span>
                        <span style={{ fontWeight: 800, fontSize: 18, color: "var(--accent)" }}>{fmt(quote.fare)}</span>
                    </div>
                    <div style={{ display: "flex", gap: 16, fontSize: 13, color: "var(--text2)" }}>
                        <span>📏 {fmtKm(quote.distanceKm)}</span>
                        <span>⏱ {fmtMin(quote.durationMin)}</span>
                        <span>⚡ ETA ~3 min</span>
                    </div>
                    <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => { setStep("cars"); setQuote(null); }}>Back</button>
                        <button className="btn btn-primary" style={{ flex: 2 }} onClick={bookRide}>Confirm Code 🚗</button>
                    </div>
                </div>
            )}

            {step === "loading" && (
                <button className="btn btn-primary btn-block btn-lg" disabled>
                    <span className="spinner" /> Processing…
                </button>
            )}
        </div>
    );
}

// ── Active trip panel ─────────────────────────────────────────────────────────
function ActiveTrip({ trip, locations, token, onRefresh, toast }) {
    const [loading, setLoading] = useState(false);
    const pickupLoc = locations.find(l => l.id === trip?.pickupId);
    const dropoffLoc = locations.find(l => l.id === trip?.dropoffId);

    // Simulate driver position along route
    const driverPos = trip?.routePoints?.[1] || pickupLoc;

    const steps = ["assigned", "in_progress", "completed"];
    const stepIdx = steps.indexOf(trip?.status);

    return (
        <div className="active-trip">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div>
                    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
                        {trip.status === "completed" ? "Receipt" : "Active Ride"}
                    </div>
                    <TripBadge status={trip.status} />
                </div>
                <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "var(--accent)" }}>₹{trip.fare}</div>
                    <div style={{ fontSize: 12, color: "var(--text2)" }}>{fmtKm(trip.distanceKm)}</div>
                </div>
            </div>

            {/* Progress */}
            {trip.status !== "pending_acceptance" && (
                <div style={{ display: "flex", gap: 0, marginBottom: 16, alignItems: "center" }}>
                    {["Driver Assigned", "In Progress", "Completed"].map((s, i) => (
                        <div key={s} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: i === 0 ? "flex-start" : i === 2 ? "flex-end" : "center" }}>
                            <div style={{
                                width: 20, height: 20, borderRadius: "50%", fontSize: 10, fontWeight: 700,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                background: i <= stepIdx ? "var(--accent)" : "var(--bg4)",
                                color: i <= stepIdx ? "#fff" : "var(--text3)",
                                marginBottom: 4
                            }}>{i < stepIdx ? "✓" : i + 1}</div>
                            <div style={{ fontSize: 10, color: i <= stepIdx ? "var(--text2)" : "var(--text3)" }}>{s}</div>
                        </div>
                    ))}
                </div>
            )}

            {trip.status === "pending_acceptance" ? (
                <>
                    <DummyMap locations={locations} pickup={pickupLoc} dropoff={dropoffLoc}
                        routePoints={trip.routePoints} isSearching={true} />

                    <div style={{ marginTop: 14, background: "var(--bg2)", borderRadius: 12, padding: "20px 16px", display: "flex", alignItems: "center", gap: 16 }}>
                        <div style={{ position: "relative", width: 48, height: 48, borderRadius: "50%", background: "var(--bg3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <div className="spinner" style={{ position: "absolute", width: "100%", height: "100%", borderWidth: 2, borderColor: "var(--accent) transparent transparent transparent" }} />
                            <span style={{ fontSize: 24 }}>{carIcon(trip.carTypeId)}</span>
                        </div>
                        <div>
                            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>Finding your ride...</div>
                            <div style={{ fontSize: 13, color: "var(--text2)" }}>Contacting nearby {trip.carType?.name || "drivers"}</div>
                        </div>
                    </div>
                </>
            ) : (
                <>
                    <DummyMap locations={locations} pickup={pickupLoc} dropoff={dropoffLoc}
                        routePoints={trip.routePoints} driverPos={driverPos} />

                    {/* Driver Found Banner */}
                    {trip.driver && (trip.status === "in_progress" || trip.status === "assigned") && (
                        <div style={{
                            marginTop: 14, borderRadius: 14, overflow: "hidden",
                            background: "linear-gradient(135deg, rgba(34,211,122,0.12) 0%, rgba(124,111,255,0.08) 100%)",
                            border: "1px solid rgba(34,211,122,0.25)"
                        }}>
                            <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 4, background: "rgba(34,211,122,0.1)", borderBottom: "1px solid rgba(34,211,122,0.15)" }}>
                                <span style={{ fontSize: 16 }}>✅</span>
                                <span style={{ fontSize: 14, fontWeight: 800, color: "var(--green)" }}>Driver Found!</span>
                            </div>
                            <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                                <div className="avatar" style={{ background: "var(--accent)", color: "#fff", width: 44, height: 44, fontSize: 18 }}>
                                    {trip.driver.name.charAt(0)}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 700, fontSize: 15 }}>{trip.driver.name}</div>
                                    <div style={{ fontSize: 12, color: "var(--text2)" }}>{trip.driver.vehicleNumber}</div>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--yellow)", fontSize: 14, fontWeight: 700 }}>
                                    ⭐ {trip.driver.rating}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Driver info fallback for other states */}
                    {trip.driver && trip.status !== "in_progress" && trip.status !== "assigned" && trip.status !== "completed" && (
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14, background: "rgba(0,0,0,0.3)", borderRadius: 12, padding: "12px 14px" }}>
                            <div className="avatar" style={{ background: "var(--accent)", color: "#fff" }}>
                                {trip.driver.name.charAt(0)}
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 700, fontSize: 14 }}>{trip.driver.name}</div>
                                <div style={{ fontSize: 12, color: "var(--text2)" }}>{trip.driver.vehicleNumber}</div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--yellow)", fontSize: 13, fontWeight: 700 }}>
                                ⭐ {trip.driver.rating}
                            </div>
                        </div>
                    )}
                </>
            )}

            {trip.status === "completed" && (
                <div style={{ marginTop: 16, padding: "16px", background: "var(--bg3)", borderRadius: 12, textAlign: "center" }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
                    <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Thanks for riding!</div>
                    <div style={{ fontSize: 13, color: "var(--text2)" }}>Your payment of <strong>{fmt(trip.fare)}</strong> was processed.</div>
                </div>
            )}

            {(trip.status === "in_progress" || trip.status === "assigned") && (
                <button
                    className="btn btn-primary btn-block btn-lg"
                    style={{
                        marginTop: 16, width: "100%",
                        background: "linear-gradient(135deg, var(--green) 0%, #1aaf5d 100%)",
                        color: "#fff", fontWeight: 800, fontSize: 15,
                        border: "none", borderRadius: 12, padding: "14px 20px",
                        boxShadow: "0 4px 16px rgba(34,211,122,0.3)",
                        transition: "all 0.2s ease"
                    }}
                    onClick={async () => {
                        setLoading(true);
                        try {
                            await apiFetch(`/api/customer/trips/${trip.id}/complete`, { method: "POST", token });
                            toast("Ride Completed! 🎉", "success");
                            onRefresh();
                        } catch (e) {
                            toast(e.message, "error");
                        } finally {
                            setLoading(false);
                        }
                    }}
                    disabled={loading}
                >
                    {loading ? <span className="spinner"/> : "✓ Complete Ride (Demo)"}
                </button>
            )}

            <button
                className="btn btn-ghost btn-sm"
                style={{ marginTop: 12, width: "100%" }}
                onClick={() => { setLoading(true); onRefresh().finally(() => setLoading(false)); }}
                disabled={loading}
            >
                {loading ? <span className="spinner" /> : "↻ Refresh Status"}
            </button>
        </div>
    );
}

// ── Trip history ──────────────────────────────────────────────────────────────
function TripHistory({ trips }) {
    if (!trips?.length) return (
        <div style={{ textAlign: "center", color: "var(--text3)", padding: "24px 0", fontSize: 14 }}>
            No past rides yet. Book your first ride! 🚀
        </div>
    );
    return (
        <div>
            {trips.filter(t => t.status === "completed" || t.status === "cancelled").map(trip => (
                <div key={trip.id} className="trip-row">
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--bg3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                        {carIcon(trip.carTypeId)}
                    </div>
                    <div className="trip-route" style={{ flex: 1 }}>
                        <div className="trip-from">{trip.pickup?.name || trip.pickupId}</div>
                        <div className="trip-to">→ {trip.dropoff?.name || trip.dropoffId}</div>
                        <div className="trip-meta">{timeAgo(trip.completedAt || trip.createdAt)}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>₹{trip.fare}</div>
                        <TripBadge status={trip.status} />
                    </div>
                </div>
            ))}
        </div>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function CustomerPage() {
    const { session, logout } = useAuth();
    const toast = useToast();
    const navigate = useNavigate();

    const [data, setData] = useState(null);
    const [tab, setTab] = useState("book"); // book | history
    const pollRef = useRef(null);

    const load = useCallback(async () => {
        try {
            const d = await apiFetch("/api/customer/dashboard", { token: session.token });
            setData(d);
            // Switch to tracking tab if active trip
            if (d.activeTrip) setTab("track");
        } catch (e) {
            if (e.message.includes("expired") || e.message.includes("valid")) { logout(); navigate("/login"); }
        }
    }, [session.token]);

    useEffect(() => {
        load();
        // Poll every 8 seconds when there is an active trip
        pollRef.current = setInterval(() => {
            load();
        }, 8000);
        return () => clearInterval(pollRef.current);
    }, [load]);

    function handleBooked(trip, isFake = false) {
        // Optimistically update
        setData(p => ({ ...p, activeTrip: trip }));
        setTab("track");
        if (!isFake) {
            load();
        }
    }

    function doLogout() {
        logout();
        navigate("/login");
    }

    const user = session.user;

    if (!data) return (
        <div className="page" style={{ alignItems: "center", justifyContent: "center" }}>
            <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
        </div>
    );

    return (
        <div className="page">
            {/* Top nav */}
            <div className="topnav">
                <div className="topnav-logo">
                    {APP_CONFIG.appName.split(" ").length > 1 ? (
                        <>
                            {APP_CONFIG.appName.split(" ")[0]} <span>{APP_CONFIG.appName.split(" ").slice(1).join(" ")}</span>
                        </>
                    ) : (
                        APP_CONFIG.appName
                    )}
                </div>
                <div className="topnav-right">
                    <div className="avatar" style={{ background: "var(--accent)", color: "#fff", width: 34, height: 34, fontSize: 13 }}>
                        {user.displayName?.charAt(0)}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text2)" }}>{user.displayName}</span>
                    <button className="btn btn-ghost btn-sm" onClick={doLogout}>Sign out</button>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ padding: "12px 20px 0", flexShrink: 0 }}>
                <div className="tabs">
                    <button className={`tab ${tab === "book" ? "active" : ""}`} onClick={() => setTab("book")}>
                        {tab === "book" && (
                            <motion.div layoutId="cust-tabs" style={{ position: "absolute", inset: 0, background: "var(--bg3)", borderRadius: "8px", zIndex: -1, boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }} transition={{ type: "spring", stiffness: 300, damping: 30 }} />
                        )}
                        Book
                    </button>
                    {data.activeTrip && (
                        <button className={`tab ${tab === "track" ? "active" : ""}`} onClick={() => setTab("track")}>
                            {tab === "track" && (
                                <motion.div layoutId="cust-tabs" style={{ position: "absolute", inset: 0, background: "var(--bg3)", borderRadius: "8px", zIndex: -1, boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }} transition={{ type: "spring", stiffness: 300, damping: 30 }} />
                            )}
                            🟢 Tracking
                        </button>
                    )}
                    <button className={`tab ${tab === "history" ? "active" : ""}`} onClick={() => setTab("history")}>
                        {tab === "history" && (
                            <motion.div layoutId="cust-tabs" style={{ position: "absolute", inset: 0, background: "var(--bg3)", borderRadius: "8px", zIndex: -1, boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }} transition={{ type: "spring", stiffness: 300, damping: 30 }} />
                        )}
                        History
                    </button>
                </div>
            </div>

            <div className="scroll-area">
                {tab === "book" && !data.activeTrip && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                        {/* Premium Hero Section */}
                        <div className="hero-section" style={{
                            position: "relative",
                            background: "linear-gradient(135deg, #1f1f2e 0%, #141420 100%)", // Force a dark premium background
                            borderRadius: 20,
                            padding: "32px 24px",
                            overflow: "hidden",
                            border: "1px solid rgba(255,255,255,0.1)",
                            color: "#ffffff" // Ensure text is always white against the forced dark background
                        }}>
                            {/* Decorative background glows */}
                            <div style={{ position: "absolute", top: -40, right: -40, width: 120, height: 120, background: "var(--accent)", filter: "blur(60px)", opacity: 0.4, borderRadius: "50%" }} />
                            <div style={{ position: "absolute", bottom: -20, left: -20, width: 100, height: 100, background: "var(--green)", filter: "blur(50px)", opacity: 0.3, borderRadius: "50%" }} />
                            
                            <div style={{ position: "relative", zIndex: 1 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
                                    Welcome to {APP_CONFIG.appName}
                                </div>
                                <h2 style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.2, marginBottom: 12, color: "#fff" }}>
                                    {APP_CONFIG.tagline}
                                </h2>
                                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", lineHeight: 1.5, maxWidth: "90%" }}>
                                    Book a comfortable ride in seconds. Enter your destination below to get started. 🚀
                                </p>
                            </div>
                        </div>

                        <BookingFlow
                            locations={data.locations}
                            carTypes={data.carTypes}
                            token={session.token}
                            onBooked={handleBooked}
                            toast={toast}
                        />
                    </div>
                )}

                {tab === "book" && data.activeTrip && (
                    <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text2)" }}>
                        <div style={{ fontSize: 32, marginBottom: 10 }}>🚗</div>
                        <div style={{ fontWeight: 700, marginBottom: 6 }}>You have an active ride</div>
                        <div style={{ fontSize: 13, marginBottom: 16 }}>Complete it before booking a new one.</div>
                        <button className="btn btn-primary" onClick={() => setTab("track")}>Track Ride →</button>
                    </div>
                )}

                {tab === "track" && data.activeTrip && (
                    <ActiveTrip
                        trip={data.activeTrip}
                        locations={data.locations}
                        token={session.token}
                        onRefresh={load}
                        toast={toast}
                    />
                )}

                {tab === "track" && !data.activeTrip && (
                    <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text3)" }}>
                        <div style={{ fontSize: 40, marginBottom: 10 }}>📭</div>
                        No active ride. Book one!
                    </div>
                )}

                {tab === "history" && (
                    <div>
                        <div className="section-title">Past Rides</div>
                        <TripHistory trips={data.tripHistory} />
                    </div>
                )}
                
                {/* Contact Information Footer */}
                <div style={{ textAlign: "center", marginTop: 40, padding: "30px 20px", borderTop: "1px solid var(--border)", color: "var(--text2)" }}>
                    <div style={{ fontSize: 12, textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em", color: "var(--text3)", marginBottom: 8 }}>Need Help?</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 2 }}>📞 {APP_CONFIG.phonePrimary}</div>
                    <div style={{ fontSize: 13 }}>✉️ {APP_CONFIG.email}</div>
                    <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 12 }}>{APP_CONFIG.address}</div>
                </div>
            </div>
        </div>
    );
}
