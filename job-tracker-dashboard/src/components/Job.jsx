import StatusControl from "./StatusControl";
import { useNavigate } from "react-router-dom";

function Job({
  job,
  onStatusChange,
  selectionMode,
  selected,
  onToggleSelection,
  selectionDisabled = false,
}) {
  const navigate = useNavigate();
  function openDetails() {
    navigate(`/jobs/${job._id}`);
  }

  function handleRowKeyDown(event) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openDetails();
    }
  }

  const appliedDate = new Date(job.appliedAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <article
      className={`job-row${selectionMode ? " job-row-selection-mode" : ""}${selected ? " job-row-selected" : ""}`}
      role={selectionMode ? undefined : "link"}
      tabIndex={selectionMode ? undefined : 0}
      aria-label={`View ${job.title} at ${job.company}`}
      onClick={selectionMode ? undefined : openDetails}
      onKeyDown={selectionMode ? undefined : handleRowKeyDown}
    >
      {selectionMode && (
        <label
          className="job-selection"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <input
            type="checkbox"
            disabled={selectionDisabled}
            checked={selected}
            onChange={() => onToggleSelection(job._id)}
            aria-label={`Select ${job.title} at ${job.company}`}
          />
        </label>
      )}

      <div className="job-identity">
        <h3>{job.title}</h3>
        <p>{job.company}</p>
      </div>

      <div className="job-meta">
        <span>{job.location || "Location not available"}</span>
        <span className="applied-date">{appliedDate}</span>
      </div>

      <div
        className="job-row-actions"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        {job.url && (
          <a
            className="posting-link"
            href={job.url}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open original posting for ${job.title}`}
          >
            Job Post URL
          </a>
        )}

        {!selectionMode && <StatusControl job={job} onStatusChange={updated => onStatusChange(updated._id, updated.status)} />}

        <span className="row-chevron" aria-hidden="true">
          ›
        </span>
      </div>

    </article>
  );
}

export default Job;
