import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { useAuth, useToast } from "../App";
import { auth, googleProvider } from "../lib/firebase";
import { signInWithPopup } from "firebase/auth";

import { APP_CONFIG } from "../config";

const ICONS = { customer: "🧍", driver: "🚗", admin: "⚙️" };
const ROLES = ["customer", "driver", "admin"];

export default function LoginPage() {
    const navigate = useNavigate();
    const { login } = useAuth();
    const toast = useToast();

    const [role, setRole] = useState("customer");
    const [mode, setMode] = useState("login"); // login | signup (customer only)
    const [form, setForm] = useState({ email: "", name: "", phone: "", username: "", password: "" });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    function set(field, value) {
        setForm(p => ({ ...p, [field]: value }));
        setError("");
    }

    async function handleGoogleLogin() {
        setLoading(true);
        setError("");
        try {
            const result = await signInWithPopup(auth, googleProvider);
            const userToken = await result.user.getIdToken();
            
            const { token, user } = await apiFetch("/api/auth/google", {
                method: "POST",
                body: { idToken: userToken }
            });

            login(token, user);
            toast("Sign in successful! 👋", "success");
            navigate("/" + user.role);
        } catch (err) {
            if (err.code !== "auth/popup-closed-by-user") {
                setError(err.message);
            }
        } finally {
            setLoading(false);
        }
    }

    async function submit(e) {
        e.preventDefault();
        setLoading(true);
        setError("");
        try {
            let endpoint, body;
            if (role === "customer" && mode === "signup") {
                endpoint = "/api/auth/customer/signup";
                body = { name: form.name, username: form.username, email: form.email, phone: form.phone, password: form.password };
            } else if (role === "customer") {
                endpoint = "/api/auth/customer/login";
                body = { email: form.email, password: form.password };
            } else if (role === "driver") {
                endpoint = "/api/auth/driver/login";
                body = { username: form.username, password: form.password };
            } else {
                endpoint = "/api/auth/admin/login";
                body = { username: form.username, password: form.password };
            }

            const { token, user } = await apiFetch(endpoint, { method: "POST", body });
            login(token, user);
            toast("Welcome back, " + user.displayName + "! 👋", "success");
            navigate("/" + user.role);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    const isSignup = role === "customer" && mode === "signup";

    return (
        <div className="login-page">
            <div className="login-box">
                <div className="login-logo">
                    {/* Split name to style the second word with accent color if exists */}
                    {APP_CONFIG.appName.split(" ").length > 1 ? (
                        <>
                            {APP_CONFIG.appName.split(" ")[0]} <span>{APP_CONFIG.appName.split(" ").slice(1).join(" ")}</span>
                        </>
                    ) : (
                        APP_CONFIG.appName
                    )}
                </div>
                <div className="login-tagline">{APP_CONFIG.tagline}</div>

                {/* Role Selector */}
                <div className="role-selector">
                    {ROLES.map(r => (
                        <button
                            key={r}
                            className={`role-btn ${role === r ? "active" : ""}`}
                            onClick={() => { setRole(r); setMode("login"); setError(""); }}
                        >
                            <div style={{ fontSize: 20, marginBottom: 4 }}>{ICONS[r]}</div>
                            {r.charAt(0).toUpperCase() + r.slice(1)}
                        </button>
                    ))}
                </div>

                <form className="form-stack" onSubmit={submit}>
                    {error && <div className="error-msg">⚠ {error}</div>}

                    {/* Customer signup extra fields */}
                    {isSignup && (
                        <>
                            <div className="form-group">
                                <label className="form-label">Full Name</label>
                                <input className="form-input" placeholder="Riya Sen" value={form.name}
                                    onChange={e => set("name", e.target.value)} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Username</label>
                                <input className="form-input" placeholder="riyasen99" value={form.username}
                                    onChange={e => set("username", e.target.value)} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Phone</label>
                                <input className="form-input" placeholder="+91 90000 00000" value={form.phone}
                                    onChange={e => set("phone", e.target.value)} required />
                            </div>
                        </>
                    )}

                    {/* Email or Username */}
                    {role === "customer" ? (
                        <div className="form-group">
                            <label className="form-label">Username or Email</label>
                            <input className="form-input" type="text" placeholder="you@example.com or riyasen99" value={form.email}
                                onChange={e => set("email", e.target.value)} required />
                        </div>
                    ) : (
                        <div className="form-group">
                            <label className="form-label">Username</label>
                            <input className="form-input" placeholder={role === "admin" ? "admin" : "driver1"} value={form.username}
                                onChange={e => set("username", e.target.value)} required />
                        </div>
                    )}

                    <div className="form-group">
                        <label className="form-label">Password</label>
                        <input className="form-input" type="password" placeholder="••••••••" value={form.password}
                            onChange={e => set("password", e.target.value)} required />
                    </div>

                    {/* Demo hint */}
                    <div style={{ fontSize: 11, color: "var(--text3)", background: "var(--bg2)", padding: "8px 12px", borderRadius: 8, lineHeight: 1.6 }}>
                        {role === "admin" && "🔑 admin / admin"}
                        {role === "driver" && "🔑 driver1 (or 2,3,4) / driver123"}
                        {role === "customer" && "🔑 riya@example.com / customer123"}
                    </div>

                    <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={loading}>
                        {loading ? <span className="spinner" /> : (isSignup ? "Create Account" : "Sign In")}
                    </button>
                </form>

                {role === "customer" && (
                    <>
                        <div className="login-divider"><span>or</span></div>
                        <button 
                            className="btn btn-secondary btn-block btn-google" 
                            onClick={handleGoogleLogin}
                            disabled={loading}
                        >
                            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" width="18" height="18" />
                            Continue with Google
                        </button>
                    </>
                )}

                {role === "customer" && (
                    <div className="form-toggle">
                        {mode === "login"
                            ? <>New here? <button onClick={() => { setMode("signup"); setError(""); }}>Create account</button></>
                            : <>Have an account? <button onClick={() => { setMode("login"); setError(""); }}>Sign in</button></>
                        }
                    </div>
                )}
            </div>
        </div>
    );
}
