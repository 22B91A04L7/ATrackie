function PendingJob({ job, onApplied, onNotYet, onDiscard, saving, error }) {
  return (
    <section className="pending-job state-panel">
      <div className="status-label">
        <span className="status-dot" aria-hidden="true" />
        Awaiting confirmation
      </div>
      <h2>Application Pending</h2>

      <div className="pending-job-summary">
        <strong>{job.title || "Title not available"}</strong>
        <span>{job.company || "Company not available"}</span>
      </div>

      <p className="pending-intro">Have you applied for this job?</p>
      {error && <p className="error-message" role="alert">{error}</p>}

      {(job.location || job.salary) && (
        <dl className="pending-job-details">
          {job.location && (
            <div>
              <dt>Location</dt>
              <dd>{job.location}</dd>
            </div>
          )}
          {job.salary && (
            <div>
              <dt>Salary</dt>
              <dd>{job.salary}</dd>
            </div>
          )}
        </dl>
      )}

      <div className="pending-job-actions">
        <button
          className="primary-button"
          type="button"
          onClick={onApplied}
          disabled={saving}
          aria-busy={saving}
        >
          {saving ? "Saving..." : "Yes, I Applied"}
        </button>

        <button
          className="secondary-button"
          type="button"
          onClick={onNotYet}
          disabled={saving}
        >
          Not Yet
        </button>

        <button
          className="discard-button"
          type="button"
          onClick={onDiscard}
          disabled={saving}
        >
          Discard
        </button>
      </div>
    </section>
  );
}

export default PendingJob;
