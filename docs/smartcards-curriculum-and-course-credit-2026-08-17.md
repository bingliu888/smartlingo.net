# SmartLingo curriculum, SmartCards, and course-credit design

Version: 2026-08-17.1

## Product promise

SmartLingo helps a learner use a new language in real situations. It does not promise that memorising a fixed number of words creates a CEFR certificate. Course levels are aligned to CEFR activity descriptors, while vocabulary totals are transparent SmartLingo product targets.

The public entry loop is:

1. open a starter SmartCard deck without creating an account;
2. learn through audio, visual meaning, examples, and active recall;
3. complete a server-scored mixed-mode challenge;
4. retain provisional points on the device;
5. sign in only when the learner wants to keep progress or claim points;
6. use verified points toward up to 100% of one monthly course fee.

Opening a deck, registering, or claiming points never starts a free trial or subscription. Checkout requires a separate, explicit choice and clearly states the renewal price and cancellation path.

## Evidence translated into product rules

- The Council of Europe describes learners as social agents using reception, production, interaction, and mediation. Therefore every unit ends in a real task, not a word-count milestone. See the [CEFR Companion Volume resources](https://www.coe.int/en/web/common-european-framework-reference-languages/cefr-companion-volume-and-its-language-versions) and [mediation in the classroom](https://www.coe.int/en/web/common-european-framework-reference-languages/mediation-in-the-classroom).
- Paul Nation's Four Strands framework recommends roughly balanced meaning-focused input, meaning-focused output, language-focused learning, and fluency development. SmartLingo maps these to listening/reading, speaking/writing, focused vocabulary/pronunciation, and timed or repeated real-life missions. See the [Cambridge excerpt from Learning Vocabulary in Another Language](https://assets.cambridge.org/97811076/23026/excerpt/9781107623026_excerpt.pdf).
- Vocabulary knowledge is meaning-specific and cumulative. A familiar spelling can have a later, more advanced sense; formulas and phrases are also learnable units. SmartLingo therefore versions lexical senses and phrases instead of storing only flat strings. See the [English Vocabulary Profile research](https://www.cambridge.org/core/journals/english-profile-journal/article/a1b2-vocabulary-insights-and-issues-arising-from-the-english-profile-wordlists-project/E57847F6C5574124B2354F9BEEC005FA).
- Published estimates differ by test, language, lemma definition, and word-family definition. Cross-language research broadly places A1 near 1,000 items, A2 around 1,000–2,000, and B1 around 2,000–3,000; it also warns that textbook vocabulary often lacks enough re-encounters. See the [2024 corpus-informed French, German, and Spanish study](https://journals.sagepub.com/doi/10.1177/13621688241288877) and [2024 CEFR vocabulary-size comparison](https://doi.org/10.3390/languages9070239).
- Spacing, retrieval, corrective feedback, and audio-visual presentation improve durable vocabulary learning. Rewards therefore depend on a first delayed retrieval pass, not card flips or time spent. See the [applied web-learning experiment](https://pmc.ncbi.nlm.nih.gov/articles/PMC8638698/) and [trainable spaced-repetition study](https://research.duolingo.com/papers/settles.acl16.pdf).
- Gamification generally has a small positive motivational effect, while evidence for proficiency gains is less certain. SmartLingo uses low-stakes progress rewards, personal bests, cooperative challenges, and actionable feedback; speed never changes redeemable credit. See the [meta-analysis of motivation and self-determination outcomes](https://link.springer.com/article/10.1007/s11423-023-10337-7).
- Reward and promotion abuse is a business-logic security problem. All scoring, caps, balances, and redemption math are server-authoritative; the browser never submits a point amount. See the [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html).

## Curriculum targets

“Learning item” means one versioned lexical sense, formula, or phrase. It is intentionally not a whitespace token. This keeps the model usable for Chinese segmentation, Japanese scripts, Arabic morphology, and other language-specific systems.

| Course | CEFR alignment | Cumulative items | Productive target | Functional goal |
| --- | --- | ---: | ---: | --- |
| Beginner | A1 aligned | 1,000 | 700 | Essential personal, home, travel, food, shopping, health, digital-service, and safety tasks using short exchanges. |
| Intermediate | A2 to B1 aligned | 2,500 | 1,800 | Independent everyday, social, study, and workplace communication; narration and routine problem solving. |
| Advanced | B1+ to B2 aligned | 4,000 | 3,000 | Clear, flexible professional, academic, and social communication with nuance, argument, and extended discourse. |

These are cumulative product targets across a course library, not items forced into a single month. A learner receives a daily slice chosen from new, due, weak, and mission-relevant items.

## Content lifecycle

Each item has a stable key, immutable version, target language, level, CEFR alignment, difficulty, scene, form, pronunciation, meanings, item kind, productive/receptive status, source, and review state.

Review states are `draft`, `ai_checked`, `human_reviewed`, `published`, and `retired`. AI may draft or perform consistency checks, but it cannot mark its own content human-reviewed. Only published content is eligible for public decks or point-bearing challenges. Corrections create a new version so past learning and challenge evidence remains auditable.

The first database release imports 336 already-reviewed SmartLingo survival items: 28 items in each of 12 languages across greetings, introductions, transport, directions, restaurants, shopping, and safety. Later packs must pass native-speaker review before publication.

## SmartCard learning and challenge rules

Each 5–12 card deck supports:

- meaning recognition;
- audio-to-meaning listening;
- meaning-to-form active recall;
- assisted spelling or script construction;
- cloze use in a sentence;
- five-turn pronunciation practice;
- one short social or real-life mission.

A public game presents one target word at a time. Meaning choices never expose the other target-language words. A correct choice moves directly to listen-and-repeat practice; the browser recognizes up to three transient speech attempts, while the server scores the transcript conservatively and stores neither audio nor transcript.

The learner can study freely and retry practice. Practice credit is awarded once per learner for a published deck version. The dated challenge is awarded once per learner, deck, and local day and supplies the daily leaderboard. The deck owner receives no credit for their own deck. Replays remain available but do not repeat an already claimed reward.

## Course-credit policy

- 100 points = USD $1 of course credit.
- Each completed public round starts at 100 provisional points; correct meanings add 10, wrong meanings subtract 5, and pronunciation passes add 5.
- Guest results become spendable only after the full round is complete and a verified account claims them.
- Up to 100% of one monthly course fee may be paid with points.
- Points have no cash-out, transfer, peer-sale, or owner-payout value.
- Course credit is separate from learning XP and direct-introducer rewards.
- Every balance change is an append-only, idempotent ledger entry.
- A reservation is created before checkout. Failed or abandoned checkout releases it; a refund or dispute reverses the corresponding settlement according to the published refund policy.
- A credit-only month grants exactly one course period and never silently creates an auto-renewing subscription.

Server reconstruction, one-claim uniqueness, self-deck exclusion, immutable deck versions, and anomaly review protect the course-credit economy without blocking ordinary practice.

## Guest safety and conversion

Guests receive a random HttpOnly device key. Only a hash is stored. Guest points are provisional and cannot be spent, transferred, or shown as cash. Claiming requires a verified signed-in account. Server checks prevent duplicate deck-version claims, self-challenges, negative balances, and daily-cap overflow.

Rate limits, abnormal attempt timing, many accounts on one device, repeated answer fingerprints, and claim velocity should contribute to a risk flag. Suspicious credit remains on hold for admin review; ordinary learning access is never blocked merely because a reward is held.

## Success measures

The primary metric is not clicks or points. Measure:

- delayed recall after 1, 7, and 30 days;
- percentage of learners who complete a real-life mission;
- speaking attempts and anxiety-safe retries;
- weekly active learners who complete meaning-focused input and output;
- guest-to-account conversion without forced subscription;
- challenge invitations that create a completed learning session;
- credit earned per verified learning hour and abuse-review rate;
- paid retention after the first explicitly chosen paid month.
