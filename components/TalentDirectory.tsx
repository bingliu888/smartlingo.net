"use client";

import Link from "next/link";

/**
 * Backward-compatible content for old /talent links. The route itself now
 * redirects to /classes; this component remains useful to cached clients.
 */
export function TalentDirectory({ lang }: { lang: "en" | "zh" }) {
  const zh = lang === "zh";
  const roles = [
    {
      name: zh ? "学习者" : "Learner",
      body: zh ? "选择语言路径、完成每日训练，并加入适合自己的课程社区。" : "Choose a language path, complete daily practice, and join the right course Community.",
    },
    {
      name: zh ? "老师" : "Teacher",
      body: zh ? "使用经批准的语言路径准备专属课堂、带领练习并支持学员。" : "Use an approved language path to prepare a private course, lead practice, and support learners.",
    },
    {
      name: zh ? "协调员" : "Coordinator",
      body: zh ? "组织课程日程、邀请、公告、社区和学员支持，不必冒充语言教师。" : "Organize schedules, invitations, announcements, Community, and learner support without pretending to be a language teacher.",
    },
    {
      name: zh ? "会话伙伴" : "Conversation partner",
      body: zh ? "通过社区、消息和实时聊天，在清楚边界下帮助同伴练习真实会话。" : "Help peers practice real conversations through Community, messages, and Live Chat with clear boundaries.",
    },
  ];

  return (
    <section className="talent-directory-main">
      <header className="talent-directory-hero">
        <div>
          <p className="section-kicker">{zh ? "课程目录" : "COURSE DIRECTORY"}</p>
          <h1>{zh ? "旧入口已迁移到课程中心。" : "This legacy entry now points to Courses."}</h1>
          <p>
            {zh
              ? "从同一个入口先选择学习语言，再浏览三级课程的九个固定期限套餐并查看自己的课程。"
              : "Use one place to choose a learning language, browse nine fixed-term packages across three levels, and view your courses."}
          </p>
        </div>
        <Link className="primary-button" href={`/${lang}/classes`}>
          {zh ? "进入课程中心" : "Open Courses"} →
        </Link>
      </header>
      <div className="talent-card-grid">
        {roles.map((tier) => (
          <article key={tier.name}>
            <div className="talent-card-head">
              <span aria-hidden="true">{tier.name.slice(0, 1)}</span>
              <div><h2>{tier.name}</h2><p>{tier.body}</p></div>
            </div>
          </article>
        ))}
      </div>
      <aside className="talent-boundary">
        {zh
          ? "每位登录会员都可作为老师或协调员准备专属课堂；进入公开目录和启用真实收费前须完成适用审核。"
          : "Every signed-in member may prepare a private course as teacher or coordinator; public listing and live payment require the applicable review."}
      </aside>
    </section>
  );
}
