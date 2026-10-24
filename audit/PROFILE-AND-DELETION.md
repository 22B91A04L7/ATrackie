# Profile and account deletion

User-approved behavior: profile with account details, permanent deletion of account/applications with password and explicit confirmation, connected extension draft cleanup, and Connect Account navigation to /login.

- Profile displays name, email and join date. Password hashes are never returned.
- Deletion requires the current password and the exact confirmation DELETE. Failed confirmations are rate limited per account.
- The backend marks the account as deleting before removing its jobs and account. Protected routes reject deleted/deleting users, except the deletion endpoint permits a retry after interrupted cleanup. A save already in flight checks ownership again after insertion and cleans itself up if deletion overlapped.
- Cleanup works with standalone local MongoDB; it is not a multi-document transaction. If cleanup fails, keep the deletion page open and retry. A database outage is returned as 503, not mistaken for an expired session.
- The connected extension verifies the account is no longer authorized before removing its token and owner-specific pending/manual drafts. Another account's drafts and unclaimed legacy drafts are not removed. Other Chrome profiles/devices cannot be remotely erased. The UI reports when local cleanup could not be confirmed.
- Connect Account opens the configured dashboard /login route.

Verification: both projects passed direct ESLint checks and production builds; 14 database-backed regression checks and 8 extension worker checks passed using disposable data. No real user account was deleted during development. Existing Vite configuration warning remains.

Manual check using a disposable account: open Profile, check details, cancel deletion, try an incorrect password, then confirm with the correct password and DELETE. Confirm its applications disappear, login fails for that deleted account, and another account is unaffected. Reload extension/dist before testing connected draft cleanup.
