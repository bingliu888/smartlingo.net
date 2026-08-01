export type RoadmapCopy = { zh: string; en: string };

export type SmartLingoRoadmapTask = {
  id: string;
  status: "done" | "planned" | "blocked";
  progress: number;
  title: RoadmapCopy;
  summary: RoadmapCopy;
};

export type SmartLingoRoadmapDay = {
  date: string;
  status: "done" | "planned" | "blocked";
  category: RoadmapCopy;
  owner: RoadmapCopy;
  acceptance: RoadmapCopy;
  tasks: SmartLingoRoadmapTask[];
};

// Strict JSON is the single source of truth for the public Project calendar,
// task pages, daily reports, and the scheduled five-task delivery automation.
const smartLingoRoadmapJson = String.raw`[
  {
    "date": "2026-07-31",
    "status": "done",
    "category": { "zh": "迁移与产品基础", "en": "Migration and product foundation" },
    "owner": { "zh": "SmartLingo 平台团队", "en": "SmartLingo platform team" },
    "acceptance": { "zh": "旧站可见内容已完整留档，产品、商务与积分边界已固定，并公开连续二十天、每天五项的交付计划。", "en": "The browser-visible legacy site is archived, product, commerce, and reward boundaries are fixed, and a twenty-day plan with five tasks per day is public." },
    "tasks": [
      { "id": "sl-d01-legacy-archive", "status": "done", "progress": 100, "title": { "zh": "保存旧站可见内容", "en": "Archive the browser-visible legacy site" }, "summary": { "zh": "保存首页、欢迎页、图标、社交分享图、文件大小与校验值，迁移后不依赖旧站资源。", "en": "Preserve the home and welcome pages, icons, social preview, file sizes, and checksums so the migration does not depend on legacy assets." } },
      { "id": "sl-d01-learning-reference", "status": "done", "progress": 100, "title": { "zh": "研究成熟语言学习方法", "en": "Study proven language-learning patterns" }, "summary": { "zh": "参考成熟产品的短课、复习、连续学习、好友互助和教师班级方法，只吸收原则，不复制品牌、题库或视觉资产。", "en": "Use proven patterns for short lessons, review, streaks, social accountability, and teacher classes without copying branding, item banks, or visual assets." } },
      { "id": "sl-d01-independent-foundation", "status": "done", "progress": 100, "title": { "zh": "建立独立站点与通用界面基础", "en": "Establish the independent site and shared UI" }, "summary": { "zh": "建立独立代码与配置边界，并对齐麻将导师的双语页眉、头像、项目入口、社区、消息、智能导师和自适应版面。", "en": "Establish independent code and configuration boundaries and align the Mahj.Guru bilingual header, avatar, Project link, Community, messaging, Guru, and responsive shell." } },
      { "id": "sl-d01-commercial-rules", "status": "done", "progress": 100, "title": { "zh": "固定班级收费与积分规则", "en": "Freeze class-commerce and reward rules" }, "summary": { "zh": "任何已登录会员都可创建私有班；班级首笔付款优惠百分之十五，优惠后税前金额按班主百分之七十、平台百分之三十分配；班级付款永不产生推荐积分。", "en": "Any signed-in member may create a private class; the first class payment is 15% off, and the discounted pre-tax amount splits 70% to the owner and 30% to the platform; class payments never create referral points." } },
      { "id": "sl-d01-roadmap-contract", "status": "done", "progress": 100, "title": { "zh": "发布一百项路线图与合约", "en": "Publish the 100-task roadmap and contract" }, "summary": { "zh": "从 2026 年 7 月 31 日起安排二十个连续日期，每天恰好五项，并由同一份机器可读数据驱动项目日历与自动开发。", "en": "Schedule twenty consecutive dates from July 31, 2026 with exactly five tasks per day, driven by one machine-readable source for Project and automation." } }
    ]
  },
  {
    "date": "2026-08-01",
    "status": "planned",
    "category": { "zh": "身份、数据与智能服务", "en": "Identity, data, and AI foundation" },
    "owner": { "zh": "SmartLingo 云平台团队", "en": "SmartLingo cloud platform team" },
    "acceptance": { "zh": "身份、结构化数据、媒体和智能服务使用独立配置，所有密钥留在服务端，失败时安全回退。", "en": "Identity, structured data, media, and AI use independent configuration, with secrets server-side and safe failure modes." },
    "tasks": [
      { "id": "sl-d02-clerk-auth", "status": "planned", "progress": 0, "title": { "zh": "接入 Clerk 邮箱验证码身份", "en": "Integrate Clerk email-code identity" }, "summary": { "zh": "启用无需密码的首次注册、会话桥接、缺失要求处理、验证码状态和验证码人机保护挂载点。", "en": "Enable passwordless first registration, the app-session bridge, missing-requirement handling, explicit code state, and the CAPTCHA mount point." } },
      { "id": "sl-d02-d1-model", "status": "planned", "progress": 0, "title": { "zh": "建立 D1 核心数据模型", "en": "Build the D1 core data model" }, "summary": { "zh": "保存学习路径、练习、进度、班级、成员、订单、平台订阅付款、直接推荐与幂等积分账本。", "en": "Store learning paths, exercises, progress, classes, members, orders, platform subscription payments, direct referrals, and an idempotent reward ledger." } },
      { "id": "sl-d02-r2-media", "status": "planned", "progress": 0, "title": { "zh": "建立 R2 私有媒体存储", "en": "Establish private R2 media storage" }, "summary": { "zh": "为头像、班级封面、语音练习和聊天附件建立签名验证、大小限制、授权读取与删除策略。", "en": "Add signatures, size limits, authorized reads, and deletion policies for avatars, class covers, voice practice, and chat attachments." } },
      { "id": "sl-d02-openai-gateway", "status": "planned", "progress": 0, "title": { "zh": "建立智能服务网关", "en": "Build the AI service gateway" }, "summary": { "zh": "统一文字智能导师、听力、口语、写作反馈和安全审核的服务端调用、限流、用量、超时与回退。", "en": "Centralize server-side calls, limits, usage, timeouts, and fallbacks for text Guru, listening, speaking, writing feedback, and safety review." } },
      { "id": "sl-d02-infrastructure-tests", "status": "planned", "progress": 0, "title": { "zh": "测试基础设施隔离", "en": "Test infrastructure isolation" }, "summary": { "zh": "验证迁移可重复、越权被拒绝、上传受限、密钥不进前端，并在身份或智能服务故障时给出可恢复状态。", "en": "Verify repeatable migrations, denied unauthorized access, constrained uploads, server-only secrets, and recoverable identity or AI failures." } }
    ]
  },
  {
    "date": "2026-08-02",
    "status": "planned",
    "category": { "zh": "七种语言与学习路径", "en": "Seven languages and learning paths" },
    "owner": { "zh": "SmartLingo 课程团队", "en": "SmartLingo curriculum team" },
    "acceptance": { "zh": "学习者可从西班牙语、英语、法语、日语、德语、意大利语和韩语选择清晰、版本化的学习路径。", "en": "Learners can choose clear, versioned paths for Spanish, English, French, Japanese, German, Italian, and Korean." },
    "tasks": [
      { "id": "sl-d03-language-catalog", "status": "planned", "progress": 0, "title": { "zh": "发布七种语言目录", "en": "Publish the seven-language catalog" }, "summary": { "zh": "为每种语言提供稳定编号、名称、文字方向、语音能力、阶段和当前内容状态。", "en": "Give each language a stable ID, name, writing direction, speech capabilities, stages, and current content status." } },
      { "id": "sl-d03-goal-onboarding", "status": "planned", "progress": 0, "title": { "zh": "建立目标与水平引导", "en": "Build goal and level onboarding" }, "summary": { "zh": "让学习者选择语言、使用场景、每日时长和自报水平，并可跳过定位测试从基础开始。", "en": "Let learners choose language, use case, daily time, and self-reported level, or skip placement and begin with fundamentals." } },
      { "id": "sl-d03-placement-check", "status": "planned", "progress": 0, "title": { "zh": "建立可选定位测评", "en": "Build optional placement checks" }, "summary": { "zh": "使用版本化原创题和服务端判定推荐起点，明确定位结果不是正式语言证书。", "en": "Use versioned original items and server-trusted scoring to recommend a start point, clearly not a formal language certificate." } },
      { "id": "sl-d03-unit-map", "status": "planned", "progress": 0, "title": { "zh": "建立阶段与单元地图", "en": "Build the stage and unit map" }, "summary": { "zh": "将词汇、听力、口语、阅读、写作和真实场景按先决条件组织成可视进度路径。", "en": "Organize vocabulary, listening, speaking, reading, writing, and real scenarios into a visible prerequisite path." } },
      { "id": "sl-d03-path-tests", "status": "planned", "progress": 0, "title": { "zh": "测试学习路径完整性", "en": "Test learning-path integrity" }, "summary": { "zh": "覆盖语言切换、阶段边界、内容版本、定位重测、进度保留和无可用内容的友好回退。", "en": "Cover language switching, stage boundaries, content versions, placement retakes, progress retention, and safe no-content fallbacks." } }
    ]
  },
  {
    "date": "2026-08-03",
    "status": "planned",
    "category": { "zh": "每日学习循环", "en": "Daily learning loop" },
    "owner": { "zh": "SmartLingo 学习体验团队", "en": "SmartLingo learning experience team" },
    "acceptance": { "zh": "学习者每天获得短而完整的练习、即时讲解、复习与进度反馈，随时可暂停和继续。", "en": "Learners receive short complete sessions, instant explanations, review, and progress feedback that can pause and resume." },
    "tasks": [
      { "id": "sl-d04-session-composer", "status": "planned", "progress": 0, "title": { "zh": "建立每日练习编排", "en": "Build the daily session composer" }, "summary": { "zh": "根据目标、阶段、薄弱点和可用时间组合新课、复习、听说读写与结束总结。", "en": "Compose new material, review, four-skill practice, and a recap from goals, stage, weak areas, and available time." } },
      { "id": "sl-d04-answer-feedback", "status": "planned", "progress": 0, "title": { "zh": "实现即时反馈与讲解", "en": "Implement instant feedback and explanations" }, "summary": { "zh": "每次作答都显示正确性、自然语言讲解、可选提示和可追溯的内容版本。", "en": "Show correctness, plain-language explanations, optional hints, and traceable content versions for every response." } },
      { "id": "sl-d04-learning-xp", "status": "planned", "progress": 0, "title": { "zh": "建立学习经验值与连续学习", "en": "Build learning XP and streaks" }, "summary": { "zh": "用不具现金价值的学习经验值鼓励练习，连续学习按用户时区计算并提供公平修复规则。", "en": "Use non-cash learning XP to encourage practice, with streaks calculated in the learner timezone and fair recovery rules." } },
      { "id": "sl-d04-resume-sync", "status": "planned", "progress": 0, "title": { "zh": "实现中断恢复与跨设备同步", "en": "Implement resume and cross-device sync" }, "summary": { "zh": "服务端保存检查点、去重提交和冲突处理，弱网时保留草稿但不伪造完成。", "en": "Keep server checkpoints, deduplicate submissions, resolve conflicts, and retain drafts on weak networks without fabricating completion." } },
      { "id": "sl-d04-loop-tests", "status": "planned", "progress": 0, "title": { "zh": "测试每日学习循环", "en": "Test the daily learning loop" }, "summary": { "zh": "覆盖重复点击、跨日、时区、断线、恢复、错误讲解、无障碍键盘操作和学习记录审计。", "en": "Cover duplicate actions, day boundaries, timezones, offline recovery, explanation errors, keyboard accessibility, and progress auditing." } }
    ]
  },
  {
    "date": "2026-08-04",
    "status": "planned",
    "category": { "zh": "词汇与间隔复习", "en": "Vocabulary and spaced review" },
    "owner": { "zh": "SmartLingo 词汇学习团队", "en": "SmartLingo vocabulary team" },
    "acceptance": { "zh": "原创词汇内容通过卡片、语境和间隔复习形成可解释、可调整的长期记忆计划。", "en": "Original vocabulary content supports an explainable, adjustable long-term memory plan through cards, context, and spaced review." },
    "tasks": [
      { "id": "sl-d05-vocabulary-records", "status": "planned", "progress": 0, "title": { "zh": "建立版本化词汇记录", "en": "Build versioned vocabulary records" }, "summary": { "zh": "保存词形、读音、词义、例句、难度、主题、来源类型和人工审核状态。", "en": "Store form, pronunciation, meaning, examples, difficulty, topic, source type, and human-review status." } },
      { "id": "sl-d05-flashcards", "status": "planned", "progress": 0, "title": { "zh": "建立多模式词汇卡", "en": "Build multimodal flashcards" }, "summary": { "zh": "支持识别、回忆、听音选词、拼写与例句填空，避免只靠翻译记忆。", "en": "Support recognition, recall, listen-and-select, spelling, and contextual cloze instead of translation-only memorization." } },
      { "id": "sl-d05-spaced-engine", "status": "planned", "progress": 0, "title": { "zh": "建立间隔复习引擎", "en": "Build the spaced-review engine" }, "summary": { "zh": "依据每次表现安排下一次复习，允许用户标记太易、太难或暂时忽略。", "en": "Schedule the next review from each response and allow learners to mark items too easy, too hard, or temporarily ignored." } },
      { "id": "sl-d05-mistake-book", "status": "planned", "progress": 0, "title": { "zh": "建立错题与重点词本", "en": "Build mistake and focus lists" }, "summary": { "zh": "自动归集反复错误和用户收藏，按技能与原因生成短复习包。", "en": "Collect repeated errors and saved items, then generate short review packs by skill and error reason." } },
      { "id": "sl-d05-vocabulary-tests", "status": "planned", "progress": 0, "title": { "zh": "测试词汇学习质量", "en": "Test vocabulary-learning quality" }, "summary": { "zh": "验证调度确定性、重复词、文字方向、音频缺失、内容撤回、时区和跨设备同步。", "en": "Verify scheduling determinism, duplicates, writing direction, missing audio, content withdrawal, timezones, and cross-device sync." } }
    ]
  },
  {
    "date": "2026-08-05",
    "status": "planned",
    "category": { "zh": "听力与发音", "en": "Listening and pronunciation" },
    "owner": { "zh": "SmartLingo 语音课程团队", "en": "SmartLingo speech curriculum team" },
    "acceptance": { "zh": "学习者可用自然语速材料练听力，并获得谨慎、可解释的发音反馈而非身份或口音优劣判断。", "en": "Learners practice with natural-speed material and receive cautious, explainable pronunciation feedback without identity or accent-value judgments." },
    "tasks": [
      { "id": "sl-d06-listening-library", "status": "planned", "progress": 0, "title": { "zh": "建立原创听力素材库", "en": "Build an original listening library" }, "summary": { "zh": "提供慢速、自然语速、场景对话、短广播与逐句文本，标记说话人数、难度和权利来源。", "en": "Provide slow and natural speech, scenario dialogue, short radio, and sentence transcripts with speaker count, level, and rights provenance." } },
      { "id": "sl-d06-dictation", "status": "planned", "progress": 0, "title": { "zh": "建立分级听写练习", "en": "Build graded dictation practice" }, "summary": { "zh": "支持重复播放、降速、逐词揭示和可解释的拼写差异，记录帮助使用而不惩罚辅助需求。", "en": "Support replay, slower speed, word reveal, and explainable spelling differences, recording help use without penalizing accommodation needs." } },
      { "id": "sl-d06-pronunciation-capture", "status": "planned", "progress": 0, "title": { "zh": "建立发音录制与回放", "en": "Build pronunciation recording and playback" }, "summary": { "zh": "只有明确按下录音后才采集语音，提供预览、重录、删除和明确保留期限。", "en": "Capture audio only after an explicit recording action, with preview, retry, deletion, and a clear retention period." } },
      { "id": "sl-d06-pronunciation-feedback", "status": "planned", "progress": 0, "title": { "zh": "提供谨慎的发音反馈", "en": "Provide cautious pronunciation feedback" }, "summary": { "zh": "对可听清度、目标音和节奏给出练习建议，显示不确定性，不推断国籍、族裔、身份或能力。", "en": "Offer practice suggestions for intelligibility, target sounds, and rhythm with uncertainty, never inferring nationality, ethnicity, identity, or ability." } },
      { "id": "sl-d06-speech-tests", "status": "planned", "progress": 0, "title": { "zh": "测试听力、录音与隐私", "en": "Test listening, recording, and privacy" }, "summary": { "zh": "覆盖麦克风拒绝、静音、噪声、超时、音频删除、授权读取、文字替代和反馈失败回退。", "en": "Cover denied microphone access, silence, noise, timeouts, audio deletion, authorized reads, text alternatives, and feedback failure fallbacks." } }
    ]
  },
  {
    "date": "2026-08-06",
    "status": "planned",
    "category": { "zh": "实时语音与场景对话", "en": "Live audio and scenario conversation" },
    "owner": { "zh": "SmartLingo 实时学习团队", "en": "SmartLingo realtime learning team" },
    "acceptance": { "zh": "登录会员可与智能导师进行有明确录音状态、文字记录控制和安全回退的实时语言对话。", "en": "Signed-in members can hold realtime language conversations with Guru using clear recording state, transcript controls, and safe fallbacks." },
    "tasks": [
      { "id": "sl-d07-live-audio-entry", "status": "planned", "progress": 0, "title": { "zh": "建立实时语音入口", "en": "Build the Live Audio entry" }, "summary": { "zh": "从学习面板与智能导师麦克风进入；未登录时保留上下文并引导登录，登录后直接返回语音场景。", "en": "Enter from learning and Guru microphone controls; preserve context through sign-in and return directly to the voice scenario." } },
      { "id": "sl-d07-scenario-library", "status": "planned", "progress": 0, "title": { "zh": "建立真实场景对话库", "en": "Build the real-world scenario library" }, "summary": { "zh": "覆盖咖啡店、机场、面试、学校、工作和旅行，并允许班主选择平台审核的场景。", "en": "Cover cafés, airports, interviews, school, work, and travel, with class owners selecting platform-reviewed scenarios." } },
      { "id": "sl-d07-conversation-coach", "status": "planned", "progress": 0, "title": { "zh": "建立对话教练", "en": "Build the conversation coach" }, "summary": { "zh": "根据水平控制语速、句长和提示，先维持交流，再在合适时机纠正并说明替代表达。", "en": "Adapt speed, sentence length, and hints to level, sustaining communication before timely corrections and alternatives." } },
      { "id": "sl-d07-session-recap", "status": "planned", "progress": 0, "title": { "zh": "生成语音会话复盘", "en": "Generate voice-session recaps" }, "summary": { "zh": "用户确认后保存关键词、常见错误、可重练片段和下一步建议，不保存未同意的完整音频。", "en": "With user confirmation, save key phrases, recurring errors, replayable segments, and next steps without retaining unconsented full audio." } },
      { "id": "sl-d07-live-audio-tests", "status": "planned", "progress": 0, "title": { "zh": "测试实时语音可靠性", "en": "Test Live Audio reliability" }, "summary": { "zh": "覆盖权限撤回、设备切换、网络抖动、重连、重复会话、字幕、键盘退出、安全词和成本限制。", "en": "Cover permission withdrawal, device changes, network jitter, reconnection, duplicate sessions, captions, keyboard exit, safety phrases, and cost limits." } }
    ]
  },
  {
    "date": "2026-08-07",
    "status": "planned",
    "category": { "zh": "阅读与写作", "en": "Reading and writing" },
    "owner": { "zh": "SmartLingo 读写课程团队", "en": "SmartLingo literacy team" },
    "acceptance": { "zh": "学习者可阅读分级原创内容、完成理解练习，并在保留本人表达的前提下获得写作反馈。", "en": "Learners read graded original content, complete comprehension practice, and receive writing feedback that preserves their authorship." },
    "tasks": [
      { "id": "sl-d08-graded-reading", "status": "planned", "progress": 0, "title": { "zh": "建立分级阅读库", "en": "Build the graded reading library" }, "summary": { "zh": "提供故事、对话、通知、邮件和工作场景文章，记录原创或许可来源、难度和词汇覆盖。", "en": "Provide stories, dialogues, notices, email, and workplace texts with original or licensed provenance, level, and vocabulary coverage." } },
      { "id": "sl-d08-reading-support", "status": "planned", "progress": 0, "title": { "zh": "建立沉浸阅读辅助", "en": "Build immersive reading support" }, "summary": { "zh": "支持点词解释、逐句朗读、文字方向、字号、行距和选择性译文，不遮挡原文。", "en": "Support tap definitions, sentence audio, writing direction, type size, spacing, and optional translation without obscuring the source text." } },
      { "id": "sl-d08-comprehension", "status": "planned", "progress": 0, "title": { "zh": "建立阅读理解练习", "en": "Build reading comprehension practice" }, "summary": { "zh": "使用主旨、细节、推断和排序题，答案引用原文位置并提供错因讲解。", "en": "Use main-idea, detail, inference, and ordering items, citing source locations and explaining errors." } },
      { "id": "sl-d08-writing-coach", "status": "planned", "progress": 0, "title": { "zh": "建立写作教练", "en": "Build the writing coach" }, "summary": { "zh": "对任务完成、清晰度、语法和词汇给出量表反馈，提供建议而不替用户完成作业或考试。", "en": "Give rubric feedback on task completion, clarity, grammar, and vocabulary without doing assignments or exams for the learner." } },
      { "id": "sl-d08-literacy-tests", "status": "planned", "progress": 0, "title": { "zh": "测试读写与原创边界", "en": "Test literacy and originality boundaries" }, "summary": { "zh": "覆盖长文、右到左文字、引用定位、草稿恢复、提示注入、抄袭请求、无障碍朗读和数据删除。", "en": "Cover long text, right-to-left scripts, citation anchors, draft recovery, prompt injection, plagiarism requests, accessible reading, and deletion." } }
    ]
  },
  {
    "date": "2026-08-08",
    "status": "planned",
    "category": { "zh": "智能导师与个性化复习", "en": "Ask Guru and personalized review" },
    "owner": { "zh": "SmartLingo 智能学习团队", "en": "SmartLingo AI learning team" },
    "acceptance": { "zh": "文字智能导师公开可用，登录后可使用个人学习上下文，但绝不越权读取班级或其他学习者资料。", "en": "Text Guru is public; signed-in tutoring can use personal learning context without accessing unauthorized class or learner data." },
    "tasks": [
      { "id": "sl-d09-public-guru", "status": "planned", "progress": 0, "title": { "zh": "完善公开文字智能导师", "en": "Complete public text Ask Guru" }, "summary": { "zh": "访客可询问语言选择、平台使用与示例短句，并使用复制、朗读、评价和分享图标。", "en": "Visitors can ask about language choice, platform use, and sample phrases, with copy, read-aloud, rating, and share controls." } },
      { "id": "sl-d09-learning-context", "status": "planned", "progress": 0, "title": { "zh": "接入个人学习上下文", "en": "Connect personal learning context" }, "summary": { "zh": "登录后只读取用户允许的当前语言、阶段、近期错误与目标，为每条上下文显示来源。", "en": "After sign-in, read only permitted language, stage, recent errors, and goals, showing the source for each context item." } },
      { "id": "sl-d09-review-generator", "status": "planned", "progress": 0, "title": { "zh": "生成个性化复习包", "en": "Generate personalized review packs" }, "summary": { "zh": "从已学内容和错题生成短复习，题目在发布前通过确定性结构、安全和答案检查。", "en": "Generate short reviews from learned content and mistakes, with deterministic structure, safety, and answer checks before release." } },
      { "id": "sl-d09-teacher-assist", "status": "planned", "progress": 0, "title": { "zh": "建立班主教学辅助", "en": "Build class-owner teaching assistance" }, "summary": { "zh": "为教师或协调员提供活动建议、公告润色和班级摘要，不泄露个人私密作答或代替人工决定。", "en": "Suggest activities, polish announcements, and summarize class patterns without exposing private answers or replacing human decisions." } },
      { "id": "sl-d09-ai-safety-tests", "status": "planned", "progress": 0, "title": { "zh": "测试智能服务安全", "en": "Test AI service safety" }, "summary": { "zh": "覆盖提示注入、跨用户和跨班越权、考试代答、限流、超时、敏感内容、未成年人保护与人工接管。", "en": "Cover prompt injection, cross-user and cross-class access, exam-answer requests, limits, timeouts, sensitive content, youth protections, and human escalation." } }
    ]
  },
  {
    "date": "2026-08-09",
    "status": "planned",
    "category": { "zh": "会员自助开班", "en": "Member-created classes" },
    "owner": { "zh": "SmartLingo 班级产品团队", "en": "SmartLingo class product team" },
    "acceptance": { "zh": "任何已登录会员都可作为教师或协调员创建私有语言班、邀请学生并管理明确范围内的班级资料。", "en": "Any signed-in member can create a private language class as teacher or coordinator, invite students, and manage scoped class data." },
    "tasks": [
      { "id": "sl-d10-class-roles", "status": "planned", "progress": 0, "title": { "zh": "定义教师与协调员角色", "en": "Define teacher and coordinator roles" }, "summary": { "zh": "教师负责教学内容与反馈，协调员负责安排与沟通；角色权限由服务端分别强制。", "en": "Teachers manage teaching and feedback while coordinators manage scheduling and communication, with server-enforced permissions." } },
      { "id": "sl-d10-class-wizard", "status": "planned", "progress": 0, "title": { "zh": "建立自助开班向导", "en": "Build the self-service class wizard" }, "summary": { "zh": "选择语言路径、角色、班名、简介、时区、日程、人数和每人费用，默认仅邀请可见。", "en": "Choose language path, role, name, description, timezone, schedule, capacity, and per-person fee, private by default." } },
      { "id": "sl-d10-private-access", "status": "planned", "progress": 0, "title": { "zh": "实现私有班访问控制", "en": "Implement private-class access control" }, "summary": { "zh": "只有班主、受邀者和已报名成员可见班级内容与名册；邮箱和付款资料不对成员公开。", "en": "Only owners, invitees, and enrolled members can see class content and rosters; email and payment details stay private." } },
      { "id": "sl-d10-invite-enrollment", "status": "planned", "progress": 0, "title": { "zh": "建立邀请与报名流程", "en": "Build invitation and enrollment" }, "summary": { "zh": "邀请链接跨登录保持班级上下文，接受后建立唯一报名状态，并防止重复加入与班级串线。", "en": "Preserve class context through sign-in, create one enrollment on acceptance, and prevent duplicates or cross-class leakage." } },
      { "id": "sl-d10-class-tests", "status": "planned", "progress": 0, "title": { "zh": "测试自助开班权限", "en": "Test self-service class permissions" }, "summary": { "zh": "覆盖免费会员开班、角色切换、人数上限、无效语言、重复邀请、越权编辑、关闭班级与数据保留。", "en": "Cover free-member creation, role changes, capacity, invalid languages, duplicate invites, unauthorized edits, closure, and retention." } }
    ]
  },
  {
    "date": "2026-08-10",
    "status": "planned",
    "category": { "zh": "班级社区与共同学习", "en": "Class community and social learning" },
    "owner": { "zh": "SmartLingo 社区团队", "en": "SmartLingo community team" },
    "acceptance": { "zh": "每个班级拥有受权限保护的社区、共同目标、同伴互助和安全治理，平台公共社区保持独立。", "en": "Each class has a permission-protected community, shared goals, peer support, and safety governance, separate from the public Community." },
    "tasks": [
      { "id": "sl-d11-class-forum", "status": "planned", "progress": 0, "title": { "zh": "建立班级论坛", "en": "Build class forums" }, "summary": { "zh": "按单元组织公告、问答、练习讨论和教师置顶主题，仅有效班级成员可参与。", "en": "Organize announcements, Q&A, practice discussions, and pinned teacher topics by unit for active class members only." } },
      { "id": "sl-d11-shared-goals", "status": "planned", "progress": 0, "title": { "zh": "建立班级共同目标", "en": "Build shared class goals" }, "summary": { "zh": "班主可设置每周学习目标，成员只分享自愿公开的完成状态，不公开私密成绩。", "en": "Owners can set weekly goals; members share only opted-in completion status, never private scores." } },
      { "id": "sl-d11-peer-practice", "status": "planned", "progress": 0, "title": { "zh": "建立同伴练习配对", "en": "Build peer practice pairing" }, "summary": { "zh": "成员可自愿按语言、时区和练习类型寻找同班伙伴，并随时退出、拉黑或举报。", "en": "Members can opt into classmate matching by language, timezone, and practice type, with exit, block, and report controls." } },
      { "id": "sl-d11-social-progress", "status": "planned", "progress": 0, "title": { "zh": "建立可选择的学习动态", "en": "Build opt-in learning activity" }, "summary": { "zh": "展示用户主动分享的连续学习、里程碑和鼓励，不公开错误详情、付款或未成年人位置。", "en": "Show user-shared streaks, milestones, and encouragement without error details, payments, or youth location." } },
      { "id": "sl-d11-community-tests", "status": "planned", "progress": 0, "title": { "zh": "测试班级社区与治理", "en": "Test class community and governance" }, "summary": { "zh": "覆盖未报名访问、跨班越权、举报、拉黑、删除、成员离班、教师停权和证据保留。", "en": "Cover unenrolled access, cross-class authorization, reports, blocks, deletion, class departure, teacher suspension, and evidence retention." } }
    ]
  },
  {
    "date": "2026-08-11",
    "status": "planned",
    "category": { "zh": "班主工作台与教学运营", "en": "Class-owner workspace and operations" },
    "owner": { "zh": "SmartLingo 教学运营团队", "en": "SmartLingo learning operations team" },
    "acceptance": { "zh": "教师和协调员拥有适合各自角色的名册、日程、教学活动与汇总统计，但看不到无关私密资料。", "en": "Teachers and coordinators receive role-appropriate rosters, schedules, activities, and aggregates without unrelated private data." },
    "tasks": [
      { "id": "sl-d12-owner-dashboard", "status": "planned", "progress": 0, "title": { "zh": "建立班主工作台", "en": "Build the class-owner dashboard" }, "summary": { "zh": "汇总班级状态、报名人数、即将上课、待回复问题、平台审核和收款准备状态。", "en": "Summarize class state, enrollment, upcoming sessions, unanswered questions, platform review, and payment readiness." } },
      { "id": "sl-d12-roster-controls", "status": "planned", "progress": 0, "title": { "zh": "建立名册与角色管理", "en": "Build roster and role management" }, "summary": { "zh": "支持邀请、移除、暂停、转移班主和共同教师，并用二次确认保护高风险变更。", "en": "Support invitations, removal, suspension, ownership transfer, and co-teachers with confirmation for high-risk changes." } },
      { "id": "sl-d12-schedule-tools", "status": "planned", "progress": 0, "title": { "zh": "建立时区安全的日程工具", "en": "Build timezone-safe scheduling" }, "summary": { "zh": "按参与者本地时间显示课程、变更和取消，保存原始时区并防止重复通知。", "en": "Show sessions, changes, and cancellations in participant local time while preserving source timezone and deduplicating notifications." } },
      { "id": "sl-d12-class-insights", "status": "planned", "progress": 0, "title": { "zh": "提供保护隐私的班级统计", "en": "Provide privacy-preserving class insights" }, "summary": { "zh": "只展示参与率、完成率和常见薄弱点等汇总；小群体不展示可识别细分。", "en": "Show aggregates such as participation, completion, and common weak areas; suppress identifiable small-group breakdowns." } },
      { "id": "sl-d12-operations-tests", "status": "planned", "progress": 0, "title": { "zh": "测试班级运营边界", "en": "Test class-operations boundaries" }, "summary": { "zh": "覆盖角色降级、班主转移、时区变化、取消、通知去重、小群体隐私和跨班统计隔离。", "en": "Cover role downgrade, ownership transfer, timezone changes, cancellation, notification deduplication, small-group privacy, and class isolation." } }
    ]
  },
  {
    "date": "2026-08-12",
    "status": "planned",
    "category": { "zh": "Stripe Connect 收款准备", "en": "Stripe Connect payout readiness" },
    "owner": { "zh": "SmartLingo 商务平台团队", "en": "SmartLingo commerce platform team" },
    "acceptance": { "zh": "班主通过 Stripe 托管开户连接自己的收款账户；未满足收款和提现要求前不能开放真实班级结账。", "en": "Class owners connect payout accounts through Stripe-hosted onboarding; live class checkout stays disabled until charge and payout requirements are met." },
    "tasks": [
      { "id": "sl-d13-connect-account", "status": "planned", "progress": 0, "title": { "zh": "建立连接账户记录", "en": "Build connected-account records" }, "summary": { "zh": "一名班主对应一个平台内连接账户引用，只保存所需状态，不复制银行或身份核验资料。", "en": "Map one class owner to one platform connected-account reference, storing only required status without copying bank or identity details." } },
      { "id": "sl-d13-hosted-onboarding", "status": "planned", "progress": 0, "title": { "zh": "接入 Stripe 托管开户", "en": "Integrate Stripe-hosted onboarding" }, "summary": { "zh": "使用一次性返回与刷新链接完成身份、企业和提现信息收集，链接只在服务端创建。", "en": "Use single-use return and refresh links for identity, business, and payout collection, created only server-side." } },
      { "id": "sl-d13-readiness-state", "status": "planned", "progress": 0, "title": { "zh": "建立收款准备状态", "en": "Build payout-readiness state" }, "summary": { "zh": "根据收费、提现和待补资料状态启用或暂停结账，并给班主显示可行动的中英文说明。", "en": "Enable or pause checkout from charge, payout, and requirement states, with actionable bilingual guidance for owners." } },
      { "id": "sl-d13-connect-webhooks", "status": "planned", "progress": 0, "title": { "zh": "处理连接账户回调", "en": "Handle connected-account webhooks" }, "summary": { "zh": "验证签名、幂等更新状态、记录审计并在账户受限时停止新付款而不破坏既有学习权限。", "en": "Verify signatures, update state idempotently, audit changes, and stop new payments when restricted without breaking existing learning access." } },
      { "id": "sl-d13-connect-tests", "status": "planned", "progress": 0, "title": { "zh": "测试收款账户生命周期", "en": "Test connected-account lifecycle" }, "summary": { "zh": "覆盖未开户、资料缺失、受限、恢复、账户错配、伪造回调、重复事件和停用班主。", "en": "Cover not-started, requirements due, restriction, recovery, account mismatch, forged callbacks, duplicate events, and owner suspension." } }
    ]
  },
  {
    "date": "2026-08-13",
    "status": "planned",
    "category": { "zh": "班级结账、优惠与分账", "en": "Class checkout, discount, and split" },
    "owner": { "zh": "SmartLingo 支付团队", "en": "SmartLingo payments team" },
    "acceptance": { "zh": "同一学习者对同一班级的首笔成功付款优惠百分之十五；优惠后税前金额严格按班主百分之七十、平台百分之三十分配。", "en": "The first successful payment per learner-class receives 15% off; the discounted pre-tax amount splits exactly 70% to the owner and 30% to the platform." },
    "tasks": [
      { "id": "sl-d14-first-payment-discount", "status": "planned", "progress": 0, "title": { "zh": "实现首笔班级付款优惠", "en": "Implement the first class-payment discount" }, "summary": { "zh": "优惠资格由服务端按学习者与班级唯一组合判断，仅首笔成功付款享受百分之十五，失败或取消不消耗资格。", "en": "Determine eligibility server-side per learner-class; only the first successful payment gets 15% off, while failed or canceled attempts do not consume eligibility." } },
      { "id": "sl-d14-destination-charge", "status": "planned", "progress": 0, "title": { "zh": "建立平台结账与目的地分账", "en": "Build platform checkout and destination split" }, "summary": { "zh": "使用 Stripe Connect 目的地付款，让班主直接收到应得份额，平台只保留明确的平台份额。", "en": "Use Stripe Connect destination charges so the owner receives the owner share and the platform retains only its stated share." } },
      { "id": "sl-d14-split-math", "status": "planned", "progress": 0, "title": { "zh": "固定百分之七十与百分之三十分账算法", "en": "Freeze the 70/30 split arithmetic" }, "summary": { "zh": "先从班级标价计算优惠，再以优惠后税前整数最小货币单位分账；舍入差额进入平台份额且总额必须守恒。", "en": "Apply the discount to the class price, then split discounted pre-tax integer minor units; rounding remainder goes to the platform and totals must reconcile." } },
      { "id": "sl-d14-payment-webhooks", "status": "planned", "progress": 0, "title": { "zh": "建立付款、退款与争议账本", "en": "Build payment, refund, and dispute ledgers" }, "summary": { "zh": "以已验证回调作为付款权威，幂等开通报名；退款时按规则反向转账并记录平台费用处理。", "en": "Use verified webhooks as payment authority, enroll idempotently, and reverse transfers under refund policy with platform-fee treatment recorded." } },
      { "id": "sl-d14-commerce-tests", "status": "planned", "progress": 0, "title": { "zh": "测试优惠、分账与退款", "en": "Test discount, split, and refunds" }, "summary": { "zh": "覆盖并发首付、重复回调、多币种最小单位、税费、舍入、部分退款、全额退款、争议和连接账户受限。", "en": "Cover concurrent first payments, duplicate webhooks, currency minor units, tax, rounding, partial and full refunds, disputes, and restricted accounts." } }
    ]
  },
  {
    "date": "2026-08-14",
    "status": "planned",
    "category": { "zh": "平台会员与直接推荐积分", "en": "Platform memberships and direct-referral points" },
    "owner": { "zh": "SmartLingo 会员与增长团队", "en": "SmartLingo membership and growth team" },
    "acceptance": { "zh": "平台会员权益和价格清楚；只有平台账户成功收取订阅费时，直接介绍人才能获得一次幂等积分，班级付款绝不触发积分。", "en": "Platform benefits and prices are clear; only a successful platform subscription charge can create one idempotent reward for the direct introducer, never a class payment." },
    "tasks": [
      { "id": "sl-d15-membership-plans", "status": "planned", "progress": 0, "title": { "zh": "建立平台会员方案", "en": "Build platform membership plans" }, "summary": { "zh": "为免费、增强学习和班主工具定义清晰权益、月付年付状态与取消规则，不把开班权限制为付费专属。", "en": "Define clear Free, enhanced-learning, and owner-tool benefits with monthly, yearly, and cancellation states, without gating class creation behind payment." } },
      { "id": "sl-d15-subscription-checkout", "status": "planned", "progress": 0, "title": { "zh": "建立平台订阅结账", "en": "Build platform subscription checkout" }, "summary": { "zh": "平台账户收取订阅费，结账前显示周期、价格、续费和取消，正式价格发布前保持真实收费关闭。", "en": "Charge subscriptions through the platform account, showing period, price, renewal, and cancellation; keep live charging off until prices are approved." } },
      { "id": "sl-d15-direct-attribution", "status": "planned", "progress": 0, "title": { "zh": "建立单层直接介绍关系", "en": "Build single-level direct attribution" }, "summary": { "zh": "一名用户最多保存一名符合条件的直接介绍人，不追溯上级、不形成多层关系，也不因注册发放付款积分。", "en": "Store at most one eligible direct introducer, with no upline or multi-level relationship and no payment reward merely for registration." } },
      { "id": "sl-d15-reward-ledger", "status": "planned", "progress": 0, "title": { "zh": "建立平台订阅积分账本", "en": "Build the platform-subscription reward ledger" }, "summary": { "zh": "只在平台订阅付款成功回调后向直接介绍人记一次积分，每个订阅付款编号只能对应一笔积分；班级订单类型在数据库层被拒绝。", "en": "Credit the direct introducer only after a successful platform subscription payment webhook, once per subscription payment ID; reject class-order event types at the database boundary." } },
      { "id": "sl-d15-reward-tests", "status": "planned", "progress": 0, "title": { "zh": "测试积分资格与冲正", "en": "Test reward eligibility and reversal" }, "summary": { "zh": "覆盖续费、失败、重试、重复回调、退款、取消、无介绍人、自我推荐、班级付款和多层伪造。", "en": "Cover renewals, failure, retry, duplicate webhooks, refunds, cancellation, no introducer, self-referral, class payments, and forged multi-level claims." } }
    ]
  },
  {
    "date": "2026-08-15",
    "status": "planned",
    "category": { "zh": "消息、实时聊天与通知", "en": "Messaging, Live Chat, and notifications" },
    "owner": { "zh": "SmartLingo 沟通体验团队", "en": "SmartLingo communications team" },
    "acceptance": { "zh": "平台与班级沟通支持私信、群组实时聊天、回复、附件、已读、通知和智能导师润色，并保持权限隔离。", "en": "Platform and class communication supports direct and group Live Chat, replies, attachments, read state, notifications, and Guru polish with authorization isolation." },
    "tasks": [
      { "id": "sl-d16-direct-messages", "status": "planned", "progress": 0, "title": { "zh": "完善受控私信", "en": "Complete controlled direct messages" }, "summary": { "zh": "允许用户在平台规则和班级关系内私信，支持会话分页、已读、拉黑、举报和成员离开后的权限更新。", "en": "Allow messaging within platform rules and class relationships with pagination, read state, blocks, reports, and permission updates after departure." } },
      { "id": "sl-d16-group-chat", "status": "planned", "progress": 0, "title": { "zh": "完善班级群组实时聊天", "en": "Complete class group Live Chat" }, "summary": { "zh": "支持在线状态、回复、重连、成员变更和教师公告，历史消息按班级保留策略授权读取。", "en": "Support presence, replies, reconnection, membership changes, and teacher announcements with retention-based authorized history." } },
      { "id": "sl-d16-attachments", "status": "planned", "progress": 0, "title": { "zh": "建立安全聊天附件", "en": "Build safe chat attachments" }, "summary": { "zh": "验证文件签名、类型和大小，禁止主动内容，使用短时授权下载并支持删除和举报保全。", "en": "Validate signatures, types, and sizes, block active content, use short-lived authorized downloads, and support deletion and report preservation." } },
      { "id": "sl-d16-guru-polish", "status": "planned", "progress": 0, "title": { "zh": "接入请智能导师润色", "en": "Integrate Polish with Guru" }, "summary": { "zh": "新消息和回复输入框都可润色草稿，保留原意、目标语言、加载、错误、键盘和触控行为。", "en": "Polish drafts in both new-message and reply composers while preserving intent, target language, loading, errors, keyboard, and touch behavior." } },
      { "id": "sl-d16-communications-tests", "status": "planned", "progress": 0, "title": { "zh": "测试消息与通知", "en": "Test messaging and notifications" }, "summary": { "zh": "覆盖跨班越权、回复、附件、已读、断线、重复通知、拉黑、举报、成员移除和智能导师失败回退。", "en": "Cover cross-class access, replies, attachments, reads, disconnection, duplicate notifications, blocks, reports, removal, and Guru failure fallback." } }
    ]
  },
  {
    "date": "2026-08-16",
    "status": "planned",
    "category": { "zh": "发现、质量与班级公开审核", "en": "Discovery, quality, and public class review" },
    "owner": { "zh": "SmartLingo 信任与课程质量团队", "en": "SmartLingo trust and class quality team" },
    "acceptance": { "zh": "私有班可通过邀请增长；只有通过内容、价格、班主和安全审核的版本才能进入公开目录。", "en": "Private classes grow by invitation; only versions passing content, price, owner, and safety review can enter the public catalog." },
    "tasks": [
      { "id": "sl-d17-public-application", "status": "planned", "progress": 0, "title": { "zh": "建立班级公开申请", "en": "Build public-class applications" }, "summary": { "zh": "班主提交课程说明、语言、日程、费用、适龄范围、内容权利和支持计划，提交不自动公开。", "en": "Owners submit description, language, schedule, fee, age range, content rights, and support plan; submission never auto-publishes." } },
      { "id": "sl-d17-automated-preflight", "status": "planned", "progress": 0, "title": { "zh": "建立公开目录自动预检", "en": "Build public-catalog preflight" }, "summary": { "zh": "检查内容完整、误导承诺、图片权利、价格状态、重复班级、敏感内容和连接账户准备状态。", "en": "Check completeness, misleading claims, image rights, price state, duplicates, sensitive content, and connected-account readiness." } },
      { "id": "sl-d17-admin-review", "status": "planned", "progress": 0, "title": { "zh": "建立管理员人工审核", "en": "Build Admin human review" }, "summary": { "zh": "支持批准、退回修改、拒绝、暂停、原因代码、证据与完整审计记录。", "en": "Support approval, changes requested, rejection, suspension, reason codes, evidence, and a complete audit trail." } },
      { "id": "sl-d17-class-discovery", "status": "planned", "progress": 0, "title": { "zh": "建立审核后班级目录", "en": "Build the reviewed class catalog" }, "summary": { "zh": "按语言、水平、时区、日程和费用筛选，显示班主角色、退款规则与审核日期，不作效果保证。", "en": "Filter by language, level, timezone, schedule, and fee, showing owner role, refund policy, and review date without outcome guarantees." } },
      { "id": "sl-d17-quality-tests", "status": "planned", "progress": 0, "title": { "zh": "测试审核、下架与发现", "en": "Test review, takedown, and discovery" }, "summary": { "zh": "覆盖并发审核、重新提交、版本替换、紧急下架、搜索越权、过期日程、受限账户和通知。", "en": "Cover concurrent review, resubmission, version replacement, emergency takedown, search authorization, expired schedules, restricted accounts, and notices." } }
    ]
  },
  {
    "date": "2026-08-17",
    "status": "planned",
    "category": { "zh": "安全、隐私、无障碍与自适应界面", "en": "Security, privacy, accessibility, and responsive UI" },
    "owner": { "zh": "SmartLingo 质量与安全团队", "en": "SmartLingo quality and safety team" },
    "acceptance": { "zh": "主要页面在中英文和手机、平板、桌面都无横向溢出、文字错位或权限泄露，并符合隐私与无障碍要求。", "en": "Primary pages in both languages have no horizontal overflow, text misalignment, or authorization leaks across phone, tablet, and desktop, and meet privacy and accessibility requirements." },
    "tasks": [
      { "id": "sl-d18-security-review", "status": "planned", "progress": 0, "title": { "zh": "完成威胁模型与权限审计", "en": "Complete threat modeling and authorization audit" }, "summary": { "zh": "覆盖身份、学习、班级、消息、媒体、智能服务、付款、回调和管理员操作的对象级权限。", "en": "Cover object-level authorization for identity, learning, classes, messages, media, AI, payments, webhooks, and Admin actions." } },
      { "id": "sl-d18-privacy-controls", "status": "planned", "progress": 0, "title": { "zh": "建立隐私同意与数据控制", "en": "Build privacy consent and data controls" }, "summary": { "zh": "让用户查看、导出、撤回可选共享和申请删除，分别说明语音、智能服务、班级与付款数据保留。", "en": "Let users view, export, withdraw optional sharing, and request deletion, with separate retention explanations for voice, AI, class, and payment data." } },
      { "id": "sl-d18-accessibility", "status": "planned", "progress": 0, "title": { "zh": "完成无障碍体验", "en": "Complete accessibility support" }, "summary": { "zh": "支持键盘、焦点、可见标签、图标名称、字幕、减少动态效果、颜色对比和不触发移动端输入缩放。", "en": "Support keyboard, focus, visible labels, icon names, captions, reduced motion, color contrast, and non-zooming mobile inputs." } },
      { "id": "sl-d18-responsive-contract", "status": "planned", "progress": 0, "title": { "zh": "执行最高优先级自适应版面合约", "en": "Enforce the highest-priority responsive layout contract" }, "summary": { "zh": "在 390×844、430×932、820×1180、1180×820 和 1440×900 的中英文页面实测文字容纳、面板宽度、单栏语义组和最终计算样式。", "en": "Measure text containment, panel width, single-column semantic groups, and final computed styles in both languages at 390×844, 430×932, 820×1180, 1180×820, and 1440×900." } },
      { "id": "sl-d18-quality-gates", "status": "planned", "progress": 0, "title": { "zh": "建立发布阻断质量门禁", "en": "Build release-blocking quality gates" }, "summary": { "zh": "运行数据迁移、全量测试、代码检查、生产构建、产物验证、敏感信息扫描和运行时版面测量，任一失败都不发布。", "en": "Run migrations, full tests, lint, production build, artifact validation, secret scan, and runtime layout measurement; any failure blocks release." } }
    ]
  },
  {
    "date": "2026-08-18",
    "status": "planned",
    "category": { "zh": "真实用户与端到端验收", "en": "Real-user and end-to-end acceptance" },
    "owner": { "zh": "SmartLingo 验收团队", "en": "SmartLingo acceptance team" },
    "acceptance": { "zh": "首位用户与四名测试用户在生产候选环境完成登录、学习、开班、社区、付款沙箱、平台订阅推荐积分和安全边界验收。", "en": "The first user and four test users complete sign-in, learning, classes, Community, payment-sandbox, subscription-referral rewards, and safety-boundary acceptance in the release candidate." },
    "tasks": [
      { "id": "sl-d19-test-accounts", "status": "planned", "progress": 0, "title": { "zh": "建立五名独立验收用户", "en": "Create five independent acceptance users" }, "summary": { "zh": "确认首位用户没有错误介绍人，并为测试 1 至测试 4 建立独立档案、头像和可撤回的测试同意。", "en": "Confirm the first user has no erroneous introducer and create independent profiles, avatars, and revocable test consent for users 1–4." } },
      { "id": "sl-d19-learning-journey", "status": "planned", "progress": 0, "title": { "zh": "验证完整语言学习流程", "en": "Verify the full language-learning journey" }, "summary": { "zh": "完成目标选择、定位、每日练习、词汇复习、听说读写、智能导师、实时语音、进度同步与隐私删除。", "en": "Complete goal selection, placement, daily practice, vocabulary review, four skills, Guru, Live Audio, progress sync, and privacy deletion." } },
      { "id": "sl-d19-class-social-journey", "status": "planned", "progress": 0, "title": { "zh": "验证开班与共同学习", "en": "Verify class creation and social learning" }, "summary": { "zh": "让测试 1 作为教师或协调员建私有班，邀请测试 2、3、4，并验证论坛、共同目标、私信和群组聊天。", "en": "Have test one create a private class as teacher or coordinator, invite tests 2–4, and verify forums, shared goals, direct messages, and group chat." } },
      { "id": "sl-d19-commerce-journey", "status": "planned", "progress": 0, "title": { "zh": "验证班级付款沙箱与分账", "en": "Verify sandbox class payment and split" }, "summary": { "zh": "验证同一学习者班级首付优惠百分之十五、优惠后税前百分之七十与百分之三十分账、重复回调和退款反向转账。", "en": "Verify the per-learner-class first-payment 15% discount, post-discount pre-tax 70/30 split, duplicate webhooks, and refund transfer reversal." } },
      { "id": "sl-d19-reward-boundary", "status": "planned", "progress": 0, "title": { "zh": "验证平台订阅推荐积分边界", "en": "Verify platform-subscription reward boundaries" }, "summary": { "zh": "让直接介绍关系只在平台订阅成功付款时逐次记积分，并证明注册、班级付款、多层关系、失败和重复回调都不发积分。", "en": "Credit a direct introducer once per successful platform subscription payment and prove registration, class payments, multi-level links, failures, and duplicate callbacks earn nothing." } }
    ]
  },
  {
    "date": "2026-08-19",
    "status": "planned",
    "category": { "zh": "生产发布与每日自动开发", "en": "Production release and daily automation" },
    "owner": { "zh": "SmartLingo 发布团队", "en": "SmartLingo release team" },
    "acceptance": { "zh": "同一验证提交同步到 GitHub、Sites 和正式域名；每日自动任务只完成最早未完成日期的五项，并在失败时安全停止和重试。", "en": "One validated commit reaches GitHub, Sites, and the production domain; daily automation completes exactly five tasks for the earliest unfinished day and stops safely for retry on failure." },
    "tasks": [
      { "id": "sl-d20-domain-services", "status": "planned", "progress": 0, "title": { "zh": "完成域名、证书与生产服务", "en": "Complete domain, certificates, and production services" }, "summary": { "zh": "验证 SmartLingo.net 与 www 的 DNS、站点证书、Clerk 前端证书、D1、R2、智能服务和 Stripe 回调，不影响其他域名。", "en": "Verify DNS, site and Clerk certificates, D1, R2, AI, and Stripe webhooks for SmartLingo.net and www without affecting other domains." } },
      { "id": "sl-d20-release-sync", "status": "planned", "progress": 0, "title": { "zh": "同步 GitHub 与 Sites 生产", "en": "Synchronize GitHub and Sites production" }, "summary": { "zh": "所有门禁通过后，将同一提交推送到现有 GitHub 主分支和唯一 Sites 项目，保存版本、公开部署并保留回滚点。", "en": "After every gate passes, push the same commit to the existing GitHub main and sole Sites project, save a version, deploy publicly, and preserve rollback." } },
      { "id": "sl-d20-production-acceptance", "status": "planned", "progress": 0, "title": { "zh": "完成正式域名双语验收", "en": "Complete bilingual production acceptance" }, "summary": { "zh": "验收首页、学习、班级、社区、消息、实时聊天、智能导师、登录、账户、项目、结账关闭或沙箱状态和 Worker 错误日志。", "en": "Verify home, learning, classes, Community, messages, Live Chat, Guru, sign-in, Account, Project, checkout-off or sandbox state, and Worker error logs." } },
      { "id": "sl-d20-daily-automation", "status": "planned", "progress": 0, "title": { "zh": "启用每天五项自动开发", "en": "Enable five-task daily automation" }, "summary": { "zh": "每天读取最早未完成日期恰好五项，逐项提供代码、内容、测试、迁移、文档或生产证据，更新日历和双语日报；已完成项不重复。", "en": "Daily, complete exactly five tasks from the earliest unfinished date with code, content, tests, migration, documentation, or production evidence, then update calendar and bilingual report without repeats." } },
      { "id": "sl-d20-recovery-report", "status": "planned", "progress": 0, "title": { "zh": "验证恢复并发布一百项总结", "en": "Verify recovery and publish the 100-task summary" }, "summary": { "zh": "演练 D1、媒体、付款回调和部署回滚，确认二十天、一百个唯一任务与完整证据，并公开后续维护责任。", "en": "Exercise D1, media, payment-webhook, and deployment recovery, confirm twenty days and 100 unique evidenced tasks, and publish ongoing maintenance ownership." } }
    ]
  }
]`;

export const smartLingoRoadmapDays = JSON.parse(smartLingoRoadmapJson) as SmartLingoRoadmapDay[];

export const smartLingoRoadmapTasks = smartLingoRoadmapDays.flatMap(day =>
  day.tasks.map(task => ({
    ...task,
    date: day.date,
    category: day.category,
    owner: day.owner,
  })),
);
