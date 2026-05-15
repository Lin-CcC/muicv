# Marketing UI Kit — Mui CV style

复刻自 [meathill/muicv](https://github.com/meathill/muicv) `packages/website/app/(marketing)/`，是工作室面向终端用户（求职者 / 博客读者 / app 用户）的**营销站**视觉范式。

## 调性 — "纸卡 + 阳光"

- 底色：奶油白（`--color-cream`）
- 主色：柯基黄（`--color-yellow`）
- 招牌效果：**2px 墨边 + 3–5px 实色阴影 = 厚纸卡片**（`.press`、`.aside-card`）
- 装饰：右上角阳光晕、左下角奶油光、稀疏 paw 点缀、`Highlight` 荧光笔加重

## 包含组件

| 文件 | 渲染什么 |
| --- | --- |
| `Icons.jsx` | 手绘 SVG 图标（paw、sparkle、arrow、doc、target、chat、compass）+ `<Highlight>` 高亮文字 + `<CorgiMascot>` 引用 |
| `Header.jsx` | sticky header：mascot + 字标 + nav + 创建账号按钮 |
| `Hero.jsx` | 双栏 hero + 自动轮播的产品演示（3 个 slide：导入素材、素材库、定制简历），含 paw 装饰、Highlight、CTA 两键 |
| `Workflow.jsx` | "只做三件事"有序步骤，圆形序号 + 黄色 press 阴影 |
| `Features.jsx` | 2×2 厚描边 press card 网格，含 "已上线 / 即将推出"状态徽章 |
| `Install.jsx` | 终端代码块（深色 `#1a1815` 底 + 奶油白字 + 推荐徽章），左侧引导文 |
| `Faq.jsx` | 折叠 FAQ + 右侧两张 promo card（下载 app / 定价） |
| `Footer.jsx` | 三列 footer + paw 监修标记 |

## 运行

直接在浏览器打开 `index.html`。所有脚本走 CDN（React 18.3.1 + Babel 7.29.0），无需构建。

## 改它

- 文案：每个 `.jsx` 文件顶部一般有数据数组（`FEATURES`、`WORKFLOW_STEPS`、`FAQ`），改这里就行，不用动 JSX 结构。
- 色：所有颜色走 `colors_and_type.css` 的 CSS 变量；不要写死 hex。
- 间距：用 `--space-*`；section 内最大 `--space-7` (32px)，section 之间 `--space-9` (56px) / `--space-10` (72px)。
- 圆角：默认 6/8/10px。`.press` / `.feat-card` / `.aside-card` 用 `--radius-xl` (14px) 是上限，**不要超过**。

## 不要

- ❌ 把 hero 改成蓝紫渐变
- ❌ 给卡片加 left-border 色条
- ❌ 拿 emoji 凑数图标（手绘 SVG 是这套的风格特征）
- ❌ 把 .press 阴影换成模糊
- ❌ 全屏 glassmorphism
