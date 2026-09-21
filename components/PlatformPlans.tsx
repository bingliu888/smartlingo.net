"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { interfaceText, type InterfaceLanguage } from "../lib/interface-locale";
import { SMARTLINGO_AIGC_CREDIT_COSTS, SMARTLINGO_PLATFORM_PRODUCTS, type SmartLingoPlatformProductId } from "../lib/platform-commerce";

type PlatformState = { subscription?: { status: string; cadence: string; currentPeriodEndsAt?: number | null } | null; platformPlan?: { id: "standard" | "max"; maxActive: boolean; remainingDays: number }; aigcCredits?: number };

export function PlatformPlans({ lang, checkout, sessionId }: { lang: InterfaceLanguage; checkout?: string; sessionId?: string }) {
  const t = useCallback((english: string, chinese: string) => interfaceText(lang, english, chinese), [lang]);
  const [state, setState] = useState<PlatformState>({});
  const [busy, setBusy] = useState(checkout === "success" && sessionId ? "complete" : "");
  const [paymentChoice, setPaymentChoice] = useState<SmartLingoPlatformProductId | "">("");
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

  async function cardCheckout(productId: SmartLingoPlatformProductId) {
    setBusy(productId); setMessage("");
    const response = await fetch("/api/billing/platform/stripe/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ productId, locale: lang }) });
    const data = await response.json().catch(() => ({})) as { url?: string; error?: string };
    if (response.status === 401) { window.location.assign(`/${lang}/auth/login?returnTo=${encodeURIComponent(`/${lang}/pricing`)}`); return; }
    if (response.ok && data.url) window.location.assign(data.url);
    else { setMessage(data.error === "STRIPE_NOT_CONFIGURED" ? t("Stripe is being configured; crypto payment remains available.", "Stripe 正在配置；仍可使用加密货币付款。") : t("Unable to open Stripe checkout.", "暂时无法打开 Stripe 结账。")); setBusy(""); }
  }

  const maxProducts = SMARTLINGO_PLATFORM_PRODUCTS.filter(item => item.kind === "max");
  const credit = SMARTLINGO_PLATFORM_PRODUCTS.find(item => item.kind === "aigc")!;
  const maxActive = Boolean(state.platformPlan?.maxActive);
  const remainingDays = Number(state.platformPlan?.remainingDays || 0);
  const paymentActions = (productId: SmartLingoPlatformProductId) => paymentChoice === productId ? <div className="platform-payment-actions">
    <button disabled={Boolean(busy)} onClick={() => void cardCheckout(productId)}>{busy === productId ? "…" : t("Card / bank", "银行卡 / 银行账户")}</button>
    <Link href={`/${lang}/pricing/crypto?product=${productId}`}>{t("Crypto Pay", "加密货币付款")}</Link>
    <button className="platform-payment-cancel" onClick={() => setPaymentChoice("")}>{t("Cancel", "取消")}</button>
  </div> : <button className="platform-payment-chooser" onClick={() => setPaymentChoice(productId)}>{t("Choose payment method", "选择付款方式")} →</button>;

  return <section className="platform-pricing" data-layout-fill="platform-pricing">
    <header className="platform-pricing-heading"><p className="section-kicker">{t("SMARTLINGO MEMBERSHIP", "SMARTLINGO 会员方案")}</p><h1>{t("Learn free. Go further with Max.", "免费学习，用 Max 更进一步。")}</h1><p>{t("Standard is free with ads. Max removes ads for one fixed term and never renews automatically. Language courses remain separate.", "Standard 免费并显示广告；Max 在固定期限内移除广告，而且绝不自动续费。语言课程仍单独订阅。")}</p></header>
    {message && <p className="billing-message" role="status">{busy === "complete" ? t("Confirming payment…", "正在确认付款…") : message}</p>}
    <article className="platform-status-card">
      <div><small>{t("MEMBER STATUS", "会员状态")}</small><h2>{maxActive ? t("Max is active", "Max 已启用") : t("Standard is active", "Standard 已启用")}</h2><p>{maxActive ? t("Enjoy an ad-free learning experience until the fixed term ends. AIGC credits remain a separate balance.", "在固定期限结束前享受无广告学习体验；人工智能生成额度仍为独立余额。") : t("Core learning stays free with ads. Upgrade once for a fixed Max term whenever you are ready.", "核心学习含广告并永久免费；准备好时可一次性购买固定期限 Max。")}</p></div>
      <strong>{maxActive ? remainingDays : t("FREE", "免费")}<span>{maxActive ? t("days remaining", "剩余天数") : t("STANDARD", "标准方案")}</span></strong>
    </article>
    <div className="platform-plan-grid">
      {maxProducts.map(product => <article className="platform-max-card" key={product.id}>
        <small>{t("ONE COMPLETE MAX PLAN", "完整的 MAX 方案")}</small>
        <h2>{product.months === 12 ? t("Annual", "年度") : t("6 months", "6 个月")}</h2>
        <strong>{product.displayPrice}</strong>
        <p>{t("Ad-free learning, focused progress tools, community learning, and AI study partners for one fixed term.", "在一个固定期限内享受无广告学习、专注进度工具、社区学习和 AI 学伴。")}</p>
        {paymentActions(product.id)}
      </article>)}
    </div>
    <article className="aigc-credit-card"><div><small>{t("AIGC TOKEN CREDIT", "人工智能生成额度")}</small><h2>{t("Create image, audio, and video media", "生成图片、音频与视频媒体")}</h2><p>{t("One prepaid pack adds 1,000 non-cash credits. The balance is independent from Max and has no exchange or withdrawal value.", "一次购买增加 1,000 个非现金额度；余额与 Max 相互独立，不可兑换或提现。")}</p><Link className="history-button" href={`/${lang}/share`}>{t("Open AIGC Studio", "打开人工智能媒体工作室")} →</Link></div><div className="aigc-credit-price"><b>{state.aigcCredits ?? 0}</b><span>{t("CREDIT", "额度")}</span><small>{credit.displayPrice} / 1,000</small><small>{t(`Image ${SMARTLINGO_AIGC_CREDIT_COSTS.image} · Audio ${SMARTLINGO_AIGC_CREDIT_COSTS.audio} · Video ${SMARTLINGO_AIGC_CREDIT_COSTS.video}`, `图片 ${SMARTLINGO_AIGC_CREDIT_COSTS.image} · 音频 ${SMARTLINGO_AIGC_CREDIT_COSTS.audio} · 视频 ${SMARTLINGO_AIGC_CREDIT_COSTS.video}`)}</small>{paymentActions(credit.id)}</div></article>
  </section>;
}
