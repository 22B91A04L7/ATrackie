import LoadingFeedback from "../components/LoadingFeedback";
import { useEffect, useState } from "react";

function AuthPage() {
  const [token] = useState(() => new URLSearchParams(window.location.search).get("token"));
  const [message, setMessage] = useState(token ? "Waiting for authentication..." : "No authentication token received.");
  const [status, setStatus] = useState(token ? "loading" : "error");

  useEffect(() => {
    if (!token) return;

    chrome.runtime.sendMessage({ type: "AUTHENTICATE", token }, (response) => {
      if (chrome.runtime.lastError || !response?.success) {
        setMessage("Failed to save authentication.");
        setStatus("error");
        console.error(chrome.runtime.lastError);
        return;
      }

      setMessage("Extension authenticated successfully.");
      setStatus("success");
    });
  }, [token]);

  return (
    <main className="auth-page">
      <section className="auth-panel" aria-live="polite">
        <div className="auth-brand">
          <div className="brand-mark" aria-hidden="true">
            AT
          </div>
          <span>Job Tracker</span>
        </div>

        <div className={`auth-status auth-status-${status}`} aria-hidden="true">
          {status === "loading" && <span className="auth-spinner" />}
          {status === "success" && (
            <svg viewBox="0 0 24 24" focusable="false">
              <path d="m7.5 12.5 3 3 6-7" />
            </svg>
          )}
          {status === "error" && <span>!</span>}
        </div>

        <h1>
          {status === "success"
            ? "You’re connected"
            : status === "error"
              ? "Connection unsuccessful"
              : "Connecting extension"}
        </h1>
        <p className="auth-message">{message}</p>
        <LoadingFeedback active={status === "loading"} label="Connecting your account..." />
        <p className="auth-support">
          {status === "success"
            ? "You can close this page and continue tracking jobs."
            : "Keep this page open while ATrackie completes the connection."}
        </p>
      </section>
    </main>
  );
}

export default AuthPage;
