# Landing-page-inspired UI refresh

23 October 2026

- Added workspace-scoped styling for login/signup, dashboard summary cards and list, job details, and manual entry.
- Matched the landing page's blue accent, light surfaces, understated borders, rounded controls, and typography.
- Improved input spacing, password-button hover state, mobile summary layout, long-heading wrapping, and manual-entry text areas.
- Restyled extension header, buttons, pending/details panels, and standalone authentication screen. Added missing CSS imports to the standalone auth entry point.
- Kept the existing popup width and scrolling constraint; preserved reduced-motion support.

LandingPage.jsx, dashboard App.css and index.css were not edited. New dashboard selectors are scoped to workspace/auth page classes, not landing page classes. No request handlers, API routes, data storage or authentication logic changed.

Validation: both projects passed lint; both production builds passed. Login and signup were inspected in the local browser. Signed-in dashboard/details/manual-entry screens and the actual Chrome extension popup still need visual review in the user's session. Existing Vite JSON-import warning remains.

To review: refresh the local dashboard and reload the unpacked extension from extension/dist. No deployment was performed.
