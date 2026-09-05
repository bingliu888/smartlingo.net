import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("primary public and signed-in surfaces use the shared SiteHeader", async () => {
  const files = await Promise.all([
    read("../app/[lang]/page.tsx"),
    read("../app/[lang]/dashboard/page.tsx"),
    read("../app/[lang]/account/page.tsx"),
    read("../app/[lang]/members/page.tsx"),
    read("../app/[lang]/messages/page.tsx"),
    read("../app/[lang]/messages/live/[threadId]/page.tsx"),
    read("../app/[lang]/assistant/page.tsx"),
    read("../app/[lang]/community/page.tsx"),
    read("../components/EditorialPage.tsx"),
    read("../app/[lang]/about/page.tsx"),
    read("../app/[lang]/privacy/page.tsx"),
    read("../app/[lang]/terms/page.tsx"),
    read("../app/[lang]/refund-policy/page.tsx"),
    read("../components/ProjectDashboard.tsx"),
  ]);
  for (const source of files) assert.match(source, /<SiteHeader lang=\{(?:lang|locale)(?: as any)?\}\s*\/>/);
});

test("shared footer links to the bilingual public Project progress and history", async () => {
  const footer = await read("../components/SiteFooter.tsx");
  assert.match(footer, /href=\{`\/\$\{lang\}\/project`\}/);
  assert.match(footer, /\{t\.project\}/);
});

test("compose and reply both provide the exact bilingual Guru polish action", async () => {
  const center = await read("../components/MessageCenter.tsx");
  assert.equal((center.match(/"Polish with Guru"/g) ?? []).length, 2);
  assert.equal((center.match(/"请智能导师润色"/g) ?? []).length, 2);
  assert.match(center, /async function improve\(\)/);
  assert.match(center, /fetch\("\/api\/assistant"/);
  assert.match(center, /setDraft\(result\.reply\)/);
});

test("email code state shows the destination and switches localized actions", async () => {
  const [form, requirements] = await Promise.all([
    read("../components/ClerkAuthForm.tsx"),
    read("../lib/clerk-auth-requirements.ts"),
  ]);
  assert.match(requirements, /Code sent to \$\{identifier\}/);
  assert.match(requirements, /验证码已发送至 \$\{identifier\}/);
  assert.match(
    form,
    /needs_second_factor[\s\S]*?prepareSecondFactor[\s\S]*?A new security code was sent to \{identifier\}[\s\S]*?replace\("\{identifier\}", identifier\)/,
  );
  assert.match(
    form,
    /needs_second_factor[\s\S]*?prepareSecondFactor[\s\S]*?新的安全码已发送至 \{identifier\}/,
  );
  assert.match(requirements, /step === "code"[\s\S]*?"验证并继续" : "Verify & continue"/);
  assert.match(requirements, /step === "code" \|\| step === "recovery-email"[\s\S]*?"更换邮箱" : "Use another email"/);
  assert.match(form, /clerkAuthStepView\(step, method, baseLang\)/);
  assert.match(form, /t\("Verify & continue", "验证并继续"\)/);
  assert.match(form, /t\("Use another email", "更换邮箱"\)/);
  assert.match(form, /authView\.primaryAction/);
  assert.match(form, /authView\.secondaryAction/);
});

test("icon-only message controls and the reply editor use localized accessible names", async () => {
  const center = await read("../components/MessageCenter.tsx");
  assert.equal((center.match(/aria-label=\{t\("Back to messages", "返回消息列表"\)\}/g) ?? []).length, 2);
  assert.match(center, /className="thread-delete"[\s\S]*?aria-label=\{t\("Delete conversation", "删除会话"\)\}/);
  assert.match(center, /aria-label=\{t\("Delete message", "删除消息"\)\}/);
  assert.match(center, /aria-label=\{t\("Reply message", "回复消息"\)\}/);
});
