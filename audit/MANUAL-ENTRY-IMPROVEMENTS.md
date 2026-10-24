# Manual entry improvements — 2026-10-24

## Changes

- Validate required text, HTTP/HTTPS URLs, field lengths, list sizes, and the 100 KB payload limit before handing a form to the extension. Backend validation remains authoritative.
- Preserve typed edits in dashboard localStorage, keyed by account ID and extension draft revision. Refreshing or reopening the same draft restores those edits. Successful handoff removes the local copy; account deletion clears that account's local form edits in the current browser.
- Show storage failures explicitly and warn before leaving when edits could not be preserved.
- Keep connection/load errors above the form and focus error messages. Editing a field no longer dismisses a load failure.
- Disable fields until the draft loads and while submission is in progress. Extension communication has a 20-second UI deadline; ambiguous save timeouts tell users to check the extension before retrying.
- Offer manual entry after extraction fails, using the current posting URL and source. Existing drafts are not overwritten.
- Mark required fields and explain comma-separated skills and one-responsibility-per-line input.
- Repair the source extraction boundaries in the dashboard session and interaction tests.

## Verification

- Dashboard and extension ESLint and production builds.
- Dashboard tests: `manualEntry.cjs`, `session.cjs`, `interactions.cjs`.
- Extension tests: `manualFallback.cjs`, `drafts.cjs`, `popup.cjs`.
- No production requests, real account deletions, or database modifications were used for these checks.

## Manual checks still needed

Reload the built extension, then exercise manual fallback, refresh/reopen after typing, pending confirmation, and dashboard navigation in Chrome. Check desktop and narrow-window layouts. Automated checks simulate Chrome messaging; they are not a live browser end-to-end test.

Local edits belong to this browser/site, not a cloud backup. Clearing site data removes them. As with existing extension drafts, another browser profile's local data cannot be remotely erased. The form still requires confirmation in the extension before an application appears on the dashboard.
