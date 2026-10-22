# Approved login and extraction limits

- Login: 10 failed attempts per IP in a 15-minute fixed window. HTTP 400 and 401 consume the allowance; completed successful logins and server errors do not. In-flight login requests reserve slots to prevent concurrent bypasses. Abandoned requests retain their reservation until expiry.
- Extraction: 10 authenticated requests per account in a one-minute fixed window, including invalid inputs and provider failures. Authentication runs before the limiter. Rejected requests do not call AI.
- The next request after the allowance is consumed returns HTTP 429, a JSON error with the remaining seconds, and a Retry-After header. Existing frontend error handling displays the message.
- A login block applies to the IP, even for correct credentials, until its window expires. People sharing an IP share the allowance. Successful login does not erase previous failures.
- Saving, browsing, session verification, signup and other job routes are not rate limited by this change.

## Verification

`node backend/tests/rateLimits.cjs` passed: success exclusion, failure boundary, concurrent reservations, separate IPs/accounts, retry header and expiry with a simulated clock.

The database-backed reliability suite passed all 11 checks, including enforcement through the actual routes and continued access to saving/listing. AI was stubbed; MongoDB used an isolated temporary instance of the already-installed executable.

## Local-development limitation

Counters live in one backend process and reset on restart. Expired entries are pruned on incoming requests. This is not distributed rate limiting. Before deployment, review shared storage and memory capacity, IPv6 grouping, and the actual reverse-proxy topology. Express currently uses direct peer IPs and does not trust arbitrary forwarded headers; no deployment proxy setting was changed here.

## Manual check

With a fresh local backend process, submit 10 incorrect logins; the next attempt should show the retry message. Existing signed-in sessions can still browse/save. Avoid repeated real AI calls solely to test the extraction limit; the automated tests exercise it without provider charges.
