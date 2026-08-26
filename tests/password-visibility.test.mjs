import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function loadVisibility() {
  const source = await readFile(new URL("../lib/password-visibility.ts", import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
}

test("password visibility keeps secrets hidden by default and exposes localized toggle state", async () => {
  const { passwordVisibility } = await loadVisibility();
  const expected = {
    zh: ["显示密码", "隐藏密码"],
    en: ["Show password", "Hide password"],
    ja: ["パスワードを表示", "パスワードを隠す"],
    ko: ["비밀번호 표시", "비밀번호 숨기기"],
    es: ["Mostrar contraseña", "Ocultar contraseña"],
    fr: ["Afficher le mot de passe", "Masquer le mot de passe"],
    de: ["Passwort anzeigen", "Passwort ausblenden"],
    ru: ["Показать пароль", "Скрыть пароль"],
    it: ["Mostra password", "Nascondi password"],
    pt: ["Mostrar senha", "Ocultar senha"],
    ar: ["إظهار كلمة المرور", "إخفاء كلمة المرور"],
    hi: ["पासवर्ड दिखाएँ", "पासवर्ड छिपाएँ"],
  };
  for (const [lang, [show, hide]] of Object.entries(expected)) {
    assert.deepEqual(passwordVisibility(false, lang), { type: "password", label: show });
    assert.deepEqual(passwordVisibility(true, lang), { type: "text", label: hide });
  }
});

test("all SmartLingo account credential fields use a visibility control", async () => {
  const [auth, settings, classroom] = await Promise.all([
    readFile(new URL("../components/ClerkAuthForm.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/PasswordSettings.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/class-detail-experience.tsx", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(auth, /<input\s+type="password"/);
  assert.doesNotMatch(settings, /<input\s+type="password"/);
  assert.match(auth, /<PasswordInput/g);
  assert.match(settings, /<PasswordInput/g);
  assert.match(classroom, /class-password-toggle/);
  assert.match(classroom, /showPassword\?"text":"password"/);
});

test("password and account routes preserve all twelve current interface languages", async () => {
  const [authPage, accountPage, authForm, settings, profile] = await Promise.all([
    readFile(new URL("../app/[lang]/auth/[mode]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/[lang]/account/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/ClerkAuthForm.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/PasswordSettings.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/ProfileEditor.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(authPage, /<ClerkAuthForm lang=\{lang\}/);
  assert.match(accountPage, /<ProfileEditor[\s\S]*?lang=\{lang\}/);
  assert.match(accountPage, /<PasswordSettings lang=\{lang\}/);
  assert.match(authForm, /lang: InterfaceLanguage/);
  assert.match(settings, /lang: InterfaceLanguage/);
  assert.match(profile, /lang: InterfaceLanguage/);
  assert.doesNotMatch(accountPage, /lang=\{lang === "zh" \? "zh" : "en"\}/);
});
