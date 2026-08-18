# SmartLingo.net site rules

## Project boundary

This repository is the independent SmartLingo.net codebase. It follows the current `mahj.guru` generic member, Community, messaging, Ask Guru, authentication, Project, and responsive-UI baseline while keeping SmartLingo branding, language content, member data, class data, commerce, credentials, deployment, and release history isolated.

The migration may use only browser-visible legacy-site facts recorded in `legacy-reference/README.md`. It must not import hidden source content, private data, third-party exercise banks, or another product's visual assets. Legacy files are evidence and fallback reference, not runtime dependencies.

## Product role

SmartLingo is an AI-native language-learning and social-learning platform. Its public promise is practical progress through short daily sessions in the fixed five skills—vocabulary, reading, writing, listening, and dialogue—plus text Ask Guru and signed-in Live Audio AI Chat.

The first supported community paths are Chinese, English, Spanish, Japanese, Korean, French, German, Russian, Italian, Portuguese, Arabic, and Hindi. A learner may join a community for any target language, including their own language, and each language may contain multiple official or member-created classes. Every official community begins with a self-selected level or an adaptive five-skill placement covering vocabulary, reading, writing, listening, and dialogue. Course content must be original or properly licensed, versioned, attributable by source type, and reviewed before public release. A placement result or platform completion record is not a government, academic, immigration, or third-party language credential.

Language selectors and language-community cards use language names as text. They never use national flags, because a language can belong to many countries, regions, and communities.

An adaptive placement starts at intermediate difficulty, contains 15 versioned questions with three rounds across all five skills, and supports pause, resume, and skip. Server-scored results recommend a learning level; self-selected levels do not fabricate five-skill scores. The daily learning calendar is based only on server activity events and displays compact indicators for all five skills plus Community participation, with its selected-day detail below the calendar.

Every one of the 12 languages uses the same cumulative course architecture: beginner offers 7, 14, and 30 days; intermediate offers 1, 2, and 3 months (30/60/90 days); advanced offers 3, 6, and 12 months (90/180/365 days). A same-language, same-level certificate for the shorter course resumes the next course at the first unstudied day: beginner 14 starts at day 8 after a 7-day certificate; beginner 30 starts at day 15 after a 14-day certificate or day 8 after only a 7-day certificate. Intermediate and advanced courses follow the same cumulative rule. Every course day is a server-persisted 60-minute session that may pause and resume across calendar days; unfinished work stays on the same course day, while the Exam tab remains available at all times.

Every recorded daily and course score uses a 1–100 scale. A completed course passes at 60; once the learner completes all server-assigned skills and the daily quiz, a current course score of 95 or higher may finish the course early. Missing, skipped, or incomplete evidence never fabricates a passing score. A passed enrollment creates one immutable SmartLingo course-completion certificate with the member-name snapshot, course level and language, final score, completion reason, curriculum version, issue date, certificate number, and verification code. It is a SmartLingo learning record, not a government, academic, immigration, or third-party language credential.

## Member-created class rules

- Any signed-in member may create a private language class as a **teacher** or **coordinator**. Class creation is not restricted to a paid membership tier.
- Teachers manage teaching activities and feedback. Coordinators manage scheduling and communication. The server enforces each role separately.
- Every new member-created class is private by default and is available only to its owner, invitees, and enrolled members.
- Public catalog placement requires automated preflight and Admin human review. A submitted class is never auto-published.
- Class owners may set a per-person fee. Live checkout remains disabled until the owner completes Stripe-hosted Connect onboarding and both charges and payouts are enabled.
- SmartLingo stores only the connected-account reference and readiness state needed to operate the platform; Stripe collects bank, identity, and payout details.

## Class-payment contract

- The first successful class payment for one learner and one class receives a **15% discount**. Failed, canceled, or abandoned attempts do not consume eligibility.
- The discounted, pre-tax amount is split **70% to the class owner and 30% to SmartLingo** through Stripe Connect destination charges.
- Money arithmetic uses integer minor currency units. The owner share is rounded down and any rounding remainder belongs to the platform so the parts always equal the discounted amount.
- Verified Stripe webhooks are the payment authority. Enrollment, discount consumption, transfers, refunds, and disputes must be idempotent and auditable.
- Refund handling follows the published class policy and reverses the connected-account transfer where required. Do not claim that fees or taxes are refundable unless the configured processor and policy support it.
- Live charges must remain off until prices, refund rules, tax handling, legal copy, webhook secrets, and connected-account readiness are configured and tested.

## Platform subscription and introducer rewards

- Platform subscriptions are distinct from member-created class payments.
- A user may have at most one eligible direct introducer. There is no upline, second level, or multi-level reward relationship.
- Reward points are created only after the SmartLingo platform account successfully collects a platform subscription payment.
- Each successful platform subscription payment ID may create at most one reward-ledger entry for the direct introducer.
- Registration, profile completion, free use, class invitations, class enrollment, and member-created class payments never create introducer payment rewards.
- Failed, canceled, duplicate, refunded, self-referred, or forged events must not create a reward; reversals follow the published platform reward policy.
- Learning XP and streaks have no cash value and are stored separately from introducer reward points.

## SmartCards and course credit

- Public starter SmartCards may be learned and challenged without sign-in. Guest points are provisional, device-bound, and not spendable until claimed by a verified signed-in account.
- The public single-card game starts at 100 provisional course points. Server-verified correct choices add 10, wrong choices subtract 5, and pronunciation passes add 5. Practice rewards once per published deck version; the daily challenge rewards once per account, deck, and local day. Self-authored decks award none.
- The client never submits a score, point award, balance, price, or discount. Published reviewed content, scoring, caps, claims, and ledger writes are server-authoritative and idempotent.
- Course points use their own append-only ledger, separate from learning XP and introducer rewards. They cannot be cashed out, transferred, sold, or included in a class-owner payout.
- 100 course points offset USD $1. A sufficient balance may pay 100% of one fixed SmartLingo monthly course fee and opens exactly 30 days without auto-renewal.
- Opening a card, registration, point claim, or credit-only month never starts a card trial or recurring subscription. Subscription checkout remains a separate explicit choice.
- AI-drafted vocabulary stays in `draft` or `ai_checked`; only published, reviewed, versioned items may appear in public point-bearing challenges.

## Shared MVP contract

- Chinese is the default language. Chinese mode uses idiomatic Chinese for generic interface and product language; English mode uses English.
- Every primary public and signed-in page uses the shared header, user/avatar control, mobile menu, and language control. The immersive sign-in screen may use the shared authentication layout.
- Account features include Dashboard, profile, plans, classes, member discovery, Community, direct and group messages, persistent Live Chat, attachments, notifications, and Project history.
- Text Ask Guru is public. Microphone recording and Live Audio AI Chat require sign-in and explicit microphone permission.
- Ask Guru answers include response action icons. Both new-message and reply composers include a working `Polish with Guru` / `请智能导师润色` action.
- Email-code authentication visibly changes to code-entry state, identifies the destination email, changes the main action to verification, and offers a different-email action.
- Clerk is the only identity provider. Its verified production session is bridged to the site-owned application session so D1-backed features use one stable user ID.
- OpenAI-supported features run through server-side gateways with limits, usage records, timeouts, content safeguards, and local fallbacks.
- D1 stores structured state. R2 stores private, user-owned media and never exposes a bucket directly.
- Every class, course, direct, and group Live Chat uses the same standard room contract: persistent text chat, URL links that open in a new tab, private R2-backed photo/audio/video/file attachments with separate View and Download actions, and Cloudflare RealtimeKit calls that remain connected during client-side navigation. Outside the active room, a bottom-left call badge shows the caller count and returns the member to that chat.
- Calls start audio-first with an explicit microphone state. One participant ends after 60 seconds without another member; calls with two or more participants end after 60 seconds without detected speaker activity, and members may immediately start or join a new call. Camera activation remains explicit and server-admitted, with no more than four simultaneous cameras; everyone else remains in audio mode until a camera slot is released.
- RealtimeKit meeting and participant credentials are created server-side, scoped to the current D1 conversation membership, returned only to that signed-in participant, and never stored in D1 or exposed in client configuration. Browser foreground alerts do not claim native lock-screen ringing.
- Community starts with a full-width **Live Meetings** center. It separates live and upcoming meetings, provides a live countdown, and lets any signed-in member schedule a titled meeting within the next 90 days. Scheduling atomically creates one dedicated standard group-chat room; at or after the scheduled time the meeting is derived as live without requiring a deployment or client-authored status change.
- Each member may own at most one meeting that has not been cancelled or ended. This is enforced by a D1 partial unique index, not only by the UI. The host may end a live meeting or cancel an upcoming meeting, which also ends its active RealtimeKit call. Member profiles show that member's active/upcoming meeting with a countdown and a server-authorized Join Meeting / Enter Chat action.

## Responsive and quality contract

- Responsive layout quality is release-blocking and has higher priority than daily feature work.
- Validate changed and representative pages in Chinese and English at 390×844, 430×932, 834×1112, 1194×834, and 1440×1000.
- Text must fit its panel naturally; row-level surfaces fill the usable parent width; semantic kicker-heading-description groups stay in one vertical column; no meaningful content is clipped or hidden by horizontal overflow.
- Browser measurements must verify final computed layout, parent/child fill, and `scrollWidth <= clientWidth`. Source-code-only CSS assertions are insufficient.
- Before release run all D1 migrations, the full test suite, lint, production build, artifact validation, sensitive-information scanning, and runtime layout checks. Any failure blocks that site's release.

## Content, AI, privacy, and safety

- Do not copy Duolingo or another provider's name, characters, brand elements, proprietary exercises, lesson text, or visual assets. Product research informs learning principles only.
- Pronunciation feedback may discuss intelligibility, target sounds, and rhythm with explicit uncertainty. It must not infer nationality, ethnicity, identity, disability, or personal worth from voice.
- Recording begins only after an explicit user action. Provide visible recording state, preview, retry, deletion, transcript controls, and clear retention terms.
- AI may explain, coach, suggest, and give rubric feedback. It must not take a learner's exam, claim certainty it does not have, expose another user's or class's data, or replace human review for public classes and sensitive decisions.
- Users can withdraw optional sharing and request access, export, or deletion according to the published policy. Public learning activity is opt-in.
- Never request wallet recovery phrases, private keys, full payment-card data, bank credentials, or unnecessary sensitive personal data.
- Do not promise fluency, scores, certificates, income, employment, immigration, refunds, payouts, or rewards.
- Privacy, terms, refund, class-owner, and reward policies remain labeled as drafts until formal legal and tax review is complete.

## Project and automated delivery

- `lib/smartlingo-roadmap.ts` is the single machine-readable source for the public 20-day Project calendar: 2026-07-31 through 2026-08-19, exactly five tasks per day and 100 unique tasks total.
- Daily automation processes exactly the five tasks from the earliest unfinished date. A task is complete only with code, content, test, migration, documentation, or production evidence.
- Every run updates the roadmap state, Project calendar, bilingual daily report, and version history. Completed tasks are verified read-only and never fabricated or repeated.
- A failed migration, test, build, scan, source-drift check, layout check, deploy, or production acceptance stops the site safely and leaves failed tasks unfinished for a later retry.

## Deployment

- `.openai/hosting.json` is the authoritative binding to the one existing Sites project after a project ID is assigned.
- The production domain is `smartlingo.net`; `www.smartlingo.net` must resolve consistently with the apex.
- Runtime secrets belong in the Sites environment and are never committed, copied into client code, or printed in reports.
- The active runtime names are `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_JWT_KEY`, `OPENAI_API_KEY`, `DEEPSEEK_API_KEY`, `ADMIN_EMAILS`, `EDITORIAL_SYNC_SECRET`, `CLOUDFLARE_REALTIME_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `REALTIMEKIT_APP_ID`, `REALTIMEKIT_VOICE_PRESET`, and `REALTIMEKIT_VIDEO_PRESET`; `GITHUB_REPOSITORY_URL` is public configuration. `DEEPSEEK_API_KEY` and `CLOUDFLARE_REALTIME_API_TOKEN` are server-only. Keep documentation, `.env.example`, hosted configuration, and the sensitive-data scanner aligned with these exact names.
- `DB` and `BUCKET` are Sites-managed bindings. Stripe variables in `.env.example` are future-only placeholders: the current runtime does not consume them, and setting them does not enable or prove checkout, charges, transfers, refunds, or payouts.
- The same validated commit must synchronize to the existing Sites source and GitHub `main`; never create a second Sites project, replace a remote, force-push, or create a no-op release.
- After deployment, verify HTTPS, both languages, sign-in, profile, learning, classes, Community, messages, Live Chat, Ask Guru, Project, payment-off or sandbox state, and Worker error logs on the formal domain.
