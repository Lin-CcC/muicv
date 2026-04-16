---
name: muicv-core
description: 管理本地 Markdown 简历素材库。帮用户在当前项目的 `.claude/muicv/` 目录下收集、更新、整理简历原始材料（工作经历、项目、教育、技能、亮点）。使用场景：当用户提到「简历」「CV」「resume」「求职」「工作经历」「我在 X 公司做过」「我做过一个项目」「整理我的素材」等；或者用户希望把零散的职业信息结构化地存到本地 Markdown 以便后续生成不同版本的简历。**第一次在一个项目里被调用时会自动检测并引导用户初始化目录结构，用户无需显式调用 init**。
---

# muicv-core

这个 skill 帮用户在**当前工作目录**下维护一个简历素材库，所有数据以 Markdown + YAML frontmatter 的形式存在 `.claude/muicv/` 下，由用户用 git 自己管理。Skill 只做"引导收集 / 追加 / 整理"，不替用户管版本。

配套的生成、评审、渲染、抓 JD 等工作由以下 skills 完成：
- `muicv-generate` — 针对某个目标岗位生成特定版本简历
- `muicv-critique` — 对已生成的版本做 STAR / 关键词 / 长度评审
- `muicv-render` — 调服务端 API 把 markdown 渲染成 PDF
- `muicv-jobs` — 抓 JD、匹配、辅助投递

---

## 前置检查（每次调用都必须先做）

在执行**任何**子任务（包括用户只是说"帮我加一段经历"）之前：

1. 检查当前工作目录下是否存在 `.claude/muicv/` 目录
2. 如果 **不存在** → 走下面的「初始化流程」，**不要假设用户已知目录结构**
3. 如果 **已存在** → 继续执行用户的实际意图（添加经历 / 项目 / 更新 / 整理）

## 初始化流程（自动触发）

当 `.claude/muicv/` 不存在时：

### 1. 简要说明（一句话）

告诉用户："看起来这是你第一次在这个项目里使用 Mui简历。我会帮你在 `.claude/muicv/` 下建立一个本地简历素材库，数据就是 Markdown 文件，你可以用 git 自己管。"

### 2. 一次性问清基础信息（不要挤牙膏）

用一轮问话收集：
- **姓名**（必填）
- **目标岗位方向**（例如"前端工程师"/"产品经理"；可留空，后面补）
- **所在城市**（可留空）
- **邮箱、电话、主要链接**（可留空，用户可以说"先不填"）

不要追问次要字段。用户提供多少就用多少。

### 3. 创建目录骨架

生成以下文件（用 Write 工具，路径都相对于用户当前工作目录）：

```
.claude/muicv/
├── profile.md            # 用第 2 步收集的信息填 frontmatter + summary 占位
├── experience/
│   └── .gitkeep
├── projects/
│   └── .gitkeep
├── targets/
│   └── .gitkeep
├── versions/
│   └── .gitkeep
├── education.md          # 带占位说明的骨架
├── skills.md             # 带占位说明的骨架
└── achievements.md       # 带占位说明的骨架
```

`profile.md` 模板（示例，实际字段由用户输入决定）：

```markdown
---
type: profile
name: 张三
title: 资深前端工程师
location: 北京
email:
phone:
links: []
---

## Summary

<2~4 句自我介绍，后续可以随时让 muicv-core 帮你补。>
```

`experience/.gitkeep`、`projects/.gitkeep`、`targets/.gitkeep`、`versions/.gitkeep`：空文件。

`education.md` / `skills.md` / `achievements.md` 骨架示例：

```markdown
---
type: education
---

## 学历

- 学校 / 专业 / 学位 / 起止
```

```markdown
---
type: skills
---

## 技能

- 编程语言：
- 框架/工具：
- 领域专长：
```

```markdown
---
type: achievements
---

## 亮点 / 作品 / 奖项

- （每一条 1~2 行，后面在生成简历时会挑选使用。）
```

### 4. 引导下一步

告诉用户："骨架已就绪。接下来你可以这样继续：

- 「加一段在 X 公司做 Y 的经历」— 我会创建 `experience/x-xxxx.md`
- 「我做过一个项目叫 Z」— 我会创建 `projects/z.md`
- 「整理一下我的素材」— 我会去重、合并、让描述更具体（但不会编造）

或者你也可以直接打开 `.claude/muicv/profile.md` 自己编辑，我会读最新内容。"

### 5. 提示 .gitignore（可选）

如果用户项目根有 `.gitignore` 而里面没有 `.claude/muicv/`，问一次："`.claude/muicv/` 里是你的简历数据，要入仓库还是 ignore？"然后按用户选择处理（入仓库 = 什么都不做；ignore = 追加一行到 `.gitignore`）。不强求用户现在回答。

---

## 子任务：add-experience

**触发**：用户说"加一段工作经历"、"我在 X 公司做过"、"我 2023 年在 Y 做前端"等。

1. 先走前置检查，确保 `.claude/muicv/` 已存在。
2. 收集以下字段（缺哪个问哪个，但也要一次问清，不要挤牙膏）：
   - `company`（必填）
   - `title`（必填，例如 "Senior Frontend Engineer"）
   - `start`（ISO 年月，例如 "2023-03"）
   - `end`（ISO 年月 或 `'present'`）
   - `location`（可选）
   - `stack`（技术栈数组，可选）
   - 职责（多条）
   - 亮点（动词开头，可量化则量化，可选）
3. 生成文件名：`experience/<company-slug>-<start-year>.md`
   - company-slug：公司英文名小写 kebab-case；如果只有中文名则用拼音
   - 例：`ACME Corp` + 2023-03 → `experience/acme-2023.md`
4. 文件内容：

   ```markdown
   ---
   type: experience
   company: ACME Corp
   title: Senior Frontend Engineer
   start: 2023-03
   end: present
   location: 北京 (Remote)
   stack: [TypeScript, React, Next.js]
   ---

   ## 职责
   - ...

   ## 亮点
   - ...（STAR：情境/任务/动作/结果，量化优先）
   ```

5. 告诉用户文件路径，问要不要继续加下一段。

## 子任务：add-project

**触发**：用户说"我做过一个项目叫 Z"、"加个项目"等。

类似 add-experience。文件路径 `projects/<slug>.md`，frontmatter：

```yaml
---
type: project
name: Mui CMS
role: Tech Lead
start: 2024-01
end: 2024-06
stack: [Node.js, PostgreSQL]
url: https://example.com
---
```

正文结构：
```markdown
## 背景 / 问题
## 我的角色与动作
## 结果 / 影响
```

## 子任务：update

**触发**：用户说"改下 X 的经历"、"把 acme 那段里的 ... 改成 ..."。

1. 用 Glob 匹配 `.claude/muicv/**/*.md`，用 Grep 搜 frontmatter 的 `company` / `name` 字段找到目标文件。
2. Read 文件，用 Edit **精确修改**（不要整段重写）。
3. 改完给用户 diff 摘要。

## 子任务：organize

**触发**：用户说"整理一下素材"、"帮我去重"，或执行 generate 前发现素材凌乱。

原则（摘自 `references/organize-prompt.md`，迁移后填充）：

- **只用已出现的事实**：可以合并、改写表达，但不能新增、推断、编造
- **去重**：同一事实的重复表达不保留多份
- **关联**：把同主题的零散记录合并成更完整的一条
- **具体**：优先"可写进简历"的表述，包含时间、对象、技术栈、结果/影响

执行步骤：

1. Glob + Read 扫描所有素材文件
2. 列出发现的问题（重复 / 碎片 / 不完整）给用户看
3. 一组一组和用户确认合并方案，经用户同意后再 Edit 落盘

---

## 数据契约（frontmatter schema 摘要）

完整 TypeScript 类型见 `@muicv/shared` 里的 `MuiCvFrontmatter`（在 `packages/shared/src/schemas/resume-md.ts`）。这里列关键字段。

| 文件 | `type` | 必填字段 | 可选字段 |
|---|---|---|---|
| `profile.md` | `profile` | `name` | `title`, `email`, `phone`, `location`, `links[]` |
| `experience/*.md` | `experience` | `company`, `title`, `start`, `end` | `location`, `stack[]` |
| `projects/*.md` | `project` | `name` | `role`, `start`, `end`, `stack[]`, `url` |
| `education.md` | `education` | — | — |
| `skills.md` | `skills` | — | — |
| `achievements.md` | `achievements` | — | — |
| `targets/*.md` | `target` | `company`, `title` | `source_url`, `fetched_at` |
| `versions/*.md` | `version` | `generated_at` | `target` |

日期格式：`start` / `end` 用 `YYYY-MM`，`end` 也可以是 `'present'`。其他时间戳用 ISO-8601。

---

## 原则

- **不要编造**：只能用用户明确说过的事实；不确定就追问或留空，**绝不自行填充**
- **一次问清**：避免挤牙膏式多轮追问，初始化时 / 加一段经历时都是一轮问完
- **文件即真相**：Skill 不在对话里缓存用户信息，每次操作都基于对 `.claude/muicv/` 下文件的 Read
- **中文友好**：默认用户讲中文就用中文；用户切英文则跟着切
- **不污染用户 git**：目录下是用户数据，由用户决定入不入库；skill 不主动 `git add/commit`
