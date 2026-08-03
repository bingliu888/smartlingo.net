"use client";

import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import { useReverification, useUser } from "@clerk/nextjs";
import { FormEvent, useState } from "react";
import styles from "./password-settings.module.css";

function readableError(issue: unknown, zh: boolean) {
  if (isClerkAPIResponseError(issue)) {
    const error = issue.errors[0];
    if (error?.code === "form_password_incorrect") return zh ? "当前密码不正确。" : "Your current password is incorrect.";
    if (error?.code === "form_password_pwned") return zh ? "该密码曾出现在数据泄露中，请换一个。" : "That password appeared in a data breach. Choose another.";
    return zh ? "无法保存密码，请重试。" : error?.longMessage || error?.message || "Could not save your password. Please try again.";
  }
  if (issue instanceof Error) return zh && !/[\u3400-\u9fff]/.test(issue.message) ? "无法保存密码，请重试。" : issue.message;
  return zh ? "无法保存密码，请重试。" : "Could not save your password. Please try again.";
}

export function PasswordSettings({ lang }: { lang: "en" | "zh" }) {
  const zh = lang === "zh";
  const { isLoaded, user } = useUser();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const passwordEnabled = Boolean(user?.passwordEnabled);
  const changePassword = useReverification(async (value: string) => {
    if (!user) throw new Error(zh ? "账户尚未载入。" : "Your account is not ready.");
    await user.updatePassword({ newPassword: value, signOutOfOtherSessions: false });
    await user.reload();
  });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setSuccess("");
    if (newPassword.length < 8) return setError(zh ? "新密码至少需要 8 个字符。" : "Your new password must be at least 8 characters.");
    if (newPassword !== confirmPassword) return setError(zh ? "两次输入的新密码不一致。" : "The new passwords do not match.");
    setBusy(true);
    try {
      await changePassword(newPassword);
      setNewPassword(""); setConfirmPassword("");
      setSuccess(zh ? "密码已保存。以后可使用密码或邮箱验证码登录。" : "Password saved. You can sign in with a password or an email code.");
    } catch (issue) { setError(readableError(issue, zh)); } finally { setBusy(false); }
  }

  return <div className={styles.wrap}>
    <p className={styles.kicker}>{zh ? "账户安全" : "ACCOUNT SECURITY"}</p>
    <h2>{passwordEnabled ? (zh ? "更新密码" : "Update password") : (zh ? "设置密码" : "Set password")}</h2>
    <p>{passwordEnabled ? (zh ? "近期邮箱验证码验证仍有效时，无需输入旧密码；若已过期，系统会安全地要求再次验证。" : "A recent email-code verification lets you update without the old password. If it has expired, you will be asked to verify again.") : (zh ? "为现有账户添加密码；以后密码和邮箱验证码都可以登录。" : "Add a password to your account; both password and email-code sign-in will work.")}</p>
    {!isLoaded ? <p className={styles.notice}>{zh ? "正在读取账户…" : "Loading account…"}</p> : <form className={styles.form} onSubmit={submit}>
      <label>{zh ? "新密码" : "New password"}<input type="password" autoComplete="new-password" minLength={8} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /><small>{zh ? "至少 8 个字符，请勿使用已泄露的密码。" : "At least 8 characters. Avoid passwords exposed in data breaches."}</small></label>
      <label>{zh ? "确认新密码" : "Confirm new password"}<input type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
      {error && <p className={styles.error} role="alert">{error}</p>}{success && <p className={styles.success} role="status">{success}</p>}
      <button disabled={busy}>{busy ? (zh ? "正在保存…" : "Saving…") : passwordEnabled ? (zh ? "更新密码" : "Update password") : (zh ? "设置密码" : "Set password")}</button>
    </form>}
  </div>;
}
