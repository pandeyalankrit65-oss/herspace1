# HerSpace

A safety and support app for women: SOS alerts to trusted contacts, incident reporting, a community safety map, and an AI support companion.

HerSpace won 1st prize at the AI Hackathon 2025. It is still a prototype. The section **What works today** describes exactly what the app does. **Not built yet** lists what it doesn't do.

## What works today

| Feature | What it does |
|---|---|
| **Emergency SOS** (`/sos`) | Starts a 3-second countdown you can cancel, then texts your confirmed emergency contacts a map link to your current location. It can also ring them with an automated voice call (optional). It shows what happened for each contact, and upgrades "sent" to "delivered" or "answered" as Twilio confirms. Anyone the alert missed can be texted or called from your own phone with one tap. There's always a button to call the emergency number (default `112`). **HerSpace does not contact police or emergency services.** |
| **Live location** (`/track/:token`) | A logged-in user's SOS text includes a private live-map link. While the SOS page stays open, the phone sends its position about every 20 seconds (it asks the browser to keep the screen on). Contacts see it update on a map, with a warning if it goes stale. Tapping **"I'm safe"** ends sharing and deletes the position immediately. Links expire after 4 hours. Each contact gets a personal link and can tap **"I'm on my way"**, which the user sees on their SOS screen ("Mom is on the way"). The SOS text also names the area ("Near Connaught Place, New Delhi"), looked up on the server from OpenStreetMap's Nominatim. |
| **Walk with me** (`/walk`) | Share your live location with confirmed contacts for a journey (30 minutes to 4 hours), with an optional note like "metro to home". Contacts get a calm text, not an alert, and can reply "I'm keeping an eye out". Tap **"I've arrived"** to stop. |
| **Rides and meetings** (`/walk`) | Besides a walk, the journey can be a **cab or auto** (vehicle number, type, app, driver, destination) or **meeting someone** (who, where, their profile or number). Contacts get those details with the live link, and a check-in timer alerts them with the last location if "I've arrived" isn't tapped in time (enforced by the server). If a ride's location stops updating for 10 minutes, contacts get one gentle "please try calling" message. |
| **Safety timer** (`/timer`) | Set a timer (15 minutes to 2 hours) with an optional note, e.g. "walking home from the metro". If you don't tap **"I'm safe"** in time, the **server** texts your confirmed contacts your last known location and a live link. It works even if your phone is off, lost or out of battery. While the page is open, you can add time and your location stays fresh, and you get a vibration and a notification 2 minutes before the end. |
| **Fake call** | A realistic incoming-call screen with ringtone and vibration, now or after a delay, as an excuse to leave an uncomfortable situation. No real call is made. Once answered, a voice speaks a short "come home now" script, and tapping **Keypad** on the call screen quietly sends a silent SOS. |
| **Voice trigger** | Say "help", "help me", "bachao" or "बचाओ" while the SOS page is open to start the (cancellable) countdown. The page shows what it heard, and a clear error if speech recognition fails. In the browser it uses the Web Speech API (Chrome and Edge, not Firefox or Brave, needs internet). In the Android app it uses the phone's own speech recognizer, asks for the microphone the first time, and keeps restarting it through silence. Either way it only works while the page is open. |
| **Shake to start SOS** | An opt-in switch on the SOS page (touch screens only): shaking the phone hard 3 times within 1.5 seconds starts the cancellable countdown. Walking or a single jolt doesn't trigger it. Only while the page is open. |
| **Hold to send** | An option on the SOS page: instead of tap-then-countdown, press and hold the SOS button for 3 seconds (a ring fills as you hold; letting go cancels). Easier to do by feel, e.g. in a pocket. Works with touch, mouse and keyboard. |
| **Verified phone number** (`/account`) | Users can add their own number, proved with a 6-digit texted code (expires in 10 minutes, 5 tries, 5 codes an hour). Alerts and invites then read "Asha (+91…)", so contacts know who it is and can call back. |
| **Safety at home** (`/account`) | For someone whose phone may be checked or who may be overheard. **Disguised mode** makes HerSpace open as a working calculator: PIN then "=" opens the app, and an optional SOS code then "=" sends a silent alert while the calculator looks normal. It relocks after a minute in the background; codes are stored only on the device, hashed. **Quick exit** puts an Exit button on every page (or press Esc twice) that jumps to an ordinary website, or back to the calculator. **Silent alert** (SOS page) turns off vibration and asks contacts to text, not call. A **code phrase** ("did you buy the red umbrella?") is explained to confirmed contacts by SMS, so they know to get help rather than reply. |
| **Help & your rights** (`/help`) | Tap-to-call helplines (112, 181, 1930, NCW, NALSA, Tele-MANAS…) and plain-language guidance for India, in English and Hindi: the first hours after a sexual assault (free treatment, emergency contraception, PEP, evidence, Zero FIR, One Stop Centres), rights with the police, domestic violence, POSH at work, online harassment and image abuse, a stalkerware checklist, and options for people who can't speak. Content lives in `src/content/help.ts`, marked with a review date; have it checked by a lawyer or women's-rights organisation before launch. |
| **Complaint letters** (`/complaint`) | Turns a saved report (or details typed in) into a formal complaint to the police (FIR, with a Zero FIR request) or a workplace Internal Committee (POSH), in English or Hindi. Editable, then copy, print or email. Nothing is sent by HerSpace. |
| **Evidence, alarm, nearest help** | **Audio evidence** (opt-in, SOS page): after an alert, the phone records in 10-second pieces, each a complete file, uploaded as it goes (up to 15 minutes), so it survives the phone being taken. Only the user can play it (`/account`); deleted with the alert after 90 days. **Loud alarm**: a siren and a red/black screen alternating under 3 times a second (the seizure-safety limit). **Nearest help** on the map: the closest police station, hospital or pharmacy with walking directions. |
| **Setup checklist** | Signed-in users see "Get ready for an emergency" on the home and SOS pages until they have added a contact, the contact has confirmed, a test alert has been sent and location access is allowed. |
| **Emergency contacts** (`/contacts`) | Up to 10 contacts, stored on your account. Each contact gets an invite link and must **agree** before they receive alerts. This stops SOS from being used to spam strangers, and means they know what an alert means. The invite can be sent by SMS automatically or shared by the user over SMS or WhatsApp. A **test alert** checks that messages actually arrive. |
| **Incident reports** (`/report`) | You can submit anonymously, in which case no account is linked, even if you're logged in. You can also add your current location to the Safe Map, and up to 3 photos. Photos are redrawn in the browser before upload, which drops EXIF data (GPS position, camera, time); the server strips any remaining metadata again. They never appear on the map: only the reporter (if not anonymous) and moderators can view them. |
| **Safe Map & help nearby** (`/map`) | An OpenStreetMap/Leaflet map of reported incidents. Locations are rounded to about 1 km, and only the incident type and date are shown. Descriptions and identities never appear on the map. After "Show my location", it also shows police stations, hospitals and pharmacies within 3 km (from OpenStreetMap's Overpass API, queried by the server with the position rounded to ~1 km), with directions and a call button where a number is known. |
| **AI support chat** (`/support`) | A supportive companion powered by Claude (`claude-opus-5`), prompted to put safety first and point to emergency help. If no Anthropic credentials are configured, it switches to simple scripted replies and the UI says so. |
| **Safe Map moderation** (`/moderation`) | Anyone can flag a point as false or abusive. Points flagged by 3 different people are hidden. Moderators (set with `ADMIN_EMAILS`) get a review queue of flagged points showing the report and its photos, never who sent it, and can keep a point on the map, remove it, or send it back to review. |
| **Works offline, installable** | After the first visit, the app (and especially the SOS page) opens with no connection. Offline, SOS can't send alerts itself, but it shows your contacts with one-tap **Text** (location included) and **Call** buttons, which work over the phone network. It can be installed to the home screen, with an SOS shortcut. |
| **Hindi** | A language toggle (always visible in the navbar) switches the safety-critical screens to Hindi: SOS, live tracking, contacts and invites, reporting, login and sign-up, password reset, support chat, map, account, and the error and offline screens. The voice trigger listens for "बचाओ" in Hindi mode. Scripted chat replies come in Hindi; the AI replies in whatever language the user writes. Strings live in `src/i18n/en.ts` and `src/i18n/hi.ts`, and a missing Hindi key fails the build. The Privacy Policy and Terms have Hindi translations (`src/pages/legal/`), marked as a convenience translation that links to the binding English text; have them professionally reviewed before launch. |
| **Privacy Policy & Terms** (`/privacy`, `/terms`) | Written to match exactly what the app collects and shares. |
| **Accounts** (`/account`) | Email + password with password reset by email, password change (signs out other devices), download of all your data, and account deletion. Passwords are hashed with scrypt. Sessions live in an HttpOnly, SameSite cookie that page scripts can't read, and are stored hashed on the server. Changing requests must carry an `X-Requested-With` header, which blocks cross-site request forgery. Login, SOS, invites, reports and chat are rate-limited. SOS locations are deleted automatically after 90 days. |

## Not built yet

- **Corporate Connect** and **Safe Circles**: the pages describe planned features and say so on the page.
- Triggers that work with the screen off or the app closed (lock screen, power button, background voice or shake).
- Audio recording, and video or other files with reports.
- AI or ML risk prediction and safe-route navigation.
- End-to-end encryption. Data is protected by access control on the server, not encrypted per user.
- Admin or HR dashboards beyond map moderation.

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
| `COOKIE_SECURE` | Force the `Secure` cookie flag on or off (default: on when `NODE_ENV=production`). The frontend and API must be served from the same origin, e.g. behind one reverse proxy. |
| `TRUST_PROXY` | Number of reverse proxies in front of the API in production, so rate limits see real client IPs. |
| `HERSPACE_SECRET` | Key for anonymising IP addresses (map flags). If unset, one is generated and stored in the database. |
| `CHECK_IN_POLL_MS` | How often the server checks for expired safety timers (default 20000). |
| `LIVE_SHARE_HOURS` | How long a live-location link stays active (default 4). |
| `SOS_RETENTION_DAYS`, `MAP_FLAG_THRESHOLD` | Data retention (default 90 days) and flags needed to hide a map point (default 3). |
| `ANTHROPIC_API_KEY` | Powers the AI support chat. Without it, the chat uses scripted fallback replies. |
| `EMERGENCY_NUMBER` | Emergency number the chat assistant mentions (default `112`). |
| `CORS_ORIGIN` | Comma-separated origins allowed to call the API directly (default `http://localhost:8080`). |
| `DATABASE_PATH` | SQLite file location (default `server/data/herspace.db`). |
| `UPLOAD_DIR` | Where report photos are stored (default `server/data/uploads`). Back it up with the database. |
| `ADMIN_EMAILS` | Comma-separated emails of accounts that can moderate the Safe Map. |
| `NOMINATIM_URL`, `OVERPASS_URL` | OpenStreetMap services for area names in SOS texts and nearby help on the map (defaults: the public instances). Set either to `off` to disable it. For real traffic, use your own instance or a commercial provider: the public ones have strict usage policies. |

The web app reads two settings from a root `.env` file (see `.env.example`). `VITE_EMERGENCY_NUMBER` (default `112`) sets the number used by the call buttons. `VITE_CONTACT_EMAIL` is the privacy contact shown on the Privacy and Terms pages.

Offline support uses a service worker (`public/sw.js`) that is only registered in production builds. Try it with `npm run build && npx vite preview`.

## Android app

The Android app (`android/`, built with [Capacitor](https://capacitorjs.com)) wraps the same web app and adds what a browser can't do:

- **Location with the screen locked.** During live sharing and safety timers, location keeps updating in the background. Android shows a persistent notification while it does.
- **Timer reminders as system notifications.** The "2 minutes left" warning is scheduled with the system, so it arrives even if the app is closed.
- **Shortcuts.** Long-press the icon for **Emergency SOS** or **Safety timer** (these open `herspace://sos` and `herspace://timer`).
- **Android integration.** The back button behaves as expected, `tel:` and `sms:` links open the dialler and messaging app, and the app has its own icon and splash screen.

API calls go through Android's native HTTP stack (CapacitorHttp): no CORS, cookies are kept in the native store, and requests aren't throttled in the background. The app needs the API's full address in `VITE_API_BASE_URL`. `.env.android` points it at `http://10.0.2.2:3001`, which is your PC as seen from the emulator. Plain HTTP is allowed only to that address, and only in debug builds.

Not yet in the app: the voice trigger (Android's WebView has no speech recognition), and iOS.

### Building

Requires JDK 21 and the Android SDK (platform 36, build-tools 36.1). Android Studio installs both.

```sh
npm run build:android            # build the web app for Android and copy it into android/
npm run android:apk              # ...and build android/app/build/outputs/apk/debug/app-debug.apk
npx cap open android             # or open the project in Android Studio
```

For a real phone, deploy the API over HTTPS, set `VITE_API_BASE_URL` to it, and build a signed release in Android Studio (Build → Generate Signed Bundle/APK).

## Tests and CI

```sh
npm test --prefix server      # API tests (Node's built-in test runner, in-memory database)
npm run test:e2e              # browser tests (Playwright), desktop and phone
npm run lint
npm run build
```

The **browser tests** (`e2e/`) build the app and drive it in Chromium, at desktop and phone sizes:
- the full SOS journey: invite a contact, the contact accepts, test alert, SOS, live tracking, "I'm safe"
- cancelling the countdown
- unconfirmed contacts
- cookie security and password reset
- reporting and the map
- Hindi
- offline SOS
- contacts replying "I'm on my way", walk with me, help nearby on the map, the setup checklist
- report photos (EXIF removed) and map moderation
- voice (with a fake speech engine) and shake (with synthetic motion events) triggers
- every page checked for console errors and phone-width overflow
- every page checked with [axe](https://github.com/dequelabs/axe-core) for WCAG 2.1 A/AA problems, in light and dark mode

OpenStreetMap lookups go to a local stub (`e2e/stub-osm.mjs`), never to the public services.

They run against an isolated API server (its own port and database) in **outbox mode**. `MESSAGE_OUTBOX` makes the server write SMS, calls and emails to a file instead of sending them, and tests read invite, SOS and reset links from that file. The server refuses outbox mode when `NODE_ENV=production`. To run them locally without downloading Chromium, use your installed Chrome: `PW_CHANNEL=chrome npm run test:e2e`.

Neither test suite reads `server/.env`, so they can't send real messages. GitHub Actions (`.github/workflows/ci.yml`) runs lint, type-check, build, the API tests and the browser tests on every push and pull request.

Database schema changes go in `server/src/db.ts` as new entries in the `migrations` list. They're applied automatically on startup.

## Tech stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind, shadcn/ui, React Router, Leaflet
- **Backend:** Node.js, Express, zod validation, SQLite (`node:sqlite`)
- **Integrations:** Twilio (SMS), Anthropic Claude API (support chat), OpenStreetMap tiles

## API overview

| Method & path | Auth | Description |
|---|---|---|
| `POST /api/auth/signup`, `POST /api/auth/login` | – | Returns `{ token, user }` |
| `POST /api/auth/logout`, `GET /api/auth/me` | Session | |
| `POST /api/auth/forgot`, `POST /api/auth/reset` | – | Password reset by email |
| `POST /api/account/password`, `GET /api/account/export`, `DELETE /api/account` | Session | Change password, download data, delete account |
| `GET /api/account/setup` | Session | Setup checklist progress |
| `POST /api/account/phone`, `POST /api/account/phone/verify`, `DELETE /api/account/phone` | Session | Verify or remove the user's own phone number |
| `GET/PUT /api/account/code-phrase` | Session | The code phrase; saving it texts confirmed contacts what it means |
| `GET/POST/PUT/DELETE /api/contacts`, `POST /api/contacts/:id/resend` | Session | Your emergency contacts and their invites |
| `GET/POST /api/contact-invites/:token` | – | Used by an invited contact to accept or decline |
| `POST /api/sos` | Optional | Sends SMS to your contacts; returns per-contact delivery status. `silent: true` asks contacts not to call and skips voice calls |
| `POST /api/sos/test` | Session | Test alert (max 3/day) |
| `GET /api/sos`, `GET /api/sos/:id` | Session | Your past SOS events / live delivery status |
| `POST /api/sos/:id/recordings`, `GET /api/sos/recordings`, `GET /api/sos/:id/recordings/:rid` | Session (owner) | Upload and play SOS audio pieces |
| `GET /api/location-shares/active`, `POST /api/location-shares/:id/location`, `POST /api/location-shares/:id/stop` | Session | Live location: resume, update position, "I'm safe" |
| `POST /api/check-ins`, `GET /api/check-ins/current`, `POST /api/check-ins/:id/extend`, `/location`, `/complete` | Session | Safety timer |
| `POST /api/location-shares` | Session | Walk with me: start sharing a journey with confirmed contacts |
| `GET /api/track/:token`, `POST /api/track/:token/ack` | Link token | What a contact sees (name, latest position, active/ended), and their "I'm on my way" reply |
| `GET /api/nearby?lat=&lng=` | – | Police stations, hospitals and pharmacies within 3 km |
| `POST /api/twilio/status` | Twilio signature | Delivery-status callbacks |
| `POST /api/reports` | Optional | Submit a report (`anonymous: true` never stores the user) |
| `GET /api/reports`, `DELETE /api/reports/:id` | Session | Your own non-anonymous reports |
| `POST /api/reports/:id/photos` | Upload token | Add a JPEG photo (up to 3, within 15 minutes of submitting) |
| `GET /api/reports/:id/photos/:photoId` | Session (owner or moderator) | View a report photo |
| `POST /api/reports/:id/flag` | – | Flag a map point |
| `GET /api/reports/map` | – | Public, coarsened points for the map |
| `GET /api/moderation/reports?queue=review\|approved\|removed`, `POST /api/moderation/reports/:id` | Moderator | Review flagged map points: `approve`, `remove` or `reopen` |
| `POST /api/chat` | – | Support chat reply (`mode: "ai"` or `"fallback"`) |

## Before a real launch

- Serve over HTTPS. Geolocation and the microphone require it outside `localhost`.
- Test SOS end to end with real phones in the countries you support. Twilio trial accounts can only text verified numbers. For Indian numbers, business SMS requires TRAI DLT registration (sender ID and message templates), or messages are silently dropped.
- Set `VITE_CONTACT_EMAIL`, and have a lawyer review the Privacy Policy and Terms of Use. They describe the app accurately, but they are not legal advice.
- Moderate map reports. Anyone can submit one, so false reports are possible.
