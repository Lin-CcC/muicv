# 端到端演示：从零做一份投递用简历

**假设场景**：你是一个前端工程师，想投 Google 的某个 Senior SWE 岗位，还没在 Mui简历里建过素材库。

本演示展示完整的 7 步工作流。每一步给你看：**用户说了什么**（→）+ **skill 做了什么**（·）。

---

## 前置

```bash
# 装好 skill（全局，对所有项目可用）
npx skills add meathill/muicv -g

# 建一个专门的求职项目目录（强烈推荐，便于 git 管理）
mkdir ~/my-career && cd ~/my-career
git init

# 启动 Claude Code
claude
```

---

## Step 1 · 首次触发，自动初始化

→ **你**："帮我准备简历"

· Claude 识别到"简历"触发 `muicv-core`，发现当前目录没有 `.claude/muicv/`，走初始化流程：

> 看起来这是你第一次在这个项目里使用 Mui简历。我会帮你在 `.claude/muicv/` 下建立一个本地简历素材库。我需要先问你几个基本信息（全部可选，留空就先空着）：
> - 姓名？
> - 目标岗位方向？
> - 所在城市？
> - 邮箱、电话、主要链接（LinkedIn / GitHub / 个人网站等）？

→ **你**："张三，前端工程师，北京。邮箱 zhangsan@example.com，github.com/zhangsan"

· Claude 创建：

```
.claude/muicv/
├── profile.md                    # 用你的信息填好
├── experience/.gitkeep
├── projects/.gitkeep
├── targets/.gitkeep
├── versions/.gitkeep
├── applications/.gitkeep
├── education.md                  # 骨架
├── skills.md                     # 骨架
└── achievements.md               # 骨架
```

`profile.md` 内容：

```markdown
---
type: profile
name: 张三
title: 前端工程师
location: 北京
email: zhangsan@example.com
links:
  - label: GitHub
    url: https://github.com/zhangsan
---

## Summary

<2~4 句自我介绍，后续可以随时让 muicv-core 帮你补。>
```

---

## Step 2 · 补充工作经历

→ **你**："加一段经历，我 2021 年 6 月到现在在 ACME Corp 做高级前端工程师。用 TypeScript、React、Next.js。负责 dashboard 重构，把 LCP 从 3.1s 降到 1.4s，带了 3 人小组"

· Claude 创建 `.claude/muicv/experience/acme-2021.md`：

```markdown
---
type: experience
company: ACME Corp
title: 高级前端工程师
start: 2021-06
end: present
location: 北京
stack: [TypeScript, React, Next.js]
---

## 职责
- 负责核心产品 dashboard 前端

## 亮点
- 主导 dashboard 重构，LCP 从 3.1s 降到 1.4s
- 带领 3 人小组协作推进
```

→ **你**："再加一段：2019 年 3 月到 2021 年 5 月在 Startup Inc 做前端，用 Vue + Nuxt，做了小程序和 H5"

· Claude 创建 `experience/startup-2019.md`，结构类似。

---

## Step 3 · 抓目标岗位 JD

→ **你**："抓这个岗位：https://www.google.com/about/careers/applications/jobs/results/1234567890"

· Claude 识别触发 `muicv-jobs:fetch`，调 Mui简历 API：

```bash
curl -X POST ${MUICV_API_BASE}/jobs/fetch \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.google.com/about/careers/..."}'
```

· API 返回清洗后的 JD markdown + meta。Claude 写到 `.claude/muicv/targets/google-senior-swe.md`：

```markdown
---
type: target
company: Google
title: Senior Software Engineer, Frontend
source_url: https://www.google.com/about/careers/...
fetched_at: 2026-04-24T10:15:00Z
---

## JD 正文

### 职责
- Build and maintain ...

### 要求
- 5+ years experience with React or similar
- Strong TypeScript
- Experience with performance optimization
- ...
```

---

## Step 4 · 匹配度分析

→ **你**："分析一下我能投这个岗位吗"

· Claude 触发 `muicv-jobs:match`，扫素材 + target，输出报告：

```
# Match 报告：targets/google-senior-swe.md

**结论**：🟡 部分匹配

## JD 要求 vs 素材覆盖

| JD 要求 | 覆盖？ | 来源 |
|---|---|---|
| React | ✅ | experience/acme-2021.md |
| TypeScript | ✅ | experience/acme-2021.md |
| Performance optimization | ✅ | LCP 优化那条 |
| 5+ years experience | ⚠️ | ACME 2021-now (~5 年) + Startup 2019-2021 (~2 年)，累计约 7 年 |
| Accessibility | ❌ | 素材里未找到 |
| ... | | |

## 建议

### P0 补素材
- Accessibility — JD 明确要求。如果你做过可访问性相关工作（WCAG、screen reader 测试等），用 muicv-core 补一段

### P1 高潜力
- "带 3 人小组"可以更突出——Google L5 特别看重 leadership 信号

## 下一步
- 补素材 → muicv-core
- 已经够 → muicv-generate 生成简历
```

---

## Step 5 · 生成简历

→ **你**："够了，直接生成一版试试"

· Claude 触发 `muicv-generate`，按 JD 相关度排序 / 裁剪 / 改写，写到 `.claude/muicv/versions/google-senior-swe-2026-04-24.md`：

```markdown
---
type: version
target: targets/google-senior-swe.md
generated_at: 2026-04-24T10:30:00Z
source_files:
  - profile.md
  - experience/acme-2021.md
  - experience/startup-2019.md
---

# 张三

前端工程师 · 北京 · zhangsan@example.com · github.com/zhangsan

## Summary

7 年前端工程师经验，精通 React + TypeScript 与 Next.js...

## 工作经历

### Senior Frontend Engineer — ACME Corp
2021-06 — 至今 · 北京 · TypeScript, React, Next.js

- 主导核心产品 dashboard 重构，LCP 从 3.1s 降到 1.4s
- 带领 3 人小组协作推进技术选型与代码评审

### Frontend Engineer — Startup Inc
2019-03 — 2021-05 · Vue, Nuxt

- ...

## 技能

- 语言：TypeScript, JavaScript
- 框架：React, Next.js, Vue, Nuxt
- 领域：前端性能优化
```

---

## Step 6 · 评审迭代

→ **你**："评审一下"

· Claude 触发 `muicv-critique`：

```
# 评审报告：versions/google-senior-swe-2026-04-24.md

**整体评估**：🟡 可改进

## 维度评分

| 维度 | 评价 | 简评 |
|---|---|---|
| 事实完整度 | 🟢 | 每条 highlight 都能追溯到素材 |
| 量化比例 | 🟡 | 4 条 highlight 里 2 条带数字 |
| STAR 结构 | 🟡 | Startup 那段缺 Result |
| 关键词对齐 | 🟡 | JD 要 accessibility 未覆盖 |
| 长度密度 | 🟢 | ~1.5 页 |

## P0
1. **Startup Inc 那段只有 Action，没有 Result**
   位置：`## 工作经历 > Startup Inc > 第 1 条`
   建议：追问一下有没有具体数字或业务结果，比如用户量、转化率等

## P1
- accessibility 素材缺，之前 match 已提示，这里再次标记

## 下一步
- 要我按 P0 改？还是先补 Startup 那段的素材？
```

→ **你**："我想起来了，Startup 那段做的 H5 是电商活动页，转化率提升了 15%。帮我加上"

· Claude Edit `experience/startup-2019.md`，在亮点里加一条，然后建议重新 generate 或直接改 version。

---

## Step 7 · 导出 PDF + 准备投递

→ **你**："定稿了，导出 PDF"

· Claude 触发 `muicv-render`，调 API（首次冷启动 5-10s，Claude 提示用户）：

```bash
curl -X POST ${MUICV_API_BASE}/render \
  -H "Content-Type: application/json" \
  -d @versions/google-senior-swe-2026-04-24.md \
  --output versions/google-senior-swe-2026-04-24.pdf
```

· Claude：`✓ versions/google-senior-swe-2026-04-24.pdf (148 KB, 2 页)`

→ **你**："帮我准备投递材料"

· Claude 触发 `muicv-jobs:apply`，基于 target + 素材生成 cover letter：

```
.claude/muicv/applications/google-2026-04-24.md
```

内容：3~5 段 cover letter + 投递 checklist + 备注（提醒 accessibility 的缺口）。

---

## 最终产出

```
~/my-career/
└── .claude/muicv/
    ├── profile.md
    ├── experience/
    │   ├── acme-2021.md
    │   └── startup-2019.md
    ├── targets/
    │   └── google-senior-swe.md
    ├── versions/
    │   ├── google-senior-swe-2026-04-24.md
    │   └── google-senior-swe-2026-04-24.pdf     ← 投递用
    └── applications/
        └── google-2026-04-24.md                  ← cover letter + checklist
```

投递后这份目录可以 `git commit`，作为你求职过程的留痕。下一个岗位来的时候，素材可以复用，只要再跑一次 fetch / match / generate / render 就好。

---

## 关键原则回顾

- **不编造**：所有生成严格来自素材。缺了就问你或留空。
- **你掌控**：评审和匹配分析只给建议，改不改你说了算。
- **不自动投递**：我们只准备材料，真正的提交由你去目标网站手动完成。
- **数据本地**：`.claude/muicv/` 是你的，要不要入 git 由你决定。
