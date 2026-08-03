"use client";

import { useEffect, useMemo, useState } from "react";

type Meeting = {
  id: string;
  ownerUserId: string;
  ownerName: string;
  ownerImageUrl: string;
  threadId: string;
  title: string;
  scheduledAt: number;
  participantCount: number;
  callParticipantCount: number;
  activeCallId: string | null;
  isOwner: boolean;
  status: "live" | "upcoming";
};

const pad = (value: number) => String(value).padStart(2, "0");
function countdown(seconds: number, zh: boolean) {
  if (seconds <= 0) return zh ? "正在进行" : "Live now";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (days) return zh ? `${days} 天 ${hours} 小时后` : `in ${days}d ${hours}h`;
  return zh ? `${pad(hours)}:${pad(minutes)}:${pad(secs)} 后开始` : `starts in ${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
}

export function CommunityMeetings({ lang }: { lang: "en" | "zh" }) {
  const zh = lang === "zh";
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<"live" | "upcoming">("live");
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("");
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const response = await fetch("/api/community/meetings", { cache: "no-store" });
    const data = await response.json().catch(() => ({})) as { meetings?: Meeting[]; serverNow?: number; error?: string };
    if (!response.ok) throw new Error(data.error || "Unable to load meetings");
    setMeetings(data.meetings || []);
    if (data.serverNow) setNow(data.serverNow);
  }

  // The async loader updates state only after the request resolves.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load().catch(() => setError(zh ? "暂时无法读取会议。" : "Meetings are temporarily unavailable.")); }, [zh]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000); return () => window.clearInterval(timer); }, []);

  const normalized = useMemo(() => meetings.map(meeting => ({ ...meeting, status: meeting.scheduledAt <= now ? "live" as const : "upcoming" as const })), [meetings, now]);
  const live = normalized.filter(meeting => meeting.status === "live");
  const upcoming = normalized.filter(meeting => meeting.status === "upcoming");
  const visible = tab === "live" ? live : upcoming;
  const ownsMeeting = normalized.some(meeting => meeting.isOwner);

  async function schedule(event: React.FormEvent) {
    event.preventDefault();
    const scheduledAt = Math.floor(new Date(start).getTime() / 1000);
    if (!title.trim() || !Number.isFinite(scheduledAt)) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/community/meetings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "schedule", title, scheduledAt }) });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Schedule failed");
      setTitle(""); setStart(""); setShowForm(false); setTab(scheduledAt <= Math.floor(Date.now() / 1000) ? "live" : "upcoming"); await load(); window.dispatchEvent(new Event("smartlingo:meetings-changed"));
    } catch (reason) { setError(reason instanceof Error ? reason.message : (zh ? "无法预约会议。" : "Unable to schedule meeting.")); }
    finally { setBusy(false); }
  }

  async function meetingAction(meeting: Meeting, action: "join" | "end") {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/community/meetings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, meetingId: meeting.id }) });
      const data = await response.json().catch(() => ({})) as { error?: string; threadId?: string };
      if (!response.ok) throw new Error(data.error || "Meeting action failed");
      if (action === "join" && data.threadId) window.location.assign(`/${lang}/messages/live/${encodeURIComponent(data.threadId)}`);
      else { await load(); window.dispatchEvent(new Event("smartlingo:meetings-changed")); }
    } catch (reason) { setError(reason instanceof Error ? reason.message : (zh ? "操作失败。" : "Action failed.")); setBusy(false); }
  }

  const defaultStart = () => {
    const date = new Date(Date.now() + 15 * 60 * 1000);
    date.setSeconds(0, 0);
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  return <section className="community-meetings" data-layout-fill="community-meetings" data-layout-text-fit="community-meetings">
    <header>
      <button className="meeting-overview" type="button" onClick={() => setOpen(value => !value)} aria-expanded={open}>
        <span className="meeting-live-mark" aria-hidden="true"/>
        <span><small>{zh ? "社区实时空间" : "COMMUNITY LIVE SPACE"}</small><strong>{zh ? "实时会议" : "Live Meetings"}</strong></span>
        <b>{live.length} {zh ? "进行中" : "live"} · {upcoming.length} {zh ? "即将开始" : "upcoming"}</b><i>{open ? "−" : "+"}</i>
      </button>
      <button className="meeting-schedule" type="button" disabled={ownsMeeting} onClick={() => { setOpen(true); setShowForm(value => !value); if (!start) setStart(defaultStart()); }}>
        {ownsMeeting ? (zh ? "您已有一个会议" : "One meeting already active") : (zh ? "预约会议" : "Schedule")}
      </button>
    </header>
    {open && <div className="meeting-center">
      {showForm && <form className="meeting-form" onSubmit={schedule}>
        <label>{zh ? "会议标题" : "Meeting title"}<input autoFocus value={title} onChange={event => setTitle(event.target.value)} minLength={3} maxLength={80} required placeholder={zh ? "例如：意大利语旅行会话练习" : "e.g. Italian travel conversation practice"}/></label>
        <label>{zh ? "开始时间" : "Start time"}<input type="datetime-local" value={start} onChange={event => setStart(event.target.value)} required/></label>
        <div><button type="button" onClick={() => setShowForm(false)}>{zh ? "取消" : "Cancel"}</button><button disabled={busy}>{zh ? "创建会议与群聊" : "Create meeting & chat"}</button></div>
        <p>{zh ? "每位会员只能保留一个正在进行或已预约的会议。会议建立后即可进入群聊。" : "Each member may keep one live or scheduled meeting. Its group chat is available immediately."}</p>
      </form>}
      <nav className="meeting-tabs" aria-label={zh ? "会议状态" : "Meeting status"}>
        <button className={tab === "live" ? "active" : ""} onClick={() => setTab("live")}>{zh ? "正在进行" : "Live"}<b>{live.length}</b></button>
        <button className={tab === "upcoming" ? "active" : ""} onClick={() => setTab("upcoming")}>{zh ? "即将开始" : "Upcoming"}<b>{upcoming.length}</b></button>
      </nav>
      <div className="meeting-list">
        {visible.map(meeting => <article key={meeting.id}>
          <span className="meeting-host-avatar">{meeting.ownerImageUrl ? <img src={meeting.ownerImageUrl} alt=""/> : meeting.ownerName.slice(0, 1).toUpperCase()}</span>
          <div><small>{meeting.status === "live" ? (zh ? "● 正在进行" : "● LIVE NOW") : countdown(meeting.scheduledAt - now, zh)}</small><h3>{meeting.title}</h3><p>{zh ? `发起人：${meeting.ownerName}` : `Hosted by ${meeting.ownerName}`} · {meeting.participantCount} {zh ? "位成员" : "members"}{meeting.activeCallId ? ` · ${meeting.callParticipantCount} ${zh ? "人在通话" : "in call"}` : ""}</p></div>
          <div className="meeting-actions"><button disabled={busy} onClick={() => meetingAction(meeting, "join")}>{meeting.status === "live" ? (zh ? "加入会议" : "Join meeting") : (zh ? "进入群聊" : "Enter chat")}</button>{meeting.isOwner && <button className="meeting-end" disabled={busy} onClick={() => meetingAction(meeting, "end")}>{meeting.status === "live" ? (zh ? "结束" : "End") : (zh ? "取消预约" : "Cancel")}</button>}</div>
        </article>)}
        {!visible.length && <div className="meeting-empty"><b>{tab === "live" ? (zh ? "目前没有正在进行的会议" : "No live meetings right now") : (zh ? "目前没有已预约的会议" : "No upcoming meetings")}</b><p>{zh ? "预约一个主题会话，邀请社区会员边聊边练。" : "Schedule a focused conversation and practice together."}</p></div>}
      </div>
      {error && <p className="meeting-error" role="alert">{error}</p>}
    </div>}
  </section>;
}
