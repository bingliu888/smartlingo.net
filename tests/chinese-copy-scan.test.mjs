import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const forbidden = /\b(?:Dashboard|Project|Community|Live Chat|Ask Guru|Guru|SmartFi|MVP|FAQ|UI|Worker|Member|Message|Messages|News|Events|Profile|Plan|Pricing|Sign in|AIGC|AI|Home|Shop|Status|Build|Version|Launch|Daily|Schedule|Deployments|Roadmap|Task|Milestone|Report|Loading|Error|Open|Closed|Submit|Save|Cancel|Search|Settings|Account|Password|Welcome|Start|Join|Learn more|View|Manage)\b/i;
async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(async entry => { const file = path.join(directory, entry.name); return entry.isDirectory() ? filesIn(file) : /\.(?:ts|tsx)$/.test(entry.name) ? [file] : []; }))).flat();
}
function nameOf(node) { return node && (ts.isIdentifier(node) || ts.isStringLiteral(node)) ? node.text : ""; }
function branchOf(node) {
  while (ts.isParenthesizedExpression(node)) node = node.expression;
  if (ts.isIdentifier(node) && ["zh", "label", "isChinese"].includes(node.text)) return "true";
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.ExclamationToken) { const branch = branchOf(node.operand); return branch === "true" ? "false" : branch === "false" ? "true" : ""; }
  if (!ts.isBinaryExpression(node)) return "";
  const expression = `${node.left.getText()} ${node.right.getText()}`;
  if (!/(?:lang|language)/i.test(expression) || !/["']zh["']/.test(expression)) return "";
  if ([ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken].includes(node.operatorToken.kind)) return "true";
  if ([ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken].includes(node.operatorToken.kind)) return "false";
  return "";
}
function strings(node, source, file, output) {
  if (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) { output.push({ file, line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1, text: node.text }); return; }
  if (ts.isTemplateExpression(node)) output.push({ file, line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1, text: `${node.head.text}${node.templateSpans.map(span => span.literal.text).join("")}` });
  if (ts.isConditionalExpression(node)) { strings(node.whenTrue, source, file, output); strings(node.whenFalse, source, file, output); return; }
  ts.forEachChild(node, child => strings(child, source, file, output));
}
async function chineseCopy() {
  const roots = ["app", "components", "lib"].map(value => path.join(root, value));
  const files = (await Promise.all(roots.map(filesIn))).flat().filter(file => !file.includes(`${path.sep}app${path.sep}api${path.sep}`));
  const output = [];
  for (const file of files) {
    const text = await readFile(file, "utf8");
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const visit = node => {
      if (ts.isPropertyAssignment(node) && /(?:^zh$|Zh$|^zh[A-Z_]|_zh$)/.test(nameOf(node.name))) strings(node.initializer, source, file, output);
      if (ts.isJsxAttribute(node) && nameOf(node.name) === "data-zh" && node.initializer) strings(node.initializer, source, file, output);
      if (ts.isConditionalExpression(node)) { const branch = branchOf(node.condition); if (branch === "true") strings(node.whenTrue, source, file, output); if (branch === "false") strings(node.whenFalse, source, file, output); }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return output;
}
test("Chinese-mode strings across app, components and lib avoid generic English UI labels", async () => {
  const copy = await chineseCopy();
  assert.ok(copy.length > 200, `expected broad Chinese-copy coverage, found ${copy.length}`);
  const failures = copy.filter(item => forbidden.test(item.text));
  assert.deepEqual(failures, [], failures.map(item => `${path.relative(root, item.file)}:${item.line}: ${item.text}`).join("\n"));
});
