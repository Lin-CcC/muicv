# WIP：Mui简历开发计划

最后更新：2026-04-16

## 重大方向调整（2026-04-16）

**原方向（2026-01-12）**：构建一个完整的 chatbot web 应用，用「AI 就业辅导对话 + 记忆库 + 按需生成简历」的模式替代传统简历表单。

**现方向**：把核心业务能力封装成 **Claude Code Skills + 轻量 API**，用户在自己熟悉的 AI agent（Claude Code / Codex / Cursor 等）里直接调用；简历素材作为 **Markdown + YAML frontmatter** 存在用户自己的项目目录里（`.claude/muicv/`），由用户用 git 自己管理。

调整原因：
- Chatbot 要做的核心能力（对话、记忆、版本）Claude Code / Codex 这类 agent 框架已天然具备，自己再做一套是重复建设
- Skill + 本地 markdown 的方式让用户数据主权更清晰、心智负担更低、渠道更广
- 开发量预估能砍一半

完整方案见 `.claude/plans/joyful-waddling-floyd.md`（Phase 0～6 分阶段落地）。

## 当前进度（Phase 0 完成）

**已完成**：
- 旧 chat UI / resume UI / API routes / server stores / memory 抽取与整理代码、D1 migrations 全部删除
- 关键 prompt 已抽取暂存到 `.plan-staging/{resume-generate,organize}-prompt.md`
- `packages/app` 缩成一个占位 Next.js 站点（保留为 web app 本体，后续承载落地页 + API + 账号/订阅 Dashboard）
- `packages/shared` 只保留 `ResumeJson` 类型
- `packages/website`、`packages/cron`、`packages/ui` 暂不动

**下一步（Phase 1 骨架）**：
- 新建 `skills/muicv-core/SKILL.md`（含自动检测 `.claude/muicv/` 是否已初始化的逻辑）
- 分发靠 [`npx skills add meathill/muicv`](https://www.npmjs.com/package/skills)（Vercel Labs 的通用 agent skill CLI，兼容 Claude Code / Codex / Cursor 等）
- 定义 `packages/shared/src/schemas/resume-md.ts`（zod frontmatter schema）
- 端到端验证：空目录 + 与 Claude 说"帮我准备简历" → skill 自动引导并生成文件

## 历史计划（已废弃，保留做追溯）

原本的 M0～M5 里程碑、Todo 清单等全部作废。核心的 prompt 资产（简历生成、记忆整理）已经从 `packages/app/src/server/ai/system-prompts.ts` 抽取到 `.plan-staging/`，后续迁移到各 skill 的 `references/` 目录。
