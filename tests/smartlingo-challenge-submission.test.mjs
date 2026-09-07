import assert from "node:assert/strict";
import test from "node:test";
import { createChallengeSubmissionGate } from "../lib/smartlingo-challenge-submission.ts";

test("a click and stale countdown submit each challenge question only once", async () => {
  const gate = createChallengeSubmissionGate();
  const requests = [];
  let resolveAnswer;
  const response = new Promise(resolve => { resolveAnswer = resolve; });
  async function submit(question, answer) {
    if (!gate.acquire(question)) return;
    requests.push({ question, answer });
    await response;
  }
  const clicked = submit("session:0:card", "correct");
  await submit("session:0:card", ""); // deadline during the request
  resolveAnswer();
  await clicked;
  await submit("session:0:card", ""); // old deadline during six-second feedback
  assert.deepEqual(requests, [{ question: "session:0:card", answer: "correct" }]);
  await submit("session:1:next", "next-answer");
  assert.equal(requests.length, 2);
});

test("failed requests can retry without unlocking a different completed question", () => {
  const gate = createChallengeSubmissionGate();
  assert.equal(gate.acquire("completed"), true);
  assert.equal(gate.acquire("failed"), true);
  gate.retry("failed");
  assert.equal(gate.acquire("failed"), true);
  assert.equal(gate.acquire("completed"), false);
});
