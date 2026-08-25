"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SMARTLINGO_AI_STUDY_PARTNERS } from "../lib/smartlingo-ai-study-partners";
import { SMARTLINGO_LANGUAGE_COMMUNITIES } from "../lib/smartlingo-language-communities";
import { interfaceText, type InterfaceLanguage } from "../lib/interface-locale";

type Level = "beginner" | "intermediate" | "advanced";
type StudyMode = "vocabulary" | "challenge" | "speaking" | "mixed";
type Availability = "weekdays" | "evenings" | "weekends" | "flexible";
type Profile = {
  enabled: boolean;
  adultConfirmed: boolean;
  coarseRegion: string;
  sourceLanguage: string;
  targetLanguage: string;
  level: Level;
  studyMode: StudyMode;
  availability: Availability;
  bio: string;
};
type Match = Omit<Profile, "enabled" | "adultConfirmed"> & {
  id: string;
  displayName: string;
  imageUrl?: string;
};

function initialProfile(lang: InterfaceLanguage): Profile {
  const sourceLanguage = lang;
  return {
    enabled: false,
    adultConfirmed: false,
    coarseRegion: "",
    sourceLanguage,
    targetLanguage: sourceLanguage === "en" ? "es" : "en",
    level: "beginner",
    studyMode: "mixed",
    availability: "flexible",
    bio: "",
  };
}

export function NearbyLearning({ lang, signedIn }: { lang: InterfaceLanguage; signedIn: boolean }) {
  const text = useCallback((english: string, chinese: string) => interfaceText(lang, english, chinese), [lang]);
  const [profile, setProfile] = useState<Profile>(() => initialProfile(lang));
  const [matches, setMatches] = useState<Match[]>([]);
  const [loaded, setLoaded] = useState(!signedIn);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [reporting, setReporting] = useState("");
  const [reportReason, setReportReason] = useState("spam");
  const target = useMemo(() => SMARTLINGO_LANGUAGE_COMMUNITIES.find(item => item.code === profile.targetLanguage), [profile.targetLanguage]);

  const load = useCallback(async () => {
    const response = await fetch("/api/community/nearby", { cache: "no-store" });
    const value = await response.json().catch(() => ({})) as { profile?: Record<string, unknown> | null; matches?: Match[]; error?: string };
    if (!response.ok) throw new Error(value.error || text("Unable to load Nearby.", "暂时无法读取 Nearby。"));
    if (value.profile) {
      setProfile({
        enabled: Boolean(value.profile.enabled),
        adultConfirmed: Boolean(value.profile.adultConfirmed),
        coarseRegion: String(value.profile.coarseRegion || ""),
        sourceLanguage: String(value.profile.sourceLanguage || lang),
        targetLanguage: String(value.profile.targetLanguage || (lang === "en" ? "es" : "en")),
        level: String(value.profile.level || "beginner") as Level,
        studyMode: String(value.profile.studyMode || "mixed") as StudyMode,
        availability: String(value.profile.availability || "flexible") as Availability,
        bio: String(value.profile.bio || ""),
      });
    }
    setMatches(value.matches || []);
    setLoaded(true);
  }, [lang, text]);

  // The request resolves before it mutates visible discovery state.
  useEffect(() => {
    if (!signedIn) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load().catch(error => { setLoaded(true); setNotice(error instanceof Error ? error.message : text("Unable to load Nearby.", "暂时无法读取 Nearby。")); });
  }, [load, signedIn, text]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy("save"); setNotice("");
    try {
      const response = await fetch("/api/community/nearby", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "save", ...profile }),
      });
      const value = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(value.error || text("Could not save Nearby preferences.", "无法保存 Nearby 设置。"));
      await load();
      setEditing(false);
      setNotice(profile.enabled ? text("Nearby is on. Only your city or region is visible.", "Nearby 已开启，只显示您填写的城市或区域。") : text("Nearby is off. AI partners remain available.", "Nearby 已关闭，AI 学习伙伴仍可使用。"));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : text("Could not save Nearby preferences.", "无法保存 Nearby 设置。"));
    } finally { setBusy(""); }
  }

  async function invite(member: Match) {
    setBusy(member.id); setNotice("");
    const activity = text("Would you like to learn together on SmartLingo? We can try a short Sprint, SmartCard round, or speaking scenario.", "要不要在 SmartLingo 一起学习？我们可以做一轮今日速成、智慧卡或生活口语。 ");
    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "create", kind: "direct", recipientId: member.id, body: activity }),
      });
      const value = await response.json().catch(() => ({})) as { threadId?: string; error?: string };
      if (!response.ok || !value.threadId) throw new Error(value.error || text("Unable to send the study invitation.", "暂时无法发送一起学习邀请。"));
      window.location.assign(`/${lang}/messages?thread=${encodeURIComponent(value.threadId)}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : text("Unable to send the study invitation.", "暂时无法发送一起学习邀请。"));
      setBusy("");
    }
  }

  async function safetyAction(memberId: string, action: "block" | "report") {
    setBusy(`${action}-${memberId}`); setNotice("");
    try {
      const response = await fetch("/api/community/nearby", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, memberId, category: reportReason }),
      });
      const value = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(value.error || text("The safety action could not be completed.", "暂时无法完成安全操作。"));
      await load();
      setReporting("");
      setNotice(action === "report" ? text("Report received and the member is hidden.", "举报已收到，该会员也已从列表隐藏。") : text("Member hidden from Nearby.", "该会员已从 Nearby 隐藏。"));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : text("The safety action could not be completed.", "暂时无法完成安全操作。"));
    } finally { setBusy(""); }
  }

  const levelName = (level: Level) => ({ beginner: text("Beginner", "初级"), intermediate: text("Intermediate", "中级"), advanced: text("Advanced", "高级") })[level];
  const modeName = (mode: StudyMode) => ({ vocabulary: text("Vocabulary", "词汇"), challenge: text("Challenge", "挑战"), speaking: text("Speaking", "口语"), mixed: text("Mixed practice", "混合练习") })[mode];
  const availabilityName = (value: Availability) => ({ weekdays: text("Weekdays", "工作日"), evenings: text("Evenings", "晚间"), weekends: text("Weekends", "周末"), flexible: text("Flexible", "时间灵活") })[value];
  const signInHref = `/${lang}/auth/login?returnTo=${encodeURIComponent(`/${lang}/community`)}`;

  return <section className="nearby-learning" id="nearby" aria-labelledby="nearby-title">
    <header className="nearby-heading">
      <div><p className="section-kicker">NEARBY · LEARN TOGETHER</p><h2 id="nearby-title">{text("Find a study partner—or start with an AI classmate.", "找同城学习伙伴，也可以马上和 AI 同学一起练。")}</h2><p>{text("AI partners are always available and are clearly labeled. Real-member discovery is optional, adult-only, and uses only the city or region you enter—never GPS or an exact address.", "AI 学习伙伴始终在线并明确标注。真人 Nearby 仅限成年会员主动开启，只使用您填写的城市或区域，绝不读取 GPS 或精确地址。")}</p></div>
      {signedIn ? <button type="button" className="secondary-button" onClick={() => setEditing(value => !value)}>{editing ? text("Close settings", "关闭设置") : profile.enabled ? text("Edit Nearby", "修改 Nearby") : text("Turn on Nearby", "开启 Nearby")}</button> : <Link className="secondary-button" href={signInHref}>{text("Sign in for real Nearby", "登录后匹配真人")}</Link>}
    </header>

    <div className="ai-partner-toolbar">
      <div><strong>{text("Choose what you want to practice", "选择想练的语言")}</strong><span>{text("No account is needed to start with an AI classmate.", "无需账户即可与 AI 同学开始练习。")}</span></div>
      <label><span>{text("I am learning", "我在学习")}</span><select value={profile.targetLanguage} onChange={event => setProfile(value => ({ ...value, targetLanguage: event.target.value }))}>{SMARTLINGO_LANGUAGE_COMMUNITIES.map(language => <option value={language.code} key={language.code}>{language.nativeName}</option>)}</select></label>
    </div>

    <div className="ai-partner-grid" aria-label={text("AI study partners", "AI 学习伙伴")}>{SMARTLINGO_AI_STUDY_PARTNERS.map(partner => <article className={`ai-partner ${partner.accent}`} key={partner.id}>
      <div className="ai-partner-avatar" aria-hidden="true">{partner.avatar}<i>AI</i></div>
      <p>{text("AI STUDY PARTNER", "AI 学习伙伴")}</p>
      <h3>{partner.name} · {text(partner.titleEn, partner.titleZh)}</h3>
      <span>{text(partner.bodyEn, partner.bodyZh)}</span>
      <Link href={`/${lang}/assistant?language=${profile.targetLanguage}&mode=conversation&partner=${partner.id}`}>{text("Learn together now", "现在一起学")} →</Link>
    </article>)}</div>

    {signedIn && editing ? <form className="nearby-settings" onSubmit={save}>
      <div className="nearby-setting-lead"><div><strong>{text("Real-member discovery", "真人学习伙伴发现")}</strong><span>{text("You control whether your profile appears.", "是否展示由您随时控制。")}</span></div><label className="nearby-toggle"><input type="checkbox" checked={profile.enabled} onChange={event => setProfile(value => ({ ...value, enabled: event.target.checked }))}/><span>{profile.enabled ? text("On", "开启") : text("Off", "关闭")}</span></label></div>
      <div className="nearby-fields">
        <label><span>{text("City or broad region", "城市或大区域")}</span><input value={profile.coarseRegion} onChange={event => setProfile(value => ({ ...value, coarseRegion: event.target.value }))} maxLength={80} placeholder={text("Example: Irvine, California", "例如：加州尔湾")}/><small>{text("Do not enter an address, school, workplace, or coordinates.", "请勿填写地址、学校、单位或坐标。")}</small></label>
        <label><span>{text("I speak", "我会说")}</span><select value={profile.sourceLanguage} onChange={event => setProfile(value => ({ ...value, sourceLanguage: event.target.value }))}>{SMARTLINGO_LANGUAGE_COMMUNITIES.map(language => <option value={language.code} key={language.code}>{language.nativeName}</option>)}</select></label>
        <label><span>{text("I am learning", "我在学习")}</span><select value={profile.targetLanguage} onChange={event => setProfile(value => ({ ...value, targetLanguage: event.target.value }))}>{SMARTLINGO_LANGUAGE_COMMUNITIES.map(language => <option value={language.code} disabled={language.code === profile.sourceLanguage} key={language.code}>{language.nativeName}</option>)}</select></label>
        <label><span>{text("Level", "级别")}</span><select value={profile.level} onChange={event => setProfile(value => ({ ...value, level: event.target.value as Level }))}><option value="beginner">{levelName("beginner")}</option><option value="intermediate">{levelName("intermediate")}</option><option value="advanced">{levelName("advanced")}</option></select></label>
        <label><span>{text("Preferred activity", "偏好活动")}</span><select value={profile.studyMode} onChange={event => setProfile(value => ({ ...value, studyMode: event.target.value as StudyMode }))}><option value="mixed">{modeName("mixed")}</option><option value="vocabulary">{modeName("vocabulary")}</option><option value="challenge">{modeName("challenge")}</option><option value="speaking">{modeName("speaking")}</option></select></label>
        <label><span>{text("Availability", "方便时间")}</span><select value={profile.availability} onChange={event => setProfile(value => ({ ...value, availability: event.target.value as Availability }))}><option value="flexible">{availabilityName("flexible")}</option><option value="weekdays">{availabilityName("weekdays")}</option><option value="evenings">{availabilityName("evenings")}</option><option value="weekends">{availabilityName("weekends")}</option></select></label>
        <label className="nearby-bio"><span>{text("Short study note", "学习小介绍")}</span><textarea value={profile.bio} onChange={event => setProfile(value => ({ ...value, bio: event.target.value }))} maxLength={280} placeholder={text("What would you like to practice together?", "您想和伙伴一起练什么？")}/></label>
      </div>
      <label className="nearby-adult"><input type="checkbox" checked={profile.adultConfirmed} onChange={event => setProfile(value => ({ ...value, adultConfirmed: event.target.checked }))}/><span>{text("I am 18 or older and understand that SmartLingo does not verify identities or arrange in-person meetings.", "我已满 18 岁，并了解 SmartLingo 不核验线下身份，也不组织线下见面。")}</span></label>
      <div className="nearby-save"><button className="primary-button" disabled={busy === "save"}>{busy === "save" ? text("Saving…", "保存中…") : text("Save Nearby settings", "保存 Nearby 设置")}</button><span>{text("Block and report controls are available on every real-member card.", "每张真人卡片均提供屏蔽和举报。")}</span></div>
    </form> : null}

    <section className="nearby-real-members" aria-label={text("Nearby real learners", "Nearby 真人学习伙伴")}>
      {!signedIn ? <div className="nearby-public-access"><div><p className="section-kicker">REAL LEARNERS · OPT-IN</p><h3>{text("Real Nearby stays private until you choose to join.", "真人 Nearby 只在您主动加入后开放。")}</h3><p>{text("Sign in to optionally match with adult learners who share your language pair and broad region. SmartLingo never uses GPS or shows an exact address.", "登录后可选择匹配同语言组合、同大区域的成年学习者。SmartLingo 不读取 GPS，也不展示精确地址。")}</p></div><Link className="primary-button" href={signInHref}>{text("Sign in for real learners", "登录后寻找真人伙伴")} →</Link></div> : <>
      <header><div><p className="section-kicker">REAL LEARNERS · OPT-IN</p><h3>{profile.enabled ? text(`Learners in ${profile.coarseRegion}`, `${profile.coarseRegion} 的学习伙伴`) : text("Real-member Nearby is off", "真人 Nearby 尚未开启")}</h3></div>{profile.enabled ? <span>{matches.length}</span> : null}</header>
      {!loaded ? <p>{text("Loading…", "读取中…")}</p> : profile.enabled && matches.length ? <div className="nearby-match-grid">{matches.map(member => <article key={member.id}>
        <div className="nearby-member-title"><span>{member.imageUrl ? <img src={member.imageUrl} alt=""/> : member.displayName.slice(0, 1).toUpperCase()}</span><div><h4>{member.displayName}</h4><p>{member.coarseRegion}</p></div></div>
        <div className="nearby-member-tags"><span>{levelName(member.level)}</span><span>{modeName(member.studyMode)}</span><span>{availabilityName(member.availability)}</span></div>
        {member.bio ? <p>{member.bio}</p> : null}
        <button className="primary-button" type="button" onClick={() => void invite(member)} disabled={busy === member.id}>{busy === member.id ? text("Sending…", "发送中…") : text("Invite to learn together", "邀请一起学习")}</button>
        <div className="nearby-safety"><button type="button" onClick={() => void safetyAction(member.id, "block")} disabled={busy === `block-${member.id}`}>{text("Block", "屏蔽")}</button><button type="button" onClick={() => setReporting(value => value === member.id ? "" : member.id)}>{text("Report", "举报")}</button></div>
        {reporting === member.id ? <div className="nearby-report"><select aria-label={text("Report reason", "举报原因")} value={reportReason} onChange={event => setReportReason(event.target.value)}><option value="spam">{text("Spam", "垃圾信息")}</option><option value="harassment">{text("Harassment", "骚扰")}</option><option value="unsafe">{text("Unsafe behavior", "不安全行为")}</option><option value="other">{text("Other", "其他")}</option></select><button type="button" onClick={() => void safetyAction(member.id, "report")} disabled={busy === `report-${member.id}`}>{text("Submit & hide", "提交并隐藏")}</button></div> : null}
      </article>)}</div> : <p>{profile.enabled ? text(`No opted-in ${target?.nameEn || "language"} partners match this region yet. Your AI classmates are ready above.`, `这个区域暂时没有匹配的${target?.nameZh || "语言"}真人伙伴；上面的 AI 同学已经可以陪练。`) : text("Turn it on only when you want real members with the same language pair to find you. AI classmates remain available without location sharing.", "只有想让相同语言组合的真人会员找到您时才开启；不分享区域也可以一直使用 AI 同学。")}</p>}</>}
    </section>
    {notice ? <p className="nearby-notice" role="status">{notice}</p> : null}
  </section>;
}
