"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { interfaceText } from "../lib/interface-locale";
import type { SiteLanguage } from "../lib/site-locale";
import {
  SMARTLINGO_COURSE_DURATIONS,
  SMARTLINGO_COURSE_PACKAGES,
  courseSubscriptionPackage,
  fixedCourseId,
  type SmartLingoCourseDurationMonths,
  type SmartLingoPackageTier,
} from "../lib/smartlingo-course-packages";

type Status = { signedIn: boolean };

export function LanguageSubscriptionCatalog({ lang, language }: { lang: SiteLanguage; language: string }) {
  const t = (english: string, chinese: string) => interfaceText(lang, english, chinese);
  const [status, setStatus] = useState<Status>({ signedIn: false });
  const [statusLoaded, setStatusLoaded] = useState(false);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/billing/status", { cache: "no-store" })
      .then(response => response.json() as Promise<Status>)
      .then(data => { if (active) setStatus(data); })
      .catch(() => undefined)
      .finally(() => { if (active) setStatusLoaded(true); });
    return () => { active = false; };
  }, []);

  async function payByCard(tier: SmartLingoPackageTier, months: SmartLingoCourseDurationMonths) {
    const classId = fixedCourseId(language, tier);
    if (!status.signedIn) {
      const returnTo = `/${lang}/programs/${language}?level=${tier}&months=${months}`;
      window.location.assign(`/${lang}/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }
    const key = `${tier}:${months}`;
    setBusy(key);
    setMessage("");
    const response = await fetch("/api/billing/card/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ classId, targetLanguage: language, months, lang }),
    });
    const data = await response.json().catch(() => ({})) as { url?: string; error?: string };
    if (response.ok && data.url) {
      window.location.assign(data.url);
      return;
    }
    setMessage(data.error || t("Unable to start credit-card checkout.", "暂时无法开始信用卡付款。"));
    setBusy("");
  }

  return <section className="sl-package-catalog" data-layout-fill="course-packages">
    <header><p className="section-kicker">{t("9 FIXED-TERM PACKAGES", "9 个固定期限套餐")}</p><h2>{t("Choose a level and access period", "选择等级和学习期限")}</h2><p>{t("Pay once for 3, 6, or 12 months. There is no automatic renewal. Use a credit card for every package, or choose an enabled SmartPay3 crypto option for a three-month package.", "一次支付 3、6 或 12 个月费用，不会自动续费。所有套餐均可使用信用卡；三个月套餐还可选择 SmartPay3 合约中已启用的加密货币付款项目。")}</p></header>
    {!statusLoaded ? null : !status.signedIn ? <div className="sl-billing-login"><p>{t("Review every price now. Sign in only when you are ready to pay.", "现在可以查看全部价格；准备付款时再登录即可。")}</p><Link className="primary-button" href={`/${lang}/auth/login?returnTo=${encodeURIComponent(`/${lang}/programs/${language}`)}`}>{t("Sign in or register", "登录或注册")}</Link></div> : null}
    <div className="sl-subscription-grid">{SMARTLINGO_COURSE_PACKAGES.map(course => <article key={course.tier}>
      <span>{course.level}</span><h3>{t(course.name.en, course.name.zh)}</h3>
      <ul>{course.features.en.map((feature, index) => <li key={feature}>✓ {t(feature, course.features.zh[index])}</li>)}</ul>
      <div className="sl-term-list" aria-label={t(`${course.name.en} package duration`, `${course.name.zh}套餐期限`)}>{SMARTLINGO_COURSE_DURATIONS.map(months => {
        const subscriptionPackage = courseSubscriptionPackage(course.tier, months)!;
        const key = `${course.tier}:${months}`;
        return <div className="sl-term-card" key={months}>
          <div><span>{months} {t("months", "个月")}</span><strong>${subscriptionPackage.priceCents / 100}</strong><small>{months === 3 ? t("Credit card · Polygon crypto available", "信用卡 · 可选 Polygon 加密货币") : t("Credit-card payment", "信用卡支付")}</small></div>
          <button type="button" onClick={() => void payByCard(course.tier, months)} disabled={Boolean(busy)}>{busy === key ? "…" : t("Credit card", "信用卡")}</button>
        </div>;
      })}</div>
    </article>)}</div>
    <section className="sl-crypto-cta" aria-labelledby="sl-crypto-heading"><div><p className="section-kicker">CRYPTO PAYMENT</p><h2 id="sl-crypto-heading">{t("Pay with crypto", "使用加密货币付款")}</h2><p>{t("Your learning language is already selected. Continue to choose only the three-month course products and token combinations currently enabled in this site's SmartPay3 contract, then connect one wallet to pay.", "学习语言已经选好。下一步只会显示本站 SmartPay3 合约当前已启用的三个月课程与代币组合，然后连接一个钱包完成付款。")}</p></div><Link className="primary-button" href={`/${lang}/programs/${language}/pay/crypto`}>{t("Use crypto payment", "使用加密货币付款")} <span>→</span></Link></section>
    {message ? <p className="billing-message" role="status">{message}</p> : null}
    <style>{`.sl-package-catalog{width:min(1200px,calc(100% - 40px));margin:0 auto;padding:70px 0 100px}.sl-package-catalog>header{width:100%}.sl-package-catalog>header h2{margin:8px 0 14px;font:600 clamp(34px,4.5vw,58px)/1.05 "Iowan Old Style","Noto Serif SC",Georgia,serif}.sl-package-catalog>header>p:last-child{max-width:72ch;color:var(--muted)}.sl-billing-login{margin-top:24px;padding:16px 18px;display:flex;align-items:center;justify-content:space-between;gap:16px;border:1px solid #b8d8cd;border-radius:14px;background:#f4fbf8}.sl-billing-login p{margin:0}.sl-subscription-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-top:30px}.sl-subscription-grid>article{min-width:0;padding:28px;display:flex;flex-direction:column;border:1px solid rgba(18,32,42,.14);border-radius:20px;background:#fffaf0}.sl-subscription-grid>article:nth-child(2){background:#eef8f3;border-color:#9fd5c0}.sl-subscription-grid>article>span{color:var(--vermillion);font-weight:900}.sl-subscription-grid h3{margin:12px 0 18px;font-size:30px}.sl-subscription-grid ul{margin:4px 0 24px;padding:0;display:grid;gap:10px;list-style:none;color:var(--muted)}.sl-term-list{display:grid;gap:10px;margin-top:auto}.sl-term-card{min-width:0;padding:12px 14px;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px;border:1px solid #9fc7b9;border-radius:12px;background:#fff}.sl-term-card>div{min-width:0;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:3px 10px;align-items:center}.sl-term-card span{font-weight:850}.sl-term-card strong{font-size:26px;color:var(--jade)}.sl-term-card small{grid-column:1/-1;color:var(--muted);overflow-wrap:anywhere}.sl-term-card button{min-height:44px;padding:0 14px;border:0;border-radius:9px;background:#0b8067;color:#fff;font-weight:850;cursor:pointer}.sl-term-card button:disabled{cursor:wait;opacity:.6}.sl-crypto-cta{width:100%;margin-top:28px;padding:32px 38px;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:28px;border:1px solid #a8cbe0;border-radius:22px;background:#eaf6ff}.sl-crypto-cta>div{min-width:0}.sl-crypto-cta h2{margin:8px 0 10px;font-size:clamp(30px,4vw,46px)}.sl-crypto-cta p:last-child{max-width:70ch;margin:0;color:#53666f}.sl-crypto-cta .primary-button{white-space:normal;text-align:center}.sl-package-catalog>.billing-message{margin-top:16px}@media(max-width:900px){.sl-subscription-grid{grid-template-columns:1fr}.sl-crypto-cta{grid-template-columns:1fr}.sl-crypto-cta .primary-button{width:100%}}@media(max-width:540px){.sl-package-catalog{width:calc(100% - 28px);padding-top:52px}.sl-subscription-grid>article{padding:20px}.sl-term-card{grid-template-columns:1fr}.sl-term-card button{width:100%}.sl-billing-login{align-items:stretch;flex-direction:column}.sl-billing-login .primary-button{width:100%;text-align:center}.sl-crypto-cta{padding:24px 20px}}`}</style>
  </section>;
}
