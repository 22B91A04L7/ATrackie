# Batch 3 — request failure handling

The user confirmed the local flow works before this batch.

## Changes

- Missing request bodies now reach existing field validation in authentication and job controllers instead of causing destructuring exceptions. Six endpoints were verified to return JSON errors with HTTP 400.
- Extension capture, duplicate lookup, and save requests report network failures in plain language.
- HTTP 401 is handled before JSON parsing, including HTML responses. Cleanup still uses the captured token so a late failure cannot sign out another account.
- Non-JSON responses produce a readable error with the HTTP status when available.
- A successful save must include a job ID before the caller can clear its pending draft. Invalid duplicate-check responses are rejected.
- The existing worker regression harness now reads its dashboard origin from configuration, so it works with local and deployed URLs.

## Verification

- Backend suite: 9 checks passed using the installed MongoDB executable and a disposable database. Includes six missing-body endpoints, concurrent writes, duplicate prevention, and account isolation.
- Worker suite: 7 checks passed.
- Popup suite: 3 checks passed, including failed-save draft preservation.
- New response suite: passed non-JSON 401/502 and offline responses across all three job requests, invalid success responses, normal save and duplicate retry.
- Extension build, backend syntax, and whitespace checks passed. Existing Vite configuration warning remains.

No application database was used for regression tests. No deployments or dependency installations were performed.

## Manual check

Reload the rebuilt extension. Leave a pending job, stop the backend, and confirm: expect a readable error and the draft to remain. Restart the backend and retry: expect one saved application.

## Remaining scope

This is targeted error handling, not comprehensive API schema validation or a security audit. Dashboard response parsing, malformed JSON middleware responses, broader field validation, password policy, rate limits, and lint cleanup remain. No new password rules, limits, or automatic write retries were introduced.
