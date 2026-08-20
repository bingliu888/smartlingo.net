# SmartLingo 21-day automated learning QA

This fixed production QA campaign runs from 2026-08-21 through 2026-09-10 at
03:00 America/Los_Angeles (10:00 UTC during the entire PDT campaign).

- `qa_21d_zh`: Chinese interface; learns English, Japanese, Spanish, and Italian.
- `qa_21d_en`: English interface; learns Chinese, Japanese, Spanish, and Italian.
- Each learner-language pair checks the production course, anonymous trial, and Play pages.
- Each pair then records vocabulary, speaking, listening, writing, and quiz evidence.
- A successful day contains 8 language runs and 40 skill log items.
- Every run appends a bilingual pass/fail report to the administrator Project calendar.
- Stable IDs make same-day retries idempotent.
- The two accounts use `.invalid` email addresses, disabled passwords, and no Clerk identities.
- QA activity enters the standard learning activity calendar with `source_type=qa_21_day`, but
  never enters XP, reward, referral, credit, payment, leaderboard, or certificate ledgers.
- Scores are deterministic synthetic health-check data. They do not claim microphone capture,
  human speech, human grading, or a full signed-in browser session.

The GitHub Actions workflow supports an optional manual Pacific date for a failed-day rerun.
Outside the fixed 21-day window it exits successfully without changing production data.

The cloud workflow is the deterministic 03:00 scheduler and evidence recorder. The intended
paired Codex automation owns the judgment-heavy recovery loop: inspect failed evidence,
implement the smallest correct fix, run the full release gate, commit and deploy, then rerun
the failed production acceptance until it passes. It must never weaken assertions or fabricate
evidence to obtain a green result. This recovery automation is considered enabled only after the
Codex automation service accepts and lists it; repository files alone do not make that claim.

Because the desktop automation service was unavailable during setup, the installed fallback is a
user LaunchAgent. Cloud QA starts at 03:00 Pacific and the sandboxed, auto-reviewed Codex recovery
agent starts at 03:05. Its absolute paths, prompt, logs, date guard, lock, and self-unload behavior
are versioned in this repository. It uses the existing ChatGPT-authenticated Codex CLI and never
bypasses the sandbox or approval review.
