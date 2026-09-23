import assert from "node:assert/strict";
import test from "node:test";
import {
  SMARTLINGO_EVERYDAY_DIALOGUE_BRIEFS,
  SMARTLINGO_EVERYDAY_SCENE_LEVEL_BRIEFS,
  prebuiltEverydayDialogueLines,
} from "../lib/smartlingo-everyday-dialogues.ts";
import { SMARTLINGO_EVERYDAY_SCENARIOS } from "../lib/smartlingo-everyday-speaking.ts";

const levelNames = ["intermediate", "advanced"];
const sceneGoals = {
  airport: { intermediate: [/passport|booking/, /行李|登机/], advanced: [/canceled|connection|rebook/, /取消|改签|转机/] },
  hotel: { intermediate: [/reservation|room|breakfast/, /预订|房间|早餐/], advanced: [/room|booking|key/, /房间|房卡|预订/] },
  restaurant: { intermediate: [/menu|kitchen|dish/, /菜单|厨房|餐点/], advanced: [/sauce|allergen|bill/, /酱汁|过敏|账单/] },
  hospital: { intermediate: [/appointment|clinician|symptoms/, /预约|医护|症状/], advanced: [/record|allergy|interpreter/, /病历|过敏|翻译/] },
  school: { intermediate: [/course|class|homework/, /课程|课|作业/], advanced: [/timetable|section|transfer/, /课程表|班次|转班/] },
  library: { intermediate: [/book|library card|due date/, /书|借书证|归还/], advanced: [/edition|loan|hold/, /版本|借阅|预约/] },
  pharmacy: { intermediate: [/pharmacist|medicine|label/, /药剂师|药|标签/], advanced: [/substitute|pharmacist|prescriber/, /替代|药剂师|开药医生/] },
  bank: { intermediate: [/account|deposit|card/, /账户|存款|借记卡/], advanced: [/charge|dispute|card/, /交易|争议|卡/] },
  police: { intermediate: [/phone|bus|report/, /手机|公交|报告/], advanced: [/missing|stolen|report/, /不见|被盗|报告/] },
  cafe: { intermediate: [/coffee|milk|sandwich/, /咖啡|奶|三明治/], advanced: [/coffee|refund|receipt/, /咖啡|退款|收据/] },
  grocery: { intermediate: [/eggs|chicken|vegetable/, /鸡蛋|鸡肉|蔬菜/], advanced: [/eggs|price|coupon/, /鸡蛋|价格|优惠券/] },
  transit: { intermediate: [/station|train|platform/, /车站|列车|站台/], advanced: [/canceled|bus|refund/, /取消|公交|退款/] },
};

test("all twelve places have ten distinct, complete source exchanges for each level", () => {
  const ids = SMARTLINGO_EVERYDAY_SCENARIOS.map(scene => scene.id).sort();
  assert.equal(ids.length, 12);
  assert.deepEqual(Object.keys(SMARTLINGO_EVERYDAY_SCENE_LEVEL_BRIEFS).sort(), ids);
  assert.deepEqual(Object.keys(sceneGoals).sort(), ids);
  for (const sceneId of ids) {
    const beginner = SMARTLINGO_EVERYDAY_DIALOGUE_BRIEFS[sceneId];
    assert.equal(beginner?.length, 10, `${sceneId} beginner`);
    const previousQuestions = new Set(beginner.map(pair => pair[0]));
    for (const level of levelNames) {
      const pairs = SMARTLINGO_EVERYDAY_SCENE_LEVEL_BRIEFS[sceneId][level];
      assert.equal(pairs.length, 10, `${sceneId}/${level}`);
      for (const [index, pair] of pairs.entries()) {
        assert.equal(pair.length, 4, `${sceneId}/${level}/${index} bilingual question and answer`);
        for (const text of pair) assert.ok(text.trim().length >= 4, `${sceneId}/${level}/${index} has meaningful text`);
        assert.ok(!previousQuestions.has(pair[0]), `${sceneId}/${level}/${index} repeats an easier prompt`);
        previousQuestions.add(pair[0]);
      }
      const english = pairs.flatMap(pair => pair.slice(0, 2)).join(" ");
      const chinese = pairs.flatMap(pair => pair.slice(2)).join(" ");
      assert.match(english, sceneGoals[sceneId][level][0], `${sceneId}/${level} has a place-specific English goal`);
      assert.match(chinese, sceneGoals[sceneId][level][1], `${sceneId}/${level} has the same Chinese goal`);
    }
  }
});

test("the actual prebuilt English and Chinese decks use each scene-specific source brief", () => {
  for (const sceneId of Object.keys(sceneGoals)) {
    for (const level of levelNames) {
      const pairs = SMARTLINGO_EVERYDAY_SCENE_LEVEL_BRIEFS[sceneId][level];
      for (const language of ["en", "zh"]) {
        const lines = prebuiltEverydayDialogueLines(sceneId, language, level);
        assert.equal(lines.length, 20, `${sceneId}/${level}/${language}`);
        for (let index = 0; index < 10; index += 1) {
          assert.equal(lines[index * 2].target, pairs[index][language === "en" ? 0 : 2]);
          assert.equal(lines[index * 2 + 1].target, pairs[index][language === "en" ? 1 : 3]);
          assert.equal(lines[index * 2].role, "staff");
          assert.equal(lines[index * 2 + 1].role, "learner");
        }
      }
    }
  }
});

test("higher-level endings resolve the initial place-specific task instead of changing topic", () => {
  const outcomes = {
    airport: [/booking reference/, /boarding passes|itinerary/],
    hotel: [/reservation|timetable|room/, /room|luggage/],
    restaurant: [/table/, /corrected bill/],
    hospital: [/appointment/, /written plan/],
    school: [/orientation/, /teacher|room|first class/],
    library: [/book/, /request|fee record/],
    pharmacy: [/headache/, /reservation details/],
    bank: [/checking account/, /disputed charge|replacement/],
    police: [/phone/, /corrected report/],
    cafe: [/iced coffee/, /refund/],
    grocery: [/eggs/, /corrected vegetable price/],
    transit: [/Central Station/, /bus ticket|refund confirmation/],
  };
  for (const [sceneId, [normalStart, recoveryEnd]] of Object.entries(outcomes)) {
    const { intermediate, advanced } = SMARTLINGO_EVERYDAY_SCENE_LEVEL_BRIEFS[sceneId];
    assert.match(intermediate[0].slice(0, 2).join(" "), normalStart, `${sceneId} normal scenario begins in place`);
    assert.match(advanced[9].slice(0, 2).join(" "), recoveryEnd, `${sceneId} recovery reaches an outcome`);
  }
});
