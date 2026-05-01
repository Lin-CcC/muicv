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

**新增 skill**：[skills/muicv-sync/SKILL.md](skills/muicv-sync/SKILL.md)
- `push`：Glob `**/*.md`（过滤隐藏目录 + node_modules）→ 组装 JSON → POST /resume/sync
- `pull`：GET /resume/snapshot → 冲突文件备份到 `.muicv-pull-backup-<ts>/` → 写入云端版
- `status`：引导去 dashboard 看
- 单库 1MB / 500 文件，超限 client 端先报错；触发词覆盖"同步/上传/备份/恢复/拉远程/换机器"等

**待办（端到端验证）**

- [x] D1 远端 migration（用户 2026-05-01 已跑）
- [ ] 部署后真机串一遍：
  - dashboard 创建 mui_ key + export 到 shell
  - 在素材库目录跟 muicv-sync 说"同步到云端" → /dashboard/sync 看到状态卡
  - 多次 push 看历史滚动到 5 份就停
  - 找新目录跟 muicv-sync 说"从云端恢复" → 文件落到本地
  - 改一个文件再 pull → 看到 .muicv-pull-backup-* 目录
  - dashboard 点恢复 / 删除 / 清空，刷新看效果

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
