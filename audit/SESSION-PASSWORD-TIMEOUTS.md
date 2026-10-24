# Review follow-up — 23 October 2026

Approved scope: stale dashboard sessions, bcrypt password bounds, and browser request deadlines.

- Authenticated dashboard responses are checked against the current token before and after reading the response body. Existing 401 handlers also compare tokens immediately before logout. A late response cannot clear a newer login.
- New signups reject passwords over 72 UTF-8 bytes in the form and API. Passwords are never silently trimmed or truncated by the new validation. Existing login behavior is unchanged for compatibility, including older long passwords.
- Dashboard API requests and extension save/duplicate requests have 30-second deadlines; extension AI extraction has 120 seconds. The same signal covers response-body reads. Timeout errors preserve existing draft/error flows; no automatic write retries were added.
- Browser timeouts do not guarantee that server work stopped. Save messages explain that the operation may already have completed; existing duplicate recovery handles retry. Server-side AI cancellation remains outside this change.

Verification: 13 database-backed checks passed using an isolated temporary database and the installed MongoDB executable. Added ASCII/multibyte password bounds and legacy login tests. Targeted dashboard and extension tests passed for stale tokens, request/body timeouts, account drafts, and save retry. Timeout branches use controlled signals, not long real waits.

No deployment or existing-account migration was performed. Test packaging and final README consolidation remain separate work.
