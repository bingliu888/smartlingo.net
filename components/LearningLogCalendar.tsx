"use client";

import { useId, useMemo, useState, type CSSProperties } from "react";

export type LearningLogDomain = {
  count: number;
  minutes: number;
  averageScore: number | null;
};

export type LearningLogDay = {
  date: string;
  domains: Record<string, LearningLogDomain>;
  communityCount: number;
};

export type LearningLogCalendarProps = {
  lang: "zh" | "en";
  days: LearningLogDay[];
  month: string;
  onMonthChange?: (month: string) => void;
};

type SkillKey = "vocabulary" | "reading" | "writing" | "listening" | "dialogue";

const SKILLS: Array<{ key: SkillKey; zh: string; en: string; color: string }> = [
  { key: "vocabulary", zh: "词汇", en: "Vocabulary", color: "#10a67a" },
  { key: "reading", zh: "阅读", en: "Reading", color: "#2478c4" },
  { key: "writing", zh: "写作", en: "Writing", color: "#8a5bd3" },
  { key: "listening", zh: "听力", en: "Listening", color: "#e09b2d" },
  { key: "dialogue", zh: "对话", en: "Dialogue", color: "#e05e67" },
];

const COMMUNITY = { zh: "社区", en: "Community", color: "#667085" } as const;
const EMPTY_DOMAIN: LearningLogDomain = { count: 0, minutes: 0, averageScore: null };

function safeWholeNumber(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function safeScore(value: number | null) {
  if (value === null || !Number.isFinite(value)) return null;
  return Math.min(100, Math.max(0, value));
}

function getDomain(day: LearningLogDay | undefined, skill: SkillKey) {
  if (!day) return EMPTY_DOMAIN;
  // Older exercise records used "speaking". Keep one public fifth skill by
  // folding that legacy key into the canonical Dialogue domain.
  return day.domains[skill] ?? (skill === "dialogue" ? day.domains.speaking : undefined) ?? EMPTY_DOMAIN;
}

function hasDomainActivity(domain: LearningLogDomain) {
  return safeWholeNumber(domain.count) > 0 || safeWholeNumber(domain.minutes) > 0 || safeScore(domain.averageScore) !== null;
}

function parseMonth(month: string, days: LearningLogDay[]) {
  const direct = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
  const fallback = /^(\d{4})-(0[1-9]|1[0-2])-\d{2}$/.exec(days[0]?.date ?? "");
  const match = direct ?? fallback;
  const year = match ? Number(match[1]) : 1970;
  const monthNumber = match ? Number(match[2]) : 1;
  return { year, monthNumber, key: `${year}-${String(monthNumber).padStart(2, "0")}` };
}

function shiftMonth(year: number, monthNumber: number, amount: number) {
  const date = new Date(Date.UTC(year, monthNumber - 1 + amount, 1, 12));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function hasAnyActivity(day: LearningLogDay | undefined) {
  return Boolean(day && (SKILLS.some(skill => hasDomainActivity(getDomain(day, skill.key))) || safeWholeNumber(day.communityCount) > 0));
}

export function LearningLogCalendar({ lang, days, month, onMonthChange }: LearningLogCalendarProps) {
  const zh = lang === "zh";
  const titleId = useId();
  const parsedMonth = useMemo(() => parseMonth(month, days), [days, month]);
  const dayMap = useMemo(
    () => new Map(days.filter(day => day.date.startsWith(`${parsedMonth.key}-`)).map(day => [day.date, day])),
    [days, parsedMonth.key],
  );
  const activeDates = useMemo(
    () => [...dayMap.values()].filter(hasAnyActivity).map(day => day.date).sort(),
    [dayMap],
  );
  const defaultSelectedDate = activeDates.at(-1) ?? `${parsedMonth.key}-01`;
  const [selection, setSelection] = useState({ month: parsedMonth.key, date: defaultSelectedDate });
  const selectedDate = selection.month === parsedMonth.key ? selection.date : defaultSelectedDate;

  const leadingDays = new Date(Date.UTC(parsedMonth.year, parsedMonth.monthNumber - 1, 1, 12)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(parsedMonth.year, parsedMonth.monthNumber, 0, 12)).getUTCDate();
  const selectedDay = dayMap.get(selectedDate);
  const locale = zh ? "zh-CN" : "en-US";
  const monthTitle = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(parsedMonth.year, parsedMonth.monthNumber - 1, 1, 12)));
  const selectedDateTitle = new Intl.DateTimeFormat(locale, {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${selectedDate}T12:00:00Z`));
  const weekdays = zh ? ["日", "一", "二", "三", "四", "五", "六"] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const describeDate = (date: string, day: LearningLogDay | undefined) => {
    const dateLabel = new Intl.DateTimeFormat(locale, {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${date}T12:00:00Z`));
    const activities = SKILLS.flatMap(skill => {
      const domain = getDomain(day, skill.key);
      if (!hasDomainActivity(domain)) return [];
      const count = safeWholeNumber(domain.count);
      const minutes = safeWholeNumber(domain.minutes);
      const label = zh ? skill.zh : skill.en;
      return [zh ? `${label} ${count} 次，${minutes} 分钟` : `${label}: ${count} activities, ${minutes} minutes`];
    });
    const communityCount = safeWholeNumber(day?.communityCount ?? 0);
    if (communityCount > 0) {
      activities.push(zh ? `社区活动 ${communityCount} 次` : `Community: ${communityCount} activities`);
    }
    return activities.length > 0
      ? `${dateLabel}，${activities.join(zh ? "；" : "; ")}`
      : zh ? `${dateLabel}，暂无学习记录` : `${dateLabel}, no learning activity`;
  };

  return <section className="sl-learning-log" data-layout-fill="learning-log-calendar">
    <style>{`
      .sl-learning-log,
      .sl-learning-log * { box-sizing: border-box; }
      .sl-learning-log {
        width: 100%;
        max-width: none;
        min-width: 0;
        display: grid;
        gap: clamp(24px, 4vw, 48px);
        color: inherit;
      }
      .sl-log-calendar,
      .sl-log-detail {
        width: 100%;
        max-width: none;
        min-width: 0;
        margin: 0;
        border: 1px solid rgba(16, 69, 58, 0.14);
        border-radius: clamp(18px, 2.4vw, 28px);
        background: rgba(255, 255, 255, 0.82);
        box-shadow: 0 18px 48px rgba(18, 64, 54, 0.07);
        overflow: hidden;
      }
      .sl-log-calendar-inner,
      .sl-log-detail-inner {
        width: 100%;
        min-width: 0;
        padding: clamp(16px, 3vw, 32px);
      }
      .sl-log-head {
        width: 100%;
        min-width: 0;
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
        margin-bottom: clamp(18px, 3vw, 28px);
      }
      .sl-log-heading { min-width: 0; }
      .sl-log-kicker {
        margin: 0 0 7px;
        color: #087d62;
        font-size: 0.78rem;
        font-weight: 800;
        letter-spacing: 0.13em;
        text-transform: uppercase;
      }
      .sl-log-heading h2,
      .sl-log-detail h3 {
        max-width: none;
        margin: 0;
        overflow-wrap: anywhere;
        line-height: 1.1;
      }
      .sl-log-heading h2 { font-size: clamp(1.55rem, 4vw, 2.55rem); }
      .sl-log-month-nav {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      .sl-log-month-nav button {
        min-width: 44px;
        min-height: 44px;
        padding: 9px 14px;
        border: 1px solid rgba(16, 69, 58, 0.2);
        border-radius: 999px;
        background: #fff;
        color: inherit;
        font: inherit;
        font-size: max(1rem, 16px);
        font-weight: 750;
        cursor: pointer;
      }
      .sl-log-month-nav button:hover,
      .sl-log-month-nav button:focus-visible {
        border-color: #087d62;
        outline: 3px solid rgba(8, 125, 98, 0.18);
        outline-offset: 2px;
      }
      .sl-log-legend {
        width: 100%;
        min-width: 0;
        display: flex;
        gap: 8px 16px;
        flex-wrap: wrap;
        margin-bottom: 18px;
        font-size: 0.88rem;
        color: rgba(23, 42, 38, 0.76);
      }
      .sl-log-legend span {
        display: inline-flex;
        align-items: center;
        min-width: 0;
        gap: 7px;
      }
      .sl-log-dot {
        width: 8px;
        height: 8px;
        flex: 0 0 8px;
        border-radius: 50%;
        background: var(--sl-log-dot);
      }
      .sl-log-grid {
        width: 100%;
        min-width: 0;
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
        gap: clamp(4px, 1vw, 10px);
      }
      .sl-log-weekday {
        min-width: 0;
        padding: 3px 0 8px;
        color: rgba(23, 42, 38, 0.62);
        font-size: clamp(0.7rem, 1.7vw, 0.86rem);
        font-weight: 760;
        text-align: center;
        overflow-wrap: anywhere;
      }
      .sl-log-empty { min-width: 0; min-height: 1px; }
      .sl-log-day {
        width: 100%;
        min-width: 0;
        min-height: clamp(48px, 9vw, 78px);
        padding: clamp(6px, 1.3vw, 11px);
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        justify-content: space-between;
        gap: 6px;
        border: 1px solid rgba(16, 69, 58, 0.14);
        border-radius: clamp(9px, 1.5vw, 15px);
        background: rgba(249, 251, 247, 0.92);
        color: inherit;
        font: inherit;
        font-size: max(1rem, 16px);
        font-weight: 780;
        line-height: 1;
        cursor: pointer;
        overflow: hidden;
      }
      .sl-log-day:hover,
      .sl-log-day:focus-visible {
        border-color: #087d62;
        outline: 3px solid rgba(8, 125, 98, 0.16);
        outline-offset: 1px;
      }
      .sl-log-day[aria-selected="true"] {
        border-color: #087d62;
        background: #e9f7f1;
        box-shadow: inset 0 0 0 1px #087d62;
      }
      .sl-log-dots {
        width: 100%;
        min-width: 0;
        display: flex;
        align-items: center;
        gap: clamp(2px, 0.6vw, 5px);
        flex-wrap: wrap;
      }
      .sl-log-dots .sl-log-dot {
        width: clamp(5px, 1.2vw, 8px);
        height: clamp(5px, 1.2vw, 8px);
        flex-basis: clamp(5px, 1.2vw, 8px);
      }
      .sl-log-detail-head {
        width: 100%;
        min-width: 0;
        margin-bottom: clamp(18px, 3vw, 28px);
      }
      .sl-log-detail h3 { font-size: clamp(1.35rem, 3vw, 2rem); }
      .sl-log-detail-summary {
        margin: 8px 0 0;
        color: rgba(23, 42, 38, 0.68);
        font-size: 1rem;
        line-height: 1.6;
        overflow-wrap: anywhere;
      }
      .sl-log-domain-grid {
        width: 100%;
        min-width: 0;
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: clamp(10px, 1.6vw, 16px);
      }
      .sl-log-domain {
        min-width: 0;
        padding: clamp(14px, 2.3vw, 22px);
        border: 1px solid rgba(16, 69, 58, 0.12);
        border-top: 4px solid var(--sl-log-accent);
        border-radius: 16px;
        background: #fff;
      }
      .sl-log-domain h4 {
        margin: 0 0 12px;
        font-size: 1rem;
        overflow-wrap: anywhere;
      }
      .sl-log-metrics {
        min-width: 0;
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
      }
      .sl-log-metrics span { min-width: 0; }
      .sl-log-metrics b,
      .sl-log-metrics small { display: block; overflow-wrap: anywhere; }
      .sl-log-metrics b { margin-bottom: 4px; font-size: 1.05rem; }
      .sl-log-metrics small { color: rgba(23, 42, 38, 0.62); font-size: 0.74rem; line-height: 1.3; }
      @media (max-width: 760px) {
        .sl-log-calendar-inner,
        .sl-log-detail-inner { padding: 16px; }
        .sl-log-head { display: grid; grid-template-columns: minmax(0, 1fr); }
        .sl-log-domain-grid { grid-template-columns: minmax(0, 1fr); }
        .sl-log-domain { padding: 15px; }
      }
      @media (min-width: 761px) and (max-width: 1080px) {
        .sl-log-domain-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
      @media (max-width: 430px) {
        .sl-log-grid { gap: 4px; }
        .sl-log-day { padding: 6px 5px; border-radius: 9px; }
        .sl-log-weekday { font-size: 0.68rem; }
        .sl-log-legend { gap: 7px 12px; }
      }
    `}</style>

    <section className="sl-log-calendar" data-layout-fill="learning-calendar" aria-labelledby={titleId}>
      <div className="sl-log-calendar-inner">
        <header className="sl-log-head">
          <div className="sl-log-heading" data-readable-copy>
            <p className="sl-log-kicker">{zh ? "每日学习日志" : "DAILY LEARNING LOG"}</p>
            <h2 id={titleId}>{monthTitle}</h2>
          </div>
          {onMonthChange ? <nav className="sl-log-month-nav" aria-label={zh ? "选择学习月份" : "Choose learning month"}>
            <button type="button" onClick={() => onMonthChange(shiftMonth(parsedMonth.year, parsedMonth.monthNumber, -1))}>
              ← {zh ? "上月" : "Previous"}
            </button>
            <button type="button" onClick={() => onMonthChange(shiftMonth(parsedMonth.year, parsedMonth.monthNumber, 1))}>
              {zh ? "下月" : "Next"} →
            </button>
          </nav> : null}
        </header>

        <div className="sl-log-legend" aria-label={zh ? "学习活动图例" : "Learning activity legend"}>
          {SKILLS.map(skill => <span key={skill.key}>
            <i className="sl-log-dot" style={{ "--sl-log-dot": skill.color } as CSSProperties} aria-hidden="true"/>
            {zh ? skill.zh : skill.en}
          </span>)}
          <span>
            <i className="sl-log-dot" style={{ "--sl-log-dot": COMMUNITY.color } as CSSProperties} aria-hidden="true"/>
            {zh ? COMMUNITY.zh : COMMUNITY.en}
          </span>
        </div>

        <div className="sl-log-grid" data-calendar-grid role="grid" aria-label={zh ? `${monthTitle} 学习日历` : `${monthTitle} learning calendar`}>
          {weekdays.map((weekday, index) => <span className="sl-log-weekday" role="columnheader" key={`${weekday}-${index}`}>{weekday}</span>)}
          {Array.from({ length: leadingDays }, (_, index) => <span className="sl-log-empty" aria-hidden="true" key={`empty-${index}`}/>)}
          {Array.from({ length: daysInMonth }, (_, index) => index + 1).map(dayNumber => {
            const date = `${parsedMonth.key}-${String(dayNumber).padStart(2, "0")}`;
            const day = dayMap.get(date);
            const dots = [
              ...SKILLS.flatMap(skill => hasDomainActivity(getDomain(day, skill.key)) ? [{ key: skill.key, color: skill.color }] : []),
              ...(safeWholeNumber(day?.communityCount ?? 0) > 0 ? [{ key: "community", color: COMMUNITY.color }] : []),
            ].slice(0, 6);

            return <button
              className="sl-log-day"
              data-calendar-day
              type="button"
              role="gridcell"
              key={date}
              aria-label={describeDate(date, day)}
              aria-selected={selectedDate === date}
              onClick={() => setSelection({ month: parsedMonth.key, date })}
            >
              <span aria-hidden="true">{dayNumber}</span>
              <span className="sl-log-dots" aria-hidden="true">
                {dots.map(dot => <i
                  className="sl-log-dot"
                  style={{ "--sl-log-dot": dot.color } as CSSProperties}
                  key={dot.key}
                />)}
              </span>
            </button>;
          })}
        </div>
      </div>
    </section>

    <section className="sl-log-detail" data-layout-fill="learning-day-detail" aria-live="polite">
      <div className="sl-log-detail-inner">
        <header className="sl-log-detail-head" data-readable-copy>
          <p className="sl-log-kicker">{zh ? "当天学习详情" : "SELECTED DAY"}</p>
          <h3>{selectedDateTitle}</h3>
          <p className="sl-log-detail-summary">
            {hasAnyActivity(selectedDay)
              ? zh ? "以下记录来自当天真实完成的学习与社区活动。" : "These entries reflect learning and community activity recorded for this day."
              : zh ? "当天暂无学习或社区活动记录。" : "No learning or community activity was recorded for this day."}
          </p>
        </header>

        <div className="sl-log-domain-grid">
          {SKILLS.map(skill => {
            const domain = getDomain(selectedDay, skill.key);
            const score = safeScore(domain.averageScore);
            return <article className="sl-log-domain" style={{ "--sl-log-accent": skill.color } as CSSProperties} key={skill.key}>
              <h4>{zh ? skill.zh : skill.en}</h4>
              <div className="sl-log-metrics">
                <span><b>{safeWholeNumber(domain.count)}</b><small>{zh ? "完成次数" : "Activities"}</small></span>
                <span><b>{safeWholeNumber(domain.minutes)}</b><small>{zh ? "分钟" : "Minutes"}</small></span>
                <span><b>{score === null ? "—" : Math.round(score)}</b><small>{zh ? "平均分" : "Avg. score"}</small></span>
              </div>
            </article>;
          })}
          <article className="sl-log-domain" style={{ "--sl-log-accent": COMMUNITY.color } as CSSProperties}>
            <h4>{zh ? COMMUNITY.zh : COMMUNITY.en}</h4>
            <div className="sl-log-metrics">
              <span><b>{safeWholeNumber(selectedDay?.communityCount ?? 0)}</b><small>{zh ? "活动次数" : "Activities"}</small></span>
              <span><b>—</b><small>{zh ? "分钟" : "Minutes"}</small></span>
              <span><b>—</b><small>{zh ? "平均分" : "Avg. score"}</small></span>
            </div>
          </article>
        </div>
      </div>
    </section>
  </section>;
}

export default LearningLogCalendar;
