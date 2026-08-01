"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ReferredMember = {
  id: string;
  displayName: string;
  status: string;
  joinedAt: number;
  memberSince: number;
};

type PlatformData = {
  subscription: { status: string; cadence: string } | null;
  referral: { code: string; url: string; count: number; joined: ReferredMember[] };
  points: number;
  rewardHistory: Array<{ id: string; points: number; status: string; createdAt: number; paymentId: string }>;
  rewardRule: string;
  classPaymentsCreateIntroducerPoints: false;
  notifications: { language: string; marketingEmail: boolean; productEmail: boolean; reminderEmail: boolean };
};

export function MembershipPanel({ lang }: { lang: "en" | "zh" }) {
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

  const plan = data.subscription?.status === "active"
    ? (data.subscription.cadence === "coordinator" ? (zh ? "协调员方案" : "Coordinator") : (zh ? "进阶方案" : "Plus"))
    : (zh ? "免费方案" : "Free");

  async function copyReferral() {
    await navigator.clipboard.writeText(data!.referral.url);
    setMessage(zh ? "平台订阅推荐链接已复制。" : "Platform-subscription referral link copied.");
  }

  async function shareReferral() {
    const item = {
      title: "SmartLingo.net",
      text: zh
        ? "和我一起使用 SmartLingo 学语言。介绍人积分只在平台成功收取订阅费后产生，班级付款不计积分。"
        : "Learn a language with me on SmartLingo. Introducer points apply only after a successful platform subscription charge; class payments never qualify.",
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
    <section className="dashboard-summary">
      <span><b>{plan}</b><small>{zh ? "当前平台方案" : "Platform plan"}</small></span>
      <button type="button" onClick={() => setShowHistory(value => !value)}><b>{data.points}</b><small>{zh ? "介绍人积分 · 记录" : "Introducer points · History"}</small></button>
      <span><b>{data.referral.count}</b><small>{zh ? "直接介绍关系" : "Direct introductions"}</small></span>
      <Link href={`/${lang}/messages`}><b>{unreadMessages > 99 ? "99+" : unreadMessages}</b><small>{zh ? "未读消息 · 打开" : "Unread messages · Open"}</small></Link>
    </section>

    <section className="member-panel">
      <div className="member-heading">
        <div><p className="section-kicker">{zh ? "学习、开班与平台订阅" : "LEARNING, CLASSES & PLATFORM PLANS"}</p><h2>{zh ? "免费学习，也可以带领自己的语言班。" : "Learn free—and lead your own language class."}</h2></div>
        <Link className="primary-button" href={`/${lang}/classes?mine=1`}>{zh ? "打开我的班级" : "Open my classes"}</Link>
      </div>

      <div className="member-grid membership-tier-grid">
        <article className={plan === (zh ? "免费方案" : "Free") ? "active" : ""}><small>{zh ? "永久免费基础" : "FREE FOUNDATION"}</small><strong>{zh ? "免费方案" : "Free"}</strong><p>{zh ? "基础路径、每日训练、公开文字导师、社区和会员自主开班。" : "Core paths, daily practice, public text Guru, Community, and member-led classes."}</p></article>
        <article className={plan === (zh ? "进阶方案" : "Plus") ? "active" : ""}><small>{zh ? "计划推出" : "PLANNED"}</small><strong>{zh ? "进阶方案" : "Plus"}</strong><p>{zh ? "更多复习、实时语音额度和个人进度分析。" : "Expanded review, live-audio allowance, and personal progress insights."}</p></article>
        <article className={plan === (zh ? "协调员方案" : "Coordinator") ? "active" : ""}><small>{zh ? "计划推出" : "PLANNED"}</small><strong>{zh ? "协调员方案" : "Coordinator"}</strong><p>{zh ? "更高班级人数、作业、答疑时间和运营分析；不开启开班资格门槛。" : "Higher roster limits, assignments, office hours, and operations analytics—without gating the right to create a class."}</p></article>
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
          <strong>{zh ? "班级付款不计积分" : "Class payments never qualify"}</strong>
          <p>{zh ? "班级购买、班主收款、Stripe Connect 转账、退款、争议和打赏一律不产生介绍人积分。积分只能由验证后的平台订阅付款回调写入。" : "Class purchases, owner payouts, Stripe Connect transfers, refunds, disputes, and tips never create introducer points. Only a verified platform-subscription payment webhook may write a reward."}</p>
          <Link className="history-button" href={`/${lang}/pricing`}>{zh ? "查看方案与规则" : "View plans and rules"} →</Link>
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
          <label><input type="checkbox" checked={data.notifications.reminderEmail} onChange={event => setData({ ...data, notifications: { ...data.notifications, reminderEmail: event.target.checked } })}/>{zh ? "课程与活动提醒" : "Class and event reminders"}</label>
          <label><input type="checkbox" checked={data.notifications.marketingEmail} onChange={event => setData({ ...data, notifications: { ...data.notifications, marketingEmail: event.target.checked } })}/>{zh ? "新闻与会员资讯" : "News and member updates"}</label>
          <button type="button" onClick={savePreferences}>{zh ? "保存偏好" : "Save preferences"}</button>
        </article>
      </div>
      {message && <p className="profile-message" role="status">{message}</p>}
    </section>
  </>;
}
