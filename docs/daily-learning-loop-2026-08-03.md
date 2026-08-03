# SmartLingo 每日学习循环 / Daily learning loop

日期 / Date: 2026-08-03  
内容版本 / Content version: `2026-08-03.1`

## 1. 每日练习编排 / Daily session composition

每个课程日保持服务端权威的 60 分钟，不把会员在引导中选择的 5–20 分钟日目标误当成课程完成证据。编排器读取会员目标、当前阶段与单元、近 30 日五技能分和到期词汇，确定性地分配原创新课、间隔复习、词汇、阅读、写作、听力、对话和结束回顾。五项技能每天都出现；课程模板中的重点技能只作为情境重点，不再过滤其余技能。

Each course day remains a server-authoritative 60 minutes. A member's 5–20 minute onboarding goal is a pacing preference, never evidence that a course day is complete. The composer reads the learner's goal, current stage and unit, recent 30-day scores across all five skills, and due vocabulary. It deterministically allocates original new material, spaced review, vocabulary, reading, writing, listening, dialogue, and a recap. All five skills appear every day; course-template focus skills no longer hide the others.

## 2. 作答反馈 / Answer feedback

普通练习由服务器重建版本化题目并判分，提交后才返回正确性、双语自然语言讲解、下一步提示与内容版本。跳过会明确记录为跳过，绝不显示为掌握。反馈明确说明它是人工智能练习反馈，不是真人教师评价，也不是正式或官方考试结果。

The server reconstructs each versioned practice item and grades it before returning correctness, bilingual plain-language explanation, a next-step hint, and the content version. A skip remains an honest skip and is never displayed as mastery. Every explanation states that it is artificial-intelligence practice feedback, not a human-teacher judgment or a formal or official exam result.

## 3. 学习 XP 与连续学习 / Learning XP and streaks

学习 XP 只在服务器成功写入学习活动后幂等发放，并由该活动的服务器分数计算。XP 使用独立账本，与平台订阅介绍人积分、班级购买、班主收款、退款、打赏和连接账户收费完全隔离；它不具现金价值。连续学习使用首次记录的权威 IANA 时区和学习者本地日期，并以修订号比较更新防止较旧并发请求覆盖新状态；每个滚动 30 天窗口最多自动修复一个被前后学习日包围的单日空档，界面同时显示当前与最长连续天数。

Learning XP is awarded idempotently only after a server learning activity is saved, and its amount derives from the server score. XP has its own ledger and is completely separate from platform-subscription introducer credit, class purchases, owner payouts, refunds, tips, and connected-account charges; it has no cash value. Streaks use the first recorded authoritative IANA timezone and learner-local dates, and revision compare-and-swap reconciliation prevents an older concurrent request from overwriting newer state. At most one surrounded single-day gap can be repaired in each rolling 30-day window, and the interface shows both current and longest streaks.

## 4. 中断恢复与跨设备同步 / Resume and cross-device sync

每个课程日有不可变编排、服务器保存的逐修订草稿快照和带修订号的检查点。客户端只在 `sessionStorage` 暂存未提交答案，弱网恢复后以客户端操作编号重放；服务器只用自己的历史快照作为三方合并基线，并由数据库触发器在同一更新中写入新快照与操作回执。互不重叠的跨设备编辑可以合并，同一字段冲突返回 `409` 并保留两边内容供用户处理。草稿、客户端计时或暂停操作都不能标记任务或课程完成；课程完成必须同时具备五技能、测验和服务端计时证据。

Each course day has an immutable composition, server-owned per-revision draft snapshots, and a revisioned checkpoint. The client uses `sessionStorage` only for unsubmitted answers and replays them with a client operation ID after weak-network recovery. The server uses only its own historical snapshot as the three-way merge base, while a database trigger records the next snapshot and operation receipt inside the same update. Disjoint cross-device edits merge, while same-field conflicts return `409` and preserve both sides for review. A draft, client timer, or pause can never mark a task or course complete; completion requires five-skill, quiz, and server-timer evidence together.

## 5. 验收合约 / Acceptance contract

- D1 迁移 `0032`、`0033` 与 `0034` 增量增加检查点、服务器修订快照、带请求指纹的同步收据、作答反馈、学习 XP 和连续学习状态；请求指纹绑定不可变课程日范围，过期离线草稿不会写入新课程日；测验回执、attempt、逐题反馈、学习活动与 XP 使用同一 D1 事务，并验证失败全量回滚。
- 专项测试覆盖精确分钟分配、弱项加权、双语错误讲解、XP 无现金价值、跨月与时区日期、滚动 30 天修复、离线三方合并、重复测验写入、服务端计时和修订号冲突。
- 完整门禁覆盖 36 个可重复 D1 迁移与 214 项测试；在途请求与后续输入分离的纯状态机测试验证丢响应后先确认旧操作、再为排队草稿生成新操作 ID。
- 训练标签支持左右方向键、`aria-controls` 与单一 `tabpanel`；响应式发布门槛继续覆盖中英文和五个指定视口。

- D1 migrations `0032`, `0033`, and `0034` additively introduce checkpoints, server revision snapshots, request-fingerprinted sync receipts, answer feedback, learning XP, and streak state. Fingerprints bind an immutable course-day scope so a stale offline draft cannot land in a new day. Quiz receipts, attempts, per-response feedback, learning activity, and XP share one D1 transaction, with a forced-failure rollback check.
- Focused tests cover exact minute allocation, weak-skill weighting, bilingual incorrect-answer explanations, non-cash XP, month and timezone boundaries, rolling-30-day repair, offline three-way merge, duplicate quiz writes, server timers, and revision conflicts.
- The complete gate covers 36 repeatable D1 migrations and 214 tests. A pure state-machine regression separates an immutable in-flight request from later typing, confirming the old operation after a lost response before assigning the queued draft a new operation ID.
- Training tabs support Left/Right Arrow keys, `aria-controls`, and one `tabpanel`; the responsive release gate continues across Chinese, English, and all five required viewports.
