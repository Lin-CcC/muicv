# WIP：Mui简历开发计划

最后更新：2026-04-26

## 方向

把核心业务能力封装成 **Claude Code Skills + 轻量 API + Electron 桌面端**，用户在自己熟悉的
AI agent（Claude Code / Codex / Cursor 等）里直接调用；简历素材作为 **Markdown + YAML
frontmatter** 存在 `.claude/muicv/`，由用户用 git 自己管理。完整背景见 README.md。

## 已完成

Phase 1～8 全部落地（commits `f5cab4d → 1372e96`，2026-01-12 ～ 2026-04-26）：

- **Phase 1～2** — Skill 骨架、素材管理、generate / critique
- **Phase 3** — `packages/api` Cloudflare Container PDF 渲染
- **Phase 4** — JD 抓取 + match + apply
- **Phase 5** — 营销页 + plugin marketplace + walkthrough
- **Phase 6** — Web 主体（OpenNext on Worker） + Better Auth + dashboard + muirouter BYOK
- **Phase 7** — 电脑端三段式（登录 → onboarding → 对话）+ 账号控制台
- **Phase 8** — `muicv://` deep link 自动登录

技术性的「踩坑 / 决策依据」沉淀到 [DEV_NOTE.md](./DEV_NOTE.md)。

## 当前进行中

无（Phase 8 之后处于功能稳定期）。

## 下一步

按 [TODO.md](./TODO.md)：

- 云同步 skill（muicv 平台 / GitHub 双通道）
- 模拟面试 skill
- 录音复盘 / 面试复盘 skill

订阅档位 / Stripe 付款 / 真实 plan 切换属于产品下一波 milestone，启动前会先在这里展开。
