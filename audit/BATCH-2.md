# Batch 2 — account-specific drafts and dependable saving

Completed development checks: 21 October 2026.

## Approved scope

1. Keep unfinished work separately for each account, restoring it only to that account. Ask for ownership confirmation before restoring old drafts that have no recorded owner.
2. Prevent repeated saves and duplicate applications, show save errors, preserve pending work for retries, and prevent concurrent status updates from duplicating timeline events.

No AI-result editing, new application statuses, reminders, preparation features, or deployment changes were added.

## What changed and why

| Area | Change | User-visible result |
| --- | --- | --- |
| Extension storage | Pending/manual records use account-specific keys and revision identifiers | Signing out preserves stored drafts; another account cannot inherit them |
| Background worker | Serializes changes, validates the exact active session, and checks message origin | Concurrent popups and stale dashboard tabs cannot overwrite another account's work |
| Account connection | New authenticated `GET /api/auth/session` endpoint verifies tokens before activating an extension account | A forged token cannot select another account's local drafts; a failed account switch leaves the extension disconnected |
| Legacy drafts | Generic ownership prompt; no draft details shown before confirmation; restoration refuses to overwrite current drafts | Existing unowned work is retained until the user explicitly claims it |
| Manual-entry page | Includes the page session and loaded draft revision in its messages | Stale forms are rejected with a visible message, while their current contents remain available for review |
| Popup | Synchronous save lock, disabled controls, visible pending-screen errors, captured session for asynchronous work | Repeated confirmation clicks send one request; failures preserve pending work |
| Late responses | Ignore results from an earlier popup session; remove only the matching draft revision | An old request cannot clear a newer draft or display a previous account's result |
| Save retry | Existing application returned on a sequential duplicate; extension recognizes it as a completed save | A lost response can be recovered by retrying without creating another application |
| Database | Unique index on `(userId, url)`; duplicate-key races return 409 | The same account cannot concurrently insert multiple copies of one normalized URL |
| Status updates | Atomic compare-and-update against the previous status; append event in the same update | Only one overlapping transition succeeds; the other gets a conflict message |
| Dashboard tabs | Protected pages subscribe to session changes and remount on a new token | Another tab cannot keep showing the prior account's form or job list after account switching |
| Extension configuration | Job requests and session verification share `API_URL`; saved-screen links use `DASHBOARD_URL` | Local verification and application requests can use the same configured backend |

## Important behavior and compatibility details

- Drafts remain local to this Chrome profile. They are not synchronized between devices. The existing single pending opportunity is retained **per account**.
- Stored manual-entry drafts are preserved; typing into the dashboard form is not newly autosaved in this batch.
- Older drafts have no reliable ownership metadata. The confirmation is a user declaration, not proof of historical ownership. Until claimed, they are not returned through normal account-scoped draft reads.
- The updated extension needs the updated backend session endpoint. The updated manual-entry page supplies session/revision fields that the updated worker requires. Test these versions together; rebuilding the extension alone against the older hosted backend will not exercise this feature correctly.
- Backend startup checks for existing duplicate `(userId, url)` pairs before creating the unique index. If duplicates exist, startup stops with an actionable error. **No records are automatically deleted or merged.** This has been tested only on the disposable database; existing application databases have not been inspected or changed.
- A request already sent before switching accounts may finish saving for its original account. It never changes ownership to the newly active account. Returning to the original account and retrying recovers an already-saved record if needed.
- A simultaneous duplicate-key collision returns 409; a subsequent retry returns the existing record. No blind automatic write retries were introduced.

## Verification results

| Check | Result |
| --- | --- |
| Backend regression scenarios | 8 passed against installed MongoDB 8.0.4 in a disposable instance |
| Extension worker/storage/service scenarios | 7 passed using real modules with simulated Chrome/network APIs |
| Popup save handler scenarios | 3 passed using controlled asynchronous completions |
| Dashboard session/manual-submit scenarios | 3 passed using simulated browser APIs |
| Dashboard production build | Passed |
| Extension production build | Passed; existing future Vite config-loader warning remains |
| Backend JavaScript syntax and whitespace checks | Passed |
| Full lint | Not clean: Chrome API globals are missing from ESLint configuration; legacy effect-state and unused-variable issues remain |

The backend concurrency tests verify **one application from ten simultaneous saves** and **one timeline event from two overlapping status updates**. Tests also verify cross-account access restrictions, non-destructive index preflight, rejected forged sessions, legacy claims, stale draft revisions, late-session failures, and loss-of-response recovery.

These are not full browser end-to-end tests or a complete security assessment. Real Chrome installation/service-worker lifecycle behavior, visual layout, and live AI calls remain to be checked. Production services were not called by the regression suites.

## Reproduce the checks

From the repository root:

```powershell
node --experimental-vm-modules extension/tests/drafts.cjs
node extension/tests/popup.cjs
node job-tracker-dashboard/tests/session.cjs
node backend/tests/reliability.cjs 'C:/Users/DELL/AppData/Local/Temp/atrackie-baseline-tools' 'C:/Program Files/MongoDB/Server/8.0/bin/mongod.exe'
```

The last command uses the test helper installed during Batch 1 and the existing MongoDB executable. It disables runtime downloads, does not load `backend/.env`, uses an isolated loopback database and data directory, stubs AI, and shuts down the temporary instance afterward. It does not use the normal MongoDB service or any existing database. See `audit/README.md` for helper installation instructions on another machine.

Run `npm run build` in each frontend directory. Run `npm run lint` separately so build success cannot hide lint failures.

For a later local browser walkthrough, point both frontend configurations at a local test backend, set the dashboard's extension ID to the loaded build, and align the extension manifest's permitted dashboard origin/backend host with those local addresses. Do not use a production database for destructive test scenarios.

## Remaining work outside these two steps

- General API validation and consistent non-JSON/network failure handling.
- Agreed password policy, login/extraction limits, and broader security review.
- Existing lint cleanup.
- Real-browser walkthrough with both accounts and the matching local application versions.

The historical Batch 1 scripts/results describe the earlier source snapshot. Use the new regression scripts above for this implementation; do not treat old baseline counts as current verification.
