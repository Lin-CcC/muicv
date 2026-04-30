# WIP：Mui简历开发计划

最后更新：2026-04-30

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

无（Phase 9 落地后处于功能稳定期，等 Stripe test mode 真实跑一段时间再切 live）。

## 下一步

按 [TODO.md](./TODO.md)：

- 云同步 skill（muicv 平台 / GitHub 双通道）
- 模拟面试 skill
- 录音复盘 / 面试复盘 skill
- 桌面 app 余额耗尽提示 UI（Stripe 跳转 / 充值入口）
