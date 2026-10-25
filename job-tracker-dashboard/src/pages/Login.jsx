import { apiRequest } from "../utils/apiRequest";
import PasswordInput from "../components/PasswordInput";
import AuthIntro from "../components/AuthIntro";
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { API_URL } from "../config";
import { connectExtension } from "../utils/connectExtension";

function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectionFailed, setConnectionFailed] = useState(false);

  async function connectAccount(token) {
    setConnecting(true);
    try {
      await connectExtension(token);
      navigate("/jobs");
    } catch (error) {
      setConnectionFailed(true);
      setError(`You are signed in, but the extension is not connected. ${error.message}`);
    } finally { setConnecting(false); }
  }

  async function retryConnection() {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      await connectAccount(localStorage.getItem("token"));
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);
    setConnectionFailed(false);

    try {
      const response = await apiRequest(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Login failed");
      }

      localStorage.setItem("token", data.token); // saving token to local storage

      await connectAccount(data.token);
    } catch (error) {
      console.error("Login error:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page auth-split">
      <AuthIntro />
      <section className="auth-card" aria-labelledby="login-title">
        <div className="auth-brand">
          <span className="brand-mark" aria-hidden="true">
            AT
          </span>
          <span>ATrackie</span>
        </div>

        <div className="auth-heading">
          <p className="eyebrow">Welcome back</p>
          <h1 id="login-title">Sign in to your workspace</h1>
          <p>Keep your next opportunity organized and moving forward.</p>
        </div>

        <form className="auth-form" onSubmit={handleLogin} aria-busy={loading}>
          <div className="form-field">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="password">Password</label>
            <PasswordInput
              id="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading && <span className="button-spinner" aria-hidden="true" />}
            <span>{loading ? (connecting ? "Connecting..." : "Signing in...") : "Sign in"}</span>
          </button>
        </form>

        {connectionFailed && (
          <div className="auth-switch">
            <button type="button" disabled={loading} onClick={retryConnection}>
              Retry extension connection
            </button>
            <p><Link to="/jobs">Continue to dashboard</Link></p>
          </div>
        )}

        <p className="auth-switch">
          Don&apos;t have an account? <Link to="/signup">Create account</Link>
        </p>
      </section>
    </main>
  );
}

export default Login;
