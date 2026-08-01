# SmartLingo public product foundation

Updated: 2026-07-31

## Positioning

SmartLingo helps people practice a new language from the first day and sustain progress through AI-supported daily learning, real conversation, and member-created learning communities.

The product has four connected pillars:

1. **Daily language practice** — short, structured sessions that balance listening, speaking, reading, writing, vocabulary, and review.
2. **Ask Guru and Live Audio AI Chat** — public text help plus signed-in, permission-based real-time speaking practice.
3. **Member-created classes** — any signed-in member can organize a private class as teacher or coordinator and bring learners together socially.
4. **Transparent commerce** — Stripe Connect supports class-owner payouts, while platform subscriptions and introducer rewards remain a separate accounting domain.

SmartLingo may be compared with other language-learning services on current, verifiable capabilities and prices. It does not promise to be the cheapest in every market, and it does not copy another service's branding, characters, proprietary exercises, lesson text, or visual assets.

## Preserved browser-visible legacy identity

The prior SmartLingo.net public experience visibly presented:

- the Chinese tagline “开口说，才会说” and the English idea “Speak a new language from day one”
- AI-native language learning with real situations such as cafés, airports, and interviews
- immediate, supportive correction during AI conversation
- pronunciation feedback, immersive reading, daily listening or radio, and a structured path from beginner levels
- Community, friend or class motivation, learning experience, and class learning
- Spanish, English, French, Japanese, German, Italian, and Korean

The original pages and images are preserved only as migration evidence under `legacy-reference/`. The new site does not depend on them at runtime and does not treat hidden source data as public content.

## Learning model

### Language paths

Each language has a stable ID, versioned stages, prerequisites, original or licensed content provenance, speech capability flags, and a published-content state. The initial catalog includes:

- Spanish / 西班牙语
- English / 英语
- French / 法语
- Japanese / 日语
- German / 德语
- Italian / 意大利语
- Korean / 韩语

Onboarding asks for the learner's target language, real-world purpose, daily time, and self-reported level. Placement is optional. Its result recommends a starting point; it is not a formal test score or credential.

### Daily practice

A daily session combines new material, spaced review, four-skill practice, and a short recap. The system saves server checkpoints, deduplicates submissions, preserves drafts in weak networks, and never marks a session complete merely because a client says it is complete.

Learning XP and streaks are motivational signals with no cash value. They are calculated separately from introducer reward points and do not create a financial claim.

### Vocabulary

Vocabulary records include form, meaning, pronunciation, examples, level, topic, source type, and review state. Practice rotates recognition, recall, listening, spelling, and contextual cloze. A spaced-review schedule adapts to the learner's responses and remains explainable and adjustable.

### Listening and speaking

Listening content includes graded natural speech, scene dialogues, and short broadcasts with transcripts and text alternatives. Recording begins only after an explicit action and provides visible state, preview, retry, and deletion.

Pronunciation feedback focuses on intelligibility, selected target sounds, and rhythm, with uncertainty shown. It must not infer nationality, ethnicity, identity, disability, or personal worth from voice.

### Reading and writing

Reading uses original or properly licensed graded stories, dialogues, notices, email, and workplace texts. Support may include tap definitions, sentence audio, optional translations, and adjustable typography.

Writing assistance gives rubric-based suggestions on task completion, clarity, grammar, and vocabulary while preserving the learner's authorship. It does not complete assignments or exams on the learner's behalf.

## Ask Guru and Live Audio AI Chat

Text Ask Guru is public for language choice, platform guidance, and sample phrases. Answers provide copy, read-aloud, rating, and sharing actions.

Personal learning context requires sign-in and includes only the member's permitted current language, stage, goals, and recent learning records. Every retrieval path enforces user and class authorization. AI output may explain, coach, suggest, and acknowledge uncertainty; it must not expose another member's data or claim a credential or outcome.

Live Audio AI Chat requires sign-in and explicit microphone permission. The interface shows when recording is active, offers captions and a keyboard exit, supports reconnection, and lets the learner control saved transcripts or summaries. Full audio is not retained without explicit, informed consent.

## Member-created classes

### Eligibility and roles

Any signed-in member may create a private class. Paid membership is not a prerequisite.

- A **teacher** manages teaching activities, learning guidance, and feedback.
- A **coordinator** manages scheduling, invitations, and class communication.

One person may hold both roles where policy permits. Server authorization—not UI visibility—enforces every action.

### Private-by-default flow

1. The member chooses a language path, role, class title, description, timezone, schedule, capacity, and optional per-person fee.
2. The class starts private and is visible only to the owner, invitees, and enrolled members.
3. Invitation context survives registration and sign-in, then creates one deduplicated enrollment.
4. The class receives a protected forum, shared goals, direct messages, and group Live Chat.
5. Public catalog placement requires a separate application, automated preflight, and Admin human review. Submission never publishes automatically.

Class owners can see scoped roster and aggregate learning information. They cannot see private answers, another class's data, payment-card details, bank information, or identity-verification documents.

## Class payments through Stripe Connect

### Connected-account readiness

SmartLingo uses Stripe-hosted Connect onboarding for class-owner identity, business, and payout requirements. SmartLingo stores a connected-account reference and readiness status, not raw bank or verification details.

Live class checkout is available only when the owner account reports both charges and payouts enabled and no blocking requirements. A later account restriction pauses new checkout without removing learning access already earned.

### First-payment discount

The 15% discount is scoped to one learner and one class. It applies only to that pair's first successful class payment. Failed, canceled, expired, or abandoned checkout attempts do not consume eligibility. A refund does not silently recreate eligibility; the published refund and promotion policy controls any exception.

### 70/30 split

The split is calculated from the discounted, pre-tax amount in integer minor currency units:

1. Calculate and subtract the 15% discount where eligible.
2. Round the class-owner share down to 70% of the discounted amount.
3. Assign the remaining amount to the platform so owner plus platform always equals the discounted amount.
4. Calculate or collect taxes according to the configured legal and processor responsibilities; tax is not part of the 70/30 base.

Example: for a first class payment with a $100.00 list price, the discounted pre-tax amount is $85.00. The class owner share is $59.50 and the platform share is $25.50 before processor-fee and tax treatment defined by the published policy.

Verified Stripe webhooks are the source of truth for success, failure, refund, dispute, and connected-account state. Every event is signature-checked and idempotent. Refunds reverse the transfer when policy requires it, and the ledger records treatment of application and processor fees.

This document defines product behavior, not authorization to take live payment. Live charging remains disabled until processor credentials, prices, tax and refund rules, legal copy, webhooks, and sandbox acceptance are complete.

## Platform subscriptions and direct-introducer points

Platform subscription payments and member-created class payments are separate event types, tables, ledgers, and webhook handlers.

The reward contract is deliberately narrow:

- a member may have at most one eligible direct introducer;
- there is no upline, second level, or multi-level reward tree;
- only a successful platform subscription payment collected by the SmartLingo platform account can generate a reward;
- one platform subscription payment ID can create at most one reward-ledger entry;
- successful recurring platform subscription payments may each create a reward when the published program allows it;
- registration, free use, profile completion, invitations, class enrollment, and member-created class payments never create introducer rewards;
- self-referral, failed payment, cancellation, duplicate callbacks, and forged event types create no reward;
- refunds or reversals follow the published reward-reversal policy.

The database rejects class-order event types from the platform-subscription reward ledger. This boundary is enforced server-side and tested; it is not a display convention.

## Community, messaging, and safety

Each class may have a forum, shared weekly goals, optional peer-practice matching, direct messages, and group Live Chat. Learning activity is shared only by opt-in. Private scores, detailed mistakes, payments, email, phone, and minors' location are never public activity.

Members can leave, block, and report. Class owners can moderate their scoped spaces; platform Admins can review evidence and suspend a class or account. Member removal updates access immediately while retention follows published safety and legal requirements.

Both new-message and reply composers include `Polish with Guru` / `请智能导师润色`, preserving the user's meaning and target language. AI failure returns the original draft and a clear error state.

## Responsive UI and release quality

Responsive quality is a release blocker and precedes daily feature work. Every changed release measures primary Chinese and English pages at 390×844, 430×932, 820×1180, 1180×820, and 1440×900.

Text must fit its panel, full-width surfaces must fill the usable parent width, semantic kicker-heading-description groups stay in one vertical column, and readable line-length limits apply only to nested prose. Runtime checks verify final computed styles, parent and child bounding boxes, and no horizontal page overflow. Root-level clipping is never accepted as evidence that a page fits.

## Credential and outcome boundaries

SmartLingo learning records may document platform activity or completion when that feature is released. They are not:

- a government or immigration document;
- an accredited academic degree;
- a third-party language certificate unless the named third party has formally authorized it;
- a guarantee of proficiency, test score, employment, earnings, visa, immigration result, payout, refund, or reward.

Privacy, terms, class-owner, refund, tax, and reward policies remain visibly labeled as drafts until formal review and approval.

## Twenty-day automated delivery

`lib/smartlingo-roadmap.ts` contains 20 consecutive dates from 2026-07-31 through 2026-08-19, exactly five tasks per date and 100 unique tasks total. It is the one source for Project calendar, task pages, reports, and daily automation.

The automation completes exactly five tasks from the earliest unfinished date. Every completed task needs code, content, test, migration, documentation, or production evidence. It updates the bilingual daily report and never repeats completed work. Any migration, test, build, sensitive-data scan, source-drift, responsive-layout, deploy, or production error stops the site safely for later retry.
*** Add File: /Users/bingliu/Documents/Codex/Sites/smartlingo.net/legacy-reference/README.md
# SmartLingo.net legacy reference

Captured: 2026-07-31

Purpose: preserve the browser-visible identity of the pre-migration SmartLingo.net deployment before DNS or hosting changes. These files are evidence and design reference only. The migrated application must not depend on them at runtime, publish them as active pages, or treat hidden source data as public content.

## Browser-visible content recorded during migration

- Brand: `SmartLingo`
- Chinese product line: `开口说，才会说`
- English social-preview line: `Speak a new language from day one.`
- Positioning: AI-native language learning through real-situation conversation with immediate, supportive correction
- Visible scenarios and capabilities: cafés, airports, interviews, pronunciation feedback, immersive reading, daily listening or radio, and structured beginner progression
- Social capabilities: Community, friend or class motivation, learning experience, and class learning
- Languages declared by the public page: Spanish, English, French, Japanese, German, Italian, and Korean (`es`, `en`, `fr`, `ja`, `de`, `it`, `ko`)
- Public metadata described the web experience as free to start; that archived metadata is not an active price, subscription, or payment authorization for the migrated site.

The legacy experience also used a green visual system and a parrot mark. The migrated site may preserve the high-level green language-learning identity, but it must use original branding and must not copy third-party character, lesson, exercise, or visual assets.

## Backup manifest

| File | Bytes | SHA-256 | Purpose |
| --- | ---: | --- | --- |
| `root-2026-07-31.html` | 18,205 | `b40afa2f89d0452178882ab0d4895666f94d3ac8077369ebd80e317cf7db3283` | Root response and browser-visible public metadata before migration |
| `welcome-2026-07-31.html` | 17,840 | `7b05adc21703806cf904c3cffca7f4f211af830b1a5dc742d3851ee3ba2ee7ab` | Welcome response and browser-visible product metadata before migration |
| `icon-192.png` | 5,322 | `e474aeba36acf602a7fea67c80834644385bbdbe253978f5b1099cd29039f1e4` | Legacy 192-pixel application icon |
| `apple-touch-icon.png` | 5,033 | `b9f229d02210a00eb25b11f213a4ce0500f789191562afe5d21cd03f8015c69e` | Legacy Apple touch icon |
| `opengraph-image.png` | 97,985 | `41f373d3c8ed4f0f9bc8c32da3cce1a5d2c652b9982d1ec346555c890fcd627b` | Legacy social-preview image |

## Integrity and use rules

- Re-run SHA-256 checks before relying on a file as migration evidence.
- Do not execute scripts from the archived HTML.
- Do not copy session data, analytics identifiers, deployment identifiers, build chunks, or hidden source content into the new product.
- Do not expose these archived HTML files through public application routes.
- New SmartLingo course text, exercises, AI prompts, class assets, and social-preview art must be original or properly licensed.
