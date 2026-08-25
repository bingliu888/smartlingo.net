# SmartLingo Project Daily QA · 2026-08-24

## 中文管理员报告

### 结论

2026-08-24 的两部分生产真实用户验收已完成。验收使用中文界面与匿名化专用测试学员，在真实 Chrome 生产会话中覆盖英语、日语、西班牙语和意大利语。全程保持“三次跟读与评分”关闭，没有请求麦克风权限，没有执行支付、退款、推荐、证书或管理员操作，也没有记录测试邮箱、验证码、邮件正文、Cookie 或会话信息。

最终版本为 `2b03b07`，GitHub Actions → Cloudflare 生产发布 `32793847369` 通过。最终自动化结果为 361/361，通过 TypeScript、64 个 D1 迁移、生产构建、501 个源文件及 436 个客户端构件的敏感信息扫描、修改文件 lint、共享站点政策、共享架构、基础功能一致性和 11 个共享合同。

### 第一部分：匿名 Play 六个 tile

- 今日速成、SmartCard 练习、SmartCard 挑战、免费初级课程、排行榜、积分兑换六个 tile 均独立要求选择语言；在今日速成选择英语不会带入其他 tile。
- 匿名 SmartCard 与生活口语按各自 feature cookie 恢复；免费日语初级课程的词汇、反馈、Continue 与后续写作位置可在刷新后恢复。
- 从 Play 重新进入今日速成会清理匿名旧轮次并从 05:00、1/5 开始；计时结束后延长 5 分钟会保留当前题目及反馈。
- SmartCard 挑战使用学习者本地日期 `2026-08-24`、日期型题库、20 题；没有 Check/Continue，反馈约 6 秒后自动进入下一题。
- Repeat After Me 默认关闭，匿名验收没有请求麦克风。

### 第二部分：登录学员 Dashboard 与四语矩阵

- Dashboard 显示今日速成、SmartCard 练习、SmartCard 挑战、生活口语及已订阅课程的已选语言区；Add Language 与 Add Course 独立进入各自选择页。
- 四种语言均完成课程词汇、阅读、写作、听力和对话的真实交互；词汇/SmartCard 精确恢复，阅读及文本对话保存，写作/听力完成真实组句、自动判题、反馈与题号推进。意大利语听力完成完整 10 题并保存。
- 四种语言均完成五技能今日速成、SmartCard 答题→反馈→Continue、当地日期 SmartCard 挑战自动推进、生活口语无麦克风 Continue、排行榜与分数历史检查。
- 生活口语初、中、高三级均有独立标题、阶段标签和不同开场词汇；正常语速状态为 `0.84×`，慢速为实际 `0.42×`，`aria-pressed` 与可见状态可双向切换。浏览器控制无法可靠测量实体扬声器的听觉时长，因此没有虚构声学时长。
- 所有生产浏览器轮次的 console error/warn 为 0；QA 创建的临时标签已关闭，原有 Dashboard handoff 保留。

| 学习语言 | 计划活跃分钟 / 深度重点 | 生产 UI 可见持久化课程分钟 | 课程证据 | 今日速成 / 分数历史 | Play 与持久化 |
| --- | --- | --- | --- | --- | --- |
| 英语 | 2 / 口语 | 5（词汇 1、阅读 2、对话 2） | 词汇 85；阅读 100；写作、听力各从 1/10 推进到 2/10；文本对话 100 | 60/100，+12 | SmartCard 1/20→2/20、积分 100→110 并刷新保持；挑战 8/20→9/20；生活口语 1/28→2/28；Sprint Top25 有真实记录 |
| 日语 | 2 / 听力 | 4（阅读 2、对话 2） | 阅读 100；听力 1/10→2/10；写作含两个「を」的 16 槽题正确并 1/10→2/10；文本对话 100 | 60/100，+12 | SmartCard +10 且刷新保持；当地日期挑战自动推进；生活口语继续并保持语言；排行榜真实读取 |
| 西班牙语 | 2 / 口语 | 4（阅读 2、对话 2） | 阅读 100；听力正确；写作先错误反馈再正确反馈；文本对话 100 | 80/100，+25 | SmartCard +10 且刷新保持；当地日期挑战自动推进；生活口语继续并保持语言；排行榜真实读取 |
| 意大利语 | 5 / 写作 | 6（阅读 2、听力 2、对话 2） | 阅读 100；听力完整 10 题并保存 100；写作正确反馈；文本对话 100 | 80/100，+25 | SmartCard +10 且刷新保持；当地日期挑战自动推进；生活口语继续并保持语言；排行榜真实读取 |

“生产 UI 可见持久化课程分钟”是课程日明细中实际显示的数据库记录，不是导航、等待、登录或部署时间。单题写作/听力在完整 10 题轮次结束前不会写入课程分钟，因此表格没有把这些单题推算成分钟。

### 本轮发现并修复

1. 匿名初级课程刷新后丢失词汇位置与分数：新增服务器权威断点并修复精确恢复。
2. 登录词汇练习只恢复技能、不恢复具体卡片：新增 D1 迁移 `0168_vocabulary_practice_resume`。
3. 日语今日速成阅读出现重复选项标签：更新内容版本、优先使用当前轮词汇并清理旧计划。
4. 订阅课程缺少独立阅读入口：新增 Reading tile 与 `training=reading` 路由映射。
5. 课程对话文本回答被三次语音评分锁住：改为无需麦克风的正式路径，语音评分保留为可选。
6. 文本对话按钮继承隐藏 Check 规则而不可见：新增专用可见主操作样式。
7. 日语组句两个相同「を」产生候选歧义：已选词块从候选区移除，撤回时重新出现。
8. 生活口语中/高级播放器不显示等级且开场相同：显示等级、按级轮换词汇，并显示精确正常/慢速状态。

### 发布与恢复链

- `b7018ef` / `32778775291`，`b0c72c3` / `32788693787`，`bd1bb65` / `32789118732`：匿名恢复与 API 性能恢复。
- `7b4c146` / `32789764246`：登录词汇精确断点。
- `3cd8993` / `32790409495`：今日速成阅读选项唯一化。
- `61f3024` / `32791349771`：课程独立阅读入口。
- `48323f1` / `32791905001`，`5f74f1e` / `32792329789`：无麦克风文本对话与按钮可见性。
- `2ef1afc` / `32793055401`：重复组句词块。
- `2b03b07` / `32793847369`：生活口语等级及语速状态。

### 教育媒体资产统计

- 12 种语言 × 1,000 个初级词 = 12,000 个初级词条。
- 11,434 个可图像化词条全部有视觉资产，覆盖率 100%。
- 11,643 / 12,000 个全部初级词条有视觉资产；其余 357 个为冠词、介词、代词等功能词豁免。
- 6,044 个可复用语言中立语义媒体概念。
- 12 个生活场景 × 10 个场景 GIF = 120 个场景动图；每个地点、每种语言、每个等级均有 10 组工作人员/学习者一问一答（20 个对话 turn）。
- 完整发布词库为 48,000 条：12 种语言各 1,000 初级、1,500 中级、1,500 高级；生产工作流逐条核验音标、十二种界面语言助读和来源字段。

## English administrator report

### Outcome

The two-part production real-user acceptance for 2026-08-24 is complete. It used the Chinese interface and an anonymized dedicated test learner in the real Chrome production session across English, Japanese, Spanish, and Italian. Repeat After Me stayed off throughout; no microphone permission, payment, refund, referral, certificate, or administrator action was requested. No test address, verification code, email body, cookie, or session artifact was recorded.

The final product commit is `2b03b07`; GitHub Actions → Cloudflare run `32793847369` passed. The final gate passed 361/361 tests, TypeScript, 64 D1 migrations, the production build, sensitive-data scanning of 501 source files and 436 client artifacts, changed-file lint, shared policy, architecture, base-feature consistency, and 11 shared contracts.

### Part A: anonymous Play

All six Play tiles independently requested a language. SmartCard, Everyday, and the free Beginner course kept isolated cookie progress; a fresh Sprint entry reset the anonymous round while extending the timer preserved the answered item. The local-date Challenge used a date-only 20-item set and advanced after about six seconds without Check or Continue. Repeat After Me remained off and no microphone was requested.

### Part B: signed-in learner

Dashboard language sections and independent Add Language/Add Course actions passed. All four languages exercised Course vocabulary, reading, writing, listening, and dialogue; completed a five-skill Sprint; ran SmartCard feedback/Continue, local-date Challenge auto-advance, Everyday no-microphone continuation, Rankings, and Score History. Exact vocabulary/SmartCard position, saved Course feedback, and all four Sprint score rows survived reloads.

| Target | Planned minutes / deep focus | Visible persisted Course minutes | Course evidence | Sprint / Score History |
| --- | --- | --- | --- | --- |
| English | 2 / speaking | 5 | vocab 85; reading 100; writing and listening 1/10→2/10; typed dialogue 100 | 60/100, +12 |
| Japanese | 2 / listening | 4 | reading 100; listening 1/10→2/10; 16-slot duplicate-particle writing correct; typed dialogue 100 | 60/100, +12 |
| Spanish | 2 / speaking | 4 | reading 100; listening correct; writing incorrect then correct feedback; typed dialogue 100 | 80/100, +25 |
| Italian | 5 / writing | 6 | reading 100; full ten-item listening round saved at 100; writing correct; typed dialogue 100 | 80/100, +25 |

Visible persisted Course minutes are the records actually displayed by the production Course day detail. They exclude navigation, loading, login, idle waits, deployment, and unfinished ten-item rounds. Physical speaker timing could not be measured reliably by browser control; the product instead exposes and tests the effective Normal `0.84×` and Slow `0.42×` states without claiming fabricated acoustic duration.

The release chain fixed anonymous and signed-in resume, ambiguous Sprint Reading, the missing Course Reading entry, no-microphone dialogue submission and visibility, duplicate sentence tokens, and explicit Everyday levels/speed. Console error/warn remained zero across the production cycles. Payment, referral, and certificate actions were not exercised; release contracts confirmed their boundaries and QA made no such transaction.
