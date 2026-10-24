# ATrackie — Job Application Tracker

ATrackie helps job seekers remember what they applied for and keep the role requirements available when they get shortlisted. It combines a React dashboard, a Chrome extension, and an Express/MongoDB backend to capture job details and track applications through the hiring process.

**Live dashboard:** [atrackie.vercel.app](https://atrackie.vercel.app)

**Backend:** [atrackie-backend.onrender.com](https://atrackie-backend.onrender.com)

The dashboard is deployed on Vercel and the backend on Render. The Chrome extension is implemented but has not been published to the Chrome Web Store; it can be loaded locally as an unpacked extension.

## Implemented features

### Job capture through the Chrome extension

- Reads text from the active page when the user requests job details.
- Sends up to 30,000 characters to the authenticated backend for AI extraction.
- Extracts the job title, company, requisition ID, location, salary, role summary, responsibilities, required and preferred skills, experience, and education.
- Attaches the original posting URL and its hostname as the source.
- Checks whether the posting is already tracked and offers a link to the existing application.
- Keeps a pending opportunity in Chrome local storage until the user confirms they applied.
- Keeps stored pending and manual-entry drafts separate for each account, with explicit ownership confirmation for older unassigned drafts.
- Supports confirming an application, keeping it pending, or discarding it.
- Displays a badge when an opportunity is pending.
- Offers a dashboard form to complete missing details when extraction does not identify enough information.

### Application dashboard

- Landing page, signup, login, and protected application pages.
- Application list with total, applied, interview, and offer counts.
- Search by job title, company, or location.
- Application status updates with confirmation before saving.
- Detailed application pages with extracted requirements and a timestamped status timeline.
- Links back to original job postings.
- Individual and bulk deletion with confirmation.

### Authentication and backend

- Password hashing with bcrypt and JWT-based authentication.
- Seven-day login tokens.
- Job reads and mutations scoped to the authenticated user.
- Request validation for required job fields, URLs, IDs, and statuses.
- Duplicate checks using normalized posting URLs within each user's applications.
- Database-level duplicate protection and atomic status transitions to handle concurrent requests.
- Structured AI extraction through Groq using `openai/gpt-oss-20b` and a JSON schema.
- Dashboard-to-extension messaging for login, logout, and manual-entry data.

## How it works

1. Create an account and sign in to the dashboard. With the configured extension installed, the dashboard sends the login token to it.
2. Open a job posting and select **Get Job Details** in the extension.
3. The backend extracts structured information from the page text, and the extension displays the result.
4. Select **Track Job** to check for duplicates and hold the opportunity as pending. If required information is missing, complete it through the dashboard's manual-entry form.
5. After applying, select **Yes, I Applied** in the extension. The backend saves the application with an initial `Applied` timeline event.
6. Use the dashboard to revisit role requirements and update the application's progress.

Pending opportunities are stored locally in the extension. They appear in the dashboard only after application confirmation saves them to the backend. The manual-entry form completes an extension opportunity rather than creating a standalone dashboard application.

## Architecture

```text
Chrome extension (React / Manifest V3)
    | captures active-page text
    | authenticated extraction and save requests
    v
Express API ----> Groq AI (structured job extraction)
    |
    v
MongoDB (users, applications, status timelines)
    ^
    | authenticated application requests
React dashboard (Vite / React Router)

Dashboard <---- Chrome external messaging ----> Extension
               authentication and manual entry
```

| Component | Technologies |
| --- | --- |
| Dashboard | React, React Router, Vite, CSS |
| Chrome extension | React, Manifest V3, Chrome storage/scripting APIs, CRXJS, Vite |
| Backend | Node.js, Express, Mongoose, MongoDB |
| Authentication | JSON Web Tokens, bcryptjs |
| AI extraction | Groq SDK, JSON schema responses |
| Deployment | Vercel for the dashboard, Render for the backend |

## Repository structure

```text
ATrackie/
├── backend/
│   ├── constants/       # Application statuses and allowed transitions
│   ├── controllers/     # Authentication and application operations
│   ├── middlewares/     # JWT authentication
│   ├── models/          # User and Job schemas
│   ├── routes/          # API routes
│   ├── services/        # AI extraction
│   ├── utils/           # Posting URL normalization
│   └── server.js
├── extension/
│   ├── manifest.json
│   └── src/             # Popup, background worker, storage, and API helpers
└── job-tracker-dashboard/
    └── src/             # Pages, components, routing, and styles
```

## Local setup

### Prerequisites

- A Node.js version compatible with Vite 8 and the installed dependencies.
- npm.
- A MongoDB connection string.
- A Groq API key with access to the configured model.
- Chrome to load the extension.

### 1. Clone the repository

```bash
git clone https://github.com/22B91A04L7/ATrackie.git
cd ATrackie
```

### 2. Start the backend

```bash
cd backend
npm install
```

Create `backend/.env` with your own values:

```dotenv
MONGO_URI=mongodb://127.0.0.1:27017/atrackie_local
JWT_SECRET=your_long_random_secret
GROQ_API_KEY=your_groq_api_key
PORT=5000
```

Keep credentials out of version control.

```bash
npm run dev
```

The backend starts after connecting successfully to MongoDB. The default local address is `http://localhost:5000`.

### 3. Start the dashboard

In another terminal, from the repository root:

```bash
cd job-tracker-dashboard
npm install
npm run dev
```

Open `http://localhost:5173` for a local frontend preview. This branch targets the deployed backend; extension connection is authorized only from the deployed dashboard.

**Configuration:** Both frontends use `https://atrackie-backend.onrender.com`. For fully local testing, change both API configurations and the Vite proxy target to `http://localhost:5000`, the extension dashboard URL to `http://localhost:5173`, and its manifest origins to the matching localhost URLs. Start your existing local MongoDB server and use the local backend `.env` described above. AI extraction still uses the Groq API.

### 4. Build and load the extension

From the repository root:

```bash
cd extension
npm install
npm run build
```

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked** and choose `extension/dist`.
4. Copy the installed extension's ID.
5. Set `EXTENSION_ID` in `job-tracker-dashboard/src/config.js` to that ID for dashboard-to-extension messaging.

The committed dashboard is configured for a specific extension ID. A locally loaded copy may receive a different ID, so the deployed dashboard may not connect to it without a matching dashboard configuration.

Deployed integration is configured in:

- `extension/src/config.js`: dashboard `https://atrackie.vercel.app`, backend `https://atrackie-backend.onrender.com`.
- `extension/manifest.json`: deployed dashboard messaging and deployed backend permissions.

Rebuild and reload the extension after changing its configuration. Sign out of local sessions and sign in on the deployed dashboard before connecting the extension.

Use the hosted MongoDB environment variable on Render; never upload the local `.env`. The backend supports `npm run dev` with automatic restart and `npm start` without it.

## API overview

All `/api/jobs` endpoints and `/api/auth/session` require an `Authorization: Bearer <token>` header. Signup and login are public.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/api/auth/signup` | Register a user |
| POST | `/api/auth/login` | Authenticate and obtain a JWT |
| GET | `/api/auth/session` | Verify the signed-in extension account (requires a bearer token) |
| GET | `/api/jobs` | List the user's applications, newest first |
| GET | `/api/jobs/:id` | Fetch one application |
| POST | `/api/jobs` | Save an application with initial `Applied` status |
| POST | `/api/jobs/extract` | Extract job information from `pageText` |
| POST | `/api/jobs/check-duplicate` | Check whether a posting URL is already tracked |
| PATCH | `/api/jobs/:id/status` | Update status and append a timeline event |
| DELETE | `/api/jobs/:id` | Delete one application |
| DELETE | `/api/jobs` | Delete applications supplied in a `jobIds` array |

## Application status progression

The dashboard and backend enforce these transitions:

| Current status | Allowed next statuses |
| --- | --- |
| Applied | Assessment, Interview, Rejected |
| Assessment | Interview, Rejected |
| Interview | Offer Received, Selected, Rejected |
| Offer Received | Selected, Rejected |
| Selected | None |
| Rejected | None |

Each saved transition records its status and timestamp. Backward transitions are not currently supported.

## Development commands

Both frontend packages provide:

```bash
npm run dev      # Start the Vite development server
npm run build    # Generate a production build
npm run lint     # Run ESLint
npm run preview  # Preview the production build
```

The backend provides `npm start`. Its `npm test` script is still a placeholder; focused regression scripts are available under the packages' `tests` directories. See [the Batch 2 change report](audit/BATCH-2.md) for commands, coverage, compatibility notes, and results.

Backend startup checks for existing duplicate applications before creating its unique index. If duplicates exist, it stops without changing those records; review them before using the updated backend with that database.

## Current scope and limitations

- The Chrome extension is not yet published to the Chrome Web Store.
- The extension stores one pending opportunity per account at a time.
- AI extraction depends on the text available in the active page and can miss or misidentify information. It currently uses the first 30,000 characters of the page's body text.
- The stored role description is an AI-generated summary; the full original page text is not archived.
- Complete AI results do not currently have an editing step in the extension; manual completion is offered when required details are missing.
- URL normalization removes fragments and trailing path slashes, but preserves query parameters. Different URLs for the same role can therefore evade duplicate checks.
- Reminders, interview preparation checklists, and tracking submitted resume versions are not implemented.

This README documents the implemented project. Planned features and Chrome Web Store publication are outside the current release scope.
