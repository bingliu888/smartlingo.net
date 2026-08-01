"use client";

import { FormEvent, useState } from "react";

const copy = {
  en: { email: "Email address", code: "One-time code", send: "Send login code", verify: "Verify & login", working: "Please wait…", sent: "Code sent. Check your email.", change: "Use another email", loading: "Login is still loading. Please try again.", incorrect: "The code is incorrect. Please try again.", expired: "The code expired. Please request a new one." },
  zh: { email: "电子邮箱", code: "一次性验证码", send: "发送登录验证码", verify: "验证并登录", working: "请稍候…", sent: "验证码已发送，请查看邮箱。", change: "更换邮箱", loading: "登录功能仍在加载，请重试。", incorrect: "验证码不正确，请重试。", expired: "验证码已过期，请重新发送。" },
};

export function AuthForm({ lang }: { lang: "en" | "zh" }) {
  const t = copy[lang];
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      if (step === "email") {
        const response = await fetch("/api/auth/request-code", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: normalizedEmail, lang }) });
        const result = await response.json() as { error?: string };
        if (!response.ok) throw new Error(result.error || (lang === "zh" ? "无法发送验证码，请重试。" : "Unable to send the code."));
        setStep("code");
        setSuccess(t.sent);
      } else {
        const response = await fetch("/api/auth/verify-code", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: normalizedEmail, code, lang }) });
        const result = await response.json() as { error?: string; redirect?: string };
        if (!response.ok) throw new Error(result.error || t.incorrect);
        window.location.replace(result.redirect || `/${lang}/dashboard`);
      }
    } catch (issue) {
      const detail = issue instanceof Error ? issue.message : "";
      setError(lang === "zh" ? (/[\u3400-\u9fff]/.test(detail) ? detail : "请求失败，请重试。") : detail || "Request failed");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setStep("email");
    setCode("");
    setSuccess("");
    setError("");
  }

  return <form className="auth-form" onSubmit={submit}><label>{t.email}<input name="email" type="email" autoComplete="email" inputMode="email" value={email} onChange={event => setEmail(event.target.value)} disabled={step === "code"} required /></label>{step === "code" && <label>{t.code}<input name="code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ""))} required /></label>}{error && <p className="form-message error" role="alert">{error}</p>}{success && <p className="form-message success" role="status">{success}</p>}<button className="primary-button full" disabled={loading}>{loading ? t.working : step === "email" ? t.send : t.verify}</button>{step === "code" && <button className="form-link" type="button" onClick={reset}>{t.change}</button>}</form>;
}
