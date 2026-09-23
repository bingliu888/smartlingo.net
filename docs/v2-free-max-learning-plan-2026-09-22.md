# SmartLingo V2 · Free practice to real-world conversation

Status: implementation plan, 2026-09-22. This document describes acceptance criteria; it does not claim that every feature is already live.

## Product outcome

Free helps a learner complete a useful real-world task through pictures, listening, word choice, and short dialogue. Max adds a one-to-one, role-based AI tutor that adapts to the learner and measures whether the learner can perform the task independently. The promise is task transfer, not points or an AI chat window by itself. Beginner/intermediate/advanced remain internal curriculum bands, not an up-front product choice; a short assessment and observed mission performance suggest the starting point, and the learner can override it.

Success will be measured by a learner's ability to complete a fresh version of the same real-world task after practice. Compare first attempt, coached retry, and a later uncoached attempt. Also track mission completion, seven-day return, Max trial activation, paid conversion, tutor response latency, and AI cost per completed mission. Do not equate an XP balance with proficiency.

## Evidence and current code review

- Duolingo Max currently offers Roleplay, spontaneous Video Call with Lily, and guided Video Call with Falstaff. Its official descriptions place those activities on the learning path and adapt speech to the learner. SmartLingo needs a stronger measurable learning loop, not merely a similar avatar. Sources: https://blog.duolingo.com/duolingo-max/ , https://blog.duolingo.com/video-call/ , https://blog.duolingo.com/beginner-video-call-with-falstaff/
- CEFR describes reception, production, interaction, and mediation; ACTFL frames proficiency as accomplishing communication objectives in spontaneous situations. These guide the mission rubric and graduated hints. Sources: https://book.coe.int/en/education-and-modern-languages/8152-common-european-framework-of-reference-for-languages-learning-teaching-assessment-companion-volume.html , https://www.actfl.org/proficiency-guidelines-overview , https://www.actfl.org/educator-resources/guiding-principles-for-language-learning/provide-effective-feedback
- Existing reusable foundation: twelve Everyday Speaking places, three levels, ten question/answer pairs per place, scene media, beginner picture vocabulary, 21-day Sprint, SmartCard, learning scores, AI study partners, public Ask Guru, speech input and playback, and the Free/Max entitlement table.
- Current gap: Play presents six broad tiles but no guided real-life mission at the top. The language picker follows the tiles. The AI study-partner link opens general chat; it does not carry a task, role, success criteria, or saved coached retry. Max pricing emphasizes ad removal and course levels rather than a concrete tutoring outcome. The live voice endpoint has no visible client entry and reads a legacy subscription status without checking the current Max expiry. These are code observations, not user-study findings.

## V2 learning loop

1. **Choose a purpose.** Pick a target language and one real-life mission, such as ordering coffee, finding groceries, or asking for a train platform. Show the task outcome and estimated time before starting. Offer a short placement check by default, plus "start with the basics" and "change my starting point" controls; never consume a Max trial merely to assess ability.
2. **Free preparation.** Reuse the existing picture words and authored scene dialogue. Present one small challenge at a time: recognize a relevant item, listen, choose a useful response, then perform a complete question/answer exchange. Give immediate explanation and a retry; keep optional microphone practice off until chosen.
3. **Independent check.** After hints, present a changed version of the situation. Score communication success separately from pronunciation and vocabulary. A user can finish Free without starting Max.
4. **Free AI study companion.** A clearly identified AI classmate may join selected free missions: it can model a reply, ask a bounded question, celebrate a real milestone, and point out one useful next practice. It is never presented as a real nearby person. Use the existing public AI gateway, with mission-specific limits and abuse controls. Show Max only when a learner requests more adaptive coaching or has repeated difficulty, and explain the extra value without blocking Free completion.
5. **Max tutor.** The learner chooses the counterpart's role and difficulty. AI stays in role, asks one question at a time, adjusts to known words and the learner's level, offers a hint or slower speech on request, and provides a short correction after the learner responds. Typed practice remains available; speech is optional. A guided simulation should include a preparation turn, a realistic goal, a changed situation, and a final independent attempt.
6. **Actionable review.** Save task ID, goal completion, error type, and next-step suggestion by default. Save a bounded transcript only when the learner opts in; do not store raw audio. Review outcomes from Dashboard and schedule a later uncoached variation. A model response alone must never grant a score or entitlement; server-side validation and bounded scoring are required.

## Free and Max boundary

Free retains all Beginner courses, picture vocabulary, SmartCard, Sprint, Everyday Speaking, Community, and existing public AI help. Free mission play uses authored content and may show ads. Entering a Beginner mission never starts Max. Max adds the adaptive one-to-one role tutor, saved coach feedback and retries, ad-free learning, and access to every course level. The existing one-time seven-day Max trial starts only after an explicit action to begin Max practice or enter an Intermediate/Advanced course, never by viewing a detail page or taking placement; the tutor must use the same shared entitlement mechanism, never a second trial. AIGC credit remains separate from membership.

## Release sequence

### Round 1 · Free mission discovery and clear value

- Put a language-first mission map on Play. Reuse Everyday Speaking scenes, pictures, authored dialogues, and existing routes. Show beginner missions prominently; preserve direct access to Sprint, SmartCard, Challenge, rankings, and Free course.
- Reframe the pricing and member Dashboard around concrete practice outcomes. Explain the Max tutor as an upcoming capability until it is production-tested, then activate the claim and link.
- Remove trial-granting side effects from course detail GET. Make the seven-day trial an explicit, dated, non-renewing user action. Restore an actual placement entry before claiming automatic level selection.
- Verify anonymous Chinese and English paths at phone, iPad, and desktop sizes. No purchase is needed.

### Round 2 · Max one-to-one role tutor

- Build on the existing Assistant voice/text UI and AI gateway. Carry a server-validated mission, counterpart role, target language, and level into every turn. Do not accept client-written system instructions.
- Follow current official OpenAI browser voice guidance: WebRTC on a user-initiated microphone action, with the standard API key kept on the trusted server. Protect session creation with authentication, entitlement, origin checks, rate limits, duration cap, and cost telemetry. Prefer a typed fallback when speech or network access fails. Source: https://developers.openai.com/api/docs/guides/voice-webrtc
- Gate tutor API and page by current Max entitlement or the one-time trial. Use the same expiry-aware entitlement check as courses. Correct the existing live-voice entitlement check and stale course-creation instructions before exposing it.
- Reuse the site-scoped provider routing and quota. Show visible recording, transcript, slow/repeat, stop, and typed fallback states. Test invalid language, role, scene, cross-user access, expired Max, and provider failure.

### Round 3 · Assessment, memory, and production acceptance

- Persist bounded member-owned sessions and retries in site-local D1. Separate uncoached task outcome from coached practice and AI feedback. Restore on refresh and expose a concise Dashboard history.
- Use the existing learned-word order and recent mistakes to choose prompts; keep newly introduced words bounded by level. Add teacher-reviewed mission rubrics and a later variation for transfer.
- Run production browser paths as visitor and ordinary QA member in Chinese and English; check no horizontal overflow across the required viewport matrix, Max trial/expiry behavior, speech fallback, costs, and Project release evidence. Fix observed defects and rerun.
- Calibrate placement before enabling automatic intermediate/advanced routing. Current 15-item assessment repeats very few vocabulary seeds, can overstate confidence after skips, and its recommendation is not yet consistently consumed by official course planning. Build reviewed multi-scenario tasks and test that recommendation changes the actual next lesson, while allowing a manual override.

## Stop conditions and reporting

Each release must pass the shared policy, build, type, lint, meaningful behavior tests, sensitive-data checks, WebKit layout matrix, exact GitHub deployment, production browser flow, and Project report. A failed gate stops that release while preserving completed work. Report each deployed round with the exact commit, run, tested routes, measured content counts, and any still-unfinished V2 criteria. At the three-day checkpoint, distinguish deployed capabilities from planned items and give the next concrete work item.
