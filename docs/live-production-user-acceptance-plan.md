# SmartLingo live production user acceptance plan

## Default release matrix

Unless the user specifies another course, every requested “full realtime test” uses exactly this baseline:

- Production origin: `https://smartlingo.net`
- Interface language: Chinese (`zh`)
- Target language: English (`en`)
- Course: official Beginner / Basic course
- Viewports: iPhone, older iPad portrait and landscape, and desktop Safari-compatible width
- Identities: anonymous visitor first, then one isolated free-month subscriber

Other target languages, interface languages, and course levels are separate opt-in matrices. Test credentials and personal data must never be committed, printed, or placed in screenshots.

## Release loop

1. Confirm the deployed commit and successful production workflow.
2. Run the anonymous suite from a clean private session.
3. Run the subscribed suite with the designated free-month test member.
4. Record each case as Pass, Fail, Blocked, or Not applicable with concise evidence.
5. For any product failure: reproduce, identify the boundary, add a regression test, fix, rebuild, redeploy, and rerun the failed case plus all affected critical cases.
6. Repeat step 5 until no product failures remain. Do not ask for routine approval during this repair loop.
7. Report genuine external blockers separately; never mark an unexecuted case as passed.

## Anonymous visitor suite

| ID | Case | Pass condition |
| --- | --- | --- |
| AN-01 | Open Chinese home and Choose courses | Chinese UI loads without clipping; English is available as a target language. |
| AN-02 | Open English course detail | `language=en` remains selected and Free to Play appears before Free Trial. |
| AN-03 | Open Free to Play | Play page and every opened game retain English without asking again. |
| AN-04 | SmartCard practice | Card counter, meaning flip, answer loop, progressive hints, points, sound, phonetics, and speech controls work. |
| AN-05 | SmartCard challenge | English remains selected; the 10-second, one-chance rule and no-hint rule are visible and enforced. |
| AN-06 | Open Free Trial | Anonymous Beginner dashboard opens without login and exposes the intended five-skill preview. |
| AN-07 | Anonymous persistence boundary | Trial actions create no authenticated API write, cookie-based learner record, localStorage, sessionStorage, or IndexedDB progress. Reload returns a clean in-memory trial. |
| AN-08 | Sign-up encouragement | The trial or game completion invitation is visible, localized, and does not claim anonymous progress was already saved. |

## Free-month subscriber suite

| ID | Case | Pass condition |
| --- | --- | --- |
| SUB-01 | Sign in and open My Courses | Only actively subscribed courses appear; Choose courses is the discovery exit. |
| SUB-02 | Open English Beginner | Dashboard keeps the current class ID, identifies the Beginner package, and never asks for language or placement again. |
| SUB-03 | Five direct launchers | Vocabulary, Speaking, Listening, Writing, and Quiz each open the matching current-course activity directly. |
| SUB-04 | Guided learning | Continue guided learning opens the current English Beginner session and preserves server course-day state. |
| SUB-05 | Vocabulary dashboard | Overall mastered percentage, 1–5 stars, Mastered/Learning/Not started counts, and the three filter tabs agree. |
| SUB-06 | Daily SmartCard deck | Shows current card / total and explicit percentage; local-time artwork, answer choices, and progressive wrong-answer color/hints work. |
| SUB-07 | Vocabulary pronunciation | Every tested word shows target phonetics plus Chinese sound guidance; text-to-speech uses English and microphone retry/denial guidance is usable. |
| SUB-08 | 21-day memory write | A correct or completed review updates only the signed-in learner’s durable stage/report; reload preserves it without duplicate credit. |
| SUB-09 | Speaking | English prompt audio, Chinese coaching copy, microphone permission, recognition, retry, and result feedback work. |
| SUB-10 | Listening | English audio and the listening task load directly and can be completed or honestly skipped. |
| SUB-11 | Writing | Writing opens directly, retains learner text on service failure, and returns localized feedback when available. |
| SUB-12 | Quiz | Quiz opens directly, exposes no answer key, grades server-side, and records one truthful attempt. |
| SUB-13 | Learning calendar | Completed activity appears on the correct local date with consistent vocabulary totals and percentage. |
| SUB-14 | Course rooms | Webinar and free group-audio tiles belong to the same course; entry and permission boundaries are correct without disturbing an active class. |
| SUB-15 | Reload and sign-out boundaries | Reload preserves subscribed progress; sign-out removes private access and never leaks another user’s data. |

## Mandatory data and release checks

- Production D1 must contain 336 published words across 12 target languages.
- Every published word must have non-empty target-language phonetics, English sound guidance, and Chinese sound guidance.
- The anonymous trial must remain client-memory-only.
- Fixed official courses derive level from their package tier and do not require placement.
- Automated tests, typecheck, production build, sensitive-data scan, and the complete WebKit layout matrix must pass before live testing.

## Evidence format

Each live run records the deployed commit, workflow URL, date/time, device/browser, test identity class (anonymous or free subscriber only), case IDs, and sanitized screenshots or concise observations. Credentials, raw tokens, private messages, microphone recordings, and unnecessary personal data are never retained.
