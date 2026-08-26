"use client";

import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import { useUser } from "@clerk/nextjs";
import { FormEvent, useState } from "react";
import { interfaceText, type InterfaceLanguage } from "../lib/interface-locale";
import { passwordSettingsMode } from "../lib/password-settings-mode";
import { PasswordInput } from "./PasswordInput";
import styles from "./password-settings.module.css";

type Translator = (english: string, chinese: string) => string;

function readableError(issue: unknown, lang: InterfaceLanguage, t: Translator) {
  if (isClerkAPIResponseError(issue)) {
    const error = issue.errors[0];
    if (error?.code === "form_password_incorrect") return t("Your current password is incorrect.", "当前密码不正确。");
    if (error?.code === "form_password_pwned") return t(
      "Password updating is working, but the new password appears in a known data breach. Use a unique random password that you have never used elsewhere (12 or more characters recommended).",
      "密码更新功能正常，但你输入的新密码已出现在已知数据泄露名单中。请使用从未在其他网站使用过的随机强密码（建议至少 12 个字符）。",
    );
    return lang === "en"
      ? error?.longMessage || error?.message || "Could not save your password. Please try again."
      : t("Could not save your password. Please try again.", "无法保存密码，请重试。");
  }
  if (issue instanceof Error && lang === "en") return issue.message;
  return t("Could not save your password. Please try again.", "无法保存密码，请重试。");
}

export function PasswordSettings({ lang }: { lang: InterfaceLanguage }) {
  const t = (english: string, chinese: string) => interfaceText(lang, english, chinese);
  const { isLoaded, user } = useUser();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const passwordEnabled = Boolean(user?.passwordEnabled);
  const mode = passwordSettingsMode(passwordEnabled);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setSuccess("");
    if (!user) return setError(t("Your account is not ready.", "账户尚未载入。"));
    if (mode.requiresCurrentPassword && !currentPassword) return setError(t("Enter your current password.", "请输入当前密码。"));
    if (newPassword.length < 8) return setError(t("Your new password must be at least 8 characters.", "新密码至少需要 8 个字符。"));
    if (newPassword !== confirmPassword) return setError(t("The new passwords do not match.", "两次输入的新密码不一致。"));
    setBusy(true);
    try {
      await user.updatePassword({ currentPassword: mode.requiresCurrentPassword ? currentPassword : undefined, newPassword, signOutOfOtherSessions: false });
      await user.reload();
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      setSuccess(t("Password saved. You can sign in with a password or an email code.", "密码已保存。以后可使用密码或邮箱验证码登录。"));
    } catch (issue) { setError(readableError(issue, lang, t)); } finally { setBusy(false); }
  }

  return <div className={styles.wrap}>
    <p className={styles.kicker}>{t("ACCOUNT SECURITY", "账户安全")}</p>
    <h2>{mode.action === "update" ? t("Update password", "更新密码") : t("Add password", "添加密码")}</h2>
    <p>{mode.action === "update" ? t("Confirm with your current password. No additional email code is required.", "输入当前密码即可更改，不会再次要求邮箱验证码。") : t("Add a password from this signed-in session without another email code; both sign-in methods will remain available.", "从当前已登录会话添加密码，不会再次要求邮箱验证码；添加后密码和邮箱验证码都可以登录。")}</p>
    {!isLoaded ? <p className={styles.notice}>{t("Loading account…", "正在读取账户…")}</p> : <form className={styles.form} onSubmit={submit}>
      {mode.requiresCurrentPassword && <PasswordInput lang={lang} label={t("Current password", "当前密码")} autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />}
      <PasswordInput lang={lang} label={t("New password", "新密码")} autoComplete="new-password" minLength={8} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} hint={t("At least 8 characters; use a unique random password of 12 or more characters when possible.", "至少 8 个字符；建议使用 12 个以上、从未在其他网站使用过的随机强密码。")} />
      <PasswordInput lang={lang} label={t("Confirm new password", "确认新密码")} autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
      {error && <p className={styles.error} role="alert">{error}</p>}{success && <p className={styles.success} role="status">{success}</p>}
      <button disabled={busy}>{busy ? t("Saving…", "正在保存…") : mode.action === "update" ? t("Update password", "更新密码") : t("Add password", "添加密码")}</button>
    </form>}
  </div>;
}
