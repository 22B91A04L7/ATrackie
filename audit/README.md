# Batch 1: development baseline

Scope: verify the existing MVP and identify targeted fixes. No application source, dependency manifest, lockfile, deployed service, or production data was changed. The root README was already untracked before this batch.

## How the checks work

- Frontend/extension builds and lint run using the installed dependencies.
- `frontend-baseline.cjs` executes existing background-worker, service, and handler logic with simulated Chrome/network APIs. It is **not** a real Chrome end-to-end test.
- `baseline.cjs` mounts the actual backend routes, middleware, controllers, and models on a local Express server with a fresh, temporary MongoDB. It creates disposable accounts and jobs, then stops MongoDB. The harness disables dotenv file loading, supplies a test JWT secret, and replaces the AI service with a stub before loading routes. No real AI calls are made.
- The test tool is installed outside the repository. The harness verifies that the database URI is loopback; it does not accept a production connection string.
- Diagnostic scripts record current behavior, including defects. A successful script exit does not mean the application has no defects.

## Reproduce

Run the frontend checks from the repository root:

```powershell
node audit/frontend-baseline.cjs
```

For database checks, install the temporary test dependency outside the repository, then pass that directory to the harness:

```powershell
$baselineTools = Join-Path $env:TEMP 'atrackie-baseline-tools'
$env:MONGOMS_DISABLE_POSTINSTALL = '1'
npm install --prefix $baselineTools mongodb-memory-server@11.3.0 --no-audit --no-fund
node audit/baseline.cjs $baselineTools 'C:/Program Files/MongoDB/Server/8.0/bin/mongod.exe'
```

The harness uses the existing MongoDB 8.0.4 installation and disables runtime downloads. It requires an explicit installed server executable path. The test helper is only a process/database lifecycle manager. The temporary instance uses its own disposable data directory and port and binds to loopback; it does not connect to the user's normal MongoDB service.

Setup note: an initial attempt unnecessarily started downloading another MongoDB runtime after checking only PATH. That download was stopped when the existing installation was located. An incomplete download may remain in the temporary test tool/cache directories; it is not used by this harness. No additional MongoDB Windows service was installed.

Run `npm run lint` and `npm run build` separately in `extension` and `job-tracker-dashboard`. Lint failures must not be hidden by the successful exit code of a subsequent build.

## Build and static baseline

| Check | Result |
| --- | --- |
| Dashboard production build | Pass |
| Extension production build | Pass |
| Backend JavaScript syntax checks | Pass |
| Dashboard lint | 19 errors |
| Extension lint | 53 errors |
| Existing backend automated tests | No suite; package script is a placeholder |

Most lint errors are missing Chrome globals in ESLint configuration. Other errors include unused variables and an effect-state rule in the extension auth page. They are not equivalent to 72 runtime defects. The extension build also warns about a future Vite JSON-import configuration requirement; the current build succeeds.

## Reproduced extension/frontend findings

1. **Account-switch isolation:** authenticating as another account leaves the previous pending job in storage. Logout removes the token and pending job but leaves the manual-entry draft. Local work needs explicit ownership and safe handling of account changes.
2. **Repeated confirmation:** two calls before the save response issue two save requests. The pending view is always passed `saving={false}`.
3. **Invisible save errors:** a failed save sets an error but the pending view does not receive/display it. Pending work is correctly preserved on failure.
4. **Unexpected HTTP response:** HTML/non-JSON error responses produce a JSON parsing exception. For a non-JSON 401, token cleanup is skipped because parsing happens before the status check.
5. **Manual-entry environment:** the page effect throws when the Chrome API is unavailable. The normal message handoff correctly saves pending data and clears the draft.

Exact observations are recorded in `frontend-results.json`.

## Database-backed results

Completed using installed MongoDB 8.0.4 with disposable accounts and an isolated data directory. The temporary server was shut down after the run. Raw observations are in `baseline-results.json`.

| Scenario | Observed result |
| --- | --- |
| Signup/login, save/list/read, status update and timeline | Pass |
| Cross-account list/read/update/single-delete/bulk-delete/duplicate lookup | Pass: another account cannot access or mutate the test owner's records |
| Missing, malformed and expired tokens | All rejected with 401 |
| Sequential duplicate save | Correctly rejected with 409 |
| Ten concurrent saves for one user and URL | **Eight documents created**, two requests rejected; confirms a race |
| Two overlapping updates to Interview | Both return 200; timeline becomes Applied, Interview, Interview |
| Missing body on create/check-duplicate/extract/login/signup | All return 500 instead of a client validation error |
| Salary number and requiredSkills string | Accepted and coerced into string/array; explicit input policy is absent |
| One-character signup password | Accepted with 201 |
| Stubbed extraction, >30,000-character input, provider outage | Success, 400, and generic 500 respectively |
| Owner single and bulk deletion | Pass |

The status-race test deliberately holds two real database reads at a barrier so both requests inspect the same old status before saving. This models an overlapping-request schedule; it is not a load benchmark. Duplicate counts may vary with scheduling. These tests use the application's real routes and models, but stub the AI provider and suppress dotenv loading.

## Further source-review findings

- Duplicate creation uses a find-then-insert sequence; the Job schema has no declared unique index for user and URL.
- Status transitions use read-then-save; the overlapping-read test above reproduces duplicate timeline events.
- Several controllers destructure `req.body` without first validating its presence.
- Signup accepts any non-empty password; field length limits and optional-field validation need an agreed policy.
- No application-level login/extraction rate limits are configured.
- Browser fetch calls have no explicit abort timeout. The installed Groq SDK **does** default to a 60-second timeout and two retries; configure intentionally rather than claiming timeouts are absent everywhere.
- External messages are origin-restricted by the manifest. Message shape validation and account-bound storage still merit hardening; missing an extra sender check alone is not evidence that arbitrary websites can connect.
- CORS is permissive. Restricting browser origins can be defense in depth, but does not replace authentication or prevent direct API requests.
- The manifest injects an empty CSS file on all sites. Removing that unused declaration can reduce unnecessary scope after a compatibility check.

## Coverage limits

This batch does not certify deployment security, production database configuration, live AI accuracy/availability, real-browser extension lifecycle behavior, or visual layout. Existing successful flows were reviewed in source; the isolated checks below exercise specified portions only. No real job-site scraping or production load testing was performed.

## Proposed next batch

Prioritize account-bound local data, reliable save feedback, concurrent writes, and robust error handling. Preserve manual entry, automatic AI capture, and the current status rules. Do not add product features or redesign the UI.

Confirmed user decision: keep unfinished work separately for each account, restoring it only when its owner signs in. Any legacy unowned draft requires an explicit migration rule; it must not be silently assigned to a different account.

Remaining decisions before implementation: password policy for new signups; practical extraction/login request limits. Existing records must be checked for duplicates before applying a unique index, without deleting user data automatically.
