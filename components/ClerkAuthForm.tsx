"use client";

import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import { useAuth } from "@clerk/nextjs";
import { useSignIn, useSignUp } from "@clerk/nextjs/legacy";
import { FormEvent, useEffect, useState } from "react";
import {
  clerkAuthStepView,
  completeSignUpAttempt,
  prepareEmailCodeFlow,
  type ClerkSignUpAttemptResult,
} from "../lib/clerk-auth-requirements";

export function ClerkAuthForm({ lang, returnTo = `/${lang}/dashboard` }: { lang: "en" | "zh"; returnTo?: string }) {
  const zh = lang === "zh";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [code, setCode] = useState("");
  const [method, setMethod] = useState<"code" | "password">("code");
  const [step, setStep] = useState<"credentials" | "code" | "password-required">("credentials");
  const [flow, setFlow] = useState<"sign-in" | "sign-up" | "second-factor" | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const { isLoaded, userId } = useAuth();
  const { isLoaded: signInLoaded, signIn, setActive: setActiveSignIn } = useSignIn();
  const { isLoaded: signUpLoaded, signUp, setActive: setActiveSignUp } = useSignUp();
  const authView = clerkAuthStepView(step, method, lang);
  const completePath = `/${lang}/auth/complete?returnTo=${encodeURIComponent(returnTo)}`;
  type SignInResult = Awaited<ReturnType<NonNullable<typeof signIn>["create"]>>;

  const activateSession = (setActive: typeof setActiveSignIn, session: string) => {
    if (!setActive) throw new Error(zh ? "登录功能仍在加载。" : "Sign-in is still loading.");
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
      if (key === "form_code_incorrect") return zh ? "验证码不正确，请重试。" : "That code is incorrect. Please try again.";
      if (key === "verification_expired") return zh ? "验证码已过期，请重新发送。" : "That code expired. Request a new one.";
      if (key === "form_password_incorrect") return zh ? "密码不正确。" : "That password is incorrect.";
      return zh ? "请求失败，请稍后重试。" : issue.errors[0]?.longMessage || issue.errors[0]?.message || "Request failed.";
    }
    if (issue instanceof Error) return zh && !/[\u3400-\u9fff]/.test(issue.message) ? "请求失败，请稍后重试。" : issue.message;
    return zh ? "请求失败。" : "Request failed.";
  }

  async function finishSignUp(result: ClerkSignUpAttemptResult) {
    const resolution = await completeSignUpAttempt(
      result,
      lang,
      sessionId => activateSession(setActiveSignUp, sessionId),
    );
    if (resolution.kind === "activated") return;
    if (resolution.kind === "password") {
      setStep("password-required");
      setCode("");
      setPassword("");
      setPasswordConfirmation("");
      setMessage(resolution.message);
      return;
    }
    throw new Error(resolution.message);
  }

  async function finishSignIn(result: SignInResult, identifier: string) {
    if (result.status === "complete" && result.createdSessionId) {
      await activateSession(setActiveSignIn, result.createdSessionId);
      return;
    }
    if (result.status === "needs_second_factor" || result.status === "needs_client_trust") {
      const factor = result.supportedSecondFactors?.find(item => item.strategy === "email_code");
      if (!factor || factor.strategy !== "email_code") {
        throw new Error(zh ? "此账户需要其他安全验证，请联系管理员。" : "This account requires another security factor. Contact an administrator.");
      }
      await result.prepareSecondFactor({ strategy: "email_code", emailAddressId: factor.emailAddressId });
      setFlow("second-factor");
      setStep("code");
      setCode("");
      setPassword("");
      setMessage(zh
        ? `此设备需要额外验证，新的安全码已发送至 ${identifier}`
        : `This device needs extra verification. A new security code was sent to ${identifier}`);
      return;
    }
    throw new Error(zh
      ? `登录需要额外步骤（${result.status || "未知"}）。`
      : `Sign-in needs another step (${result.status || "unknown"}).`);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage(""); setLoading(true);
    try {
      if (!signInLoaded || !signUpLoaded || !signIn || !signUp) throw new Error(zh ? "登录功能仍在加载。" : "Sign-in is still loading.");
      const identifier = email.trim().toLowerCase();
      if (step === "credentials" && method === "code") {
        const prepared = await prepareEmailCodeFlow(identifier, lang, {
          createSignIn: value => signIn.create({ identifier: value }),
          createSignUp: value => signUp.create({ emailAddress: value }),
          isIdentifierNotFound: issue => isClerkAPIResponseError(issue)
            && issue.errors.some(item => item.code === "form_identifier_not_found"),
        });
        setFlow(prepared.flow);
        setStep("code");
        setMessage(prepared.message);
      } else if (step === "credentials") {
        try {
          const result = await signIn.create({ identifier, password });
          await finishSignIn(result, identifier);
        } catch (issue) {
          const missing = isClerkAPIResponseError(issue) && issue.errors.some(item => item.code === "form_identifier_not_found");
          if (!missing) throw issue;
          // Password registration is intentionally disabled. A new email
          // always enters the passwordless email-code registration path.
          const attempt = await signUp.create({ emailAddress: identifier });
          await attempt.prepareEmailAddressVerification({ strategy: "email_code" });
          setPassword("");
          setFlow("sign-up");
          setStep("code");
          setMessage(zh ? `验证码已发送至 ${identifier}` : `Code sent to ${identifier}`);
        }
      } else if (flow === "second-factor") {
        const result = await signIn.attemptSecondFactor({ strategy: "email_code", code });
        await finishSignIn(result, identifier);
      } else if (flow === "sign-in") {
        const result = await signIn.attemptFirstFactor({ strategy: "email_code", code });
        await finishSignIn(result, identifier);
      } else if (step === "password-required" && flow === "sign-up") {
        if (password.length < 8) throw new Error(zh ? "密码至少需要 8 个字符。" : "Your password must be at least 8 characters.");
        if (password !== passwordConfirmation) throw new Error(zh ? "两次输入的密码不一致。" : "The passwords do not match.");
        const result = await signUp.update({ password });
        await finishSignUp(result);
      } else {
        const result = await signUp.attemptEmailAddressVerification({ code });
        await finishSignUp(result);
      }
    } catch (issue) { setError(readableError(issue)); } finally { setLoading(false); }
  }

  function reset(next = method) { setMethod(next); setStep("credentials"); setFlow(null); setCode(""); setPassword(""); setPasswordConfirmation(""); setError(""); setMessage(""); }

  if (userId) return <p className="form-message success" role="status">{zh ? "正在连接安全会话…" : "Connecting your secure session…"}</p>;
  return <form className="auth-form" onSubmit={submit}>
    <label>{zh ? "电子邮箱" : "Email address"}<input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} disabled={step !== "credentials"} required /></label>
    {((method === "password" && step === "credentials") || step === "password-required") && <label>{step === "password-required" ? (zh ? "创建密码" : "Create password") : (zh ? "密码" : "Password")}<input type="password" autoComplete={step === "password-required" ? "new-password" : "current-password"} minLength={8} value={password} onChange={event => setPassword(event.target.value)} required /></label>}
    {step === "password-required" && <label>{zh ? "确认密码" : "Confirm password"}<input type="password" autoComplete="new-password" minLength={8} value={passwordConfirmation} onChange={event => setPasswordConfirmation(event.target.value)} required /></label>}
    {authView.showCodeField && <label>{zh ? "一次性验证码" : "One-time code"}<input type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ""))} required /></label>}
    {error && <p className="form-message error" role="alert">{error}</p>}{message && <p className="form-message success" role="status">{message}</p>}
    <div id={authView.captchaElementId} />
    <button className="primary-button full" disabled={loading || !signInLoaded || !signUpLoaded}>{loading ? (zh ? "请稍候…" : "Please wait…") : authView.primaryAction}</button>
    {step === "code" || step === "password-required" ? <button className="form-link" type="button" onClick={() => reset()}>{authView.secondaryAction}</button> : <button className="form-link" type="button" onClick={() => reset(method === "code" ? "password" : "code")}>{authView.secondaryAction}</button>}
  </form>;
}
