import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { EXTENSION_ID } from "../config";
import { manualDraftKey, validateManualJob } from "../utils/manualEntry";

function ManualEntryPage() {
  const navigate = useNavigate();
  const errorRef = useRef(null);

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
  const [loadError, setLoadError] = useState('');
  const [draftWarning, setDraftWarning] = useState('');
  const draftKey = manualDraftKey(pageToken, draftRevision);

  useEffect(() => {
    if (error || loadError) errorRef.current?.focus();
  }, [error, loadError]);

  useEffect(() => {
    if (!draftWarning) return;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [draftWarning]);

  useEffect(() => {
    if (saved) {
      window.scrollTo({ top: 0, behavior: 'instant' });
      document.getElementById('manual-entry-success-title')?.focus();
    }
  }, [saved]);

  useEffect(() => {
    let disposed = false;
    const timer = setTimeout(() => {
      disposed = true;
      setLoadError('The extension did not respond. Reconnect it and reload this page.');
    }, 20000);
    const fail = message => { clearTimeout(timer); if (!disposed) setLoadError(message); };
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      queueMicrotask(() => fail('Connect the ATrackie extension, then reload this page.'));
    } else {
      try {
        chrome.runtime.sendMessage(EXTENSION_ID, { type: 'GET_MANUAL_ENTRY_JOB', token: pageToken }, response => {
          const runtimeError = chrome.runtime.lastError;
          clearTimeout(timer);
          if (disposed) return;
          if (runtimeError || !response?.success) {
            fail(response?.error || 'Could not connect to the extension. Reconnect your account and reload this page.');
            return;
          }
          const job = response.job || {};
          let restored = {};
          try {
            const key = manualDraftKey(pageToken, response.revision);
            const stored = key && localStorage.getItem(key);
            if (stored) {
              const parsed = JSON.parse(stored);
              if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
              restored = Object.fromEntries(Object.entries(parsed).filter(([, value]) => typeof value === 'string'));
            }
          } catch { setDraftWarning('Could not restore locally saved edits. Keep this page open until you finish.'); }
          setDraftRevision(response.revision);
          setFormData(current => ({
            ...current, ...job,
            responsibilities: Array.isArray(job.responsibilities) ? job.responsibilities.join('\n') : job.responsibilities || '',
            requiredSkills: Array.isArray(job.requiredSkills) ? job.requiredSkills.join(', ') : job.requiredSkills || '',
            preferredSkills: Array.isArray(job.preferredSkills) ? job.preferredSkills.join(', ') : job.preferredSkills || '',
            ...restored,
          }));
          setDraftReady(true);
        });
      } catch { fail('Could not connect to the extension. Reload this page to retry.'); }
    }
    return () => { disposed = true; clearTimeout(timer); };
  }, [pageToken]);

  function handleChange(event) {
    const { name, value } = event.target;

    const next = { ...formData, [name]: value };
    setFormData(next);
    try {
      if (!draftKey || localStorage.getItem('token') !== pageToken) throw new Error();
      localStorage.setItem(draftKey, JSON.stringify(next));
      setDraftWarning('');
    } catch { setDraftWarning('Your edits could not be saved locally. Keep this page open until you submit.'); }

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

    const validationError = validateManualJob(completedJob);
    if (validationError) { setError(validationError); return; }
    setSaving(true);
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      setSaving(false);
      setError('The extension did not respond. Reopen it to check whether your job is pending before retrying. Your typed details are preserved.');
    }, 20000);
    try { chrome.runtime.sendMessage(
      EXTENSION_ID,
      {
        type: "SAVE_MANUAL_ENTRY_JOB",
        token: pageToken,
        revision: draftRevision,
        job: completedJob,
      },
      (response) => {
        const runtimeError = chrome.runtime.lastError;
        clearTimeout(timer);
        if (settled) return;
        settled = true;
        if (runtimeError) {
          console.error(
            "Could not save manual entry:",
            runtimeError.message,
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

        try { if (draftKey) localStorage.removeItem(draftKey); } catch { /* Saved draft is already handed off. */ }
        setDraftWarning('');
        setSaving(false);
        setSaved(true);
      },
    ); } catch {
      clearTimeout(timer);
      setSaving(false);
      setError('Could not connect to the extension. Your details are still here; reconnect and retry.');
    }
  }

  function handleGoToDashboard() {
    navigate("/jobs");
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
            <span>ATrackie</span>
          </button>
        </header>

        <section
          className="manual-entry-section manual-entry-success"
          aria-labelledby="manual-entry-success-title"
        >
          <div className="manual-entry-heading">
            <p className="manual-pending-badge">Pending application</p>

            <h1 id="manual-entry-success-title" tabIndex={-1}>Opportunity saved</h1>

            <p>
              <strong>{formData.title || "This opportunity"}</strong> at{" "}
              <strong>{formData.company || "the company"}</strong>
            </p>
          </div>

          <div className="manual-next-steps">
            <h2>Finish tracking your application</h2>
            <p>Your details are saved in the extension as pending. Confirm after applying to add this job to your dashboard.</p>
            <ol>
              <li>Submit your application on the job posting website.</li>
              <li>Open the <strong>ATrackie extension</strong> and <strong>confirm your application</strong>.</li>
            </ol>
          </div>

          <div className="manual-entry-actions">
            {error && <p className="error" role="alert">{error}</p>}
            <button
              className="primary-button"
              type="button"
              onClick={handleGoToDashboard}
            >
              Go to dashboard
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
          onClick={() => { if (!draftWarning || window.confirm('Your edits could not be saved. Leave this page and lose them?')) navigate('/jobs'); }}
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

        <p className="manual-form-help">* Required. Edits are saved on this browser for your account until you submit.</p>
        {(loadError || error) && <p ref={errorRef} tabIndex={-1} className="error manual-form-error" role="alert">{loadError || error}</p>}
        {draftWarning && <p className="error manual-form-error" role="alert">{draftWarning}</p>}
        {!draftReady && !loadError && <p role="status">Loading your draft...</p>}
        <form onSubmit={handleSubmit}>
        <fieldset className="manual-entry-form" disabled={!draftReady || saving}>
          <legend className="sr-only">Job details</legend>
          <div className="form-field">
            <label htmlFor="title">Job title *</label>
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
            <label htmlFor="company">Company *</label>
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
            <label htmlFor="url">Application URL *</label>
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
            <label htmlFor="source">Source *</label>
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
              aria-describedby="responsibilities-hint"
              value={formData.responsibilities}
              onChange={handleChange}
              rows="4"
            />
            <small id="responsibilities-hint">Enter one responsibility per line.</small>
          </div>

          <div className="form-field">
            <label htmlFor="requiredSkills">Required skills</label>
            <textarea
              id="requiredSkills"
              name="requiredSkills"
              aria-describedby="requiredSkills-hint"
              value={formData.requiredSkills}
              onChange={handleChange}
              rows="3"
            />
            <small id="requiredSkills-hint">Separate skills with commas, for example: React, SQL.</small>
          </div>

          <div className="form-field">
            <label htmlFor="preferredSkills">Preferred skills</label>
            <textarea
              id="preferredSkills"
              name="preferredSkills"
              aria-describedby="preferredSkills-hint"
              value={formData.preferredSkills}
              onChange={handleChange}
              rows="3"
            />
            <small id="preferredSkills-hint">Separate skills with commas.</small>
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

          <div className="manual-entry-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={() => { if (!draftWarning || window.confirm('Your edits could not be saved. Leave this page and lose them?')) navigate('/jobs'); }}
              disabled={saving}
            >
              Cancel
            </button>

            <button className="primary-button" type="submit" disabled={saving || !draftReady}>
              {saving ? "Saving..." : "Track Opportunity"}
            </button>
          </div>
        </fieldset>
        </form>
      </section>
    </main>
  );
}

export default ManualEntryPage;
