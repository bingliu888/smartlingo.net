# SmartLingo live production user acceptance plan

This plan has exactly two parts. A release is not accepted until every applicable case in both parts passes in a real browser on `https://smartlingo.net`.

## Shared release matrix and repair loop

- Primary language journey: Chinese interface (`zh`) learning Japanese (`ja`).
- Second language journey: English interface (`en`) learning Italian (`it`).
- Course baseline: official Beginner / Basic course.
- Viewports: iPhone, older iPad portrait and landscape, and desktop Safari-compatible width.
- Record the deployed commit and successful production workflow before testing.
- Record every case as Pass, Fail, Blocked, or Not applicable with concise, sanitized evidence.
- For a product failure: reproduce it, identify the boundary, add a regression test, fix, rebuild, redeploy, and rerun the failed case plus affected critical cases. Repeat without routine approval until no product failures remain.
- Never commit, print, or capture credentials, raw tokens, private messages, microphone recordings, or unnecessary personal data.

## Part 1 — anonymous user: test all six Play tiles

Start in a clean signed-out browser session. Select a target language on the Play page before opening a tile. Run the complete matrix first as Chinese learning Japanese, then repeat the routing, selected-language, and critical interaction checks as English learning Italian.

| ID | Play tile | Pass condition |
| --- | --- | --- |
| AN-01 | Play page and language selection | Exactly six primary tiles are visible and usable without signing in. The selected target language is shown and retained by every language-specific destination; no destination asks for the language again. |
| AN-02 | Today’s Sprint | The chosen language and 5/10/15/20-minute choice reach the Beginner five-skill flow: vocabulary, reading, listening, writing, and speaking. Entering from Play starts a new anonymous Sprint and replaces the prior Sprint cookie checkpoint; reloading or extending the current timer keeps that run. |
| AN-03 | Smart Card Practice | The selected-language starter deck opens. Words are ordered by lowest difficulty and then highest frequency within the same difficulty, and every word shows difficulty and frequency. Answers auto-grade, show correct/wrong review, and wait for Continue. |
| AN-04 | Smart Card Challenge | The selected-language timed game opens. Answers auto-grade with no Check or Continue stop; feedback advances automatically after six seconds. Timer, one-chance behavior, score, and ranking submission remain usable. |
| AN-05 | Rankings | The selected language remains active, Today and This week views load, and only verified completed Sprint results are ranked. Anonymous users are not presented as durable signed-in competitors. |
| AN-06 | Redeem | The reward store opens. A signed-out visitor sees the correct sign-in boundary and cannot spend or claim another member’s balance. |
| AN-07 | Free Beginner Course / Free Trial | The selected-language Beginner preview opens and exposes five separate learning modules: vocabulary, reading, listening, writing, and speaking. Each answer auto-grades; review waits for Continue. Sentence building shows the required number of ordered spaces, offers more choices than spaces, and grades automatically when all spaces are filled. |
| AN-08 | Anonymous continuity boundary | Within the active Sprint, refresh and timer extension resume from the anonymous HttpOnly cookie checkpoint. Starting Today’s Sprint again from Play with a newly selected language and timer creates a clean run. No member D1 progress is written and no learning status is stored in localStorage, sessionStorage, or IndexedDB. |

## Part 2 — signed-in test user: test every Dashboard tile

Use the designated isolated test member. The account must have active subscribed Beginner courses for the tested target languages. Test Chinese learning Japanese first, then English learning Italian. The Dashboard must derive its language choices from subscribed courses, and each tile must display the specific selected language before navigation.

| ID | Dashboard tile or area | Pass condition |
| --- | --- | --- |
| MEM-01 | Dashboard inventory | Every Dashboard tile/area present in the release is visible and usable. Mandatory learning entries are separate, clearly named access points for Today’s Sprint, Smart Card Practice, Smart Card Challenge, Everyday speaking, and Subscribed courses; Ask AI, membership, certificates, account, and platform-plan areas are also checked when present. |
| MEM-02 | Per-tile language selection and subscription | Every learning item lists the member’s already subscribed language sections. Japanese and Italian appear only when backed by an active subscribed course. Each item shows its own selected-language control and current-language label, keeps that selection independently, sends the exact language in its URL or course context, and provides a Choose another language or subscribe action. |
| MEM-03 | Today’s Sprint | The selected subscribed Beginner course and language open directly without another picker. The 5/10/15/20-minute controls work, all five modules complete, and refresh resumes the exact D1 checkpoint for the signed-in member. |
| MEM-04 | Smart Card Practice | The selected-language deck uses the shared difficulty-ascending/frequency-descending order, shows both scores on every word, auto-grades each answer, and waits on the correct/wrong review until Continue. |
| MEM-05 | Smart Card Challenge | The selected-language timed challenge has no Check or Continue stop and automatically advances six seconds after feedback. Verified scores and eligible course credit belong only to the signed-in test member. |
| MEM-06 | Everyday speaking | The selected language opens the correct scenario catalog. Normal and slow playback work; Repeat after me records three attempts, shows an individual score for each attempt, and waits for Continue after review. |
| MEM-07 | Subscribed courses | Only active subscribed courses appear under the selected language. Each course opens the correct course ID, target language, and Beginner level without asking for placement or language again; vocabulary, reading, listening, writing, and speaking remain separate. |
| MEM-08 | Other Dashboard areas | Ask AI receives the selected target language. Membership, certificates, account, and platform-plan tiles show only the signed-in member’s authorized data and preserve the interface language. |
| MEM-09 | Member continuity and isolation | Refresh, return to Dashboard, and a new browser visit resume durable learning status from D1 for the same member. Sign-out removes private access; a different account cannot see the test member’s courses, checkpoints, scores, credit, or Dashboard data. |

## Mandatory data, layout, and evidence checks

- Production D1 contains 336 published words across 12 target languages.
- Every published word has non-empty target-language phonetics, English sound guidance, and Chinese sound guidance.
- Fixed official courses derive level from their package tier and do not require placement.
- Automated tests, typecheck, production build, sensitive-data scan, and the complete responsive browser layout matrix pass before live acceptance.
- Every live run records the exact deployed commit, workflow URL, Pacific date/time, browser/viewport, identity class, interface and target language, case IDs, and sanitized screenshots or concise observations.
