# SmartLingo.net site rules

## Project boundary

This repository is the independent SmartLingo.net codebase. It follows the current `mahj.guru` generic member, Community, messaging, Ask Guru, authentication, Project, and responsive-UI baseline while keeping SmartLingo branding, language content, member data, class data, commerce, credentials, deployment, and release history isolated.

The migration may use only browser-visible legacy-site facts recorded in `legacy-reference/README.md`. It must not import hidden source content, private data, third-party exercise banks, or another product's visual assets. Legacy files are evidence and fallback reference, not runtime dependencies.

## Product role

SmartLingo is an AI-native language-learning and social-learning platform. Its public promise is practical progress through short daily sessions, listening, speaking, reading, writing, vocabulary review, text Ask Guru, and signed-in Live Audio AI Chat.

The first supported community paths are Chinese, English, Spanish, Japanese, Korean, French, German, Russian, Italian, and Portuguese. A learner may join a community for any target language, including their own language, and each language may contain multiple official or member-created classes. Course content must be original or properly licensed, versioned, attributable by source type, and reviewed before public release. A placement result or platform completion record is not a government, academic, immigration, or third-party language credential.

Language selectors and language-community cards use language names as text. They never use national flags, because a language can belong to many countries, regions, and communities.

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
- The active runtime names are `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_JWT_KEY`, `OPENAI_API_KEY`, `ADMIN_EMAILS`, and `EDITORIAL_SYNC_SECRET`; `GITHUB_REPOSITORY_URL` is public configuration. Keep documentation, `.env.example`, hosted configuration, and the sensitive-data scanner aligned with these exact names.
- `DB` and `BUCKET` are Sites-managed bindings. Stripe variables in `.env.example` are future-only placeholders: the current runtime does not consume them, and setting them does not enable or prove checkout, charges, transfers, refunds, or payouts.
- The same validated commit must synchronize to the existing Sites source and GitHub `main`; never create a second Sites project, replace a remote, force-push, or create a no-op release.
- After deployment, verify HTTPS, both languages, sign-in, profile, learning, classes, Community, messages, Live Chat, Ask Guru, Project, payment-off or sandbox state, and Worker error logs on the formal domain.
