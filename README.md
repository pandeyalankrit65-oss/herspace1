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
| **Safe word** (SOS page) | Users choose their own word; saying it 3 times within 10 seconds while voice listening is on starts the (cancellable) SOS countdown, while once or twice in conversation does nothing. The built-in "help" words can be turned off so only the safe word triggers SOS. A "Test my safe word" button shows what the phone heard, to pick a word it recognises reliably. Stored only on the device (`src/lib/safe-word.ts`). |
| **Voice commands** (mic in the top bar) | Say what you need on any page: "help me" (starts the SOS countdown), "call Mom" (matches contact names and family words like मम्मी / அம்மா / মা / आई against names and relations), "call police", "start a 30 minute timer", "fake call", "sound the alarm", "share my location", "I'm taking a cab", "open the map", "report", "my rights". Works in all five languages (`src/lib/voice-commands.ts`). It shows what it heard and what it's about to do before acting, and suggests phrases when it doesn't understand. |
| **Voice in the support chat** | A mic button speaks your message instead of typing, and "Read replies aloud" reads the AI's answers in the app's language. |
| **Listen for screams** (SOS page) | Opt-in, while the SOS page is open: a long, loud scream starts the cancellable countdown. Sound is analysed on the phone in 50 ms frames (`src/lib/scream.ts`) and never recorded or sent: a frame counts if it's loud, its energy is mostly in the 0.7-4 kHz band and its spectral centre is above 900 Hz, and about 0.8 s of such frames within 1.5 s triggers (0.5 s and quieter on "More sensitive"), then it rests for 15 s. Noise suppression and automatic gain are turned off so they don't flatten a scream. A **Test it** mode shows a live meter and whether a sound would count, without starting SOS. |
| **Distress-aware chat** (`/support`) | As soon as a message suggests danger ("he's following me", "bachao", "பின்தொடர்கிறான்"...) the chat shows **Send SOS now** (straight into the cancellable countdown) and a call button; signs of self-harm bring Tele-MANAS 14416, 112 and the breathing exercise. Detection is on the device, in all five languages and romanised Hindi (`src/lib/distress.ts`), so it works before any reply and offline; the server's scripted replies use the same lists (a unit test keeps them in step). The chat now also works with the app in Tamil, Bengali or Marathi (the server used to reject those languages) and has scripted replies in them. |
| **Shake to start SOS** | An opt-in switch on the SOS page (touch screens only): shaking the phone hard 3 times within 1.5 seconds starts the cancellable countdown. Walking or a single jolt doesn't trigger it. Only while the page is open. |
| **Hold to send** | An option on the SOS page: instead of tap-then-countdown, press and hold the SOS button for 3 seconds (a ring fills as you hold; letting go cancels). Easier to do by feel, e.g. in a pocket. Works with touch, mouse and keyboard. |
| **Verified phone number** (`/account`) | Users can add their own number, proved with a 6-digit texted code (expires in 10 minutes, 5 tries, 5 codes an hour). Alerts and invites then read "Asha (+91…)", so contacts know who it is and can call back. |
| **Safety at home** (`/account`) | For someone whose phone may be checked or who may be overheard. **Disguised mode** makes HerSpace open as a working calculator: PIN then "=" opens the app, and an optional SOS code then "=" sends a silent alert while the calculator looks normal. It relocks after a minute in the background; codes are stored only on the device, hashed. **Quick exit** puts an Exit button on every page (or press Esc twice) that jumps to an ordinary website, or back to the calculator. **Silent alert** (SOS page) turns off vibration and asks contacts to text, not call. A **code phrase** ("did you buy the red umbrella?") is explained to confirmed contacts by SMS, so they know to get help rather than reply. |
| **Emergency info** (`/account`) | Blood group, allergies, medicines, health conditions and notes for whoever reaches her first. Health data, so it's private by default: with sharing turned on, contacts see it only on the live link of an active SOS (never walks or rides). Included in the data export and deleted with the account. |
| **Battery on the live link** | Each location update carries the phone's battery level (where the browser has the Battery API, including Android), so contacts see "Phone battery: 8% · it may switch off soon" and know why updates might stop. |
| **Saved places and automatic arrival** (`/account`, `/walk`) | Save Home, Work and other places (current position, or tap the map). Kept only on the phone, never on the server, and removed on logout. Pick one when starting a walk or ride: contacts are told where she's heading, and when the phone gets two fixes within ~150 m (with decent accuracy) a 30-second "You've reached Home" countdown starts, which she can cancel. Then sharing stops, the journey's safety timer ends, and contacts get "Asha has arrived at Home". |
| **Evidence pack** (`/evidence/:id`, linked from each report on `/account`) | One document per report for the police, a lawyer or a workplace Internal Committee: the report and its photos, the SOS alerts from the day before to the day after (time, location, who was alerted and how, who replied "on my way", how much audio was recorded) and a draft police complaint. "Save as PDF / Print" uses the browser's print dialog (Android's print dialog in the app), which handles every script (Hindi, Tamil...) and the photos; in print only the document shows. Built from the user's own records and sent nowhere. |
| **Help & your rights** (`/help`) | Tap-to-call helplines (112, 181, 1930, NCW, NALSA, Tele-MANAS…) and plain-language guidance for India, in all five app languages: the first hours after a sexual assault (free treatment, emergency contraception, PEP, evidence, Zero FIR, One Stop Centres), rights with the police, domestic violence, POSH at work, online harassment and image abuse, a stalkerware checklist, and options for people who can't speak. Content lives in `src/content/help.ts`, marked with a review date; have it checked by a lawyer or women's-rights organisation before launch. |
| **Complaint letters** (`/complaint`) | Turns a saved report (or details typed in) into a formal complaint to the police (FIR, with a Zero FIR request) or a workplace Internal Committee (POSH), in any of the app's five languages: it follows the app's language, or she can pick another (a station may prefer English or the local language). The Tamil, Bengali and Marathi letters were drafted with AI assistance and need checking by a native speaker before launch. Editable, then copy, print or email. Nothing is sent by HerSpace. |
| **Evidence, alarm, nearest help** | **Audio evidence** (opt-in, SOS page): after an alert, the phone records in 10-second pieces, each a complete file, uploaded as it goes (up to 15 minutes), so it survives the phone being taken. Only the user can play it (`/account`); deleted with the alert after 90 days. **Loud alarm**: a siren and a red/black screen alternating under 3 times a second (the seizure-safety limit). **Nearest help** on the map: the closest police station, hospital or pharmacy with walking directions. |
| **Setup checklist** | Signed-in users see "Get ready for an emergency" on the home and SOS pages until they have added a contact, the contact has confirmed, a test alert has been sent and location access is allowed. |
| **Emergency contacts** (`/contacts`) | Up to 10 contacts, stored on your account. Each contact gets an invite link and must **agree** before they receive alerts. This stops SOS from being used to spam strangers, and means they know what an alert means. The invite can be sent by SMS automatically or shared by the user over SMS or WhatsApp. A **test alert** checks that messages actually arrive. |
| **Incident reports** (`/report`) | You can submit anonymously, in which case no account is linked, even if you're logged in. You can also add your current location to the Safe Map, and up to 3 photos. Photos are redrawn in the browser before upload, which drops EXIF data (GPS position, camera, time); the server strips any remaining metadata again. They never appear on the map: only the reporter (if not anonymous) and moderators can view them. |
| **Safe Map & help nearby** (`/map`) | An OpenStreetMap/Leaflet map of reported incidents. Locations are rounded to about 1 km, and only the incident type and date are shown. Descriptions and identities never appear on the map. After "Show my location", it also shows police stations, hospitals and pharmacies within 3 km (from OpenStreetMap's Overpass API, queried by the server with the position rounded to ~1 km), with directions and a call button where a number is known. |
| **AI support chat** (`/support`) | A supportive companion powered by Claude (`claude-opus-5`), prompted to put safety first and point to emergency help. If no Anthropic credentials are configured, it switches to simple scripted replies and the UI says so. |
| **Safe Map moderation** (`/moderation`) | Anyone can flag a point as false or abusive. Points flagged by 3 different people are hidden. Moderators get a review queue of flagged points showing the report and its photos, never who sent it, and can keep a point on the map, remove it, or send it back to review. |
| **Works offline, installable** | After the first visit, the service worker stores the whole app (every page, from a build-time file list), so any page opens with no connection, and keeps map tiles you've viewed (up to 600). Offline, SOS can't send alerts itself, but it shows your contacts with one-tap **Text** (location included) and **Call** buttons, which work over the phone network. The map shows the last incidents and nearby help seen, contacts show the copy kept on the device, and reports (with photos) are saved on the phone and sent automatically when back online. Features that need the server (timer, walk, chat, editing contacts) say so and point to SOS. A small "offline" pill shows on every page. It can be installed to the home screen, with an SOS shortcut. The Android app keeps all its pages on the phone. |
| **Hindi** | A language toggle (always visible in the navbar) switches the whole app to Hindi, including the legal pages, help guide and complaint letters. The voice trigger listens for "बचाओ" in Hindi mode. Scripted chat replies come in Hindi; the AI replies in whatever language the user writes. Strings live in `src/i18n/en.ts` and `src/i18n/hi.ts`, and a missing Hindi key fails the build. The Privacy Policy and Terms have Hindi translations (`src/pages/legal/`), marked as a convenience translation that links to the binding English text; have them professionally reviewed before launch. |
| **Tamil, Bengali, Marathi (beta)** | The whole interface is also available in தமிழ், বাংলা and मराठी (marked "beta" in the language menu). These were drafted with AI assistance and must be reviewed by native speakers before launch; any missing message falls back to English. The voice trigger listens for உதவி / காப்பாத்து, বাঁচাও / সাহায্য and वाचवा / मदत, and read-aloud and the fake call speak in the chosen language. The Privacy Policy, Terms, complaint letters and the Help & rights guide are translated too (the English legal text stays binding, and each translation links to it); a unit test keeps every translation of the guide in step with the English, down to its numbers. Each language is its own file, downloaded only by people who choose it, and Tamil and Bengali fonts are self-hosted and only downloaded when used. |
| **Corporate Connect** (`/corporate`) | Confidential workplace reporting. An HR person sets up the workplace and gets an 8-character join code to share (only its keyed hash is stored; a new code replaces it). Setting a work email domain needs an account email on that domain, and employees whose email matches are shown as verified. Employees report harassment, discrimination, bullying or unsafe conditions to HR, **anonymous unless they choose to share their name**, and HR and the employee talk it through in a private thread without HR learning who it is. HR sets a status (new, being reviewed, resolved, closed) and sees insights: totals, open cases, typical time to first reply, reports per month, and a breakdown by type only from 3 reports up, with rare types folded into Other so they can't point to one person. Alerts go to a Slack or Teams webhook (only `hooks.slack.com`, `*.webhook.office.com` and `*.logic.azure.com` over https) or an email, and never carry what was written or who wrote it; the employee is emailed when HR replies, also without the reply. One workplace per account; the employer sees nothing else the employee does in HerSpace. |
| **Safe Circles** (`/circles`, `/circles/:id`) | Small private communities for a college, workplace or neighbourhood. Anyone signed in can start one and becomes its owner; people join with an 8-character code (stored as a keyed hash; moderators can replace it) or, for circles the owner chose to list, find it and ask to join, which a moderator approves. A circle can be limited to one email domain (only someone on that domain can set it), and members on it are shown as verified. Members post safety alerts, questions, support and events, and comment. **Anonymous posts and comments hide the author from everyone, moderators included**; the author is still stored so they can delete it and so a moderator can remove it and ban the author without learning who it was. Flags from 3 members hide a post until a moderator keeps or removes it. The owner makes moderators; moderators approve requests, remove or ban members and make a new code. When the owner leaves or deletes their account, the circle passes to the longest-standing moderator, then member, and is deleted when empty. Up to 20 circles per account; posting and flagging are rate-limited. |
| **Expert help** (`/partners`, `/partners/join`) | A partner network of counsellors, lawyers, NGOs, self-defence trainers and doctors. They apply with their registration or credentials; **nobody is listed until a HerSpace moderator approves them** (in `/moderation`, after checking with the issuing body), and any edit sends a listing back for checking. People filter by kind, city and language, and send a session request: the partner is emailed the user's name, the contact method she chose and her message, with her consent; partners' own email, phone and credentials are never shown publicly. HerSpace doesn't book sessions or take payment. The directory starts empty and shows the official helplines (181, Tele-MANAS, NALSA, NCW, 112) whenever nobody matches. Requests are limited to 5 a day. |
| **Verified community reporting** (`/map`, `/moderation`, `/account`) | Emails are confirmed with an emailed link (sent at signup; resend from `/account`; a password reset counts too), and only confirmed emails make someone "verified" in a workplace or circle on their domain. Map points say whether they came from a **verified reporter** (email and phone confirmed), an account, or anonymously, and signed-in people with a confirmed email can add "I saw this too"; a "Verified only" switch shows points from verified reporters or confirmed by 2+ people. **Fake-report checks** are plain rules in `server/src/trust.ts`, not a score: the same text as a report from the last week, 5+ reports from one account in an hour, two reports 200+ km apart within an hour, a new unconfirmed account reporting a lot, or an unconfirmed throwaway address (common disposable domains). Such reports are **held** for a moderator with the reasons, never silently dropped. Moderators review accounts by **code name** (never name or email, as the Privacy Policy promises) with their signals, and can pause one from the Safe Map with a reason the person is emailed; SOS and everything else keep working for them, and their points leave the map. IP addresses aren't used to link accounts: shared mobile network addresses would flag innocent people. |
| **Heatmap and reports near you** (`/map`) | A Points / Heatmap switch and a period filter (3 months, 12 months, any time). The heatmap shades ~1 km squares (the map points' own rounding, so it reveals nothing new) by a weighted sum of reports (`src/lib/risk.ts`): incident type (assault counts most), who reported it (verified 1.5×, anonymous 0.6×), confirmations (up to 3×), and age (halving every 90 days). After "Show my location", it gives an estimate for 1.5 km around you: how many reports, the weighted level, the latest date, the most common type and how many are verified, and suggests Walk with me when the level is medium or high. With fewer than 3 reports it says that's too few to tell, and it always says that few or no reports doesn't mean an area is safe. Everything is computed in the browser from the public map data. |
| **Well-being** (`/wellbeing`) | Guided breathing (box 4-4-4-4 or 4-7-8, with an animated circle that respects reduced motion, and optional vibration for eyes-closed use), the 5-4-3-2-1 grounding exercise, and a daily mood check-in with an optional note. The journal is kept **only on the phone** (`src/lib/mood.ts`, last 60 days), never sent to the server, and erased on logout, when someone else signs in, or on request. After the lowest mood today, or three low check-ins within a week, it gently offers Tele-MANAS (14416), the support chat and counsellors in Expert help. Says plainly that it isn't therapy. |
| **Privacy Policy & Terms** (`/privacy`, `/terms`) | Written to match exactly what the app collects and shares. |
| **Accounts** (`/account`) | Email + password with password reset by email, password change (signs out other devices), download of all your data, and account deletion. Passwords are hashed with scrypt. Sessions live in an HttpOnly, SameSite cookie that page scripts can't read, and are stored hashed on the server. Changing requests must carry an `X-Requested-With` header, which blocks cross-site request forgery. Login, SOS, invites, reports and chat are rate-limited. SOS locations are deleted automatically after 90 days. |

## Not built yet

- **Safe word, voice trigger and scream detection in the background**: today they listen only while the SOS page is open with the screen on. Listening with the screen off or the app closed needs an Android foreground service with microphone access (a permanent notification, battery use, and Google Play's rules for background microphone use), ideally with on-device recognition so audio never leaves the phone.
- Other triggers that work with the screen off or the app closed: shake, lock-screen widget, power-button presses (needs an accessibility service, which Play Store policy restricts), smartwatch or Bluetooth panic button.
- A missed-call SOS number for phones without data (needs a telephony provider).
- Disguised mode can't change the app's name or icon on the home screen (needs native Android work).
- Audio or video attached to reports (audio is recorded during SOS already).
- Native-speaker review of the Tamil, Bengali and Marathi translations (interface, complaint letters, Privacy Policy and Terms), and legal review of the translated legal pages and the Help & rights guide in all four languages.
- Safe-route navigation, and risk prediction beyond the weighted count of reports on the heatmap (e.g. time of day, lighting, crowd data).
- End-to-end encryption. Data is protected by access control on the server, not encrypted per user.
- Corporate Connect: signing in with the company's own login (SSO), and a formal Internal Committee case workflow (hearings, deadlines, reports to the District Officer).

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
| `ADMIN_EMAILS` | Development and tests only: comma-separated emails treated as moderators. Ignored in production, because sign-up doesn't verify email addresses. In production, grant the role with `npm run moderator -- add <email>` (also `remove`, `list`) in `server/`, after the person has signed up. |
| `MAX_RECORDING_MB_PER_DAY` | Cap on SOS audio each account can upload per day (default 200). |
| `NOMINATIM_URL`, `OVERPASS_URL` | OpenStreetMap services for area names in SOS texts and nearby help on the map (defaults: the public instances). Set either to `off` to disable it. For real traffic, use your own instance or a commercial provider: the public ones have strict usage policies. |

The web app reads two settings from a root `.env` file (see `.env.example`). `VITE_EMERGENCY_NUMBER` (default `112`) sets the number used by the call buttons. `VITE_CONTACT_EMAIL` is the privacy contact shown on the Privacy and Terms pages.

Offline support uses a service worker (`public/sw.js`) that is only registered in production builds. Try it with `npm run build && npx vite preview`.

## Android app

The Android app (`android/`, built with [Capacitor](https://capacitorjs.com)) wraps the same web app and adds what a browser can't do:

- **Location with the screen locked.** During live sharing and safety timers, location keeps updating in the background. Android shows a persistent notification while it does.
- **Timer reminders as system notifications.** The "2 minutes left" warning is scheduled with the system, so it arrives even if the app is closed.
- **Shortcuts.** Long-press the icon for **Emergency SOS** or **Safety timer** (these open `herspace://sos` and `herspace://timer`).
- **Android integration.** The back button behaves as expected, `tel:` and `sms:` links open the dialler and messaging app, and the app has its own icon and splash screen.
- **Speech both ways.** Android's WebView has neither speech recognition nor speech synthesis, so the app uses the phone's own: its recognizer for the voice trigger, safe word and voice commands, and its text-to-speech voice for the fake call, "Read aloud" and chat replies (`src/lib/speak.ts`).
- **Printing and Save as PDF.** `window.print()` does nothing in the WebView, so the evidence pack and complaint letter use a small built-in plugin (`PrintPlugin.java`) that opens Android's print dialog, which includes "Save as PDF".

API calls go through Android's native HTTP stack (CapacitorHttp): no CORS, cookies are kept in the native store, and requests aren't throttled in the background. Binary uploads (report photos, SOS audio) must be sent as a `File`: CapacitorHttp serializes a plain `Blob` as JSON, which corrupts it (see `asUpload` in `src/lib/native.ts`). The WebView can also report "online" in airplane mode, so the app treats failed requests as offline and checks back every 15 seconds. The app needs the API's full address in `VITE_API_BASE_URL`. `.env.android` points it at `http://10.0.2.2:3001`, which is your PC as seen from the emulator. Plain HTTP is allowed only to that address, and only in debug builds.

Not yet: an iOS app.

### Building

Requires JDK 21 and the Android SDK (platform 36, build-tools 36.1). Android Studio installs both.

```sh
npm run build:android            # build the web app for Android and copy it into android/
npm run android:apk              # ...and build android/app/build/outputs/apk/debug/app-debug.apk
npx cap open android             # or open the project in Android Studio
```

For a real phone, deploy the API over HTTPS, set `VITE_API_BASE_URL` to it, and build a signed release in Android Studio (Build → Generate Signed Bundle/APK).

### Checking the app on the emulator

`npm run test:android` drives the app on a running emulator and checks what only the app can do: SOS with audio recording, battery and emergency info on the contact's link, photo uploads, the evidence pack's print dialog (Save as PDF), automatic arrival from real GPS fixes, the safe word and voice commands with Android's recognizer, the fake call's voice, disguised mode with its silent SOS code, and an offline report sent once the connection is back (34 checks).

```sh
emulator -avd <name>                 # start an emulator (Android Studio's Device Manager works too)
npm run android:apk                  # build the app
npm run test:android -- --install    # install it and run the checks
```

It needs `ANDROID_HOME` (or `ADB`) pointing at the Android SDK and port 3001 free: it starts its own throwaway API server there, because the emulator build calls `http://10.0.2.2:3001`, and it never touches your dev database. Speech can't be spoken into the emulator, so recognized words are delivered the way Android's recognizer delivers them. Results and screenshots go to `test-results/android/`. The emulator needs about 1.5 GB of free memory; with less, Android may restart the app's WebView mid-run.

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
- Scream detection: a stand-in microphone plays a scream-like tone; test mode never starts SOS, a short burst doesn't count, a sustained scream starts the countdown
- Distress-aware chat: the danger and self-harm banners, Send SOS going straight into the countdown, and chat in Tamil
- Heatmap: no reports nearby is never called safe, three reports give a weighted estimate, and the heatmap draws squares instead of points
- Well-being: breathing cues change on time, grounding steps, and a low-mood check-in that offers Tele-MANAS and never leaves the phone
- Verified reporting: confirming an email by its link, a copied report from a throwaway account held with its reason, "I saw this too", and a moderator pausing that account by code name
- Expert help: a partner applies, isn't listed until a moderator approves, then a user's session request reaches them by email
- Safe Circles: an owner and a member in two browsers, from starting a circle to an anonymous post, a flag and a ban
- Corporate Connect: an HR person and an employee in two browsers, from setting up the workplace to an anonymous report, Slack alert and replies
- every page checked for console errors and phone-width overflow
- every page checked with [axe](https://github.com/dequelabs/axe-core) for WCAG 2.1 A/AA problems, in light and dark mode

OpenStreetMap lookups go to a local stub (`e2e/stub-osm.mjs`), never to the public services.

They run against an isolated API server (its own port and database) in **outbox mode**. `MESSAGE_OUTBOX` makes the server write SMS, calls, emails and Slack/Teams webhooks to a file instead of sending them, and tests read invite, SOS and reset links from that file. The server refuses outbox mode when `NODE_ENV=production`. To run them locally without downloading Chromium, use your installed Chrome: `PW_CHANNEL=chrome npm run test:e2e`.

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
| `POST /api/location-shares/:id/stop` | Session | Stop sharing. `arrived: true` on a journey to a saved place texts contacts once |
| `GET /api/reports/:id/evidence` | Session (author only) | Everything for a report's evidence pack |
| `GET/PUT /api/account/emergency-info` | Session | Emergency info and whether contacts see it during an SOS |
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
| `GET /api/workplace`, `POST /api/workplace/orgs`, `/join`, `/leave` | Session | Your workplace; set one up (you become HR), join with a code, leave |
| `POST /api/workplace/reports`, `GET /api/workplace/reports/mine`, `POST /api/workplace/reports/:id/messages` | Session (member) | Report to HR (`shareIdentity` optional), your reports and their threads, reply |
| `GET /api/workplace/hr/reports`, `PATCH /api/workplace/hr/reports/:id`, `GET /api/workplace/hr/insights` | Session (HR) | Reports (no reporter unless shared), status changes, aggregate insights |
| `GET/PUT /api/workplace/hr/settings`, `POST /api/workplace/hr/join-code`, `POST /api/workplace/hr/team` | Session (HR) | Slack/Teams/email alerts, a new join code, add a member to the HR team |
| `GET /api/circles`, `GET /api/circles/directory?q=`, `POST /api/circles`, `/join`, `/:id/request`, `/:id/leave` | Session | Your circles (with new posts and things to review), listed circles, start one, join with a code, ask to join, leave |
| `GET /api/circles/:id?before=`, `POST /api/circles/:id/posts`, `/posts/:postId/comments`, `/flag`, `DELETE /api/circles/:id/posts/:postId`, `/comments/:commentId` | Session (member) | The feed (30 posts a page), post, comment, flag, delete |
| `GET /api/circles/:id/moderation`, `POST .../moderation/requests/:userId`, `.../moderation/items`, `.../moderation/members/:userId`, `POST /api/circles/:id/join-code`, `PUT /api/circles/:id` | Session (moderator; settings: owner) | Join requests, flagged items, members, roles, new code, settings |
| `GET /api/partners?kind=&city=&lang=` | – | Checked partners (public details only) and their cities |
| `GET/PUT/DELETE /api/partners/mine`, `POST /api/partners/:id/request`, `GET /api/partners/requests/mine` | Session | Apply, edit or remove your listing; send a session request (emailed to the partner); your sent requests |
| `GET /api/moderation/partners?status=`, `POST /api/moderation/partners/:id` | Moderator | Applications and listings: `approve`, `reject` or `hide` (with a note) |
| `POST /api/auth/verify-email/send`, `POST /api/auth/verify-email` | Session / link token | Email a confirmation link; confirm the address |
| `POST /api/reports/:id/confirm` | Session (confirmed email) | "I saw this too" on someone else's map point |
| `GET /api/moderation/reports?queue=held`, `GET /api/moderation/accounts?view=review\|suspended`, `POST /api/moderation/accounts/:id` | Moderator | Held reports with reasons; accounts by code name; `suspend` (with a reason), `unsuspend` or `clear` |
| `POST /api/chat` | – | Support chat reply (`mode: "ai"` or `"fallback"`) |

## Before a real launch

- Serve over HTTPS. Geolocation and the microphone require it outside `localhost`.
- Test SOS end to end with real phones in the countries you support. Twilio trial accounts can only text verified numbers. For Indian numbers, business SMS requires TRAI DLT registration (sender ID and message templates), or messages are silently dropped.
- Set `VITE_CONTACT_EMAIL`, and have a lawyer review the Privacy Policy and Terms of Use. They describe the app accurately, but they are not legal advice.
- Moderate map reports. Anyone can submit one, so false reports are possible.
- Security headers on the web host: a Content-Security-Policy, `frame-ancestors 'none'` (or `X-Frame-Options: DENY`) so HerSpace can't be embedded in another site to trick people into tapping things, and HSTS. The API already sends `nosniff` and `no-referrer`; the web pages are served by the host, so these have to be set there.
- Set `TRUST_PROXY` to the number of proxies in front of the API. Rate limits on SOS, logins and verification codes use the client's IP address, and without it everyone appears to come from the proxy.
- Keep `server/data` (the database and uploads, including SOS audio and report photos) on persistent storage with regular backups, and test restoring one.
- Error monitoring and uptime alerts for the API and for Twilio delivery failures. An SOS that silently fails to send is the worst failure this app can have.
- Android: sign release builds, point `VITE_API_BASE_URL` at the HTTPS API, and fill in Google Play's data safety form (location in the background, microphone, health details in emergency info).
- Re-run `npm audit` on both packages before each release. The web app's remaining advisories are in its build tools (Tailwind 3), not in what users download.
