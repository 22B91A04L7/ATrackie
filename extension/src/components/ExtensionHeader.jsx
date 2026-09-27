import { DASHBOARD_URL } from "../config";

function ExtensionHeader() {
  function handleOpenDashboard() {
    chrome.tabs.create({ url: `${DASHBOARD_URL}/jobs` });
  }

  return (
    <header className="extension-header">
      <div className="brand-mark" aria-hidden="true">
        AT
      </div>
      <div className="brand-copy">
        <h1>ATrackie</h1>
        <p>Your application assistant</p>
      </div>
      <button
        className="secondary-button header-dashboard-button"
        type="button"
        onClick={handleOpenDashboard}
        aria-label="Open Dashboard in a new tab"
        title="Open Dashboard"
      >
        <span className="header-dashboard-label">Open Dashboard</span>
        <svg
          className="header-dashboard-icon"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M9.5 2.5h4v4" />
          <path d="M13.5 2.5 7.5 8.5" />
          <path d="M12 9.5v3a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3" />
        </svg>
      </button>
    </header>
  );
}

export default ExtensionHeader;
