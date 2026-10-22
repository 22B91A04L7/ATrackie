# API validation and dashboard errors

Approved scope: input validation and dashboard error handling. Deleted-account token checks were explicitly excluded and were not changed.

## Changes

- Write requests require JSON objects. Optional text fields accept strings, null, or omission; arrays must contain strings. This prevents Mongoose silently converting numbers or scalar skills into stored values.
- Length limits: title/company/source/job ID 500; URL 8192; location/salary 2000; experience/education 10000; descriptions and extraction text 30000; name 200; email 320. Password policy is unchanged.
- Skills/responsibilities allow up to 100 strings, each up to 2000 characters. Bulk deletion allows up to 1000 valid 24-character hexadecimal IDs.
- Existing Express 100 KB body limit is retained. Oversized bodies return JSON HTTP 413; malformed JSON returns JSON HTTP 400.
- Login, signup, dashboard listing/deletion, details/deletion, and status updates share readable network/response error handling. Backend validation and rate-limit messages are surfaced. Non-JSON 401 responses retain the existing sign-in redirect behavior.
- Incomplete successful login/list/detail/status responses are rejected instead of accepted as usable data. Failed operations retain their existing error-state behavior; no automatic write retries were added.

## Verification

- Database-backed suite: 12 checks passed, including invalid types, array payloads, oversized fields, invalid bulk IDs, malformed JSON and oversized bodies; all invalid job requests left the test database unchanged.
- Existing API concurrency, account isolation, password and rate-limit checks passed.
- Dashboard response, session and extension-connection tests passed.
- Dashboard lint and production build passed.
- Tests used disposable MongoDB and stubbed AI; no application data was changed.

## Manual checks

1. Stop the backend and refresh the dashboard: expect a readable connection error. Restart and refresh to restore the list.
2. Add a normal manual application and capture an AI application; verify saving, viewing details and changing status.
3. Try a manual title over 500 characters: saving should show the field-specific error and retain pending work.

This is targeted validation, not a complete security certification. No deployment changes or new dependencies were introduced.
