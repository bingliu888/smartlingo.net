# 2026-09-10 SmartLingo recovery — blocked / 恢复验收受阻

## 中文

America/Los_Angeles 日期首先通过系统时钟确认：2026-09-10 03:00:09 PDT（2026-09-10 10:00:09 UTC），处于固定窗口第 21 天。按活动窗口流程执行；没有改名 LaunchAgent 或执行 bootout。

结论：**真实用户验收受阻，未通过**。预定匿名测试身份为 `qa_test_learner_1`，未确认实际登录身份。本文件是管理员 Project 双语待同步阻塞记录，尚未发布到线上 Project。

### 阻塞证据

- Computer Use 枚举到运行中的真实 Chrome，但浏览器连接列表为空。原生 Chrome 状态读取成功，显示 `chrome://profile-picker/`，未进入生产网站。
- 自动审批拒绝点击现有 “Your Chrome” 配置，理由为可能暴露未授权个人会话，以及尚未确认专用 QA 身份。未绕过拒绝，未改用其他站点的 QA 配置，未读取 Gmail、请求验证码或操作个人站内账号。继续需要用户批准打开该现有配置，并仅在确认 SmartLingo 专用 QA 身份后执行学习。
- 当前进程没有 `EDITORIAL_SYNC_SECRET` 或 `CLOUDFLARE_API_TOKEN`（仅检查是否存在，没有输出值）。没有可用的已确认管理员浏览器会话。未尝试无授权写入 Project，不能声称线上记录已更新。
- 初次 GitHub CLI 连接因沙箱网络限制失败；获准网络访问后恢复成功，因此 GitHub 不构成最终阻塞。

### 已完成的独立验证

- 工作区起始干净，分支 `main`，HEAD：`dda861dea4ca59efecb05e9b2943c3dba76c0a7e`。
- 句子目录、学习路径、学习天数／排行榜、21 天 QA 四组本地契约 **22/22 通过**。
- 对 2026-09-10 的单独运行时断言：36 门课程各 120 个唯一句子条目；听力和写作合计 72 个每日题组，各 10 个唯一题目。此检查不证明生产内容或真实交互。
- 今日预检原先缺失，已用 `local_date=2026-09-10` 触发 [GitHub 34463839144](https://github.com/bingliu888/smartlingo.net/actions/runs/34463839144)，终态 `success`，运行提交与上述 HEAD 一致。
- 已完整读取其 `smartlingo-route-preflight-2026-09-10` 工件，32/32 匿名路由通过。工件仅证明路由可用，不证明登录、学习、分数、订阅或持久化。

### 工件中的固定计划与真实结果

| 语言 | 最低活跃分钟 | 课程深度重点 | 功能重点 | 实际活跃分钟 | Course / Play / Everyday | 显示分数 / 持久化日志 |
| --- | --- | --- | --- | --- | --- | --- |
| 英语 en | 5 | 口语 speaking | SmartCard Challenge | 0，未开始计时 | 均未执行 | 无本轮证据 |
| 日语 ja | 5 | 阅读 reading | SmartCard Practice | 0，未开始计时 | 均未执行 | 无本轮证据 |
| 西班牙语 es | 4 | 词汇 vocabulary | Course | 0，未开始计时 | 均未执行 | 无本轮证据 |
| 意大利语 it | 2 | 词汇 vocabulary | SmartCard Practice | 0，未开始计时 | 均未执行 | 无本轮证据 |

尚未进行任何计分或反馈学习动作。Dashboard 四语区域、五项课程技能、两个 Sprint 入口与完整回合、SmartCard、Challenge、Everyday Speaking、Score History、Rankings、Community 和所有服务器持久化验收均待执行。没有生产浏览器完成状态、进度前后值或学习页控制台证据。导航、诊断、等待预检等均未计为学习时间。

没有开启跟读，没有请求麦克风权限；因为没有进入学习页面，未验证控件默认状态。本轮没有支付、推荐、证书或学习数据写入，没有创建分数、SmartCard 积分、挑战、奖励或排行榜记录。未取得账本前后快照，不能独立确认全站账本不变。

没有创建 Chrome 标签、窗口、配置或浏览器／媒体进程，无本轮测试标签需要关闭。保留用户原有配置选择窗口和 Chrome 进程。没有产品代码修改、提交、推送或部署；仅新增本阻塞文档。

解除 Chrome 审批阻塞后从专用 QA 身份确认与 `/zh/dashboard` 开始；同日重试复用上表工件计划，完成全部四语真实交互及持久化证据。Project 同步依赖恢复后发布准确的阻塞或验收记录，不将本文件视为已发布或通过报告。

## English

The first date check returned 2026-09-10 03:00:09 PDT in America/Los_Angeles, campaign day 21. The active-window procedure applies. The LaunchAgent was neither renamed nor unloaded.

**Blocked, not passed.** Intended anonymized learner: `qa_test_learner_1`; the signed-in identity was not verified. This bilingual administrator Project blocker record is local and has not been published.

Computer Use listed running Chrome with no connected browser entries. Native Chrome inspection succeeded and showed `chrome://profile-picker/`. Automatic approval review rejected opening the existing “Your Chrome” profile because it could expose personal sessions before the dedicated QA identity was established. The rejection was not bypassed, no other site's QA profile was substituted, and no Gmail message, OTP or account credential was accessed. Continuing requires approval to open that existing profile and perform learning only after confirming the dedicated SmartLingo QA identity.

The current process has neither `EDITORIAL_SYNC_SECRET` nor `CLOUDFLARE_API_TOKEN`; only presence was checked, without printing values. No verified administrator browser session was available. Project was not updated. Initial sandboxed GitHub connectivity failed, but approved network access succeeded, so GitHub is not a remaining blocker.

The initial working tree was clean on main at `dda861dea4ca59efecb05e9b2943c3dba76c0a7e`. All 22 selected local contracts passed. A separate date-specific runtime assertion confirmed 36 courses with 120 unique sentence entries each and 72 listening/writing rounds with ten unique entries each. These are local code/data checks, not production learning evidence.

Today's missing route preflight was dispatched with local_date 2026-09-10. Run 34463839144 completed successfully at the same commit. Its downloaded artifact was read completely: 32/32 anonymous routes passed. This establishes neither authentication nor learning, scores, subscriptions or persistence.

The artifact's required plan is English 5 minutes / speaking / SmartCard Challenge; Japanese 5 minutes / reading / SmartCard Practice; Spanish 4 minutes / vocabulary / Course; Italian 2 minutes / vocabulary / SmartCard Practice. Every language has 0 active learning minutes, with no timer started, no completed Course/Play/Everyday activities, no displayed score and no persisted learning-log evidence. Dashboard, five Course skills, both Sprint entries and a complete round, SmartCard, Challenge, Everyday, Score History, Rankings and Community all remain untested in a real signed-in session. No learning-page console evidence was obtained.

Repeat-after-me was not enabled and no microphone permission was requested. Learning-control defaults were not inspected. No payment, referral, certificate, score, SmartCard-credit, challenge, reward or leaderboard writes were performed. Ledger snapshots were not obtained, so global ledger invariance is not independently verified.

No Chrome tab, window, profile, browser or media process was created; there are no QA-created tabs to close. The pre-existing Chrome profile-picker window and process were preserved. No product code was changed, committed, pushed or deployed. Only this blocker document was added. Resume dedicated QA identity verification and the Chinese dashboard after the approval blocker is resolved, reuse the same-date artifact plan, and publish an accurate Project record when its authorized synchronization dependency is available.
