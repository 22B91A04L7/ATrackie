import LoadingFeedback from "../components/LoadingFeedback";
import { apiRequest } from "../utils/apiRequest";
import { useEffect, useState } from "react";
import Job from "../components/Job";
import Profile from "../components/Profile";
import { useNavigate } from "react-router-dom";
import { EXTENSION_ID, API_URL } from "../config";

function Dashboard() {
  const [showProfile, setShowProfile] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedJobIds, setSelectedJobIds] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const navigate = useNavigate();

  function handleLogout() {
    if (
      typeof chrome !== "undefined" &&
      chrome.runtime &&
      typeof chrome.runtime.sendMessage === "function"
    ) {
      chrome.runtime.sendMessage(
        EXTENSION_ID,
        {
          type: "LOGOUT",
          token: localStorage.getItem("token"),
        },
        () => {
          if (chrome.runtime.lastError) {
            console.warn(
              "Could not log out extension:",
              chrome.runtime.lastError.message,
            );
            return;
          }
        },
      );
    }

    localStorage.removeItem("token");
    navigate("/login");
  }

  function toggleSelectionMode() {
    setSelectionMode((current) => !current);
    setSelectedJobIds([]);
  }

  function toggleJobSelection(jobId) {
    setSelectedJobIds((current) =>
      current.includes(jobId)
        ? current.filter((id) => id !== jobId)
        : [...current, jobId],
    );
  }

  function cancelSelection() {
    setSelectionMode(false);
    setSelectedJobIds([]);
  }

  function openDeleteConfirmation() {
    if (selectedJobIds.length === 0) {
      return;
    }

    setDeleteError("");
    setShowDeleteConfirmation(true);
  }

  function closeDeleteConfirmation() {
    if (deleting) {
      return;
    }

    setDeleteError("");
    setShowDeleteConfirmation(false);
  }

  async function handleDeleteSelected() {
    if (deleting || selectedJobIds.length === 0) {
      return;
    }

    setDeleting(true);
    setDeleteError("");

    try {
      const token = localStorage.getItem("token");

      const response = await apiRequest(`${API_URL}/api/jobs`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          jobIds: selectedJobIds,
        }),
      });

      if (response.status === 401) {
          if (localStorage.getItem("token") !== token) return;
        localStorage.removeItem("token");
        navigate("/login");
        return;
      }

      if (!response.ok) {
        throw new Error("Unable to delete the selected applications.");
      }

      await response.json();

      setJobs((currentJobs) =>
        currentJobs.filter((job) => !selectedJobIds.includes(job._id)),
      );

      setSelectedJobIds([]);
      setSelectionMode(false);
      setShowDeleteConfirmation(false);
    } catch (error) {
      console.error("Bulk delete error:", error);

      setDeleteError(
        error instanceof Error
          ? error.message
          : "Unable to delete the selected applications.",
      );
    } finally {
      setDeleting(false);
    }
  }

  useEffect(() => {
    async function fetchJobs() {
      try {
        const token = localStorage.getItem("token");

        const response = await apiRequest(`${API_URL}/api/jobs`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.status === 401) {
          if (localStorage.getItem("token") !== token) return;
          localStorage.removeItem("token");
          navigate("/login");
          return;
        }
        if (!response.ok) {
          throw new Error("Failed to fetch applications.");
        }

        const data = await response.json();
        setJobs(Array.isArray(data) ? data : data.jobs || []);
      } catch (error) {
        console.error("Error fetching applications:", error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    }

    fetchJobs();
  }, [navigate]);

  function handleStatusChange(jobId, newStatus) {
    setJobs((currentJobs) =>
      currentJobs.map((job) =>
        job._id === jobId ? { ...job, status: newStatus } : job,
      ),
    );
  }

  if (loading) {
    return (
      <main className="app-shell dashboard-page">
        <section className="state-card" aria-live="polite">
          <div className="loading-indicator" aria-hidden="true" />
          <h2>Loading applications...</h2>
          <LoadingFeedback label="Fetching your applications..." />
          <p>Preparing your job application workspace.</p>
        </section>
      </main>
    );
  }

  if (error) {
    return (
      <main className="app-shell dashboard-page">
        <section className="state-card state-card-error" role="alert">
          <p className="eyebrow">Unable to refresh</p>
          <h2>Could not load applications</h2>
          <p>{error}</p>
        </section>
      </main>
    );
  }

  const appliedCount = jobs.filter((job) => job.status === "Applied").length;
  const interviewCount = jobs.filter(
    (job) => job.status === "Interview",
  ).length;
  const offerCount = jobs.filter(
    (job) => job.status === "Offer Received",
  ).length;

  const filteredJobs = jobs.filter((job) => {
    const searchText = searchTerm.toLowerCase();

    return (
      job.title?.toLowerCase().includes(searchText) ||
      job.company?.toLowerCase().includes(searchText) ||
      job.location?.toLowerCase().includes(searchText)
    );
  });

  return (
    <main className="app-shell dashboard-page">
      <header className="dashboard-header">
        <a className="product-name" href="/jobs" aria-label="ATrackie home">
          <span className="product-mark" aria-hidden="true">
            AT
          </span>
          <span>ATrackie</span>
        </a>
        <div className="profile-actions">
        <button className="logout-button" type="button" aria-expanded={showProfile} onClick={() => setShowProfile(value => !value)}>Profile</button>
        <button className="logout-button" type="button" onClick={handleLogout}>
          Log out
        </button>
        </div>
      </header>
      {showProfile && <Profile onClose={() => setShowProfile(false)} />}

      <section className="career-section" aria-labelledby="career-title">
        <p className="eyebrow">Your career</p>
        <h1 id="career-title">Applications</h1>
        <div className="career-summary" aria-label="Application summary">
          <span>
            <strong>{jobs.length}</strong> applications
          </span>
          <span>
            <strong>{appliedCount}</strong> applied
          </span>
          <span>
            <strong>{interviewCount}</strong> interviews
          </span>
          <span>
            <strong>{offerCount}</strong> offers
          </span>
        </div>
      </section>

      <section
        className="applications-section"
        aria-labelledby="applications-title"
      >
        <div className="applications-toolbar">
          <div className="search-panel">
            <label className="visually-hidden" htmlFor="application-search">
              Search applications
            </label>
            <span className="search-icon" aria-hidden="true" />
            <input
              id="application-search"
              type="search"
              placeholder="Search applications..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          <p className="result-count">
            {filteredJobs.length}{" "}
            {filteredJobs.length === 1 ? "application" : "applications"}
          </p>
          <div className="toolbar-actions">
            {selectionMode ? (
              <>
                <span className="selection-count">
                  {selectedJobIds.length} selected
                </span>

                <button
                  className="cancel-selection-button"
                  type="button"
                  onClick={cancelSelection}
                  disabled={deleting}
                >
                  Cancel
                </button>

                <button
                  className="delete-selected-button"
                  type="button"
                  onClick={openDeleteConfirmation}
                  disabled={selectedJobIds.length === 0 || deleting}
                >
                  Delete ({selectedJobIds.length})
                </button>
              </>
            ) : (
              <button
                className="delete-mode-button"
                type="button"
                onClick={toggleSelectionMode}
                aria-label="Select applications to delete"
                title="Select applications to delete"
              >
                <span className="delete-icon" aria-hidden="true">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 6h18" />
                    <path d="M8 6V4h8v2" />
                    <path d="M19 6l-1 15H6L5 6" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                  </svg>
                </span>
                <span>Select to delete</span>
              </button>
            )}
          </div>
        </div>

        {showDeleteConfirmation && (
          <section
            className="bulk-delete-confirmation"
            role="alertdialog"
            aria-labelledby="bulk-delete-title"
            aria-describedby="bulk-delete-description"
            aria-busy={deleting}
          >
            <div>
              <h2 id="bulk-delete-title">
                Delete {selectedJobIds.length}{" "}
                {selectedJobIds.length === 1 ? "application" : "applications"}?
              </h2>

              <p id="bulk-delete-description">
                This will permanently remove the selected applications from your
                tracker.
              </p>

              <LoadingFeedback active={deleting} label="Deleting applications..." />
              {deleteError && (
                <p className="bulk-delete-error" role="alert">
                  {deleteError}
                </p>
              )}
            </div>

            <div className="bulk-delete-actions">
              <button
                className="cancel-selection-button"
                type="button"
                onClick={closeDeleteConfirmation}
                disabled={deleting}
              >
                Cancel
              </button>

              <button
                className="delete-selected-confirm-button"
                type="button"
                onClick={handleDeleteSelected}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete Applications"}
              </button>
            </div>
          </section>
        )}

        <h2 className="visually-hidden" id="applications-title">
          Application list
        </h2>

        <div className="job-list">
          {filteredJobs.length === 0 ? (
            <div className="empty-state">
              <h3>
                {jobs.length === 0
                  ? "No applications yet"
                  : "No matching applications"}
              </h3>
              <p>
                {jobs.length === 0
                  ? "Track your first application using the ATrackie extension."
                  : "Try a different title, company, or location."}
              </p>
            </div>
          ) : (
            filteredJobs.map((job) => (
              <Job
                key={job._id}
                job={job}
                onStatusChange={handleStatusChange}
                selectionMode={selectionMode}
                selected={selectedJobIds.includes(job._id)}
                onToggleSelection={toggleJobSelection}
                selectionDisabled={deleting || showDeleteConfirmation}
              />
            ))
          )}
        </div>
      </section>
    </main>
  );
}

export default Dashboard;
