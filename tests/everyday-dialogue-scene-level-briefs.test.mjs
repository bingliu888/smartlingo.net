import assert from "node:assert/strict";
import test from "node:test";
import {
  SMARTLINGO_EVERYDAY_DIALOGUE_BRIEFS,
  SMARTLINGO_EVERYDAY_SCENE_LEVEL_BRIEFS,
} from "../lib/smartlingo-everyday-dialogues.ts";

const scenes = ["cafe", "grocery", "transit"];
const levels = ["intermediate", "advanced"];

test("cafe, grocery, and transit have ten complete, distinct bilingual exchanges at each higher level", () => {
  assert.deepEqual(Object.keys(SMARTLINGO_EVERYDAY_SCENE_LEVEL_BRIEFS).sort(), Object.keys(SMARTLINGO_EVERYDAY_DIALOGUE_BRIEFS).sort());
  for (const scene of scenes) {
    assert.equal(SMARTLINGO_EVERYDAY_DIALOGUE_BRIEFS[scene].length, 10, `${scene} beginner is retained`);
    assert.deepEqual(Object.keys(SMARTLINGO_EVERYDAY_SCENE_LEVEL_BRIEFS[scene]).sort(), [...levels].sort());
    const beginnerQuestions = new Set(SMARTLINGO_EVERYDAY_DIALOGUE_BRIEFS[scene].map(pair => pair[0]));
    const higherLevelQuestions = [];
    for (const level of levels) {
      const pairs = SMARTLINGO_EVERYDAY_SCENE_LEVEL_BRIEFS[scene][level];
      assert.equal(pairs.length, 10, `${scene}/${level}`);
      for (const [index, pair] of pairs.entries()) {
        assert.equal(pair.length, 4, `${scene}/${level}/${index}`);
        for (const line of pair) assert.ok(line.trim().length >= 4, `${scene}/${level}/${index} has complete text`);
        assert.ok(!beginnerQuestions.has(pair[0]), `${scene}/${level}/${index} is not a repeated beginner prompt`);
        higherLevelQuestions.push(pair[0]);
      }
    }
    assert.equal(new Set(higherLevelQuestions).size, 20, `${scene} higher-level prompts do not repeat`);
  }
});

test("cafe levels teach ordering with substitutions and then correcting an actual order", () => {
  const { intermediate, advanced } = SMARTLINGO_EVERYDAY_SCENE_LEVEL_BRIEFS.cafe;
  assert.match(intermediate[0][1], /iced coffee with oat milk/);
  assert.match(intermediate[1][0], /out of oat milk/);
  assert.match(intermediate[8][0], /iced coffee with soy milk/);
  assert.match(intermediate[8][3], /香草糖浆/);
  assert.match(advanced[0][0], /made your coffee hot by mistake/);
  assert.match(advanced[1][1], /nut allergy/);
  assert.match(advanced[6][1], /refund the overcharge/);
  assert.match(advanced[9][3], /核对退款/);
});

test("grocery levels teach a purchase and then resolve stock, weight, and checkout discrepancies", () => {
  const { intermediate, advanced } = SMARTLINGO_EVERYDAY_SCENE_LEVEL_BRIEFS.grocery;
  assert.match(intermediate[0][1], /eggs/);
  assert.match(intermediate[3][1], /Half a kilogram of chicken/);
  assert.match(intermediate[9][3], /核对.*折扣/);
  assert.match(advanced[0][1], /price per egg/);
  assert.match(advanced[5][0], /register shows full price/);
  assert.match(advanced[8][1], /charge my card only once/);
  assert.match(advanced[9][3], /核对价格/);
});

test("transit levels teach a timed transfer and then recover from a canceled train", () => {
  const { intermediate, advanced } = SMARTLINGO_EVERYDAY_SCENE_LEVEL_BRIEFS.transit;
  assert.match(intermediate[0][1], /Central Station before five/);
  assert.match(intermediate[2][1], /change trains/);
  assert.match(intermediate[8][0], /platform four/);
  assert.match(advanced[0][0], /train.*canceled/);
  assert.match(advanced[3][1], /accessible direct bus/);
  assert.match(advanced[6][1], /refund/);
  assert.match(advanced[9][3], /公交票、退款确认和站台号/);
});
