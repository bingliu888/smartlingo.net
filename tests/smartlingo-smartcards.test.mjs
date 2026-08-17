import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { buildSmartCardChallenge, gradeSmartCardChallenge } from "../lib/smartlingo-smartcards.ts";
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

test("public challenge and redemption routes keep scores and balances server-authoritative", () => {
  const publicRoute = readFileSync(new URL("../app/api/smartcards/[token]/route.ts", import.meta.url), "utf8");
  const redemptionRoute = readFileSync(new URL("../app/api/billing/credits/redeem/route.ts", import.meta.url), "utf8");
  assert.match(publicRoute, /gradeSmartCardChallenge/);
  assert.doesNotMatch(publicRoute, /body\.(?:score|points|rewardPoints|balancePoints)/);
  assert.match(publicRoute, /HttpOnly; Secure; SameSite=Lax/);
  assert.match(redemptionRoute, /COALESCE\(SUM\(points\),0\)/);
  assert.match(redemptionRoute, /-value\.course\.priceCents/);
  assert.match(redemptionRoute, /provider_subscription_id[^]*credit:/);
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
  } finally { database.close(); }
});
