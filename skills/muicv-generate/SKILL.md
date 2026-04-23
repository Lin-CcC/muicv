---
name: muicv-generate
description: 针对某个目标岗位，从本地 `.claude/muicv/` 素材库生成一份定制化的简历 Markdown，落到 `versions/` 下。使用场景：用户说「帮我针对这个岗位写简历」「给 Google SWE 生成一版」「根据这份 JD 定制简历」「基于 targets/xxx 生成」「做一版投递用的简历」等。前置依赖 `muicv-core` 维护的素材库；如果还没有素材或 target，应该先提示用户去 muicv-core 初始化 / 添加素材。
---

# muicv-generate

针对某个目标岗位（`targets/*.md` 里的 JD），从用户本地素材库（`.claude/muicv/`）挑选、排序、改写得到一份投递用的简历 Markdown。输出到 `versions/<target-slug>-<YYYY-MM-DD>.md`。

**核心约束：只能使用素材里已有的事实，不得编造、不得推断。** 缺信息就留空或问用户。

## 前置检查

1. `.claude/muicv/` 是否存在？不存在 → 提示用户调用 `muicv-core` 初始化，不自己动手
2. `.claude/muicv/profile.md` 是否存在且包含 `name`？缺失 → 提示先完善 profile
3. 用户指定的 target 是否在 `targets/` 下？
   - 如果用户提了具体 target 文件或 JD URL：用它
   - 如果用户只说"帮我生成简历"但没指定：列出 `targets/*.md` 让用户选；如果一个都没有，询问是要生成"通用版"（无 target）还是先补一个 JD（让用户切到 `muicv-jobs` 抓 JD 或手工粘贴到 `targets/` 下）

## 生成流程

### 1. 输入采集

用 Read 加载：

- `profile.md` — 姓名、标题、联系方式、summary
- `experience/*.md` — 所有工作经历
- `projects/*.md` — 所有项目
- `education.md`、`skills.md`、`achievements.md`
- 指定的 `targets/<slug>.md`（如有）

用 Glob 枚举 `experience/` 和 `projects/`，不要假设只有示例里列的那几个。

### 2. 针对 target 的处理

当 target 存在时：

- 从 JD 正文里抽关键词（技术栈、职责、软技能）
- 遍历素材，对每段 experience / project / skill 按"对 JD 的相关度"打个非正式分（高/中/低）
- 排序：相关度高的在前；时间近的在前
- **在每个输出段落前，都确保保留"源文件 + 源 highlight 原文"的可追溯性**（内部思考用；不写到输出里）
- 裁剪：低相关度的段落要么放到后半部分、要么整段略过
- 高亮挑选：每段 experience 选 2~4 条最相关 highlight；每个项目选 2~3 条

当没有 target 时：生成通用版，按时间倒序，保留最具代表性的亮点。

### 3. 改写

- **动词开头**、主动语态
- **可量化则量化**：用户素材里有数字就保留；**素材里没有数字，就不要编**
- **避免空话**：把"负责 X"改成"做了 X 的什么动作，产生了什么结果"（前提是素材里有动作和结果）
- 术语对齐 target 的措辞（例如素材写"提升首屏速度"，JD 里叫"improve Core Web Vitals"，可以兼顾两者表达）
- 保持简洁：每条 highlight 一行，不超过两行

### 4. 输出结构

写入 `.claude/muicv/versions/<target-slug>-<YYYY-MM-DD>.md`：

- `target-slug`：target frontmatter 的 company+title，小写 kebab-case；没有 target 时用 `general`
- `YYYY-MM-DD`：当日日期（UTC 或本地都可，保持一致）
- 如果当天同一 target 已生成过：在文件名后加 `-2`、`-3`（不要覆盖历史，让用户决定删哪个）

文件格式：

```markdown
---
type: version
target: targets/google-swe.md        # 无 target 时省略
generated_at: 2026-04-23T12:00:00Z
source_files:                         # 用到的素材文件（追溯用）
  - profile.md
  - experience/acme-2023.md
  - experience/startup-2021.md
  - projects/mui-cms.md
---

# 张三

Senior Frontend Engineer · 北京 · zhang@example.com · https://github.com/zhang

## Summary

<2~4 句，突出目标岗位需要的核心能力与核心经历>

## 工作经历

### Senior Frontend Engineer — ACME Corp
2023-03 — 至今 · 北京 (Remote) · TypeScript, React, Next.js

- 动词开头的 highlight，1~2 行
- …

### Frontend Engineer — Startup Inc
2021-06 — 2023-02 · 上海 · Vue, Nuxt

- …

## 项目

### Mui CMS · Tech Lead
2024-01 — 2024-06 · Node.js, PostgreSQL · https://example.com

- …

## 教育

### 某大学 · 计算机科学 · 本科
2017-09 — 2021-06

- （若素材里有相关项目/获奖才写 highlight）

## 技能

- 编程语言：TypeScript, JavaScript
- 框架/工具：React, Next.js, Vue
- 领域：前端性能优化、设计系统
```

字段留空规则：缺的字段就省略该行，**不要写"未填写"或"N/A"**。

### 5. 交付

生成完后：

1. 告诉用户路径
2. 摘要："相关度最高的 3 条 highlight 是 ..."
3. 建议下一步：
   - `muicv-critique` 做一轮质量评审
   - `muicv-render` 渲染成 PDF

## 反例（不要做）

- ❌ 素材里没写数字，输出加上"提升 30%"
- ❌ 素材没说"带团队"，输出写"领导 5 人团队"
- ❌ target 要求 Golang，素材没 Golang，输出硬塞一条"了解 Golang"
- ❌ 覆盖同一天的历史版本（应该加后缀）
- ❌ 一次生成就把所有 experience 全塞进去（应该按相关度裁剪）

## Prompt 细节参考

核心 prompt 在 `references/prompts.md`（生成时加载），里面是更细的措辞、语气、排版规则。
