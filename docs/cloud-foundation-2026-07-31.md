# SmartLingo cloud foundation

Updated: 2026-07-31

## Identity

- Clerk is the only production identity provider for sign-in, email-code registration, optional later passwords, and session security.
- The server verifies Clerk tokens against `smartlingo.net` and `www.smartlingo.net`, reads the verified primary email from Clerk, and binds one short-lived application session to one Clerk session ID.
- Legacy application password and verification-code endpoints remain disabled so they cannot create a second identity system.
- A platform referral cookie may establish one direct introducer during first account creation. Signup itself creates no points.

## D1

- D1 stores users, sessions, language paths, learning checkpoints, private classes, class membership, communities, messages, connected-account state, class orders, platform subscription payments, and introducer reward entries.
- Member-created class commerce is isolated from platform-subscription commerce.
- Class orders store integer-cent subtotal, one-time discount eligibility, discounted pre-tax amount, tax, 70% owner share, 30% platform fee, payment state, refund/dispute state, and webhook idempotency evidence.
- An introducer reward entry must reference one unique successful platform subscription payment. No class order can satisfy that foreign-key boundary.
- Migrations run in journal order, pass foreign-key checks, and are idempotent on a second execution.

## R2

- R2 holds private avatars, class media, learning attachments, message files, and referral artwork.
- D1 records owner, scope, object key, media type, byte count, digest, status, and deletion state.
- Browser uploads use exact media allowlists and file-signature checks. Reads require identity plus ownership or class/conversation authorization.

## AI Gateway

- OpenAI credentials remain server-only. Browser bundles, D1, logs, and error responses must not contain secrets.
- Public text Guru uses bounded input and a safe local fallback. Message polishing preserves the user draft on failure. Scoring cannot unlock learning when the model is unavailable.
- Microphone and live audio require sign-in, explicit permission, visible recording state, usage controls, and deletion/retention disclosures.
- AI practice feedback is not an official examination result and does not guarantee education, work, visa, or other outcomes.

## Deployment gate

Before a production release, the project must pass migration validation, all tests, ESLint, a vinext production build, artifact validation, responsive checks at the shared Sites viewport matrix, sensitive-data scanning, unique-project verification, and production Worker-error review.

The complete product rules are in `docs/smartlingo-product-foundation.md`; the machine-readable 20-day, 100-task plan is in `lib/smartlingo-roadmap.ts`; legacy browser-visible evidence is cataloged in `legacy-reference/README.md`.
