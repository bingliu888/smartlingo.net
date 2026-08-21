# SmartLingo 21-day automated learning QA

This fixed production QA campaign runs from 2026-08-21 through 2026-09-10 at
03:00 America/Los_Angeles (10:00 UTC during the entire PDT campaign).

- `qa_21d_zh`: Chinese interface; learns English, Japanese, Spanish, and Italian.
- Each learner-language pair checks the production course, anonymous trial, and Play pages. Play
  acceptance activates both the shared-header and home Today-task entry points, verifies the
  interface-language default, all six activity tiles, the twelve-language picker, and propagation
  of the selected target language into every language-dependent activity link.
- In every target language, Play acceptance verifies all four Today's Sprint duration choices and
  the default 10-minute selection, then selects 5 minutes and completes one entire five-skill round
  with a server-graded score and persisted signed-in Sprint result before SmartCard practice.
- Each pair then completes vocabulary, speaking, listening, writing, and quiz interactions in the
  real signed-in Chrome session.
- A stable daily hash assigns each language 1–5 minimum active-learning minutes and one rotating
  deep-focus skill. The value changes across dates and languages but remains identical on a same-day
  recovery retry. Login, navigation, page loading, device waits, repairs, deployments, and idle time
  never count toward it.
- Each language must produce at least one legitimate server-graded score and persisted learning log.
- A successful day contains 4 language runs, 20 direct course-skill log items, and 4 completed
  five-skill Today's Sprint rounds in addition to SmartCard and Everyday Speaking evidence.
- Every run appends a bilingual pass/fail report to the administrator Project calendar.
- Stable IDs make same-day retries idempotent.
- The dedicated QA learner signs in through Clerk using the verification code from its real mailbox;
  its address and verification code are never stored in source, logs, screenshots, or reports.
- QA activity enters the normal signed-in learner history through production UI actions, but never
  enters reward, referral, credit, payment, leaderboard, or certificate ledgers.
- Direct or synthetic learning/score database writes are forbidden. Unavailable microphone input is
  reported as blocked rather than passed.

The GitHub Actions workflow supports an optional manual Pacific date for a failed-day rerun.
Outside the fixed 21-day window it exits successfully without changing production data.

The cloud workflow is a route-only 03:00 preflight and publishes no learning evidence. The paired
local Codex automation owns real Chrome/Gmail acceptance and the judgment-heavy recovery loop: inspect failed evidence,
implement the smallest correct fix, run the full release gate, commit and deploy, then rerun
the failed production acceptance until it passes. It must never weaken assertions or fabricate
evidence to obtain a green result. This recovery automation is considered enabled only after the
Codex automation service accepts and lists it; repository files alone do not make that claim.

Because the desktop automation service was unavailable during setup, the installed fallback is a
user LaunchAgent. Cloud QA and the sandboxed, auto-reviewed Codex recovery agent both start at
03:00 Pacific; the recovery agent inspects or idempotently dispatches that day's cloud preflight
before real browser learning. The signed Codex executable is the direct LaunchAgent program so macOS does
not block an intermediary shell from the Documents workspace. Its paths, prompt, logs, date guard,
and self-unload behavior are versioned in this repository. It uses the existing
ChatGPT-authenticated Codex CLI and never
bypasses the workspace-write sandbox or automatic approval review. `--approve-for-me` selects that
reviewed workspace sandbox itself, so no incompatible explicit sandbox override is supplied.
