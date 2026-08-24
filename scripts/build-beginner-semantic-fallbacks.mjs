import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const plan = JSON.parse(readFileSync(new URL("../media-source/beginner-visual-concept-plan.json", import.meta.url), "utf8"));
const concepts = plan.concepts.slice(plan.selectedAiConcepts);
const outputDirectory = new URL("../public/images/smartcards/", import.meta.url);
mkdirSync(outputDirectory, { recursive: true });

function hash(value) {
  let result = 2166136261;
  for (const character of value) result = Math.imul(result ^ character.codePointAt(0), 16777619);
  return result >>> 0;
}

function category(label) {
  if (/\b(?:food|eat|drink|meal|fruit|vegetable|meat|bread|rice|cake|tea|coffee|cook|taste|hungry|breakfast|lunch|dinner)\b/.test(label)) return "food";
  if (/\b(?:animal|dog|cat|bird|fish|horse|cow|bear|lion|mouse|insect)\b/.test(label)) return "animal";
  if (/\b(?:car|bus|train|plane|ship|bicycle|transport|travel|drive|road|station)\b/.test(label)) return "transport";
  if (/\b(?:doctor|hospital|health|medicine|ill|disease|pain|body|arm|leg|hand|head|eye|ear|mouth|heart)\b/.test(label)) return "health";
  if (/\b(?:school|student|teacher|learn|study|book|read|write|course|lesson|education|knowledge)\b/.test(label)) return "education";
  if (/\b(?:money|cash|price|cost|pay|buy|sell|bank|market|business|trade)\b/.test(label)) return "money";
  if (/\b(?:time|day|week|month|year|hour|minute|morning|evening|night|early|late|before|after|anniversary|century|period|moment|future|past)\b/.test(label)) return "time";
  if (/\b(?:say|speak|talk|ask|answer|word|language|message|call|news|voice|communication)\b/.test(label)) return "communication";
  if (/\b(?:happy|sad|angry|fear|love|hope|feel|emotion|smile|cry|sorry|kind|beautiful)\b/.test(label)) return "emotion";
  if (/\b(?:house|home|building|room|school|office|hotel|city|village|country|place|site|area|region|nation|state|province|district|territory)\b/.test(label)) return "place";
  if (/\b(?:sun|moon|sky|sea|river|mountain|tree|flower|forest|nature|rain|snow|wind|earth|fire|water)\b/.test(label)) return "nature";
  if (/\b(?:person|people|man|woman|boy|girl|child|family|friend|mother|father|sister|brother|human)\b/.test(label)) return "people";
  if (/\b(?:go|come|run|walk|move|give|take|make|open|close|start|stop|enter|leave|carry|raise|fall|turn|follow)\b/.test(label)) return "action";
  if (/\b(?:number|many|few|more|less|all|none|half|percent|amount|quantity|level|rank|first|second|third)\b/.test(label)) return "quantity";
  return "concept";
}

function icon(kind, hue, variant) {
  const dark = `hsl(${hue} 58% 28%)`;
  const main = `hsl(${hue} 72% 52%)`;
  const accent = `hsl(${(hue + 48) % 360} 82% 56%)`;
  const pale = `hsl(${hue} 75% 93%)`;
  const common = `stroke="${dark}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"`;
  const conceptTemplates = [
    `<circle cx="50" cy="49" r="29" fill="${pale}" ${common}/><circle cx="50" cy="49" r="12" fill="${accent}" ${common}/><path d="M50 12v10m0 54v10M13 49h10m54 0h10M24 23l8 8m36 36 8 8m0-52-8 8M32 67l-8 8" fill="none" ${common}/>`,
    `<path d="M35 64q-13-9-13-25a28 28 0 0 1 56 0q0 16-13 25l-4 18H39Z" fill="${accent}" ${common}/><path d="M39 69h22M39 77h22M50 11v-7M17 19l-6-6m72 6 6-6" fill="none" ${common}/>`,
    `<path d="M50 18v61M24 30h52M20 72h60M31 30 18 56h26Zm38 0L56 56h26Z" fill="${pale}" ${common}/><circle cx="50" cy="16" r="7" fill="${accent}" ${common}/>`,
    `<circle cx="50" cy="50" r="34" fill="${pale}" ${common}/><circle cx="50" cy="50" r="23" fill="${main}" ${common}/><circle cx="50" cy="50" r="11" fill="${accent}" ${common}/><path d="m77 23 11-11m-12 1 12-1-1 12" fill="none" ${common}/>`,
    `<path d="M50 13 79 24v23q0 24-29 39Q21 71 21 47V24Z" fill="${main}" ${common}/><path d="m34 50 10 10 23-25" fill="none" stroke="white" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`,
    `<circle cx="22" cy="50" r="10" fill="${accent}" ${common}/><circle cx="78" cy="25" r="10" fill="${main}" ${common}/><circle cx="78" cy="75" r="10" fill="${main}" ${common}/><path d="M32 50h17m0 0 19-22M49 50l19 22" fill="none" ${common}/>`,
    `<path d="m50 12 10 22 24 3-18 17 5 24-21-12-21 12 5-24-18-17 24-3Z" fill="${accent}" ${common}/><path d="M16 19c19-11 47-11 68 0M16 81c19 11 47 11 68 0" fill="none" ${common}/>`,
    `<circle cx="50" cy="22" r="12" fill="${accent}" ${common}/><circle cx="24" cy="72" r="12" fill="${main}" ${common}/><circle cx="76" cy="72" r="12" fill="${main}" ${common}/><path d="m44 33-14 27m26-27 14 27M36 72h28" fill="none" ${common}/>`
  ];
  const templates = {
    people: `<circle cx="50" cy="31" r="13" fill="${accent}" ${common}/><path d="M27 78c2-22 11-32 23-32s21 10 23 32" fill="${main}" ${common}/><circle cx="26" cy="47" r="8" fill="${pale}" ${common}/><circle cx="74" cy="47" r="8" fill="${pale}" ${common}/>`,
    action: `<circle cx="27" cy="31" r="9" fill="${accent}" ${common}/><path d="M27 42v24m0-14 14 8M27 51 15 62m12 4-10 15m10-15 13 14" fill="none" ${common}/><path d="M48 35h34m-12-10 12 10-12 10" fill="none" ${common}/>`,
    place: `<path d="M17 45 50 19l33 26v38H17Z" fill="${pale}" ${common}/><path d="M41 83V57h18v26M27 50h10v11H27m36-11h10v11H63" fill="${accent}" ${common}/>`,
    nature: `<circle cx="75" cy="25" r="10" fill="${accent}" ${common}/><path d="M8 78 34 41l17 22 12-14 29 29Z" fill="${main}" ${common}/><path d="M34 41 45 56l6 7" fill="none" stroke="white" stroke-width="4"/>`,
    food: `<ellipse cx="52" cy="61" rx="30" ry="18" fill="${pale}" ${common}/><ellipse cx="52" cy="57" rx="20" ry="10" fill="${accent}" ${common}/><path d="M15 25v56m-6-56v18m12-18v18m66-18v56" fill="none" ${common}/>`,
    animal: `<ellipse cx="50" cy="55" rx="27" ry="23" fill="${main}" ${common}/><circle cx="39" cy="51" r="3" fill="${dark}"/><circle cx="61" cy="51" r="3" fill="${dark}"/><path d="m33 31-11-12 2 25m43-13 11-12-2 25M42 64q8 7 16 0" fill="${accent}" ${common}/>`,
    transport: `<path d="m17 58 10-22h45l12 22v18H17Z" fill="${main}" ${common}/><path d="M33 40h32l7 17H26Z" fill="${pale}" ${common}/><circle cx="31" cy="76" r="8" fill="${dark}"/><circle cx="70" cy="76" r="8" fill="${dark}"/>`,
    health: `<path d="M39 17h22v22h22v22H61v22H39V61H17V39h22Z" fill="${accent}" ${common}/><path d="M25 50h13l7-12 10 27 8-15h14" fill="none" stroke="white" stroke-width="4"/>`,
    education: `<path d="M13 28q20-9 37 5v50q-17-14-37-5Zm74 0q-20-9-37 5v50q17-14 37-5Z" fill="${pale}" ${common}/><path d="M50 33v50m-27-40h17m-17 12h17m20-12h17m-17 12h17" fill="none" ${common}/>`,
    money: `<circle cx="50" cy="50" r="31" fill="${accent}" ${common}/><path d="M61 35q-7-8-18-3-9 4-2 12l18 8q8 7-1 14-12 8-22-3M50 24v52" fill="none" ${common}/>`,
    time: `<circle cx="50" cy="51" r="32" fill="${pale}" ${common}/><path d="M50 51V31m0 20 17 10" fill="none" ${common}/><circle cx="50" cy="51" r="3" fill="${dark}"/>`,
    communication: `<path d="M12 22h55v39H36L22 75V61H12Z" fill="${pale}" ${common}/><path d="M41 49h47v31H62L50 89v-9h-9Z" fill="${accent}" ${common}/><circle cx="28" cy="42" r="3" fill="${dark}"/><circle cx="40" cy="42" r="3" fill="${dark}"/><circle cx="52" cy="42" r="3" fill="${dark}"/>`,
    emotion: `<circle cx="50" cy="51" r="33" fill="${accent}" ${common}/><circle cx="38" cy="43" r="4" fill="${dark}"/><circle cx="62" cy="43" r="4" fill="${dark}"/><path d="M33 61q17 18 34 0" fill="none" ${common}/>`,
    quantity: `<rect x="17" y="55" width="14" height="27" rx="4" fill="${main}" ${common}/><rect x="43" y="39" width="14" height="43" rx="4" fill="${accent}" ${common}/><rect x="69" y="22" width="14" height="60" rx="4" fill="${main}" ${common}/><path d="m14 28 18-12 18 8 24-14" fill="none" ${common}/>`,
    concept: conceptTemplates[variant % conceptTemplates.length]
  };
  return templates[kind] || templates.concept;
}

const sheetSize = plan.sheetSize;
for (let offset = 0; offset < concepts.length; offset += sheetSize) {
  const batch = concepts.slice(offset, offset + sheetSize);
  const cells = batch.map((concept, cellIndex) => {
    const x = (cellIndex % 6) * 100;
    const y = Math.floor(cellIndex / 6) * 100;
    const hue = hash(concept.key) % 360;
    const kind = category(concept.label);
    return `<g transform="translate(${x} ${y})"><rect x="2" y="2" width="96" height="96" rx="12" fill="hsl(${hue} 75% 96%)" stroke="hsl(${hue} 45% 84%)" stroke-width="2"/>${icon(kind, hue, hash(concept.label))}</g>`;
  }).join("");
  const number = String(Math.floor(offset / sheetSize) + 1).padStart(3, "0");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600" role="img" aria-label="SmartLingo beginner semantic picture sprite"><rect width="600" height="600" fill="#f8fbff"/>${cells}</svg>\n`;
  writeFileSync(new URL(`beginner-semantic-fallback-sprite-${number}-2026-08-23.svg`, outputDirectory), svg);
}

console.log(JSON.stringify({ concepts: concepts.length, sheets: Math.ceil(concepts.length / sheetSize) }));
