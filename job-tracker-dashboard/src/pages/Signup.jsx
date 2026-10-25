import { apiRequest } from "../utils/apiRequest";
import PasswordInput from "../components/PasswordInput";
import AuthIntro from "../components/AuthIntro";
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { API_URL } from "../config";

function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  async function handleSubmit(event) {
    event.preventDefault();
    if (loading || success) return;
    setError("");
    if (new TextEncoder().encode(password).length > 72) {
      setError("Password is too long. Use at most 72 UTF-8 bytes; some characters use more than one byte.");
      return;
    }
    setLoading(true);

    try {
      const response = await apiRequest(`${API_URL}/api/auth/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Signup failed");
      }

      setSuccess("Account created successfully! Redirecting to login...");

      setTimeout(() => {
        navigate("/login");
      }, 2000);
    } catch (error) {
      console.error("Signup error:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page auth-split signup-page">
      <AuthIntro />
      <section className="auth-card" aria-labelledby="signup-title">
        <div className="auth-brand">
          <span className="brand-mark" aria-hidden="true">
            AT
          </span>
          <span>ATrackie</span>
        </div>

        <div className="auth-heading">
          <p className="eyebrow">Start tracking smarter</p>
          <h1 id="signup-title">Create your account</h1>
          <p>
            Build a clear view of every application, interview, and next step.
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} aria-busy={loading}>
          <div className="form-field">
            <label htmlFor="name">Full name</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
              autoComplete="name"
              required
            />
          </div>

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
              placeholder="Create a secure password"
              autoComplete="new-password"
              minLength={8}
              aria-describedby="password-hint"
              required
            />
            <small id="password-hint">Use at least 8 characters.</small>
          </div>

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}

          {success && (
            <p className="success" role="status">
              {success}
            </p>
          )}

          <button className="auth-submit" type="submit" disabled={loading || Boolean(success)}>
            {loading && <span className="button-spinner" aria-hidden="true" />}
            <span>{loading ? "Creating account..." : "Create account"}</span>
          </button>
        </form>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </section>
    </main>
  );
}

export default Signup;
