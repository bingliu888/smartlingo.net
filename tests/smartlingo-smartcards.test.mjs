import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { buildSmartCardChallenge, gradeSmartCardChallenge, scoreSmartCardPronunciation, smartCardMicrophoneFailure } from "../lib/smartlingo-smartcards.ts";
import { applyTrackedMigrations, readMigrationManifest } from "../scripts/validate-d1-migrations.mjs";

const cards = Array.from({ length: 12 }, (_, index) => ({
  id: `card-${index + 1}`,
  form: `form ${index + 1}`,
  pronunciation: `sound ${index + 1}`,
  meaningEn: `meaning ${index + 1}`,
  meaningZh: `含义 ${index + 1}`,
  sceneKey: "greetings",
  difficulty: 1,
}));

test("SmartCard challenge mixes recognition, listening, recall, and limited typing", () => {
  const challenge = buildSmartCardChallenge(cards);
  assert.equal(challenge.length, 12);
  assert.deepEqual(new Set(challenge.map(question => question.mode)), new Set(["recognition", "listening", "recall", "typing"]));
  assert.equal(challenge.filter(question => question.mode === "typing").length, 1);
  assert.ok(challenge.filter(question => question.options).every(question => question.options.length === 4));
});

test("SmartCard score is server-derived from question answers", () => {
  const challenge = buildSmartCardChallenge(cards);
  const answers = Object.fromEntries(challenge.map(question => [question.id, question.mode === "typing" ? cards.find(card => card.id === question.cardId).form : question.cardId]));
  assert.deepEqual(gradeSmartCardChallenge(cards, answers), { correctCount: 12, questionCount: 12, score: 100 });
  answers[challenge[0].id] = "client cannot submit a score";
  assert.deepEqual(gradeSmartCardChallenge(cards, answers), { correctCount: 11, questionCount: 12, score: 92 });
});

test("migration publishes reviewed starter content and enforces point boundaries", () => {
  const sql = readFileSync(new URL("../drizzle/0040_smartcards_curriculum_credits.sql", import.meta.url), "utf8");
  assert.equal((sql.match(/INSERT INTO smartlingo_vocabulary_items/g) || []).length, 336);
  assert.equal((sql.match(/INSERT INTO smartlingo_smartcard_decks/g) || []).length, 12);
  assert.match(sql, /points_per_usd[^]*100/);
  assert.match(sql, /max_redemption_basis_points[^]*10000/);
  assert.match(sql, /daily_earn_cap[^]*50/);
  assert.match(sql, /smartlingo_smartcard_reward_once_uq[^]*WHERE reward_points > 0/);
  assert.match(sql, /smartlingo_smartcard_guest_reward_once_uq[^]*WHERE provisional_points > 0/);
  assert.match(sql, /invalid or capped SmartCard challenge reward/);
  assert.match(sql, /insufficient SmartLingo course credit/);
});

test("0125 gives every published vocabulary item target and learner-language pronunciation guides", () => {
  const migration = readFileSync(new URL("../drizzle/0125_vocabulary_pronunciation_guides.sql", import.meta.url), "utf8");
  const ids = [...migration.matchAll(/WHERE id='([^']+)'/g)].map(match => match[1]);
  assert.equal(ids.length, 336);
  assert.equal(new Set(ids).size, 336);
  assert.match(migration, /target_phonetic TEXT NOT NULL DEFAULT ''/);
  assert.match(migration, /pronunciation_en TEXT NOT NULL DEFAULT ''/);
  assert.match(migration, /pronunciation_zh TEXT NOT NULL DEFAULT ''/);
  assert.match(migration, /published vocabulary requires complete pronunciation guides/);

  const database = new DatabaseSync(":memory:");
  database.exec("CREATE TABLE smartlingo_vocabulary_items(id TEXT PRIMARY KEY,review_status TEXT NOT NULL,updated_at INTEGER NOT NULL)");
  const insert = database.prepare("INSERT INTO smartlingo_vocabulary_items(id,review_status,updated_at) VALUES(?,'published',0)");
  for (const id of ids) insert.run(id);
  database.exec(migration);
  const complete = database.prepare("SELECT COUNT(*) AS count FROM smartlingo_vocabulary_items WHERE target_phonetic<>'' AND pronunciation_en<>'' AND pronunciation_zh<>''").get();
  assert.equal(complete.count, 336);
  assert.deepEqual({ ...database.prepare("SELECT target_phonetic AS targetPhonetic,pronunciation_en AS pronunciationEn,pronunciation_zh AS pronunciationZh FROM smartlingo_vocabulary_items WHERE id='vocab_en_beginner_greetings_1_v1'").get() }, {
    targetPhonetic: "/həˈloʊ/", pronunciationEn: "huh-LOH", pronunciationZh: "hē-lóu",
  });
  assert.throws(() => database.prepare("INSERT INTO smartlingo_vocabulary_items(id,review_status,updated_at) VALUES('incomplete','published',0)").run(), /complete pronunciation guides/);
});

test("0127 keeps learner-facing meanings free of category and language metadata", () => {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys=ON");
  applyTrackedMigrations(database, readMigrationManifest());
  database.exec(readFileSync(new URL("../drizzle/0127_clean_vocabulary_meanings.sql", import.meta.url), "utf8"));
  assert.deepEqual({ ...database.prepare("SELECT COUNT(*) AS total,SUM(instr(meaning_en,' · ')>0 OR instr(meaning_zh,' · ')>0) AS decorated FROM smartlingo_vocabulary_items WHERE source_type='smartlingo_original'").get() }, { total: 336, decorated: 0 });
  assert.deepEqual({ ...database.prepare("SELECT meaning_en AS meaningEn,meaning_zh AS meaningZh FROM smartlingo_vocabulary_items WHERE id='vocab_es_beginner_greetings_4_v1'").get() }, {
    meaningEn: "excuse me; sorry",
    meaningZh: "劳驾；对不起",
  });
  database.close();
});

test("public game and redemption routes keep scores and balances server-authoritative", () => {
  const publicRoute = readFileSync(new URL("../app/api/smartcards/[token]/route.ts", import.meta.url), "utf8");
  const redemptionRoute = readFileSync(new URL("../app/api/billing/credits/redeem/route.ts", import.meta.url), "utf8");
  assert.match(publicRoute, /scoreSmartCardPronunciation/);
  assert.match(publicRoute, /startingPoints \+ correctCount \* POLICY\.correctPoints/);
  assert.doesNotMatch(publicRoute, /body\.(?:score|points|rewardPoints|balancePoints)/);
  assert.match(publicRoute, /HttpOnly; Secure; SameSite=Lax/);
  assert.match(redemptionRoute, /COALESCE\(SUM\(points\),0\)/);
  assert.match(redemptionRoute, /-value\.course\.priceCents/);
  assert.match(redemptionRoute, /provider_subscription_id[^]*credit:/);
});

test("pronunciation transcript scoring tolerates case and punctuation but rejects the wrong word", () => {
  assert.deepEqual(scoreSmartCardPronunciation("Hello!", "hello"), { score: 100, passed: true });
  assert.equal(scoreSmartCardPronunciation("Hello", "yellow").passed, false);
  assert.equal(scoreSmartCardPronunciation("مرحبًا", "مرحبا", "marḥaban").passed, true);
  assert.equal(scoreSmartCardPronunciation("こんにちは", "konnichiwa", "konnichiwa").passed, true);
  assert.equal(scoreSmartCardPronunciation("你好", "ni hao", "nǐ hǎo").passed, true);
  assert.deepEqual(scoreSmartCardPronunciation("Hallo", "Halo", "HAH-loh", "de"), { score: 100, passed: true });
  assert.deepEqual(scoreSmartCardPronunciation("ciao", "Chao", "chow", "it"), { score: 100, passed: true });
  assert.equal(scoreSmartCardPronunciation("Hello", "Helo", "", "en").passed, false);
});

test("microphone failures distinguish denied permission from a retryable device error", () => {
  assert.equal(smartCardMicrophoneFailure("NotAllowedError"), "denied");
  assert.equal(smartCardMicrophoneFailure("service-not-allowed"), "denied");
  assert.equal(smartCardMicrophoneFailure("audio-capture"), "unavailable");
  assert.equal(smartCardMicrophoneFailure("TimeoutError"), "unavailable");
});

test("single-card game hides other target words and has no submit button", () => {
  const source = readFileSync(new URL("../components/PublicSmartCardChallenge.tsx", import.meta.url), "utf8");
  assert.match(source, /请跟我说/);
  assert.match(source, /SpeechRecognition/);
  assert.match(source, /new MediaRecorder\(stream\)/);
  assert.match(source, /getUserMedia/);
  assert.match(source, /AI 读完后会自动听您跟读/);
  assert.match(source, /重新检查麦克风/);
  assert.match(source, /正在分析发音/);
  assert.match(source, /4500/);
  assert.match(source, /\/speech/);
  assert.match(source, /permission\.state === "granted"/);
  assert.match(source, /maxAlternatives = 5/);
  assert.doesNotMatch(source, /开始说/);
  assert.doesNotMatch(source, /听并跟读/);
  assert.doesNotMatch(source, /Listen & speak/);
  assert.match(source, /policy\.startingPoints/);
  assert.doesNotMatch(source, />Submit</);
  assert.doesNotMatch(source, /option\.form/);
  assert.doesNotMatch(source, /<small>\{card\.sceneKey\}<\/small>/);
});

test("follow-me practice shows target phonetics and the current interface language sound guide", () => {
  const component = readFileSync(new URL("../components/PublicSmartCardChallenge.tsx", import.meta.url), "utf8");
  const route = readFileSync(new URL("../app/api/smartcards/[token]/route.ts", import.meta.url), "utf8");
  assert.match(component, /目标语言音标/);
  assert.match(component, /中文拼音式助读/);
  assert.match(component, /English sound guide/);
  assert.match(component, /card\.targetPhonetic \|\| card\.pronunciation/);
  assert.match(component, /card\.pronunciationZh : card\.pronunciationEn/);
  assert.match(route, /target_phonetic AS targetPhonetic/);
  assert.match(route, /pronunciation_en AS pronunciationEn/);
  assert.match(route, /pronunciation_zh AS pronunciationZh/);
});

test("multilingual speech fallback is bounded, server-scored, and does not persist audio", () => {
  const route = readFileSync(new URL("../app/api/smartcards/[token]/speech/route.ts", import.meta.url), "utf8");
  assert.match(route, /MAX_AUDIO_BYTES = 750_000/);
  assert.match(route, /transcribeSmartAiSpeech/);
  assert.match(route, /scoreSmartCardPronunciation/);
  assert.match(route, /target_language AS targetLanguage/);
  assert.doesNotMatch(route, /put\(|INSERT INTO|UPDATE /);
});

test("game navigation keeps target language, progress, local-time art, and score feedback", () => {
  const course = readFileSync(new URL("../app/[lang]/programs/[language]/page.tsx", import.meta.url), "utf8");
  const play = readFileSync(new URL("../app/[lang]/play/page.tsx", import.meta.url), "utf8");
  const challenge = readFileSync(new URL("../app/[lang]/play/challenge/page.tsx", import.meta.url), "utf8");
  const calendar = readFileSync(new URL("../components/SmartCardChallengeCalendar.tsx", import.meta.url), "utf8");
  const game = readFileSync(new URL("../components/PublicSmartCardChallenge.tsx", import.meta.url), "utf8");
  const leaderboard = readFileSync(new URL("../app/api/smartcards/leaderboard/route.ts", import.meta.url), "utf8");
  assert.match(course, /play\?language=\$\{language\}/);
  assert.match(course, /免费游戏/);
  assert.match(play, /smartcards\/starter-\$\{language\}/);
  assert.match(play, /play\/challenge\?language=\$\{language\}/);
  assert.match(challenge, /isSmartLingoCommunityLanguage/);
  assert.match(calendar, /leaderboard\?month=\$\{month\}&language=/);
  assert.match(calendar, /mode=challenge&language=\$\{targetLanguage\}/);
  assert.match(game, /card-count/);
  assert.match(game, /index \+ 1\} \/ \{cards\.length/);
  assert.match(game, /learning-world-\$\{timeScene\}\.jpg/);
  assert.match(game, /getHours\(\)/);
  assert.match(game, /createOscillator/);
  assert.match(game, /prefers-reduced-motion/);
  assert.match(game, /challengeDeadline/);
  assert.match(game, /currentLeader/);
  assert.match(game, /gameMode!=="challenge"/);
  assert.match(leaderboard, /deck\.target_language=\?/);
  assert.match(leaderboard, /isSmartLingoCommunityLanguage/);
  assert.match(leaderboard, /smartlingo_smartcard_daily_settlements/);
  assert.match(leaderboard, /smartcard_winner_earn/);
});

test("0041 separates practice from daily challenge and guards game rewards", () => {
  const sql = readFileSync(new URL("../drizzle/0041_smartcard_single_card_game.sql", import.meta.url), "utf8");
  assert.match(sql, /game_mode TEXT NOT NULL CHECK\(game_mode IN \('practice','challenge'\)\)/);
  assert.match(sql, /smartlingo_course_credit_game_insert_trg/);
  assert.match(sql, /run\.score=NEW\.points/);
  assert.match(sql, /deck\.owner_user_id!=NEW\.user_id/);
});

test("0042 makes daily challenges timed, single-chance, and settle winners once", () => {
  const sql = readFileSync(new URL("../drizzle/0042_smartcard_daily_challenge.sql", import.meta.url), "utf8");
  const route = readFileSync(new URL("../app/api/smartcards/[token]/route.ts", import.meta.url), "utf8");
  assert.match(sql, /smartlingo_smartcard_timed_sessions/);
  assert.match(sql, /smartlingo_smartcard_daily_settlement_uq/);
  assert.match(sql, /smartlingo_course_credit_winner_insert_trg/);
  assert.match(route, /challengeSeconds: 10/);
  assert.match(route, /new Date\(nowMs\)\.toISOString\(\)\.slice\(0,10\)/);
  assert.match(route, /nowMs-session\.questionStartedMs>POLICY\.challengeSeconds\*1000/);
  assert.match(route, /current_index=\?/);
  assert.match(route, /leader&&leader\.score<100&&score>leader\.score/);
});

test("database permits learning retries but awards one capped credit per deck version", () => {
  const database = new DatabaseSync(":memory:");
  try {
    database.exec("PRAGMA foreign_keys=ON");
    applyTrackedMigrations(database, readMigrationManifest());
    database.prepare(`INSERT INTO users(id,email,display_name,password_hash,preferred_language,role,created_at)
      VALUES('card-learner','card-learner@example.invalid','Card Learner','disabled','en','member',1)`).run();
    const insertAttempt = database.prepare(`INSERT INTO smartlingo_smartcard_challenge_attempts
      (id,deck_id,deck_version,attempt_number,challenger_user_id,score,correct_count,question_count,passed,reward_points,answer_fingerprint,local_date,created_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    insertAttempt.run("attempt-1", "starter_en", 1, 1, "card-learner", 50, 6, 12, 0, 0, "f1", "2026-08-17", 1);
    insertAttempt.run("attempt-2", "starter_en", 1, 2, "card-learner", 92, 11, 12, 1, 10, "f2", "2026-08-17", 2);
    database.prepare(`INSERT INTO smartlingo_course_credit_ledger
      (id,user_id,points,entry_type,source_type,source_id,local_date,note,created_at)
      VALUES('credit-1','card-learner',10,'challenge_earn','smartcard_challenge','attempt-2','2026-08-17','pass',2)`).run();
    assert.throws(() => insertAttempt.run("attempt-3", "starter_en", 1, 3, "card-learner", 100, 12, 12, 1, 10, "f3", "2026-08-17", 3));
    assert.throws(() => database.prepare(`INSERT INTO smartlingo_course_credit_ledger
      (id,user_id,points,entry_type,source_type,source_id,local_date,note,created_at)
      VALUES('spend-too-much','card-learner',-11,'course_redeem','course_month','x','2026-08-17','no',3)`).run());
    database.prepare(`INSERT INTO smartlingo_course_credit_ledger
      (id,user_id,points,entry_type,source_type,source_id,local_date,note,created_at)
      VALUES('spend-all','card-learner',-10,'course_redeem','course_month','ok','2026-08-17','yes',3)`).run();
    assert.equal(database.prepare("SELECT SUM(points) AS balance FROM smartlingo_course_credit_ledger WHERE user_id='card-learner'").get().balance, 0);
    database.prepare(`INSERT INTO smartlingo_smartcard_game_runs
      (id,guest_key_hash,deck_id,deck_version,game_mode,score,correct_count,question_count,pronunciation_passes,answer_fingerprint,local_date,claim_status,claimed_user_id,claimed_at,created_at,updated_at)
      VALUES('game-1','guest-1','starter_en',1,'practice',250,12,12,6,'game-proof','2026-08-17','claimed','card-learner',4,4,4)`).run();
    database.prepare(`INSERT INTO smartlingo_course_credit_ledger
      (id,user_id,points,entry_type,source_type,source_id,local_date,note,created_at)
      VALUES('game-credit','card-learner',250,'smartcard_game_earn','smartcard_game','game-1','2026-08-17','game',4)`).run();
    assert.throws(() => database.prepare(`INSERT INTO smartlingo_course_credit_ledger
      (id,user_id,points,entry_type,source_type,source_id,local_date,note,created_at)
      VALUES('fake-game-credit','card-learner',251,'smartcard_game_earn','smartcard_game','game-1','2026-08-17','fake',5)`).run());
    database.prepare(`INSERT INTO smartlingo_smartcard_game_runs
      (id,guest_key_hash,deck_id,deck_version,game_mode,score,correct_count,question_count,pronunciation_passes,answer_fingerprint,local_date,claim_status,claimed_user_id,claimed_at,created_at,updated_at,leader_bonus_basis_points)
      VALUES('daily-winner','guest-2','starter_en',1,'challenge',90,11,12,0,'timed-proof','2026-08-17','claimed','card-learner',5,5,5,1000)`).run();
    assert.throws(() => database.prepare(`INSERT INTO smartlingo_course_credit_ledger
      (id,user_id,points,entry_type,source_type,source_id,local_date,note,created_at)
      VALUES('early-challenge-credit','card-learner',90,'smartcard_game_earn','smartcard_game','daily-winner','2026-08-17','not settled',5)`).run());
    database.prepare(`INSERT INTO smartlingo_smartcard_daily_settlements
      (id,target_language,local_date,winner_run_id,winner_user_id,winning_score,reward_points,settled_at)
      VALUES('settlement-en','en','2026-08-17','daily-winner','card-learner',90,99,6)`).run();
    database.prepare(`INSERT INTO smartlingo_course_credit_ledger
      (id,user_id,points,entry_type,source_type,source_id,local_date,note,created_at)
      VALUES('winner-credit','card-learner',99,'smartcard_winner_earn','smartcard_daily_winner','settlement-en','2026-08-17','winner',6)`).run();
    assert.throws(() => database.prepare(`INSERT INTO smartlingo_course_credit_ledger
      (id,user_id,points,entry_type,source_type,source_id,local_date,note,created_at)
      VALUES('fake-winner-credit','card-learner',100,'smartcard_winner_earn','smartcard_daily_winner','settlement-en','2026-08-17','fake',7)`).run());
    assert.equal(database.prepare("SELECT SUM(points) AS balance FROM smartlingo_course_credit_ledger WHERE user_id='card-learner'").get().balance, 349);
  } finally { database.close(); }
});
