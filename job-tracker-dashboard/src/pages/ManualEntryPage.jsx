import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { EXTENSION_ID } from "../config";

function ManualEntryPage() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    title: "",
    company: "",
    url: "",
    source: "",
    location: "",
    salary: "",
    jobId: "",
    experience: "",
    education: "",
    responsibilities: "",
    requiredSkills: "",
    preferredSkills: "",
    jobDescription: "",
  });

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [pageToken] = useState(() => localStorage.getItem("token"));
  const [draftRevision, setDraftRevision] = useState(null);
  const [draftReady, setDraftReady] = useState(false);

  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
      queueMicrotask(() => setError("Connect the ATrackie extension before completing this opportunity."));
      return;
    }
    chrome.runtime.sendMessage(
      EXTENSION_ID,
      { type: "GET_MANUAL_ENTRY_JOB", token: pageToken },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error(
            "Could not get manual entry job:",
            chrome.runtime.lastError.message,
          );
          setError("Could not connect to the extension. Reconnect your account and reload this page.");
          return;
        }

        if (!response?.success) {
          setError(response?.error || "Could not load your draft.");
          return;
        }
        setDraftRevision(response.revision);
        setDraftReady(true);
        if (!response.job) return;

        setFormData((current) => ({
          ...current,
          ...response.job,
          responsibilities: Array.isArray(response.job.responsibilities)
            ? response.job.responsibilities.join("\n")
            : response.job.responsibilities || "",
          requiredSkills: Array.isArray(response.job.requiredSkills)
            ? response.job.requiredSkills.join(", ")
            : response.job.requiredSkills || "",
          preferredSkills: Array.isArray(response.job.preferredSkills)
            ? response.job.preferredSkills.join(", ")
            : response.job.preferredSkills || "",
        }));
      },
    );
  }, [pageToken]);

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));

    if (error) {
      setError("");
    }
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (saving || !draftReady) {
      return;
    }

    if (localStorage.getItem("token") !== pageToken) {
      setError("Your account changed. Reload this page before saving.");
      return;
    }

    setError("");
    setSaving(true);

    const completedJob = {
      ...formData,
      responsibilities: formData.responsibilities
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
      requiredSkills: formData.requiredSkills
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      preferredSkills: formData.preferredSkills
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    };

    chrome.runtime.sendMessage(
      EXTENSION_ID,
      {
        type: "SAVE_MANUAL_ENTRY_JOB",
        token: pageToken,
        revision: draftRevision,
        job: completedJob,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error(
            "Could not save manual entry:",
            chrome.runtime.lastError.message,
          );

          setError(
            "Could not connect to the Job Tracker extension. Please reload the extension and try again.",
          );
          setSaving(false);
          return;
        }

        if (!response?.success) {
          console.error(
            "Could not save manual entry:",
            response?.error || "Unknown error",
          );

          setError(response?.error || "Could not save the opportunity.");
          setSaving(false);
          return;
        }

        setSaving(false);
        setSaved(true);
      },
    );
  }

  function handleOpenJobPosting() {
    if (!formData.url) {
      return;
    }

    window.open(formData.url, "_blank", "noopener,noreferrer");
  }

  if (saved) {
    return (
      <main className="app-shell manual-entry-page">
        <header className="dashboard-header">
          <button
            className="product-name"
            type="button"
            onClick={() => navigate("/jobs")}
          >
            <span className="product-mark" aria-hidden="true">
              AT
            </span>
            <span>Job Tracker</span>
          </button>
        </header>

        <section
          className="manual-entry-section"
          aria-labelledby="manual-entry-success-title"
        >
          <div className="manual-entry-heading">
            <p className="eyebrow">Application pending</p>

            <h1 id="manual-entry-success-title">Opportunity saved</h1>

            <p>
              {formData.title || "This opportunity"} at{" "}
              {formData.company || "the company"} is now saved as an application
              pending.
            </p>

            <p>
              Return to the job posting and apply. After you apply, open the Job
              Tracker extension and confirm your application.
            </p>
          </div>

          <div className="manual-entry-actions">
            <button
              className="primary-button"
              type="button"
              onClick={handleOpenJobPosting}
            >
              Go back to Posting
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell manual-entry-page">
      <header className="dashboard-header">
        <button
          className="product-name"
          type="button"
          onClick={() => navigate("/jobs")}
          disabled={saving}
        >
          <span className="product-mark" aria-hidden="true">
            AT
          </span>
          <span>ATrackie</span>
        </button>
      </header>

      <section
        className="manual-entry-section"
        aria-labelledby="manual-entry-title"
      >
        <div className="manual-entry-heading">
          <p className="eyebrow">Complete application details</p>

          <h1 id="manual-entry-title">Track an opportunity manually</h1>

          <p>
            We could not identify enough information automatically. Complete the
            missing details below to continue tracking this opportunity.
          </p>
        </div>

        <form className="manual-entry-form" onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="title">Job title</label>
            <input
              id="title"
              name="title"
              type="text"
              value={formData.title}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="company">Company</label>
            <input
              id="company"
              name="company"
              type="text"
              value={formData.company}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="url">Application URL</label>
            <input
              id="url"
              name="url"
              type="url"
              value={formData.url}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="source">Source</label>
            <input
              id="source"
              name="source"
              type="text"
              value={formData.source}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="location">Location</label>
            <input
              id="location"
              name="location"
              type="text"
              value={formData.location}
              onChange={handleChange}
            />
          </div>

          <div className="form-field">
            <label htmlFor="salary">Salary</label>
            <input
              id="salary"
              name="salary"
              type="text"
              value={formData.salary}
              onChange={handleChange}
            />
          </div>

          <div className="form-field">
            <label htmlFor="jobId">Job ID</label>
            <input
              id="jobId"
              name="jobId"
              type="text"
              value={formData.jobId}
              onChange={handleChange}
            />
          </div>

          <div className="form-field">
            <label htmlFor="experience">Experience</label>
            <input
              id="experience"
              name="experience"
              type="text"
              value={formData.experience}
              onChange={handleChange}
            />
          </div>

          <div className="form-field">
            <label htmlFor="education">Education</label>
            <input
              id="education"
              name="education"
              type="text"
              value={formData.education}
              onChange={handleChange}
            />
          </div>

          <div className="form-field">
            <label htmlFor="responsibilities">Responsibilities</label>
            <textarea
              id="responsibilities"
              name="responsibilities"
              value={formData.responsibilities}
              onChange={handleChange}
              rows="4"
            />
          </div>

          <div className="form-field">
            <label htmlFor="requiredSkills">Required skills</label>
            <textarea
              id="requiredSkills"
              name="requiredSkills"
              value={formData.requiredSkills}
              onChange={handleChange}
              rows="3"
            />
          </div>

          <div className="form-field">
            <label htmlFor="preferredSkills">Preferred skills</label>
            <textarea
              id="preferredSkills"
              name="preferredSkills"
              value={formData.preferredSkills}
              onChange={handleChange}
              rows="3"
            />
          </div>

          <div className="form-field">
            <label htmlFor="jobDescription">Job description</label>
            <textarea
              id="jobDescription"
              name="jobDescription"
              value={formData.jobDescription}
              onChange={handleChange}
              rows="6"
            />
          </div>

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}

          <div className="manual-entry-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={() => navigate("/jobs")}
              disabled={saving}
            >
              Cancel
            </button>

            <button className="primary-button" type="submit" disabled={saving || !draftReady}>
              {saving ? "Saving..." : "Track Opportunity"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

export default ManualEntryPage;
