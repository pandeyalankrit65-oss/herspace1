# HerSpace

A safety and support app for women: SOS alerts to trusted contacts, incident reporting, a community safety map, and an AI support companion.

HerSpace won 1st prize at the AI Hackathon 2025. It is still a prototype. The section **What works today** describes exactly what the app does. **Not built yet** lists what it doesn't do.

## What works today

| Feature | What it does |
|---|---|
| **Emergency SOS** (`/sos`) | Starts a 3-second countdown you can cancel, then texts your confirmed emergency contacts a map link to your current location. It can also ring them with an automated voice call (optional). It shows what happened for each contact, and upgrades "sent" to "delivered" or "answered" as Twilio confirms. Anyone the alert missed can be texted or called from your own phone with one tap. There's always a button to call the emergency number (default `112`). **HerSpace does not contact police or emergency services.** |
| **Voice trigger** | Say "help me" while the SOS page is open to start the countdown. It uses the browser's Web Speech API (Chrome/Edge), and only works while the page is open. |
| **Emergency contacts** (`/contacts`) | Up to 10 contacts, stored on your account. Each contact gets an invite link and must **agree** before they receive alerts. This stops SOS from being used to spam strangers, and means they know what an alert means. The invite can be sent by SMS automatically or shared by the user over SMS or WhatsApp. A **test alert** checks that messages actually arrive. |
| **Incident reports** (`/report`) | You can submit anonymously, in which case no account is linked, even if you're logged in. You can also add your current location to the Safe Map. |
| **Safe Map** (`/map`) | An OpenStreetMap/Leaflet map of reported incidents. Locations are rounded to about 1 km, and only the incident type and date are shown. Descriptions and identities never appear on the map. |
| **AI support chat** (`/support`) | A supportive companion powered by Claude (`claude-opus-5`), prompted to put safety first and point to emergency help. If no Anthropic credentials are configured, it switches to simple scripted replies and the UI says so. |
| **Safe Map moderation** | Anyone can flag a point as false or abusive. Points flagged by 3 different people are hidden. |
| **Works offline, installable** | After the first visit, the app (and especially the SOS page) opens with no connection. Offline, SOS can't send alerts itself, but it shows your contacts with one-tap **Text** (location included) and **Call** buttons, which work over the phone network. It can be installed to the home screen, with an SOS shortcut. |
| **Privacy Policy & Terms** (`/privacy`, `/terms`) | Written to match exactly what the app collects and shares. |
| **Accounts** (`/account`) | Email + password with password reset by email, password change (signs out other devices), download of all your data, and account deletion. Passwords are hashed with scrypt, and session tokens are stored hashed. Login, SOS, invites, reports and chat are rate-limited. SOS locations are deleted automatically after 90 days. |

## Not built yet

- **Corporate Connect** and **Safe Circles**: the pages describe planned features and say so on the page.
- Live location tracking after the SOS is sent. Contacts currently get your location from the moment you pressed SOS.
- A native mobile app. As a web page, SOS only works while the page is open. There's no lock-screen, power-button or shake trigger.
- Phone-number verification for the user's own account.
- Audio recording, and uploading photos or files with reports.
- AI or ML risk prediction and safe-route navigation.
- End-to-end encryption. Data is protected by access control on the server, not encrypted per user.
- Admin or HR dashboards, and a review queue for flagged map reports.

## Running locally

Requires **Node.js 22.13+**, because the server uses the built-in `node:sqlite` module.

```sh
# 1. Install
npm install
npm install --prefix server

# 2. Configure the server (optional, but SMS and AI chat need it)
cp server/.env.example server/.env
#    then fill in TWILIO_* and ANTHROPIC_API_KEY

# 3. Run the API (port 3001) and the web app (port 8080) in two terminals
npm run dev:server
npm run dev
```

Open http://localhost:8080. The Vite dev server forwards `/api` requests to the backend.

### Configuration (`server/.env`)

| Variable | Purpose |
|---|---|
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | Needed for SOS SMS and contact invites. Without them, SOS still records the event, but the app clearly tells the user that nothing was sent and offers text/call buttons instead. Invites can then only be shared by the user. |
| `SOS_VOICE_CALLS` | `true` to also ring confirmed contacts with an automated call during a real SOS. |
| `PUBLIC_API_URL` | Public URL of the API. Enables Twilio delivery-status callbacks (signature-verified), which turn "sent" into "delivered" or "answered". |
| `APP_URL` | Frontend URL used in invite and password-reset links (default `http://localhost:8080`). |
| `RESEND_API_KEY`, `EMAIL_FROM` | Sends password-reset emails through [Resend](https://resend.com). Without them, reset links are printed to the server console (development only). |
| `TRUST_PROXY` | Number of reverse proxies in front of the API in production, so rate limits see real client IPs. |
| `SOS_RETENTION_DAYS`, `MAP_FLAG_THRESHOLD` | Data retention (default 90 days) and flags needed to hide a map point (default 3). |
| `ANTHROPIC_API_KEY` | Powers the AI support chat. Without it, the chat uses scripted fallback replies. |
| `EMERGENCY_NUMBER` | Emergency number the chat assistant mentions (default `112`). |
| `CORS_ORIGIN` | Comma-separated origins allowed to call the API directly (default `http://localhost:8080`). |
| `DATABASE_PATH` | SQLite file location (default `server/data/herspace.db`). |

The web app reads two settings from a root `.env` file (see `.env.example`). `VITE_EMERGENCY_NUMBER` (default `112`) sets the number used by the call buttons. `VITE_CONTACT_EMAIL` is the privacy contact shown on the Privacy and Terms pages.

Offline support uses a service worker (`public/sw.js`) that is only registered in production builds. Try it with `npm run build && npx vite preview`.

## Tests and CI

```sh
npm test --prefix server   # API tests (Node's built-in test runner, in-memory database)
npm run lint
npm run build
```

GitHub Actions (`.github/workflows/ci.yml`) runs lint, type-check, build and the API tests on every push and pull request. The tests never read `server/.env`, so they can't send real messages.

Database schema changes go in `server/src/db.ts` as new entries in the `migrations` list. They're applied automatically on startup.

## Tech stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind, shadcn/ui, React Router, Leaflet
- **Backend:** Node.js, Express, zod validation, SQLite (`node:sqlite`)
- **Integrations:** Twilio (SMS), Anthropic Claude API (support chat), OpenStreetMap tiles

## API overview

| Method & path | Auth | Description |
|---|---|---|
| `POST /api/auth/signup`, `POST /api/auth/login` | – | Returns `{ token, user }` |
| `POST /api/auth/logout`, `GET /api/auth/me` | Bearer | |
| `POST /api/auth/forgot`, `POST /api/auth/reset` | – | Password reset by email |
| `POST /api/account/password`, `GET /api/account/export`, `DELETE /api/account` | Bearer | Change password, download data, delete account |
| `GET/POST/PUT/DELETE /api/contacts`, `POST /api/contacts/:id/resend` | Bearer | Your emergency contacts and their invites |
| `GET/POST /api/contact-invites/:token` | – | Used by an invited contact to accept or decline |
| `POST /api/sos` | Optional | Sends SMS to your contacts; returns per-contact delivery status |
| `POST /api/sos/test` | Bearer | Test alert (max 3/day) |
| `GET /api/sos`, `GET /api/sos/:id` | Bearer | Your past SOS events / live delivery status |
| `POST /api/twilio/status` | Twilio signature | Delivery-status callbacks |
| `POST /api/reports` | Optional | Submit a report (`anonymous: true` never stores the user) |
| `GET /api/reports`, `DELETE /api/reports/:id` | Bearer | Your own non-anonymous reports |
| `POST /api/reports/:id/flag` | – | Flag a map point |
| `GET /api/reports/map` | – | Public, coarsened points for the map |
| `POST /api/chat` | – | Support chat reply (`mode: "ai"` or `"fallback"`) |

## Before a real launch

- Serve over HTTPS. Geolocation and the microphone require it outside `localhost`.
- Test SOS end to end with real phones in the countries you support. Twilio trial accounts can only text verified numbers. For Indian numbers, business SMS requires TRAI DLT registration (sender ID and message templates), or messages are silently dropped.
- Set `VITE_CONTACT_EMAIL`, and have a lawyer review the Privacy Policy and Terms of Use. They describe the app accurately, but they are not legal advice.
- Moderate map reports. Anyone can submit one, so false reports are possible.
