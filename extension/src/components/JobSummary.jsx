function JobSummary({
  job,
  onTrackJob,
  onViewApplication,
  onCompleteDetailsManually,
  duplicate,
  error,
  saving,
}) {
  const hasMetadata = job.location || job.experience || job.salary;

  const isManualCompletionRequired =
    error ===
    "Could not identify enough information to track this opportunity.";

  return (
    <section className="job-summary state-panel">
      <p className="section-kicker">
        {duplicate ? "Already tracked" : "Job details"}
      </p>

      <h2>{job.title || "Title not available"}</h2>

      <p className="job-summary-company">
        {job.company || "Company not available"}
      </p>

      {hasMetadata && (
        <dl className="job-summary-meta">
          {job.location && (
            <div>
              <dt>Location</dt>
              <dd>{job.location}</dd>
            </div>
          )}

          {job.experience && (
            <div>
              <dt>Experience</dt>
              <dd>{job.experience}</dd>
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

      {isManualCompletionRequired ? (
        <div className="manual-entry-prompt">
          <p className="error-message">{error}</p>

          <button
            className="manual-entry-button"
            type="button"
            onClick={onCompleteDetailsManually}
          >
            Complete Details Manually
          </button>
        </div>
      ) : error ? (
        <p className="error-message">{error}</p>
      ) : null}

      {!isManualCompletionRequired &&
        (duplicate ? (
          <button
            className="primary-button"
            type="button"
            onClick={onViewApplication}
          >
            View Application
          </button>
        ) : (
          <button className="primary-button" type="button" onClick={onTrackJob} disabled={saving} aria-busy={saving}>
            {saving ? "Saving..." : "Track This Job"}
          </button>
        ))}
    </section>
  );
}

export default JobSummary;
