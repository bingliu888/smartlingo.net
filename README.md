# SmartLingo.net

SmartLingo is a Chinese-default, bilingual AI-native language-learning platform for individual practice and member-created learning communities.

## Product foundation

The migration preserves the browser-visible identity of the prior SmartLingo.net site:

- “开口说，才会说” / “Speak from day one”
- real-world AI conversation practice
- pronunciation feedback, immersive reading, daily listening, and structured progression
- Spanish, English, French, Japanese, German, Italian, and Korean
- Community, social motivation, and class learning

The preserved HTML and image evidence is documented in [`legacy-reference/README.md`](legacy-reference/README.md). The new application does not depend on the old deployment or import hidden source content.

The product uses proven language-learning principles—short lessons, active recall, spaced review, balanced listening/speaking/reading/writing, visible progress, social accountability, and teacher-led classes—without copying a competitor's brand, characters, proprietary content, item banks, or visual assets.

## Member-created language classes

Any signed-in member may create a private class as a teacher or coordinator. This right is not limited to a paid tier. A class can have its own language path, schedule, member roster, learning Community, direct messages, group Live Chat, and AI-assisted practice.

Public catalog placement is separate: the class must pass automated preflight and Admin human review before it appears in search.

## Payments and rewards

Class checkout is designed for Stripe Connect:

1. The class owner completes Stripe-hosted Connect onboarding.
2. The first successful payment by one learner for one class receives 15% off.
3. The discounted, pre-tax amount is split 70% to the class owner and 30% to SmartLingo.
4. Verified webhooks authorize enrollment, transfer state, refunds, and disputes.

Live charging remains disabled until processor credentials, prices, refund rules, tax handling, legal copy, and connected-account readiness are configured and tested.

Introducer rewards apply only to successful **platform subscription** payments collected by SmartLingo. Each subscription payment may create one idempotent reward for one direct introducer. Registration and member-created class payments never create introducer rewards, and no multi-level relationship exists. Learning XP is a separate, non-cash progress signal.

## Shared site features

- Chinese-default, bilingual public and member pages
- language onboarding, daily practice, vocabulary review, listening, speaking, reading, and writing
- public text Ask Guru and signed-in Live Audio AI Chat
- profiles, member discovery, Community, class forums, direct messages, and group Live Chat
- member-created private classes with teacher and coordinator roles
- responsive shared header, user/avatar control, mobile menu, language control, and Project history
- release-blocking layout validation for phone, iPad portrait, iPad landscape, and desktop in both languages

## Public project plan

The machine-readable roadmap in [`lib/smartlingo-roadmap.ts`](lib/smartlingo-roadmap.ts) covers 20 consecutive days from 2026-07-31 through 2026-08-19, exactly five tasks per day and 100 unique tasks total. The Project calendar, task details, daily reports, and scheduled development all consume that one source.

## Architecture

- Vinext / Next App Router / React
- Clerk for identity, bridged to the application session
- Cloudflare D1 through Drizzle for structured state
- Cloudflare R2 for private member, class, voice, and message media
- OpenAI server-side APIs for Ask Guru and supported language-learning assistance
- Stripe Connect for planned class-owner onboarding, destination charges, split payments, refunds, and disputes
- OpenAI Sites for build, versioning, deployment, and domain management

Runtime bindings are declared in `.openai/hosting.json`. Secrets belong in the hosted environment and are never committed.

## Runtime configuration

The current server runtime reads these exact hosted-environment names:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (public Clerk browser configuration)
- `CLERK_SECRET_KEY`, `CLERK_JWT_KEY`
- `OPENAI_API_KEY`
- `ADMIN_EMAILS`, `EDITORIAL_SYNC_SECRET`
- `GITHUB_REPOSITORY_URL` (public repository URL, not a secret)

`DB` and `BUCKET` are Sites-managed D1 and R2 bindings, not environment-variable secrets. The Stripe names shown in `.env.example` are reserved for future Stripe Connect work only. The current runtime does not read them, and their presence must never be treated as evidence that checkout, charging, transfers, or payouts are enabled.

## Local development

Requires Node.js 22.13 or newer.

```bash
npm ci
npm run dev
npm test
npm run scan:sensitive
```

See [`SITES.md`](SITES.md) for the product, security, responsive UI, automated delivery, and deployment contracts. See [`docs/smartlingo-product-foundation.md`](docs/smartlingo-product-foundation.md) for the detailed product model.
