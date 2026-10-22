import { DASHBOARD_URL } from "../config";

function ApplicationSaved({ job, onCaptureAnother }) {
  function handleViewDashboard() {
    chrome.tabs.create({
      url: `${DASHBOARD_URL}/jobs`,
    });
  }

  return (
    <section className="application-saved state-panel">
      <div className="success-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <path d="m7.5 12.5 3 3 6-7" />
        </svg>
      </div>

      <p className="section-kicker">Application recorded</p>

      <h2>Application Saved</h2>

      <p className="saved-message">
        Your application has been added to your tracker.
      </p>

      {(job.title || job.company) && (
        <div className="saved-job">
          {job.title && <strong>{job.title}</strong>}
          {job.company && <span>{job.company}</span>}
        </div>
      )}

      <div className="saved-actions">
        <button
          className="primary-button"
          type="button"
          onClick={handleViewDashboard}
        >
          View Dashboard
        </button>

        <button
          className="secondary-button"
          type="button"
          onClick={onCaptureAnother}
        >
          Capture Another Job
        </button>
      </div>
    </section>
  );
}

export default ApplicationSaved;
