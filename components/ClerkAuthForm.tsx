"use client";

import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import { useAuth } from "@clerk/nextjs";
import { useSignIn, useSignUp } from "@clerk/nextjs/legacy";
import { FormEvent, useEffect, useState } from "react";
import {
  clerkAuthStepView,
  completeSignUpAttempt,
  prepareEmailCodeFlow,
  startPasswordSignInOrUp,
  type ClerkSignUpAttemptResult,
} from "../lib/clerk-auth-requirements";
import { interfaceText, type InterfaceLanguage } from "../lib/interface-locale";
import { PasswordInput } from "./PasswordInput";

export function ClerkAuthForm({ lang, returnTo = `/${lang}/dashboard` }: { lang: InterfaceLanguage; returnTo?: string }) {
  const t = (english: string, chinese: string) => interfaceText(lang, english, chinese);
  const baseLang = lang === "zh" ? "zh" : "en";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [code, setCode] = useState("");
  const [method, setMethod] = useState<"code" | "password">("code");
  const [step, setStep] = useState<"credentials" | "code" | "password-required" | "recovery-email" | "recovery-code">("credentials");
  const [flow, setFlow] = useState<"sign-in" | "sign-up" | "second-factor" | "recovery" | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const { isLoaded, userId } = useAuth();
  const { isLoaded: signInLoaded, signIn, setActive: setActiveSignIn } = useSignIn();
  const { isLoaded: signUpLoaded, signUp, setActive: setActiveSignUp } = useSignUp();
  const authState = clerkAuthStepView(step, method, baseLang);
  const authView = {
    ...authState,
    primaryAction: step === "recovery-email"
      ? t("Send reset code", "发送重置验证码")
      : step === "recovery-code"
        ? t("Reset password & sign in", "重置密码并登录")
        : step === "code"
          ? t("Verify & continue", "验证并继续")
          : step === "password-required"
            ? t("Create password & sign in", "设置密码并登录")
            : method === "code"
              ? t("Send secure code", "发送安全验证码")
              : t("Continue with password", "使用密码继续"),
    secondaryAction: step === "code" || step === "password-required" || step === "recovery-email" || step === "recovery-code"
      ? t("Use another email", "更换邮箱")
      : method === "code"
        ? t("Use password instead", "改用密码")
        : t("Use an email code instead", "改用邮箱验证码"),
  };
  const completePath = `/${lang}/auth/complete?returnTo=${encodeURIComponent(returnTo)}`;
  type SignInResult = Awaited<ReturnType<NonNullable<typeof signIn>["create"]>>;

  const activateSession = (setActive: typeof setActiveSignIn, session: string) => {
    if (!setActive) throw new Error(t("Sign-in is still loading.", "登录功能仍在加载。"));
    return setActive({
      session,
      navigate: async ({ decorateUrl }) => {
        // Clerk's decorated navigation refreshes the first-party cookie that
        // Safari ITP requires before the app-session bridge can read it.
        window.location.href = decorateUrl(completePath);
      },
    });
  };

  useEffect(() => {
    // A member who opens the login page with an existing Clerk session still
    // needs the same deterministic bridge before entering D1-backed surfaces.
    if (isLoaded && userId) window.location.replace(completePath);
  }, [completePath, isLoaded, userId]);

  function readableError(issue: unknown) {
    if (isClerkAPIResponseError(issue)) {
      const key = issue.errors[0]?.code;
      if (key === "form_code_incorrect") return t("That code is incorrect. Please try again.", "验证码不正确，请重试。");
      if (key === "verification_expired") return t("That code expired. Request a new one.", "验证码已过期，请重新发送。");
      if (key === "form_identifier_not_found") return t("No account exists with that email.", "未找到使用该邮箱的账户。");
      if (key === "form_password_incorrect") return t("That password is incorrect.", "密码不正确。");
      if (key === "form_password_length_too_short") return t("Your password must be at least 8 characters.", "密码至少需要 8 个字符。");
      return lang === "en"
        ? issue.errors[0]?.longMessage || issue.errors[0]?.message || "Request failed."
        : t("Request failed. Please try again later.", "请求失败，请稍后重试。");
    }
    if (issue instanceof Error) return issue.message;
    return t("Request failed.", "请求失败。");
  }

  async function finishSignUp(result: ClerkSignUpAttemptResult) {
    const resolution = await completeSignUpAttempt(
      result,
      baseLang,
      sessionId => activateSession(setActiveSignUp, sessionId),
    );
    if (resolution.kind === "activated") return;
    if (resolution.kind === "password") {
      setStep("password-required");
      setCode("");
      setPassword("");
      setPasswordConfirmation("");
      setMessage(t(
        "Your email is verified. The current account settings also require new users to create a password; sign-in will finish automatically after you set it.",
        "电子邮箱已验证。当前账户设置还要求新用户创建密码；设置后将自动完成登录。",
      ));
      return;
    }
    throw new Error(t(
      "Your account requires additional information before sign-in can finish. Use another sign-in method or contact an administrator.",
      "账户仍需补充资料才能完成登录。请更换登录方式或联系管理员。",
    ));
  }

  async function finishSignIn(result: SignInResult, identifier: string) {
    if (result.status === "complete" && result.createdSessionId) {
      await activateSession(setActiveSignIn, result.createdSessionId);
      return;
    }
    if (result.status === "needs_second_factor" || result.status === "needs_client_trust") {
      const factor = result.supportedSecondFactors?.find(item => item.strategy === "email_code");
      if (!factor || factor.strategy !== "email_code") {
        throw new Error(t("This account requires another security factor. Contact an administrator.", "此账户需要其他安全验证，请联系管理员。"));
      }
      await result.prepareSecondFactor({ strategy: "email_code", emailAddressId: factor.emailAddressId });
      setFlow("second-factor");
      setStep("code");
      setCode("");
      setPassword("");
      setMessage(t(
        "This device needs extra verification. A new security code was sent to {identifier}",
        "此设备需要额外验证，新的安全码已发送至 {identifier}",
      ).replace("{identifier}", identifier));
      return;
    }
    throw new Error(t(
      "Sign-in needs another step ({status}).",
      "登录需要额外步骤（{status}）。",
    ).replace("{status}", result.status || t("unknown", "未知")));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage(""); setLoading(true);
    try {
      if (!signInLoaded || !signUpLoaded || !signIn || !signUp) throw new Error(t("Sign-in is still loading.", "登录功能仍在加载。"));
      const identifier = email.trim().toLowerCase();
      if (step === "recovery-email") {
        await signIn.create({ strategy: "reset_password_email_code", identifier });
        setFlow("recovery");
        setStep("recovery-code");
        setMessage(t(
          "Account found. Check {identifier} and enter the one-time reset code from the email.",
          "账户已找到。请检查 {identifier}，并输入邮件中的一次性重置验证码。",
        ).replace("{identifier}", identifier));
      } else if (step === "recovery-code" && flow === "recovery") {
        if (password.length < 8) throw new Error(t("Your new password must be at least 8 characters.", "新密码至少需要 8 个字符。"));
        if (password !== passwordConfirmation) throw new Error(t("The new passwords do not match.", "两次输入的新密码不一致。"));
        const result = await signIn.attemptFirstFactor({ strategy: "reset_password_email_code", code, password });
        await finishSignIn(result, identifier);
      } else if (step === "credentials" && method === "code") {
        const prepared = await prepareEmailCodeFlow(identifier, baseLang, {
          createSignIn: value => signIn.create({ identifier: value }),
          createSignUp: value => signUp.create({ emailAddress: value }),
          isIdentifierNotFound: issue => isClerkAPIResponseError(issue)
            && issue.errors.some(item => item.code === "form_identifier_not_found"),
        });
        setFlow(prepared.flow);
        setStep("code");
        setMessage(t("Code sent to {identifier}", "验证码已发送至 {identifier}").replace("{identifier}", prepared.identifier));
      } else if (step === "credentials") {
        const result = await startPasswordSignInOrUp(identifier, password, {
          createSignIn: (value, secret) => signIn.create({ identifier: value, password: secret }),
          createSignUp: (value, secret) => signUp.create({ emailAddress: value, password: secret }),
          isIdentifierNotFound: issue => isClerkAPIResponseError(issue)
            && issue.errors.some(item => item.code === "form_identifier_not_found"),
        });
        if (result.flow === "sign-in") await finishSignIn(result.result, identifier);
        else await finishSignUp(result.result);
      } else if (flow === "second-factor") {
        const result = await signIn.attemptSecondFactor({ strategy: "email_code", code });
        await finishSignIn(result, identifier);
      } else if (flow === "sign-in") {
        const result = await signIn.attemptFirstFactor({ strategy: "email_code", code });
        await finishSignIn(result, identifier);
      } else if (step === "password-required" && flow === "sign-up") {
        if (password.length < 8) throw new Error(t("Your password must be at least 8 characters.", "密码至少需要 8 个字符。"));
        if (password !== passwordConfirmation) throw new Error(t("The passwords do not match.", "两次输入的密码不一致。"));
        const result = await signUp.update({ password });
        await finishSignUp(result);
      } else {
        const result = await signUp.attemptEmailAddressVerification({ code });
        await finishSignUp(result);
      }
    } catch (issue) { setError(readableError(issue)); } finally { setLoading(false); }
  }

  function reset(next = method) { setMethod(next); setStep("credentials"); setFlow(null); setCode(""); setPassword(""); setPasswordConfirmation(""); setError(""); setMessage(""); }

  function startRecovery() { setStep("recovery-email"); setFlow(null); setCode(""); setPassword(""); setPasswordConfirmation(""); setError(""); setMessage(t("Enter your account email to receive a one-time reset code.", "输入账户邮箱以接收一次性重置验证码。")); }

  if (userId) return <p className="form-message success" role="status">{t("Connecting your secure session…", "正在连接安全会话…")}</p>;
  return <form className="auth-form" onSubmit={submit}>
    <label>{t("Email address", "电子邮箱")}<input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} disabled={step === "code" || step === "password-required" || step === "recovery-code"} required /></label>
    {((method === "password" && step === "credentials") || step === "password-required" || step === "recovery-code") && <PasswordInput lang={lang} label={step === "credentials" ? t("Password", "密码") : t("New password", "新密码")} autoComplete={step === "credentials" ? "current-password" : "new-password"} minLength={8} value={password} onChange={event => setPassword(event.target.value)} required />}
    {(step === "password-required" || step === "recovery-code") && <PasswordInput lang={lang} label={t("Confirm new password", "确认新密码")} autoComplete="new-password" minLength={8} value={passwordConfirmation} onChange={event => setPasswordConfirmation(event.target.value)} required />}
    {method === "password" && step === "credentials" && <button className="form-link auth-forgot-password" type="button" onClick={startRecovery}>{t("Forgot password?", "忘记密码？")}</button>}
    {authView.showCodeField && <label>{t("One-time code", "一次性验证码")}<input type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ""))} required /></label>}
    {error && <p className="form-message error" role="alert">{error}</p>}{message && <p className="form-message success" role="status">{message}</p>}
    {(step === "code" || step === "recovery-code") && <p className="form-message">{t("If you don't see the code email in your inbox, check your Spam or Junk folder.", "如果收件箱中没有看到验证码邮件，请检查垃圾邮件或广告邮件文件夹。")}</p>}
    {step === "recovery-email" && <p className="form-message">{t("Self-service recovery cannot work if the account email is false or unreachable.", "若注册邮箱不存在或无法收信，将无法自行找回密码。")}</p>}
    <div id={authView.captchaElementId} />
    <button className="primary-button full" disabled={loading || !signInLoaded || !signUpLoaded}>{loading ? t("Please wait…", "请稍候…") : authView.primaryAction}</button>
    {step !== "credentials" ? <button className="form-link" type="button" onClick={() => reset()}>{authView.secondaryAction}</button> : <button className="form-link" type="button" onClick={() => reset(method === "code" ? "password" : "code")}>{authView.secondaryAction}</button>}
  </form>;
}
