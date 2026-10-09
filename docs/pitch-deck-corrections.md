# Pitch deck corrections (HerSpACE.pdf, 11 slides)

What the deck says that isn't true of the app, and what to say instead. Checked against the app as of
10 October 2026. **Must fix** = a claim that's false and could mislead or put someone at risk.
**Update** = out of date or overstated. Replacement text is a suggestion; keep your own voice.

## Slide 1: title

- **Update.** "Smart Protection for Women and Children" → **"Smart protection for women"**. The app is
  18+ (children's features were deliberately left out).
- "Always With You. Even Offline." is fair if explained: without internet, SOS falls back to texts and
  calls from her own phone, reports are saved and sent later, and the help pages work offline.

## Slide 2: problem statement (women & children)

- **Update.** Drop children: "Children may panic and not know how to ask for help", "Children need
  automatic panic recognition and safe-zone monitoring". HerSpace doesn't do either.
- Replace the last lines with: *"Women need help that works when they can't speak, can't unlock their
  phone, or can't get a signal, and that notices when something is wrong."*

## Slide 3: problem statement (online and offline harassment)

- Fine as it is.

## Slide 4: our solution

| Deck says | Change to |
|---|---|
| Voice-based harassment detection (AI emotion + tone analysis) | **Scream detection on the phone** (opt-in; sound never recorded or sent) and an **opt-in voice-stress experiment** that only asks "Are you okay?", never sends SOS by itself |
| AI companion for mental health, calming voice | **AI support chat** that adapts to how she feels and can read replies aloud; Tele-MANAS and counsellors for real care |
| Verified community reporting, fake ID detector | **Verified reporting**: reports from confirmed accounts weigh more, others can confirm them, and false ones can be flagged to moderators. There is no "fake ID detector" |
| Predictive unsafe zone heatmaps, powered by ML | **Heatmap of recent reports**, weighted by how recent, serious and confirmed they are. It's not ML and not a prediction, and the app never calls an area "safe" |
| Corporate safety portal | Fine (Corporate Connect) |
| Emotional Well-being Zone | Fine |

## Slide 5: what makes us unique, and NIRVA

- **Must fix: "its end to end encrypted".** The chat is not end-to-end encrypted: messages go to the AI
  provider (Anthropic) to write each reply. Say instead: *"HerSpace doesn't save your chat."*
  (The only end-to-end-style encryption in the app is the **private record** for abuse at home:
  encrypted on her phone with her own PIN.)
- **Update.** "Detects tone, stress, and fear in real time" → *"Notices fear, panic or sadness in what
  she writes, and offers help that fits; says openly that it can be wrong."*
- **Update.** "Links users to verified NGOs, helplines, or volunteers" → *"Official helplines (181,
  112, Tele-MANAS, free legal aid) and a directory of partners checked by our team."* The partner
  directory starts empty until real partners are verified.
- **Update.** "100% confidential, secure" → say what's true: *"Contacts only see her location during an
  alert or a journey she starts; reports on the map are anonymous and rounded to about 1 km; she can
  download or delete all her data."*
- **Update.** "Works within HR tools (Slack, Teams, Gmail)" → **"Slack, Microsoft Teams and email
  alerts for HR"** (no Gmail integration).
- NIRVA: the app doesn't use that name. Either rename the chat in the app, or call it "AI support
  chat" in the deck.

## Slide 6: app screenshots

- **Must fix.** These are old screens. Replace them with current ones (I can take phone-size screenshots
  of any page).

## Slide 7: corporate support & empowerment platform

- **Update.** "AI Chatbot: report harassment or bias safely" → **"A private report form to HR, with
  the option to stay anonymous; HR can reply without knowing who she is."** The chat isn't the reporting
  channel.
- **Update.** "Partnerships: connects with verified NGOs and experts" → as on slide 5, the directory
  starts empty.
- The rest is accurate.

## Slide 8: customer segments & channels

- Fine.

## Slide 9: key metrics & revenue model

- Suggestion: **keep SOS and safety features free**. "Freemium add-ons: SOS+" puts safety behind a
  paywall, which reviewers and users may see as a red flag. Charge companies (B2B), not the woman in
  danger.
- "Verified partner network commission (10–15%)": the app takes session requests but has no payments.
  Present it as planned, not existing.

## Slide 10: technology & cost

| Deck says | Actually |
|---|---|
| Frontend: React.js + Tailwind CSS | React + TypeScript + Tailwind, and an **Android app** (Capacitor) |
| Backend: Node.js + FastAPI | **Node.js + Express** (no FastAPI) |
| AI & NLP: Gemini / OpenAI | **Anthropic Claude** (support chat and report drafts; a faster model for the fake call) |
| Database: MongoDB Atlas | **SQLite** |
| Cloud: AWS / Azure | **Not hosted yet** |
| Security: AES-256 encryption + anonymous tokens | **Must fix.** Say: HTTPS, hashed passwords, secure session cookies, CSRF protection, rate limits; the private record is encrypted on the phone (AES-256-GCM) with her own PIN |
| Dashboard: Power BI / Streamlit | **Built-in HR dashboard** |
| Integrations: Slack, Teams, Gmail | **Slack, Teams, email** |

- **Must fix: the cost table leaves out the biggest running cost, SMS and calls.** Every alert texts
  each contact (and can call them). Add SMS and voice-call costs (Twilio), plus India's **DLT
  registration** for SMS, and email (Resend). Get current quotes rather than guessing; AI cost depends
  on chat usage.
- The SOS screenshot says *"Your location and emergency details will be sent to your trusted contacts
  and **local authorities**"*. **Must fix: HerSpace does not contact police or emergency services**, and
  the app says so. Replace the screenshot.
- The Safe Circles screenshot shows example communities with member counts ("1,247 members"). Don't
  present those as real users.

## Slide 11: unfair advantage & future vision

- **Update.** "Detects distress or fear from voice, text, or tone in real time" → *"Notices when
  something seems wrong, from what she writes, a scream, or several clues on a journey, and asks if
  she's okay; if she can't answer, it alerts her contacts."*
- **Update.** "Backed by trusted NGOs, counselors, and legal experts" → not yet. Say *"Built to work with
  verified NGOs and counsellors"* until real partners have joined.
- **Update.** "One-tap SOS that shares live location with trusted contacts **or corporate security**" →
  drop "corporate security"; alerts go to her own confirmed contacts.
- Future vision is fine as vision.

## Worth adding: what the app does that the deck doesn't mention

- **Prevention:** warnings when walking into an area with recent reports, "check the way" before setting
  off, regular journeys with reminders, a ride that turns the wrong way is noticed, a daily check-in for
  someone living alone.
- **When she can't act:** "Are you okay?" checks that send a silent SOS if she doesn't answer, "Stay
  with me" voice company, a code phrase said aloud, a fake call that talks back, alerts by text message
  from a basic phone.
- **Abuse at home:** disguised mode (a working calculator), quick exit, quick wipe, a private encrypted
  record of abuse, a safety plan, Domestic Violence Act guidance.
- **For contacts:** how the alert started, which way she's moving, and what to do right now.
- **Afterwards:** a report told in her own words, guidance for the first hours after an assault, a
  letter when police refuse an FIR, a gentle follow-up in the days after.
- **Five languages:** English, Hindi, Tamil, Bengali, Marathi.

Before claiming these to judges or investors, make sure they've been tried on real phones and that the
legal and medical guidance has been reviewed.
