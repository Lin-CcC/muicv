Mui简历
===

> 在你熟悉的 AI agent（Claude Code / Codex / Cursor ...）里管理简历。

简历素材以 **Markdown + YAML frontmatter** 存在你自己的项目目录里，由你用 git 管理；针对不同岗位生成的简历版本也同样存本地。服务端只承担本地不方便做的事：PDF 渲染、JD 抓取、模板库，以及后续的账号 / 订阅 / 计费。

当前状态：**重构中**，从 "chatbot web 应用" 转向 "Claude Code Skills + API"。详情见 [WIP.md](./WIP.md)。

---

安装
---

两种方式任选：

### 1. Claude Code Plugin Marketplace

官方机制，用户通过 `/plugin` 命令管理：

```bash
# 在 Claude Code 里：
/plugin marketplace add meathill/muicv
/plugin install muicv@meathill
```

装完立刻可用。`/plugin list` 查看已装，`/plugin update` 更新。

### 2. npx skills（多 agent 通用）

用 [`skills`](https://www.npmjs.com/package/skills) CLI（Vercel Labs 出品，兼容 Claude Code / Codex / Cursor / OpenCode 等 40+ agent）：

```bash
# 全局装到 ~/.claude/skills/（交互选择具体装哪些 skill 到哪些 agent）
npx skills add meathill/muicv -g

# 只装一部分
npx skills add meathill/muicv -g -s muicv-core -s muicv-generate -a claude-code

# 管理
npx skills list
npx skills update
npx skills remove muicv-core
```

装到项目级（默认位置 `./.claude/skills/`，会入 git、团队共享）——去掉 `-g` 即可。

---

使用
---

任意目录下启动 Claude Code，然后跟 Claude 说任何和简历 / 求职相关的话，比如：

- 「帮我准备简历」
- 「我想管理一下我的工作经历」
- 「加一段在 X 公司做 Y 的经历」

完整的走一遍：见 [docs/walkthrough.md](./docs/walkthrough.md) —— 从零到投递一份针对性简历的 7 步演示。

首次在某项目内触发时，`muicv-core` 会自动在当前工作目录创建 `.claude/muicv/`：

```
.claude/muicv/
├── profile.md          # 姓名、联系方式、自我介绍
├── experience/         # 工作经历（每段一个 md 文件）
├── projects/           # 项目（每个一个 md 文件）
├── targets/            # 目标岗位 / JD
├── versions/           # 针对某个 target 生成的简历版本
├── education.md
├── skills.md
└── achievements.md
```

这些文件就是你的"数据"——Skill 不会在别处缓存，也不会替你 commit。要不要入 git 由你决定。

---

Skills
---

| Skill | 状态 | 做什么 |
|---|---|---|
| [`muicv-core`](./skills/muicv-core/SKILL.md) | ✅ 已实现 | 初始化、添加 / 更新 / 整理素材 |
| [`muicv-generate`](./skills/muicv-generate/SKILL.md) | ✅ 已实现 | 针对 JD 从素材库生成特定版本简历到 `versions/` |
| [`muicv-critique`](./skills/muicv-critique/SKILL.md) | ✅ 已实现 | STAR / 量化 / 关键词对齐 / 长度 等维度评审 |
| [`muicv-render`](./skills/muicv-render/SKILL.md) | ✅ 已实现 | 调 API 渲染 PDF（Cloudflare Browser Rendering + Next.js 模板） |
| [`muicv-jobs`](./skills/muicv-jobs/SKILL.md) | ✅ 已实现 | `fetch` 抓 JD、`match` 匹配度分析、`apply` 生成 cover letter |

---

仓库结构
---

```
muicv/
├── .claude-plugin/        # plugin.json + marketplace.json（Claude Code 官方分发）
├── skills/                # Agent skill 源（也可通过 `npx skills add` 分发）
├── docs/                  # walkthrough 等开发者文档
├── packages/
│   ├── website/           # Web app 本体（landing + 未来 dashboard），Next.js on OpenNext
│   │   └── app/(marketing)/  # 营销页 route group
│   ├── api/               # Skill 背后的 Cloudflare Worker（/render、/jobs/fetch、/waitlist）
│   │   ├── src/           # Worker 代码（Browser Rendering binding 调 puppeteer）
│   │   └── migrations/    # D1 schema
│   ├── shared/            # 领域类型（ResumeJson、frontmatter schema 等）
│   ├── ui/                # UI 组件
│   ├── cron/              # 定时任务骨架
│   └── app/               # （规划中）基于 OpenAI Agent SDK 的 electron 桌面端
└── WIP.md                 # 当前开发计划
```

---

技术栈
---

- **Skills**：Markdown + frontmatter，符合 [Claude Skill 规范](https://code.claude.com/docs/en/skills)
- **Web (`packages/website`)**：Next.js 16 on OpenNext / Cloudflare Workers — landing + dashboard
- **API (`packages/api`)**：Cloudflare Worker + Hono；PDF 渲染用 Cloudflare Browser Rendering（puppeteer.goto packages/website 的 SSR 模板路由）；JD 抓取走同一个 binding
- **Electron app (`packages/app`)**：electron + React + OpenAI Agents SDK，
  可下载 .dmg 直接装。LLM 走 muirouter（OpenAI 兼容）；
  调 muicv API 做 PDF 渲染 + JD 抓取
  - 下载：[muicv.com/download](https://muicv.com/download)
  - 发布：tag `v*` 自动触发 `.github/workflows/release.yml`
- **数据**：D1 + R2（按需接入）
- **类型**：TypeScript（pnpm workspace）

---

License
---

UNLICENSED（当前）。
