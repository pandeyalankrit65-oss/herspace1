# Expert review before launch

HerSpace gives legal, medical and safety guidance to women who may be in danger, in five
languages. Most of it was drafted with AI help. It must be checked by people qualified to check
it before launch. This page says who needs to read what, what has already been checked, and the
open questions for each reviewer.

When a reviewer signs off, update `REVIEWED` in `src/content/help.ts` (the Help page shows that
date) and note it at the bottom of this page.

## What has already been checked (October 2026)

Every claim on the Help page was checked against official sources or well-known judgments. No
errors were found. One addition was made: the ₹3 lakh minimum compensation for acid-attack
survivors. This lowers the reviewers' work but does not replace it. A lawyer and a doctor
should still read every line, because the wording matters as much as the facts.

| Claim | Basis |
|---|---|
| Free first aid and treatment at any hospital, before any police complaint | CrPC s.357C, now BNSS s.397 |
| Medical examination needs her consent | CrPC s.164A, now BNSS s.184 |
| Zero FIR, a free copy of the FIR, and writing to the SP or a magistrate if refused | BNSS s.173 and s.175 |
| Statement at home | CrPC s.160 proviso, now BNSS s.179 |
| Name not published | IPC s.228A, now BNS s.72 |
| Emergency contraception within 72 hours (some types 5 days), PEP within 72 hours | WHO and NACO guidance |
| Domestic violence: kinds of abuse, right to the shared home, protection, residence, money and custody orders, Protection Officer | PWDVA 2005 ss.3, 17, 18 to 22 |
| POSH: Internal Committee at 10+ employees, Local Committee, 3 months plus 3 | POSH Act 2013 ss.4, 6, 9 |
| SHe-Box, open to private-sector employees since 2018, relaunched August 2024 | Ministry of Women and Child Development |
| Couples choosing their own partner must be protected | *Shakti Vahini v Union of India* (2018) |
| Same-sex relationships are not a crime | *Navtej Singh Johar v Union of India* (2018) |
| Transgender Persons Act 2019: no discrimination at work, in healthcare or in renting | s.3 |
| Acid attack: free treatment at private hospitals too, a certificate from the first hospital, at least ₹3 lakh compensation | *Laxmi v Union of India* (2015) |
| SMS to 112 | ERSS (Ministry of Home Affairs) |
| Anonymous reporting of crimes against women | cybercrime.gov.in |
| Recruiting agents registered with the MEA (eMigrate), and the 1800 11 3090 helpline (24 hours, 11 languages) | Ministry of External Affairs |
| Rail Madad 139 | Ministry of Railways |
| Helplines: 112, 181, 108, 1930, NCW WhatsApp 7827170170, NALSA 15100, Tele-MANAS 14416, Childline 1098 | Official numbers, current as of October 2026 |

The guidance deliberately leaves out section numbers. The BNS and BNSS replaced the IPC and CrPC
in July 2024, and numbers in a guide like this go out of date quickly.

## 1. A lawyer (criminal law and women's rights)

**Read:**
- **Help & your rights**, `src/content/help.ts` (English and Hindi), or the `/help` page.
  It has 11 sections: after an assault, the police, domestic violence, work (POSH), online
  abuse, forced marriage, acid attacks, jobs abroad and trafficking, LGBTQ+ women, phone
  tracking, and not being able to speak.
- **Complaint letters**, `src/content/complaint.ts`, or the `/complaint` page. There are three
  kinds: a police complaint, a workplace complaint, and a letter to the SP when the police
  refuse an FIR.
- **POSH Internal Committee tools**, `server/src/posh.ts`. These cover the committee make-up
  rules and the deadlines (7 and 10 days under Rule 7, 90 days under s.11, 10 and 60 days
  under s.13), and the Rule 14 annual report. HR teams will rely on them.
- **Privacy Policy and Terms**, `src/pages/Privacy.tsx` and `src/pages/Terms.tsx`, with their
  translations in `src/pages/legal/`.

**Questions:**
1. Forced marriage: is "a marriage without your free consent can be challenged" fair to say
   across personal laws? (Under the Hindu Marriage Act the time limit is short.) Should the
   guide say "talk to a lawyer quickly"?
2. LGBTQ+: is "courts have ordered protection for couples" accurate enough for same-sex couples,
   given the case law since 2018?
3. Jobs abroad: should the guide name the legal cap on the recruiting agent's fee?
4. POSH: the Help page says "your employer must not punish you for complaining". The Act has no
   section that says this outright; it rests on the employer's duties (s.19) and on case law.
   Is the wording safe, or should it be softer?
5. POSH: the deadline for the employer's action (60 days from the committee's report) is
   counted from the date the report was submitted. Is that how HR teams count it?

## 2. A doctor (emergency or forensic medicine)

**Read:**
- "After a sexual assault", points 2 to 6: treatment, consent, emergency contraception, PEP,
  keeping evidence.
- "Acid attack or burns", points 1 and 2: first aid.
- The support chat's crisis replies, `server/src/chat.ts`. Look at `SYSTEM_PROMPT` and the
  `selfHarm` and `danger` fallbacks in every language.

**Questions:**
1. Acid first aid says "at least 20 minutes" of cool running water. Should it say longer for
   alkalis, or "until the pain stops"?
2. Is "PEP within 72 hours, ideally within 24" the right message for India's NACO protocol?

## 3. Native speakers: Hindi, Tamil, Bengali, Marathi

Ideally each reviewer also knows the legal terms in their language.

**What to read:**
- **App text**: 1,939 strings per language, in `src/i18n/hi.ts`, `ta.ts`, `bn.ts` and `mr.ts`.
- **Help guides**: the Hindi block in `src/content/help.ts`, and `help-ta.ts`, `help-bn.ts`,
  `help-mr.ts`.
- **Complaint letters**: `src/content/complaint.ts`.
- **Privacy Policy and Terms**: `src/pages/legal/`.

**Start with what's read under stress.** If time is short, review these first:
- the SOS screen;
- the "Are you okay?" check;
- the fake call;
- the Help page;
- the sign-up "check your email" screen.

A quick way to review is to switch the app's language and use it.

**Open question for the team:** the SOS text and voice call that contacts receive are
English-only (`server/src/routes/sos.ts`), because the app doesn't know the contact's language.
Should each contact get a language setting?

## 4. A domestic-violence or safety organisation

**Look at:**
- The features for someone living with an abuser:
  - disguised mode and neutral notifications;
  - quick wipe;
  - silent alerts;
  - the private encrypted record;
  - the spoken code phrase.

  They are under Account → Safety at home.
- The "Is someone tracking your phone?" section of the Help page.
- What the app reveals if he picks up her phone. Sign-up no longer reveals whether an email has
  an account; check what else would.

**Question:** removing a tracking app can alert the person who installed it. Is the guide's
advice ("make a safety plan first") enough?

## Sign-off

| Reviewer | Name and organisation | Date | Notes |
|---|---|---|---|
| Lawyer | | | |
| Doctor | | | |
| Hindi | | | |
| Tamil | | | |
| Bengali | | | |
| Marathi | | | |
| Safety organisation | | | |
