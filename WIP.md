# WIP：Mui简历开发计划

最后更新：2026-04-24

## 重大方向调整（2026-04-16）

**原方向（2026-01-12）**：构建一个完整的 chatbot web 应用，用「AI 就业辅导对话 + 记忆库 + 按需生成简历」的模式替代传统简历表单。

**现方向**：把核心业务能力封装成 **Claude Code Skills + 轻量 API**，用户在自己熟悉的 AI agent（Claude Code / Codex / Cursor 等）里直接调用；简历素材作为 **Markdown + YAML frontmatter** 存在用户自己的项目目录里（`.claude/muicv/`），由用户用 git 自己管理。

调整原因：
- Chatbot 要做的核心能力（对话、记忆、版本）Claude Code / Codex 这类 agent 框架已天然具备，自己再做一套是重复建设
- Skill + 本地 markdown 的方式让用户数据主权更清晰、心智负担更低、渠道更广
- 开发量预估能砍一半

完整方案见 `.claude/plans/joyful-waddling-floyd.md`（Phase 0～6 分阶段落地）。

## 当前进度

**Phase 0 清理** ✅ — chatbot 遗留代码全部删除；旧 prompt 迁移到 skill references 后 .plan-staging 清理

**Phase 1 骨架** ✅ — `skills/muicv-core/SKILL.md` 自动检测初始化 + add-experience / add-project / update / organize；`packages/shared/src/schemas/resume-md.ts` 定义 frontmatter 类型；分发走 [`npx skills add meathill/muicv`](https://www.npmjs.com/package/skills)

**Phase 2 生成/评审** ✅ — `muicv-generate`（针对 JD 从素材库生成 version md）+ `muicv-critique`（7 维度评审）+ `muicv-core` 的 organize reference

**Phase 3 服务端渲染** ✅ — 新建 `packages/api`（独立 Cloudflare Worker）：
- `BrowserContainer` Durable Object（透明代理）暴露 Cloudflare Container
- Container 内 Node 22 + Chromium + Puppeteer + Hono server
- POST /render 接收 markdown → 返回 PDF
- `muicv-render` skill 调 API 存 PDF 到 `versions/<name>.pdf`

**Phase 4 网络任务** ✅ — JD 抓取 + 匹配分析 + 投递辅助：
- `packages/api` 加 POST /jobs/fetch：container 里 Puppeteer + Readability + Turndown，把 JD 页面清洗成 markdown + meta
- `skills/muicv-jobs`：fetch（写 targets/）、match（本地素材 vs JD 关键词差距分析）、apply（本地生成 cover letter 到 applications/）
- muicv-core 初始化骨架补上 `applications/` 目录
- shared schema 加 `ApplicationFrontmatter`

**下一步（Phase 5 分发 / 营销页）**：
- `.claude-plugin/plugin.json` + `marketplace.json`（Claude Code 官方 Plugin Marketplace）
- `packages/website` 文案重写（从"对话驱动"改为"Skills + 本地 Markdown"定位）
- 端到端 dogfood：自己用 skills 做一份简历走完全流程

## 历史计划（已废弃，保留做追溯）

原本的 M0～M5 里程碑、Todo 清单等全部作废。核心的 prompt 资产（简历生成、记忆整理）已经从 `packages/app/src/server/ai/system-prompts.ts` 抽取到 `.plan-staging/`，后续迁移到各 skill 的 `references/` 目录。
