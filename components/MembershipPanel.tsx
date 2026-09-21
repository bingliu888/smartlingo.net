"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { InterfaceLanguage } from "../lib/interface-locale";

type ReferredMember = {
  id: string;
  displayName: string;
  status: string;
  joinedAt: number;
  memberSince: number;
};

type PlatformData = {
  subscription: { status: string; cadence: string; currentPeriodEndsAt?: number | null } | null;
  platformPlan: { id: "free" | "max"; maxActive: boolean; trialActive?: boolean; remainingDays: number };
  aigcCredits: number;
  referral: { code: string; url: string; count: number; joined: ReferredMember[] };
  points: number;
  rewardHistory: Array<{ id: string; points: number; status: string; createdAt: number; paymentId: string }>;
  rewardRule: string;
  classPaymentsCreateIntroducerPoints: false;
  notifications: { language: string; marketingEmail: boolean; productEmail: boolean; reminderEmail: boolean };
};

export function MembershipPanel({ lang }: { lang: InterfaceLanguage }) {
  const zh = lang === "zh";
  const [data, setData] = useState<PlatformData | null>(null);
  const [message, setMessage] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    fetch("/api/platform", { cache: "no-store" })
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(setData)
      .catch(() => setMessage(zh ? "暂时无法读取会员资料。" : "Membership data is temporarily unavailable."));
    const refresh = () => fetch("/api/messages?summary=1", { cache: "no-store" })
      .then(response => response.ok ? response.json() : null)
      .then(result => setUnreadMessages(Number(result?.unread) || 0))
      .catch(() => undefined);
    refresh();
    const timer = window.setInterval(refresh, 30000);
    return () => window.clearInterval(timer);
  }, [zh]);

  if (!data) return <section className="member-panel" aria-live="polite">{message || (zh ? "正在准备会员中心…" : "Preparing membership…")}</section>;

  const maxActive = data.platformPlan.maxActive;
  const plan = maxActive ? "Max" : "Free";
  const maxDays = data.platformPlan.remainingDays;

  async function copyReferral() {
    await navigator.clipboard.writeText(data!.referral.url);
    setMessage(zh ? "平台订阅推荐链接已复制。" : "Platform-subscription referral link copied.");
  }

  async function shareReferral() {
    const item = {
      title: "SmartLingo.net",
      text: zh
        ? "和我一起使用 SmartLingo 学语言。介绍人积分只在平台成功收取订阅费后产生，课程付款不计积分。"
        : "Learn a language with me on SmartLingo. Introducer points apply only after a successful platform subscription charge; course payments never qualify.",
      url: data!.referral.url,
    };
    if (navigator.share) await navigator.share(item).catch(() => undefined);
    else await copyReferral();
  }

  async function savePreferences() {
    const response = await fetch("/api/platform", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data!.notifications),
    });
    setMessage(response.ok ? (zh ? "邮件偏好已保存。" : "Email preferences saved.") : (zh ? "暂时无法保存。" : "Could not save."));
  }

  return <>
    <section className="dashboard-creator-summary dashboard-platform-summary">
      <div><p className="eyebrow"><span/> MAX MEMBERSHIP</p><h2>Max</h2><p>{maxActive ? data.platformPlan.trialActive ? (zh ? `7 天试用 · 剩余 ${maxDays} 天` : `7-day trial · ${maxDays} days remaining`) : (zh ? `剩余 ${maxDays} 天` : `${maxDays} days remaining`) : (zh ? "当前为免费方案" : "Free plan active")}</p><Link href={`/${lang}/pricing`}>{maxActive ? (zh ? "延长" : "Extend") : (zh ? "升级" : "Upgrade")} →</Link></div>
      <div><p className="eyebrow"><span/> AIGC TOKEN CREDIT</p><h2>{data.aigcCredits.toLocaleString()}</h2><p>{zh ? "用于生成图片、音频与视频" : "For image, audio, and video generation"}</p><Link href={`/${lang}/pricing#aigc-credits`}>{zh ? "购买" : "Add"} →</Link></div>
    </section>

    <section className="dashboard-summary">
      <span><b>{plan}</b><small>{zh ? "当前平台方案" : "Platform plan"}</small></span>
      <button type="button" onClick={() => setShowHistory(value => !value)}><b>{data.points}</b><small>{zh ? "介绍人积分 · 记录" : "Introducer points · History"}</small></button>
      <span><b>{data.referral.count}</b><small>{zh ? "直接介绍关系" : "Direct introductions"}</small></span>
      <Link href={`/${lang}/messages`}><b>{unreadMessages > 99 ? "99+" : unreadMessages}</b><small>{zh ? "未读消息 · 打开" : "Unread messages · Open"}</small></Link>
    </section>

    <section className="member-panel">
      <div className="member-heading">
        <div><p className="section-kicker">{zh ? "平台方案与推荐" : "PLATFORM PLANS & REFERRALS"}</p><h2>{zh ? "管理方案、推荐关系和会员偏好。" : "Manage your plan, referrals, and member preferences."}</h2></div>
        <Link className="primary-button" href={`/${lang}/classes?mine=1`}>{zh ? "打开我的课程" : "Open My Courses"}</Link>
      </div>

      <div className="member-grid membership-tier-grid">
        <article className={!maxActive ? "active" : ""}><small>FREE</small><strong>{zh ? "免费方案（含广告）" : "Free with ads"}</strong><p>{zh ? "保留今日练习、SmartCard、生活口语、社区与公开 AI 学伴，以相关广告支持免费使用。" : "Daily practice, SmartCard, speaking scenarios, Community, and the public AI study partner remain free with ads."}</p><Link href={`/${lang}/pricing`}>{zh ? "查看方案" : "View plans"} →</Link></article>
        <article className={maxActive ? "active" : ""}><small>MAX</small><strong>{zh ? "无广告 · 中高级课程" : "Ad-free · higher course levels"}</strong><p>{maxActive && data.subscription?.currentPeriodEndsAt ? (zh ? `有效期至 ${new Date(data.subscription.currentPeriodEndsAt * 1000).toLocaleDateString("zh-CN")}` : `Active through ${new Date(data.subscription.currentPeriodEndsAt * 1000).toLocaleDateString("en-US")}`) : (zh ? "初级永久免费；中级和高级在一次性 7 天试用后需要 Max。6 个月 $59 或年度 $99，不自动续费。" : "Beginner is always free; Intermediate and Advanced require Max after one 7-day trial. Choose 6 months for $59 or annual access for $99; no auto-renewal.")}</p><Link href={`/${lang}/pricing`}>{zh ? "管理 Max" : "Manage Max"} →</Link></article>
        <article><small>AIGC TOKEN CREDIT</small><strong>{data.aigcCredits}</strong><p>{zh ? "用于生成图片、音频与视频；$10 可购买 1,000 额度。" : "Use credits to generate image, audio, and video media. $10 buys 1,000 credits."}</p><Link href={`/${lang}/pricing`}>{zh ? "购买额度" : "Buy credits"} →</Link></article>
      </div>

      <div className="member-grid">
        <article>
          <small>{zh ? "平台订阅推荐" : "PLATFORM SUBSCRIPTION REFERRAL"}</small>
          <strong>{data.referral.code}</strong>
          <p>{zh ? "分享此链接建立一层直接介绍关系。只有平台每次成功收取订阅费后，介绍人才可能按公布规则获得积分。注册本身不发积分。" : "Share this link to record one direct introducer. Points may be earned only after each successful platform subscription charge under published rules; signup alone earns nothing."}</p>
          <div className="share-url"><input readOnly value={data.referral.url}/></div>
          <div className="dashboard-share-actions"><button type="button" onClick={copyReferral}>{zh ? "复制链接" : "Copy link"}</button><button type="button" onClick={shareReferral}>{zh ? "分享" : "Share"}</button></div>
        </article>

        <article>
          <small>{zh ? "严格奖励边界" : "STRICT REWARD BOUNDARY"}</small>
          <strong>{zh ? "课程付款不计积分" : "Course payments never qualify"}</strong>
          <p>{zh ? "课程购买、班主收款、Stripe Connect 转账、退款、争议和打赏一律不产生介绍人积分。积分只能由验证后的平台订阅付款回调写入。" : "Course purchases, owner payouts, Stripe Connect transfers, refunds, disputes, and tips never create introducer points. Only a verified platform-subscription payment webhook may write a reward."}</p>
          <Link className="history-button" href={`/${lang}/programs`}>{zh ? "查看课程与规则" : "View courses and rules"} →</Link>
        </article>

        <article>
          <small>{zh ? "奖励记录" : "REWARD HISTORY"}</small>
          <strong>{data.points}</strong>
          <p>{zh ? "当前可见积分均绑定到唯一的平台订阅付款，不支持由前端手工转移或创建。" : "Every visible point entry is linked to one unique platform subscription payment and cannot be created or transferred by a client action."}</p>
          <button className="history-button" type="button" onClick={() => setShowHistory(value => !value)}>{showHistory ? (zh ? "收起记录" : "Hide history") : (zh ? "查看记录" : "View history")} →</button>
          {showHistory && <div className="reward-history">{data.rewardHistory.length ? data.rewardHistory.map(item => <div key={item.id}><span>{zh ? "平台订阅付款奖励" : "Platform subscription payment"}<small>{new Date(item.createdAt * 1000).toLocaleDateString(zh ? "zh-CN" : "en-US")}</small></span><b>{item.status === "reversed" ? "−" : "+"}{item.points}</b></div>) : <p>{zh ? "暂无符合条件的奖励记录。" : "No qualifying reward activity yet."}</p>}</div>}
        </article>

        <article className="email-card">
          <small>{zh ? "邮件偏好" : "EMAIL PREFERENCES"}</small>
          <label><input type="checkbox" checked={data.notifications.productEmail} onChange={event => setData({ ...data, notifications: { ...data.notifications, productEmail: event.target.checked } })}/>{zh ? "产品与账户通知" : "Product and account"}</label>
          <label><input type="checkbox" checked={data.notifications.reminderEmail} onChange={event => setData({ ...data, notifications: { ...data.notifications, reminderEmail: event.target.checked } })}/>{zh ? "课程与活动提醒" : "Course and event reminders"}</label>
          <label><input type="checkbox" checked={data.notifications.marketingEmail} onChange={event => setData({ ...data, notifications: { ...data.notifications, marketingEmail: event.target.checked } })}/>{zh ? "新闻与会员资讯" : "News and member updates"}</label>
          <button type="button" onClick={savePreferences}>{zh ? "保存偏好" : "Save preferences"}</button>
        </article>
      </div>
      {message && <p className="profile-message" role="status">{message}</p>}
    </section>
  </>;
}
