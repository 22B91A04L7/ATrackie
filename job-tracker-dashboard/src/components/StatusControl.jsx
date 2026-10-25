import LoadingFeedback from "./LoadingFeedback";
import { apiRequest } from "../utils/apiRequest";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { STATUS_TRANSITIONS } from "../constants/applicationStatus";
import { API_URL } from "../config";

export default function StatusControl({ job, onStatusChange, disabled = false }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState(job.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [pendingStatus, setPendingStatus] = useState(null);

  function handleStatusChange(event) {
    const newStatus = event.target.value;

    if (newStatus === status) {
      return;
    }

    setError("");
    setPendingStatus(newStatus);
  }

  async function confirmStatusChange() {
    if (!pendingStatus || saving) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      const token = localStorage.getItem("token");

      const response = await apiRequest(`${API_URL}/api/jobs/${job._id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: pendingStatus,
        }),
      });

      if (response.status === 401) {
          if (localStorage.getItem("token") !== token) return;
        localStorage.removeItem("token");
        navigate("/login");
        return;
      }

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to update status");

      setStatus(data.job.status);
      onStatusChange(data.job);
      setPendingStatus(null);
    } catch (error) {
      console.error("Status update error:", error);
      setError(error.message || "Could not update status");
    } finally {
      setSaving(false);
    }
  }

  function cancelStatusChange() {
    if (saving) {
      return;
    }

    setPendingStatus(null);
  }


  return <div className="application-status-control">
        <div className="status-control">
          <label className="visually-hidden" htmlFor={`status-${job._id}`}>
            Status for {job.title}
          </label>

          <select
            id={`status-${job._id}`}
            className={`status-select status-${status
              .toLowerCase()
              .replaceAll(" ", "-")}`}
            value={status}
            onChange={handleStatusChange}
            disabled={saving || disabled}
            aria-busy={saving}
          >
            <option value={status}>{status}</option>

            {STATUS_TRANSITIONS[status].map((nextStatus) => (
              <option key={nextStatus} value={nextStatus}>
                {nextStatus}
              </option>
            ))}
          </select>
        </div>


      {pendingStatus && (
        <section
          className="status-confirmation"
          role="alertdialog"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
          aria-labelledby={`status-confirmation-title-${job._id}`}
          aria-describedby={`status-confirmation-description-${job._id}`}
          aria-busy={saving}
        >
          <div>
            <h4 id={`status-confirmation-title-${job._id}`}>
              Change application status?
            </h4>

            <p id={`status-confirmation-description-${job._id}`}>
              This application will move from {status} to {pendingStatus}.
              Status changes cannot move backwards later.
            </p>
          </div>

          <LoadingFeedback active={saving} label="Updating status..." />
          <div className="status-confirmation-actions">
            <button
              type="button"
              onClick={cancelStatusChange}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={confirmStatusChange}
              disabled={saving}
            >
              {saving ? "Updating..." : "Change Status"}
            </button>
          </div>
        </section>
      )}

      {error && (
        <p className="row-error" role="alert">
          {error}
        </p>
      )}

  </div>;
}
