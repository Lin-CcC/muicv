Mui简历
===

> 在你熟悉的 AI agent（Claude Code / Codex / Cursor ...）里管理简历。

简历素材以 **Markdown + YAML frontmatter** 存在你自己的项目目录里，由你用 git 管理；针对不同岗位生成的简历版本也同样存本地。服务端只承担本地不方便做的事：PDF 渲染、JD 抓取、模板库，以及后续的账号 / 订阅 / 计费。

当前状态：**重构中**，从 "chatbot web 应用" 转向 "Claude Code Skills + API"。详情见 [WIP.md](./WIP.md)。

---

安装
---

### 从源码（当前阶段推荐）

```bash
git clone https://github.com/meathill/muicv.git
cd muicv
./install.sh
```

`install.sh` 把 `skills/*` 下每个 skill 目录软链到 `~/.claude/skills/`，让 Claude Code 启动时自动发现。自定义目录：`CLAUDE_SKILLS_DIR=/path ./install.sh`。

### Plugin Marketplace（规划中）

```bash
/plugin marketplace add meathill/muicv
/plugin install muicv@muicv
```

---

使用
---

任意目录下启动 Claude Code，然后跟 Claude 说任何和简历 / 求职相关的话，比如：

- 「帮我准备简历」
- 「我想管理一下我的工作经历」
- 「加一段在 X 公司做 Y 的经历」

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
| `muicv-generate` | 🚧 规划中 | 针对 JD 生成特定版本简历 |
| `muicv-critique` | 🚧 规划中 | STAR / 关键词 / 长度评审 |
| `muicv-render` | 🚧 规划中 | 调 API 渲染 PDF |
| `muicv-jobs` | 🚧 规划中 | 抓 JD、匹配、投递辅助 |

---

仓库结构
---

```
muicv/
├── skills/                # Claude Code Skill 源（安装时软链到 ~/.claude/skills/）
├── packages/
│   ├── app/               # Web app 本体（落地页 + API + 将来的账号/订阅 Dashboard）
│   ├── website/           # 营销站
│   ├── shared/            # 领域类型（ResumeJson、frontmatter schema 等）
│   ├── ui/                # UI 组件
│   └── cron/              # 定时任务骨架
├── install.sh             # 把 skills/* 软链到 ~/.claude/skills/
└── WIP.md                 # 当前开发计划
```

---

技术栈
---

- **Skills**：Markdown + frontmatter，符合 [Claude Skill 规范](https://code.claude.com/docs/en/skills)
- **服务端**：Next.js on Cloudflare Workers（OpenNext）+ D1 + R2
- **类型**：TypeScript（pnpm workspace）
- **样式**：Tailwind CSS

---

License
---

UNLICENSED（当前）。
