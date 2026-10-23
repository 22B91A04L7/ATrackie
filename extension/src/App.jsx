import { useState, useEffect, useRef } from "react";
import { getActiveTab } from "./utils/chrome";
import "./App.css";
import "./polish.css";
import { extractJob, saveJob, checkJobDuplicate } from "./services/jobService";
import { getSession } from "./utils/session";
import PendingJob from "./components/PendingJob";
import ExtensionHeader from "./components/ExtensionHeader";
import ApplicationSaved from "./components/ApplicationSaved";
import JobExtractor from "./components/JobExtractor";
import JobSummary from "./components/JobSummary";
import {
  getDraftState,
  setPendingJob as savePendingJob,
  setManualEntryJob,
  claimLegacyDrafts,
  removePendingJob,
} from "./utils/storage";
import { DASHBOARD_URL } from "./config";

function getSourceFromUrl(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "Unknown";
  }
}

function App() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [jobData, setJobData] = useState(null);
  const [pendingJob, setPendingJob] = useState(null);
  const [savedJob, setSavedJob] = useState(null);
  const [step, setStep] = useState("initial");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [duplicateJobId, setDuplicateJobId] = useState(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasLegacy, setHasLegacy] = useState(false);
  const [hasManual, setHasManual] = useState(false);
  const sessionRef = useRef(null);
  const generation = useRef(0);
  const busy = useRef(false);

  useEffect(() => {
    let disposed = false;
    const invalidateOperations = () => { generation.current++; };
    async function initializeExtension() {
      const current = ++generation.current;
      sessionRef.current = null;
      busy.current = false;
      setLoading(false);
      setSaving(false);
      setIsAuthenticated(false);
      setPendingJob(null);
      setJobData(null);
      setSavedJob(null);
      setError("");
      setDuplicateJobId(null);
      setHasLegacy(false);
      setHasManual(false);
      setStep("initial");
      try {
        const session = await getSession();
        const state = await getDraftState(session);
        if (disposed || current !== generation.current) return;
        sessionRef.current = session;
        setIsAuthenticated(true);
        setSessionExpired(false);
        setHasLegacy(state.hasLegacy);
        setHasManual(state.hasManual);
        if (state.pending) {
          setPendingJob(state.pending);
          setStep("pending");
        }
      } catch {
        if (!disposed && current === generation.current) setIsAuthenticated(false);
      }
    }

    initializeExtension();

    function handleStorageChange(changes, areaName) {
      if (areaName === "local" && changes.token) {
        initializeExtension();
      } else if (areaName === "local" && !busy.current && sessionRef.current) {
        const prefix = `draft:${sessionRef.current.userId}:`;
        if (changes[`${prefix}pending`]) {
          const draft = changes[`${prefix}pending`].newValue || null;
          setPendingJob(draft);
          setStep(previous => draft ? "pending" : previous === "pending" ? "initial" : previous);
        }
        if (changes[`${prefix}manual`]) setHasManual(Boolean(changes[`${prefix}manual`].newValue));
      }
    }

    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      disposed = true;
      invalidateOperations();
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  function beginOperation() {
    if (busy.current || !sessionRef.current) return null;
    busy.current = true;
    setError("");
    return { session: sessionRef.current, generation: generation.current };
  }
  const isCurrent = (operation) => operation.generation === generation.current;
  function finishOperation(operation) {
    if (isCurrent(operation)) { busy.current = false; setSaving(false); setLoading(false); }
  }

  //handles raw text extraction from web page
  async function handleGetJobDetails() {
    const operation = beginOperation();
    if (!operation) return;
    setLoading(true);
    setError("");

    try {
      const activeTab = await getActiveTab();

      const results = await chrome.scripting.executeScript({
        target: {
          tabId: activeTab.id,
        },
        func: () => document.body.innerText,
      });

      if (!results || !results[0] || !results[0].result) {
        throw new Error("Could not read the job page.");
      }

      const pageText = results[0].result.slice(0, 30000);

      if (!isCurrent(operation)) return;
      const extractedJob = await extractJob(pageText, operation.session.token);
      if (!isCurrent(operation)) return;
      const jobWithSource = {
        ...extractedJob,
        url: activeTab.url || "",
        source: getSourceFromUrl(activeTab.url || ""),
      };

      setJobData(jobWithSource);
      setStep("extracted");
    } catch (error) {
      if (!isCurrent(operation)) return;
      console.error("Could not get job details:", error);

      if (
        error.message ===
        "Your session has expired. Please reconnect your account."
      ) {
        setSessionExpired(true);
        setIsAuthenticated(false);
        return;
      }

      setError(error.message);
    } finally {
      finishOperation(operation);
    }
  }

  // AI-extracted data is tracked as-is, no edit step.
  async function handleTrackJob() {
    const operation = beginOperation();
    if (!operation) return;
    setSaving(true);
    try {
      if (!jobData.title || !jobData.company || !jobData.url || !jobData.source) {
        await setManualEntryJob(jobData, operation.session);
        if (!isCurrent(operation)) return;
        setHasManual(true);
        setError("Could not identify enough information to track this opportunity.");
        return;
      }
      const duplicateResult = await checkJobDuplicate(jobData.url, operation.session.token);
      if (!isCurrent(operation)) return;

      if (duplicateResult.exists) {
        setDuplicateJobId(duplicateResult.jobId);
        setError("This job application is already in your tracker.");
        return;
      }
      setDuplicateJobId(null);
      const draft = await savePendingJob(jobData, operation.session);
      if (!isCurrent(operation)) return;
      setPendingJob(draft);
      setStep("pending");
      setJobData(null);
      setError("");
    } catch (error) {
      if (isCurrent(operation)) setError(error.message);
    } finally {
      finishOperation(operation);
    }
  }

  //handkles manual entry of job details when AI extraction fails
  function handleCompleteDetailsManually() {
    chrome.tabs.create({
      url: `${DASHBOARD_URL}/jobs/manual-entry`,
    });
  }
  //to view duplicate job and stops tracking again
  function handleViewDuplicateJob() {
    if (!duplicateJobId) {
      return;
    }

    chrome.tabs.create({
      url: `${DASHBOARD_URL}/jobs/${duplicateJobId}`,
    });
  }

  function handleNotYet() {
    // Reopening restores this account's draft from the background worker.
    try {
      window.close();
    } catch (error) {
      console.error("Could not close popup:", error);
    }
  }

  async function handleApplied() {
    const operation = beginOperation();
    if (!operation) return;
    setSaving(true);
    try {
      const savedJobResponse = await saveJob(pendingJob.job, operation.session.token);
      if (!isCurrent(operation)) return;
      const result = await removePendingJob(operation.session, pendingJob.revision);
      if (!isCurrent(operation)) return;
      if (!result.removed) throw new Error("Your pending application changed. Reopen the extension to see the latest draft.");

      setPendingJob(null);
      setSavedJob(savedJobResponse.job);
      setStep("saved");
    } catch (error) {
      console.error("Could not save job:", error);
      if (isCurrent(operation)) setError(error.message);
    } finally {
      finishOperation(operation);
    }
  }

  async function handleDiscard() {
    const operation = beginOperation();
    if (!operation) return;
    setSaving(true);
    try {
      const result = await removePendingJob(operation.session, pendingJob.revision);
      if (!isCurrent(operation)) return;
      if (!result.removed) throw new Error("Your pending application changed. Reopen the extension before discarding it.");
      setPendingJob(null);
      setStep("initial");
      setError("");
    } catch (error) {
      if (isCurrent(operation)) setError(error.message);
    } finally {
      finishOperation(operation);
    }
  }

  async function handleRestoreLegacy() {
    const operation = beginOperation();
    if (!operation) return;
    setSaving(true);
    try {
      await claimLegacyDrafts(operation.session);
      const state = await getDraftState(operation.session);
      if (!isCurrent(operation)) return;
      setHasLegacy(state.hasLegacy);
      setHasManual(state.hasManual);
      setPendingJob(state.pending);
      setStep(state.pending ? "pending" : "initial");
    } catch (error) {
      if (isCurrent(operation)) setError(error.message);
    } finally { finishOperation(operation); }
  }

  if (!isAuthenticated) {
    return (
      <main className="extension-app">
        <ExtensionHeader />

        <section className="extension-body" aria-live="polite">
          <section className="state-panel">
            <p className="section-kicker">Account connection</p>
            <h2>Connect your account</h2>
            <p
              className={
                sessionExpired ? "error-message" : "connection-message"
              }
            >
              {sessionExpired
                ? "Your session has expired. Please reconnect your account."
                : "Sign in to your ATrackie dashboard to connect this extension and start tracking applications."}
            </p>

            <button
              className="primary-button"
              type="button"
              onClick={() => {
                chrome.tabs.create({
                  url: DASHBOARD_URL,
                });
              }}
            >
              Connect Account
            </button>
          </section>
        </section>
      </main>
    );
  }

  return (
    <main className="extension-app">
      {/* header component */}
      <ExtensionHeader />

      <section
        className={`extension-body extension-step-${step}`}
        aria-live="polite"
      >
        {hasLegacy && (
          <section className="state-panel">
            <h2>Restore earlier drafts?</h2>
            <p>This browser has unfinished work from an earlier version without an account owner. Restore it only if you created it and are signed in to the correct account.</p>
            <button className="primary-button" type="button" disabled={saving || loading} onClick={handleRestoreLegacy}>These drafts are mine — restore</button>
            <button className="secondary-button" type="button" disabled={saving || loading} onClick={() => setHasLegacy(false)}>Not now</button>
          </section>
        )}
        {step === "initial" && (
          <JobExtractor
            loading={loading}
            error={error}
            onGetJobDetails={handleGetJobDetails}
          />
        )}

        {step === "initial" && hasManual && (
          <button className="secondary-button" type="button" onClick={handleCompleteDetailsManually}>Continue manual entry</button>
        )}

        {step === "extracted" && jobData && (
          <JobSummary
            job={jobData}
            saving={saving}
            error={error}
            duplicate={Boolean(duplicateJobId)}
            onTrackJob={handleTrackJob}
            onViewApplication={handleViewDuplicateJob}
            onCompleteDetailsManually={handleCompleteDetailsManually}
          />
        )}

        {step === "pending" && pendingJob && (
          <PendingJob
            job={pendingJob.job}
            error={error}
            onApplied={handleApplied}
            onNotYet={handleNotYet}
            onDiscard={handleDiscard}
            saving={saving}
          />
        )}

        {step === "saved" && savedJob && (
          <ApplicationSaved
            job={savedJob}
            onCaptureAnother={() => {
              setSavedJob(null);
              setDuplicateJobId(null);
              setStep("initial");
            }}
          />
        )}
      </section>
    </main>
  );
}

export default App;
