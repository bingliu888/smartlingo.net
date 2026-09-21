"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { interfaceText, type InterfaceLanguage } from "../lib/interface-locale";
import { SMARTLINGO_AIGC_CREDIT_COSTS, SMARTLINGO_PLATFORM_PRODUCTS, type SmartLingoPlatformProductId } from "../lib/platform-commerce";

type PlatformState = { subscription?: { status: string; cadence: string; currentPeriodEndsAt?: number | null } | null; platformPlan?: { id: "free" | "max"; maxActive: boolean; trialActive?: boolean; remainingDays: number }; aigcCredits?: number };

export function PlatformPlans({ lang, checkout, sessionId, compact = false }: { lang: InterfaceLanguage; checkout?: string; sessionId?: string; compact?: boolean }) {
  const t = useCallback((english: string, chinese: string) => interfaceText(lang, english, chinese), [lang]);
  const [state, setState] = useState<PlatformState>({});
  const [busy, setBusy] = useState(checkout === "success" && sessionId ? "complete" : "");
  const [message, setMessage] = useState(checkout === "cancelled" ? t("Stripe checkout was cancelled. No charge was made.", "Stripe 结账已取消，未产生费用。") : "");

  useEffect(() => {
    let active = true;
    const load = () => fetch("/api/platform", { cache: "no-store" }).then(response => response.ok ? response.json() : null).then(data => { if (active && data) setState(data); });
    if (checkout === "success" && sessionId) {
      fetch("/api/billing/platform/stripe/complete", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId }) })
        .then(async response => ({ ok: response.ok, data: await response.json().catch(() => ({})) }))
        .then(result => {
          if (!active) return;
          setMessage(result.ok ? t("Payment confirmed and your account has been updated.", "付款已确认，账户权益已经更新。") : t("Stripe is still confirming this payment. Refresh shortly; do not pay again.", "Stripe 仍在确认付款。请稍后刷新，不要重复付款。"));
          return load();
        }).finally(() => { if (active) setBusy(""); });
    } else void load();
    return () => { active = false; };
  }, [checkout, sessionId, t]);

  const maxProducts = SMARTLINGO_PLATFORM_PRODUCTS.filter(item => item.kind === "max");
  const credit = SMARTLINGO_PLATFORM_PRODUCTS.find(item => item.kind === "aigc")!;
  const maxActive = Boolean(state.platformPlan?.maxActive);
  const remainingDays = Number(state.platformPlan?.remainingDays || 0);
  const paymentActions = (productId: SmartLingoPlatformProductId) => <Link className="platform-payment-chooser" href={`/${lang}/pricing/pay/${productId}?returnTo=${encodeURIComponent(`/${lang}/pricing`)}`}>{t("Choose payment method", "选择付款方式")} →</Link>;

  return <section className={`platform-pricing${compact ? " platform-pricing-compact" : ""}`}>
    <header className="platform-pricing-heading"><p className="section-kicker">{t("SMARTLINGO MEMBERSHIP", "SMARTLINGO 会员方案")}</p><h1>{t("Learn Beginner free. Go further with Max.", "初级永久免费，用 Max 更进一步。")}</h1><p>{t("Free includes every Beginner course with ads. Opening an Intermediate or Advanced course starts one 7-day Max trial; after it ends, Max is required to continue those levels. Max removes ads and never renews automatically.", "免费方案包含全部带广告的初级课程。首次进入中级或高级课程会自动开始一次 7 天 Max 试用；试用结束后需开通 Max 才能继续这些等级。Max 去除广告且不会自动续费。")}</p></header>
    {message && <p className="billing-message" role="status">{busy === "complete" ? t("Confirming payment…", "正在确认付款…") : message}</p>}
    {!compact && <article className="platform-status-card">
      <div><small>{t("MEMBER STATUS", "会员状态")}</small><h2>{maxActive ? state.platformPlan?.trialActive ? t("7-day Max trial is active", "7 天 Max 试用已启用") : t("Max is active", "Max 已启用") : t("Free is active", "免费方案已启用")}</h2><p>{maxActive ? t("Enjoy ad-free learning and every course level until the fixed term ends. AIGC credits remain a separate balance.", "在固定期限结束前享受无广告学习和全部课程等级；人工智能生成额度仍为独立余额。") : t("Every Beginner course stays free with ads. Enter Intermediate or Advanced once to start your one-time 7-day Max trial.", "全部初级课程含广告并永久免费；首次进入中级或高级课程时会开始一次性 7 天 Max 试用。")}</p></div>
      <strong>{maxActive ? remainingDays : t("FREE", "免费")}<span>{maxActive ? t("days remaining", "剩余天数") : t("FREE PLAN", "免费方案")}</span></strong>
    </article>}
    <div className="platform-plan-grid">
      <article className="platform-free-card">
        <small>{t("FREE PLAN", "免费方案")}</small>
        <h2>{t("Free", "免费")}</h2>
        <strong>$0</strong>
        <p>{t("Learn every Beginner course with ads, including daily practice, SmartCard, speaking scenarios, Community, and the public AI study partner. Visiting Beginner never starts Max.", "免费学习全部带广告的初级课程，包括今日练习、SmartCard、生活口语、社区和公开人工智能学伴；进入初级课程不会启动 Max。")}</p>
        <Link className="platform-payment-chooser" href={`/${lang}/play`}>{t("Start free", "免费开始")} →</Link>
      </article>
      {maxProducts.map(product => <article className="platform-max-card" key={product.id}>
        <small>{t("ONE COMPLETE MAX PLAN", "完整的 MAX 方案")}</small>
        <h2>{product.months === 12 ? t("Annual", "年度") : t("6 months", "6 个月")}</h2>
        <strong>{product.displayPrice}</strong>
        <p>{t("Ad-free learning plus every Beginner, Intermediate, and Advanced course level, focused progress tools, Community, and AI study partners for one fixed term.", "在一个固定期限内享受无广告学习，并可学习全部初级、中级和高级课程，同时使用专注进度工具、社区和 AI 学伴。")}</p>
        {paymentActions(product.id)}
      </article>)}
    </div>
    <article className="aigc-credit-card" id="aigc-credits"><div><small>{t("AIGC TOKEN CREDIT", "人工智能生成额度")}</small><h2>{t("Create image, audio, and video media", "生成图片、音频与视频媒体")}</h2><p>{t("One prepaid pack adds 1,000 non-cash credits. The balance is independent from Max and has no exchange or withdrawal value.", "一次购买增加 1,000 个非现金额度；余额与 Max 相互独立，不可兑换或提现。")}</p></div><div className="aigc-credit-price"><b>{state.aigcCredits ?? 0}</b><span>{t("CREDIT", "额度")}</span><small>{credit.displayPrice} / 1,000</small><small>{t(`Image ${SMARTLINGO_AIGC_CREDIT_COSTS.image} · Audio ${SMARTLINGO_AIGC_CREDIT_COSTS.audio} · Video ${SMARTLINGO_AIGC_CREDIT_COSTS.video}`, `图片 ${SMARTLINGO_AIGC_CREDIT_COSTS.image} · 音频 ${SMARTLINGO_AIGC_CREDIT_COSTS.audio} · 视频 ${SMARTLINGO_AIGC_CREDIT_COSTS.video}`)}</small>{paymentActions(credit.id)}</div></article>
  </section>;
}
