# WIP：Mui简历开发计划

最后更新：2026-05-01

## 方向

把核心业务能力封装成 **Claude Code Skills + 轻量 API + Electron 桌面端**，用户在自己熟悉的
AI agent（Claude Code / Codex / Cursor 等）里直接调用；简历素材作为 **Markdown + YAML
frontmatter** 存在 `.claude/muicv/`，由用户用 git 自己管理。完整背景见 README.md。

## 已完成

Phase 1～9 全部落地（commits `f5cab4d → ……`，2026-01-12 ～ 2026-04-30）：

- **Phase 1～2** — Skill 骨架、素材管理、generate / critique
- **Phase 3** — `packages/api` PDF 渲染（2026-04-29 从 Cloudflare Container + DO 切到 Browser Rendering + Workers Binding，模板从 setContent string 升级为 puppeteer.goto packages/website React 组件 SSR）
- **Phase 4** — JD 抓取 + match + apply
- **Phase 5** — 营销页 + plugin marketplace + walkthrough
- **Phase 6** — Web 主体（OpenNext on Worker） + Better Auth + dashboard + muirouter BYOK
- **Phase 7** — 电脑端三段式（登录 → onboarding → 对话）+ 账号控制台
- **Phase 8** — `muicv://` deep link 自动登录
- **Phase 9（M4）** — **付费 token 钱包**：tokenBalance / tokenLedger / subscription /
  stripeEvent 4 张表；charge / credit / ensureBalance 原子扣账；LLM 1.1× 计费 + tee +
  pre-check；PDF / JD 固定 token 扣账；Stripe Checkout（月卡 + 补充包）+ Customer
  Portal；webhook 双层幂等（evt_id + invoice_id / session_id）；dashboard 钱包 UI +
  pricing 页改造。注册送 10K，token 永不过期。

技术性的「踩坑 / 决策依据」沉淀到 [DEV_NOTE.md](./DEV_NOTE.md)；部署步骤（含 Stripe
test → live 切换 SOP）见 [DEPLOYMENT.md](./DEPLOYMENT.md)。

## 当前进行中

### Phase 10：MuiCV 云同步（已全部落地）

用户在 muicv-sync skill 里主动触发「同步到云端」/「从云端恢复」，把本地工作目录的所有 .md
文件整体作为一份完整快照 push/pull。云端只保留一份活动版 + 最近 5 份历史。Dashboard
提供管理页（看大小、最后同步时间、历史列表、恢复历史、清空云端）。

**已落地**

- DB：`resumeSnapshot`（活动版，每用户 1 行）+ `resumeSnapshotHistory`（最近 5 份），
  见 [migrations/0009_resume_snapshot.sql](packages/website/migrations/0009_resume_snapshot.sql) 和
  [lib/schema.ts](packages/website/lib/schema.ts)
- 共用校验：[packages/shared/src/resume-sync.ts](packages/shared/src/resume-sync.ts)，含限制
  常量（1MB / 500 文件 / 5 份历史）+ 路径校验 + 稳定 hash
- skill API（Bearer key，挂在 `api.muicv.com`）：
  [packages/api/src/routes/resume-sync.ts](packages/api/src/routes/resume-sync.ts)
  - `POST /resume/sync`：push 一份新活动版（自动归档旧版到 history）
  - `GET /resume/snapshot`：pull 活动版（含 files）
  - `GET /resume/snapshot/history`：列历史 metadata
  - `GET /resume/snapshot/history/:id`：pull 某历史版本
  - `DELETE /resume/snapshot`：清空全部
- dashboard API（cookie session，挂在 `muicv.com/api`）：
  - `GET /api/resume/sync`、`DELETE /api/resume/sync`
  - `DELETE /api/resume/sync/history/[id]`
  - `POST /api/resume/sync/history/[id]/restore`
- dashboard UI：[/dashboard/sync](packages/website/app/(dashboard)/dashboard/sync/page.tsx)
  + sidebar 加第 4 项「云同步」

**计费**：完全免费（不扣 token）。靠大小上限（1MB/库）和历史份数（5 份）兜边界。

**冲突策略**：last-write-wins。每次 push 自动把活动版归档；用户能在 dashboard 一键恢复历史。

**两类用户两条路径**

- **client 用户**（无感）：登录后 deep link 已自动注入 `muicvApiKey`，`packages/app` 的 agent 多了
  `sync_resume_to_cloud` / `pull_resume_from_cloud` 两个 tool（见
  [api-tools-sync.ts](packages/app/src/main/agent/api-tools-sync.ts)），用户跟 agent 说"同步"就走完整流程
- **skill 用户**（自配 key）：[muicv-sync SKILL.md](skills/muicv-sync/SKILL.md) 把 key 教育做扎实——
  `MUICV_API_KEY` 没设时 skill 必须先把五步获取 key 流程完整发给用户，不试探性跑请求；错误话术针对
  401 / 格式错 / 超限 / 网络分别给"用户能直接行动"的回复
- 两端共用 `packages/shared/src/resume-sync.ts` 的预校验（1MB / 500 文件 / 路径合法）

**待办（端到端验证）**

- [x] D1 远端 migration（用户 2026-05-01 已跑）
- [ ] 部署后真机串一遍：
  - dashboard 创建 mui_ key + export 到 shell
  - 在素材库目录跟 muicv-sync 说"同步到云端" → /dashboard/sync 看到状态卡
  - 多次 push 看历史滚动到 5 份就停
  - 找新目录跟 muicv-sync 说"从云端恢复" → 文件落到本地
  - 改一个文件再 pull → 看到 .muicv-pull-backup-* 目录
  - dashboard 点恢复 / 删除 / 清空，刷新看效果

### Phase 12：muicv-debrief skill（面试复盘，已落地）

跟 muicv-interview 配对——前者面**前**练，后者面**后**复盘。**写文件**类型 skill：
把用户讲述的题目 / 回答 / 面试官反应整理成 `debriefs/<company>-<title>-<date>.md`，
可 git 管，未来可被 muicv-core 整理成"面试进步轨迹"。

新文件：
- [skills/muicv-debrief/SKILL.md](skills/muicv-debrief/SKILL.md)：4 步流程（收背景 → 逐题收 →
  落盘 → 口头分析），中立分析者人设，明确不下"过/挂"结论
- [packages/shared/src/schemas/resume-md.ts](packages/shared/src/schemas/resume-md.ts) 加
  `DebriefFrontmatter` 类型

muicv-core SKILL.md 同步更新：目录骨架加 `debriefs/`、数据契约表格加 debrief 行、
配套 skill 列表加 muicv-interview / muicv-debrief / muicv-coaching 指向。

### Phase 11：muicv-git skill（白盒版本管理，已落地）

跟 muicv-sync 形成「黑/白盒」配对——muicv-sync 是平台 D1 自动化备份，muicv-git
是用户自己掌控的 git repo（GitHub / GitLab / 自建）。两者可以同时用：日常以
git 为准，muicv-sync 当二级备份。

**新增 skill**：[skills/muicv-git/SKILL.md](skills/muicv-git/SKILL.md)
- `init`：git init + 写 .gitignore（默认排除 `.DS_Store` / `.muicv-pull-backup-*/`，
  不排除 PDF）+ 用 `gh repo create` 一步关联远程，没装 gh 走"GitHub.com 手动
  建仓 + git remote add"备选路径
- `sync`：git status 列改动 → 让用户给具体 commit message（不默认填 "update"）
  → add . / commit / push；rejected 失败教用户 `pull --rebase` 自己合并，**不**
  force push
- `clone`：换机器场景，`gh repo clone <user>/<repo>` 拉下来
- `status`：fetch + status + log -5 综合看一眼
- 错误处理覆盖：git/gh 没装、push rejected、permission denied、repo 已存在

**职责边界**：
- skill 不替用户隐式 commit（除非用户明说 sync）
- 不强推 / 不重写历史
- 教用户 git，让用户能离开 skill 也会用

## 历史

Phase 1～9 全部落地（commits `f5cab4d → ……`，2026-01-12 ～ 2026-04-30）。本次（2026-05-01）
追加 dashboard 改造：左 sidebar + 4 个子页面（commit `6203ed5`），随后落地云同步 server +
dashboard 主干。

## 下一步

按 [TODO.md](./TODO.md)：

- 云同步 skill（muicv 平台 / GitHub 双通道）— **本期做了 muicv 平台 server 端，skill 端下一轮**
- 模拟面试 skill
- 录音复盘 / 面试复盘 skill
- 桌面 app 余额耗尽提示 UI（Stripe 跳转 / 充值入口）
