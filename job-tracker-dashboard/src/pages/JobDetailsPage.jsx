import { apiRequest } from "../utils/apiRequest";
import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import DeleteApplication from "../components/DeleteApplication";
import StatusControl from "../components/StatusControl";
import { API_URL } from "../config";

function JobDetailsPage() {
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchJob() {
      try {
        const token = localStorage.getItem("token");

        const response = await apiRequest(`${API_URL}/api/jobs/${id}`, {
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
          throw new Error("Failed to fetch job details.");
        }

        const data = await response.json();
        setJob(data.job || data);
      } catch (error) {
        console.error("Error fetching job details:", error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    }

    fetchJob();
  }, [id, navigate]);

  function openDeleteConfirmation() {
    setDeleteError("");
    setShowDeleteConfirmation(true);
  }

  function closeDeleteConfirmation() {
    if (deleting) return;

    setDeleteError("");
    setShowDeleteConfirmation(false);
  }

  async function handleDeleteApplication() {
    if (deleting) return;

    setDeleting(true);
    setDeleteError("");

    try {
      const token = localStorage.getItem("token");

      const response = await apiRequest(`${API_URL}/api/jobs/${id}`, {
        method: "DELETE",
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
        throw new Error("Unable to delete this application. Please try again.");
      }

      navigate("/jobs");
    } catch (error) {
      console.error("Error deleting application:", error);

      setDeleteError(
        error instanceof Error
          ? error.message
          : "Unable to delete this application. Please try again.",
      );
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <main className="app-shell details-page">
        <section className="state-card" aria-live="polite">
          <div className="loading-indicator" aria-hidden="true" />
          <h2>Loading job details...</h2>
          <p>Fetching the full application record.</p>
        </section>
      </main>
    );
  }

  if (error) {
    return (
      <main className="app-shell details-page">
        <section className="state-card state-card-error" role="alert">
          <p className="eyebrow">Details unavailable</p>
          <h2>Could not load job details</h2>
          <p>{error}</p>
          <Link className="back-link" to="/jobs">
            Back to Applications
          </Link>
        </section>
      </main>
    );
  }

  if (!job) {
    return (
      <main className="app-shell details-page">
        <section className="state-card">
          <p className="eyebrow">Not found</p>
          <h2>Job not found</h2>
          <Link className="back-link" to="/jobs">
            Back to Applications
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell details-page">
      <nav className="details-nav" aria-label="Breadcrumb">
        <Link className="back-link" to="/jobs">
          ← Back to applications
        </Link>
      </nav>

      <header className="details-header">
        <div className="details-heading">
          <p className="eyebrow">Application details</p>
          <h1>{job.title}</h1>
          <p className="details-company">{job.company}</p>

          <div className="header-meta">
            <span>{job.location || "Location not available"}</span>
            {job.status && <span className="detail-status">{job.status}</span>}
          </div>
        </div>

        <div className="details-actions">
          {job.url && (
            <a
              className="primary-link"
              href={job.url}
              target="_blank"
              rel="noreferrer"
            >
              Open Job Posting
            </a>
          )}

          <button
            className="delete-application-trigger"
            type="button"
            onClick={openDeleteConfirmation}
            aria-expanded={showDeleteConfirmation}
            aria-controls="delete-application-confirmation"
          >
            Delete Application
          </button>
        </div>
      </header>

      <DeleteApplication
        isOpen={showDeleteConfirmation}
        isDeleting={deleting}
        error={deleteError}
        onCancel={closeDeleteConfirmation}
        onConfirm={handleDeleteApplication}
      />

      <section
        className="details-section timeline-section"
        aria-labelledby="timeline-title"
      >
        <div className="timeline-header">
        <div className="section-heading">
          <p className="eyebrow">Progress</p>
          <h2 id="timeline-title">Application timeline</h2>
        </div>
        <div className="timeline-status">
          <span className="timeline-status-label">Update status</span>
          <StatusControl key={job._id} job={job} onStatusChange={setJob} disabled={deleting} />
        </div>
        </div>

        {job.timeline && job.timeline.length > 0 ? (
          <ol className="timeline-list">
            {job.timeline.map((event, index) => (
              <li key={`${event.timestamp}-${index}`}>
                <span className="timeline-marker" aria-hidden="true" />

                <div className="timeline-event">
                  <strong>{event.status}</strong>

                  <time dateTime={event.timestamp}>
                    {new Date(event.timestamp).toLocaleString()}
                  </time>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted-text">No timeline events available.</p>
        )}
      </section>

      <section
        className="details-section summary-section"
        aria-labelledby="summary-title"
      >
        <div className="section-heading">
          <p className="eyebrow">Overview</p>
          <h2 id="summary-title">Job information</h2>
        </div>

        <dl className="details-grid">
          <div>
            <dt>Company</dt>
            <dd>{job.company}</dd>
          </div>

          <div>
            <dt>Location</dt>
            <dd>{job.location || "Not available"}</dd>
          </div>

          <div>
            <dt>Salary</dt>
            <dd>{job.salary || "Not available"}</dd>
          </div>

          <div>
            <dt>Experience</dt>
            <dd>{job.experience || "Not available"}</dd>
          </div>

          <div>
            <dt>Education</dt>
            <dd>{job.education || "Not available"}</dd>
          </div>

          <div>
            <dt>Job ID</dt>
            <dd>{job.jobId || "Not available"}</dd>
          </div>

          <div>
            <dt>Source</dt>
            <dd>{job.source || "Not available"}</dd>
          </div>
        </dl>
      </section>

      <section
        className="details-section content-section"
        aria-labelledby="description-title"
      >
        <div className="section-heading">
          <h2 id="description-title">Job description</h2>
        </div>

        <p className="job-description-text">
          {job.jobDescription || job.description || "Description not available"}
        </p>
      </section>

      <section
        className="details-section content-section"
        aria-labelledby="responsibilities-title"
      >
        <div className="section-heading">
          <h2 id="responsibilities-title">Responsibilities</h2>
        </div>

        {job.responsibilities && job.responsibilities.length > 0 ? (
          <ul className="content-list">
            {job.responsibilities.map((responsibility, index) => (
              <li key={index}>{responsibility}</li>
            ))}
          </ul>
        ) : (
          <p className="muted-text">Responsibilities not available.</p>
        )}
      </section>

      <div className="skills-layout">
        <section
          className="details-section content-section"
          aria-labelledby="required-skills-title"
        >
          <div className="section-heading">
            <h2 id="required-skills-title">Required skills</h2>
          </div>

          {job.requiredSkills && job.requiredSkills.length > 0 ? (
            <ul className="skill-list">
              {job.requiredSkills.map((skill, index) => (
                <li key={index}>{skill}</li>
              ))}
            </ul>
          ) : (
            <p className="muted-text">Required skills not available.</p>
          )}
        </section>

        <section
          className="details-section content-section"
          aria-labelledby="preferred-skills-title"
        >
          <div className="section-heading">
            <h2 id="preferred-skills-title">Preferred skills</h2>
          </div>

          {job.preferredSkills && job.preferredSkills.length > 0 ? (
            <ul className="skill-list">
              {job.preferredSkills.map((skill, index) => (
                <li key={index}>{skill}</li>
              ))}
            </ul>
          ) : (
            <p className="muted-text">Preferred skills not available.</p>
          )}
        </section>
      </div>
    </main>
  );
}

export default JobDetailsPage;
