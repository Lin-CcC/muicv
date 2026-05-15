# Meathill Studio Design System

> 暖黄 · 奶油白 · 暖深棕。一只柯基的颜色，做成一个工作室的视觉语言。

这个 design system 是 **Meathill Studio**（[blog.meathill.com](https://blog.meathill.com)）个人工作室的视觉与产品基底，覆盖 SaaS、博客 / CMS、手机 app 等场景。

工作室和它的精神图腾是两件事，类似丰田之于凯美瑞：

- **Meathill Studio** 是公司 / 主体，承担"做什么、对谁负责"。所有正式署名、版权、wordmark 都用这个名字。
- **Mui**（一只名叫姆伊的柯基狗）是工作室的吉祥物 / 监修者 / 拟人化代表。她的颜色（暖黄背毛 + 奶油白胸口 + 黑鼻子）成了整个视觉系统的取色来源，她的口吻成了 AI 助手的人格。在文案里 Mui 会以**第一人称**出现："Mui 在思考"、"由柯基姆伊监修"、"把简历交给 Mui 整理"。

配色、版式、装饰，全部围绕这只狗展开；署名、企业身份，全部走 Meathill Studio。两边别混。

工作室对设计有几个非常具体的要求，这套系统全部把它们物化为 token：

- **暖色调优先** — 主色是 yellow（柯基背毛），不出现冷蓝紫；底色用奶油白而非纯白，字色用暖深棕而非纯黑。
- **圆角不要太大** — 默认 `--radius: 6px`，最大 `--radius-xl: 14px`。不做 pill 化、不做圆胖控件。
- **边距不要太空旷** — 信息密度优先。spacing 基准是 4px，常用 8–16px，section 内最大 32px。SaaS 工具表格、表单、面板都按密度档位排版。
- **文字不要太小，也不要奇数、不要小数** — 正文 16px，UI 14px，元信息 / kbd / mono 标签 12px 是最小档。类型序列只走偶数：12 / 14 / 16 / 18 / 20 / 24 / 30 / 36 / 48。
- **组件覆盖要全** — 工作室同时输出 SaaS / 博客 / 手机 app，所以从 `Button / Input / Select / Combobox / Menu / Sidebar / Pagination / Sheet` 到 `BlogPostCard / AppCard / Toolbar / EmptyState`，都要有。

---

## 索引

| 文件 / 目录 | 用途 |
| --- | --- |
| `README.md` | 你正在读的这份。品牌、内容、视觉、图标四大基础原则。 |
| `SKILL.md` | 把这个 design system 当作 [Claude Skill](https://code.claude.com/docs/en/skills) 加载时的入口。 |
| `colors_and_type.css` | 所有 CSS 变量（颜色、字号、间距、半径、阴影、动效）+ 语义元素样式。**所有 HTML 都应该 `<link>` 这个文件。** 内含完整的暗色 token（见下节）。 |
| `assets/` | 实体素材：mascot SVG、wordmark、paw icon、blog favicon、Mui 原照。 |
| `preview/` | 设计系统卡片（在 "Design System" tab 浏览）。 |
| `ui_kits/marketing/` | Mui简历 风格营销 / 博客网站 UI kit（hero + workflow + features + install + FAQ + footer）。 |
| `ui_kits/saas/` | 高密度 SaaS 控制台 UI kit（sidebar + KPI + 表格 + 设置）。 |
| `ui_kits/app/` | 手机 app UI kit（iOS frame + 概览 / 对话 / 素材 / 设置 4 个屏幕 + 底部 tab）。 |
| `fonts/` | 字体目录。当前所有字体走 Google Fonts CDN，本目录留作离线托管的入口；上线生产时再 self-host。 |

## 暗色模式

每个产品都支持暗色。三种触发方式，按需选：

```html
<html data-theme="dark">    <!-- 强制暗色 -->
<html data-theme="auto">    <!-- 跟随系统 (prefers-color-scheme) -->
<body class="dark">         <!-- 只让某个 region 走暗色 -->
```

不写任何属性 = 默认浅色。所有 `--color-*` token 都已在暗色下重定义，UI kits 和 preview cards 不需要改任何样式，只要在 `<html>` 加属性就翻面。

暗色版规则：
- 底色不是纯黑，是 **暖深棕** `#1a1410`（cream），卡片底 `#231b14`（paper）。
- 字色不是纯白，是 **暖米白** `#f3e9d5`（ink）。
- 黄色家族在暗底上自动提亮一档 (yellow-deep `#b3851c` → `#e6b240`)，否则看不清。
- 描边色 `--color-ink-line` 在暗色下变成 `rgb(243 233 213 / 0.55)`，press button 的"厚边"还在但柔化。
- `.bg-sun` 的橘黄渐变保留但透明度从 0.45 降到 0.20。

## 来源仓库（如果你能访问，可以从源码进一步对齐细节）

这套 design system 是从两个真实仓库里提炼出来的，没有凭空发明。建议读者也去原仓库串一遍：

- **[meathill/muicv](https://github.com/meathill/muicv)** — Mui简历，工作室目前的旗舰产品（Markdown + skill 形态的 AI 求职 agent + Next.js + Cloudflare Workers）。
  关键参考路径：
  - `packages/website/app/globals.css` — 品牌色 token 源头
  - `packages/website/app/(marketing)/_sections/*` — Hero / Features / Workflow / FAQ 视觉范式
  - `packages/website/components/corgi-mascot.tsx` — mascot SVG
  - `packages/ui/src/*` — 底层组件实现（基于 `@base-ui/react`）
- **[meathill/blog-2026](https://github.com/meathill/blog-2026)** — 山维空间博客（Next.js 16 + WordPress headless + Cloudflare）。
  关键参考路径：
  - `src/app/globals.css` — 浅色 / 深色双主题
  - `src/components/home/*` — Hero、PostCard、TagCloud
  - `src/components/ui/*` — shadcn-style 组件集合（50+ 个）

---

## 内容基础（CONTENT FUNDAMENTALS）

**默认中文。**英文是辅助，不是平等的两条主线。命名、UI 文案、技术专有词夹杂英文是 OK 的（"BlockNote 编辑器""token 钱包""BYOK"等），但句子结构是中文。

### 语气：温暖、有陪伴感，但不卖萌过量

求职、写博客、用工具——这些场景的用户都希望被"理解"，但不希望被当小孩哄。Mui 这只狗是品牌的拟人化，但 Mui 本身有"监修者"的稳重感，不是"小宠物"。

正向例子（来自源码原文，保留作语料）：

- > "把简历和经历交给 Mui 整理。"
- > "下载桌面 app，导入现有简历或粘贴一段经历。Mui 会先帮你整理成可复用的职业素材库，再针对不同岗位生成、评审和导出简历。"
- > "想问的**大概率**在这里。"（FAQ 标题，自嘲但准确）
- > "由柯基 Mui 监修"（footer，平静的拟人）
- > "全栈开发 · 技术分享 · 生活记录"（博客 hero badge，密度高、节奏感强）

反例 / 不要写：

- ❌ "汪～Mui 来帮你啦！" — 过度卖萌
- ❌ "AI-powered next-generation resume platform" — 空泛 SaaS 套话
- ❌ "智能、高效、便捷" — 形容词堆叠没有信息
- ❌ "立即开启你的 AI 求职之旅" — 旅程比喻、励志体

### 称呼：第二人称（"你"），不要用"您"

工作室的产品给开发者、给求职者、给读者用，用"你"建立平视感。"您"会立刻把氛围推到外包客服。

### 大小写：英文专有词保留原样

- ✅ "Next.js""Cloudflare""macOS""TypeScript""GitHub"
- ✅ "Pro / Max 月付"（产品档位英文）
- ❌ "next.js""next-js""NEXT.JS"（错误大小写）
- ❌ 中文段落开头用一个英文大写单词（除非是品牌名）

中文之间夹英文 / 数字时**不需要**手动加空格，但跨段、跨标题时排版会自动好看。

### 标点：中文用全角，代码 / token 用半角

- 中文句子内：`，。！？：；""''`
- 代码 / 命令 / 路径：`-`、`_`、`.`、`/`、半角括号
- 不混用：`Mui简历`（专名）、"`muicv-core`"（包名）、"我们的服务器"（中文）。

### Emoji：可以用，但要节制

工作室的产品里能看到的 emoji：

- 🐾（paw） — Mui 的标志，footer / metadata 上用
- 🏋️ — 个人简介里点缀生活信息
- ✅ ❌ — 状态、对错
- ❤️ ❤️ — "Made with ♥ in 重庆"这类 footer

**不要**用 🚀、🎉、💡、🔥、✨ 这些"AI SaaS 配套 emoji"。Mui 不喜欢它们。

### 写作节奏：短句 + 列点 + 偶尔一句长句承接

- 标题：超短，3–10 个汉字。
- 副标题：一句话讲清要做什么。
- 解释：偶尔长句承担「为什么这样」，但段不超过 3 行。
- 列点：3–5 项最佳；超过就拆 section。

### 反目标（owner 写下来的，转录在这里）

- 不把首页做成 AI SaaS 式能力矩阵
- 不在首屏解释 BYOK、token、skill 协议或 agent 生态
- 不把 onboarding 做成强制导览或长教程
- 不为了兜底而堆满说明

---

## 视觉基础（VISUAL FOUNDATIONS）

### 颜色

**核心 palette（柯基色谱）**：

| Token | 用途 |
| --- | --- |
| `--color-yellow` `#e6c34a` | 主色。CTA、激活状态、品牌点睛。**面积要克制**，全屏黄是失败的。 |
| `--color-yellow-warm` `#e6a23a` | 主色暖一档；mascot / logo 默认色。 |
| `--color-yellow-deep` `#b3851c` | 深 accent / press 阴影底色 / 链接色 / 强调字 |
| `--color-corgi` `#f3c574` | 高亮（marker style）、装饰、轻 hover |
| `--color-fluff` `#fbf1d8` | 淡 yellow surface、tag 背景、status pill 底 |
| `--color-tongue` `#d8694e` | 柯基舌头粉橘。**仅用于 danger 或强 attention**，否则氛围会跑偏 |

**中性（暖中性，全部偏黄）**：

| Token | 用途 |
| --- | --- |
| `--color-cream` `#fdfaf2` | 页面底色。**不要用纯白。** |
| `--color-paper` `#f6efde` | 卡片底、二级面板 |
| `--color-paper-deep` `#ede2c5` | 三级表面、选中行、code block 浅底 |
| `--color-ink` `#3a2e23` | 主字色。**不要用纯黑。** |
| `--color-ink-soft` `#5a4938` | 正文 |
| `--color-mute` `#8a7660` | 元信息、placeholder |
| `--color-rule` `#e0d3b8` | 细分隔 |
| `--color-rule-strong` `#c9b790` | 卡片描边 |

**语义色**：success 用暖绿、warning 用品牌家族黄、danger 用 tongue 加深，info 用唯一一个冷色（`#3b6f9a`）做链接 / 信息提示，避免页面失温。

### 字体

| 角色 | 字体 | 落点 |
| --- | --- | --- |
| Display（serif） | **Fraunces** | Hero 标题、品牌大字、`<blockquote>`，给暖色页面一个文化感的落点。可用 italic 营造亲和。 |
| Body sans | **Nunito** | 全部 UI、正文。圆润 friendly，配柯基气质刚好。 |
| Mono | **JetBrains Mono** | eyebrow 小标签、代码、tabular 数字、命令行 |

字号刷选偶数、不上奇数、不上小数（owner 偏好）：正文 16px，UI 14px，元信息 12px，标题 24 / 30 / 36 / 48px。主体行高 1.6 。

> ⚠️ **字体托管**：目前 `colors_and_type.css` 里没有 `@font-face`，依赖 Google Fonts CDN。建议在每个 HTML 的 `<head>` 加：
>
> ```html
> <link rel="preconnect" href="https://fonts.googleapis.com">
> <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
> <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700;9..144,800&family=Nunito:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
> ```
>
> 如果你想 self-host（CN 用户友好），把 woff2 放进 `fonts/`，再在 CSS 里加 `@font-face`。**目前 `fonts/` 是空目录**，等 owner 上传授权过的字体文件。

### 间距与密度

4px 基准。组件内常用 8–16px，section 间 32–56px。这套系统**不做 64px+ 的呼吸感堆叠**——工具页面密度优先。

```
--space-1 4px   --space-4 16px   --space-7  32px
--space-2 8px   --space-5 20px   --space-8  40px
--space-3 12px  --space-6 24px   --space-9  56px / --space-10 72px
```

### 圆角

紧凑档位。**不做 24px+ 的"巨石卡片"**。

```
--radius-xs   3px   --radius-md   8px
--radius-sm   4px   --radius-lg  10px
--radius      6px   --radius-xl  14px  (装饰性 / Hero 卡片)
--radius-full 9999px (pill — tag / badge / chip only)
```

### 卡片 & 表面

两种风格并存，按层级用：

1. **Soft card** — `bg: var(--color-paper); border: 1px solid var(--color-rule-strong); border-radius: var(--radius-md); shadow: var(--shadow-sm);` → 表格、列表项、产品 UI 主力。
2. **Press card** —`bg: var(--color-cream); border: 2px solid var(--color-ink); border-radius: var(--radius-lg); box-shadow: 0 4px 0 0 var(--color-ink);` → marketing / hero / FAQ / 重点 callout。卡通厚描边气质，是工作室的招牌。

**严格禁忌**：

- ❌ 圆角 + 仅左 border 描边色条的"shadcn 默认 alert"
- ❌ 蓝紫渐变背景
- ❌ 嵌套卡片（卡片里再套卡片）
- ❌ 全 emoji 图标卡
- ❌ glassmorphism 大块毛玻璃（小处可用，但不要做主背景）

### 阴影 / 立体感

工作室的招牌效果是 **"press"** 风格：底部一道实色色条（黄或墨），不做模糊。

```css
.press      { box-shadow: 0 3px 0 0 var(--color-yellow-deep); }
.press-ink  { box-shadow: 0 3px 0 0 var(--color-ink); }
```

hover 时上移 1px，阴影变 4px；active 时下沉 2px，阴影变 1px。物理感、可点击感很强。

模糊阴影只在 dropdown / popover / sheet 这种"漂浮"的元素上用，强度也小（`--shadow-md` / `--shadow-lg`）。

### 背景与装饰

- `.bg-grid` — radial dot 网格，24px 间距，opacity 5%。Hero / 重点 section 背景。
- `.bg-sun` — 右上角橘黄径向渐变 + 左下角奶油白柔光，营造"阳光斜射进窗"的暖意。
- **`<Highlight>` marker** — 文字下层一道偏 skew 的 `--color-corgi` 块状高亮，模拟荧光笔。
- 偶尔用 `<PawIcon>` 浮在 Hero 角落（参考 muicv 的 `_sections/hero.tsx` 左 8%/上 18% + 右 6%/上 60%）。

不用：

- 抽象 blob / SVG illustration
- 装饰性 3D 渲染
- 大面积 noise / grain
- 全屏渐变

### 动效

- **总体**：短、轻、不阻塞任务。`--t-fast: 120ms`、`--t-base: 180ms`。easing 用 `cubic-bezier(0.22, 0.61, 0.36, 1)`（自然减速）。
- **hover**：颜色变化、`translateY(-1px)` 微抬，或 underline 颜色切换。不要弹簧、不要 scale 1.05+。
- **active / press**：`translateY(2px)` + 阴影变薄，物理按下感。
- **入场**：`opacity` + 10–20px 平移渐入。**不要**滑过整屏的视差。
- **mascot 装饰**：`.wiggle` 旋转 ±3°/2.4s，仅装饰元素（如 ✦），不要给主 UI 加。
- 遵守 `prefers-reduced-motion`。

### 交互状态（每个新组件都要覆盖）

`default / hover / focus-visible / active / disabled / loading / 空状态`。focus ring 用 `box-shadow: var(--focus-ring)`（黄 40% 透明，3px 实环）。

### 透明 / 模糊

- header / 浮动 toolbar：`bg-cream/85` + `backdrop-blur-sm`。**不要**做整屏毛玻璃。
- 模糊大背景仅在装饰 blob 上：`bg-yellow/15 blur-md`、`bg-corgi/30 blur-2xl`。

### 图像基调

- **暖色、自然光**。不做冷调、不去饱和成黑白、不加重 grain。
- 产品截图 / 演示图框在 `2px ink 描边 + press-ink 阴影`的卡片里，title bar 三个圆点是 `tongue / yellow / corgi`（不是 macOS 的红黄绿）。

---

## 图标（ICONOGRAPHY）

工作室同时用两套图标体系，按上下文选择：

### 1. Lucide（主力，SaaS / 产品 UI 用）

[lucide.dev](https://lucide.dev)。`blog-2026` 里直接通过 `lucide-react` 使用：

```tsx
import { ArrowRightIcon, SparklesIcon, GithubIcon, HeartIcon } from "lucide-react";
```

在 HTML / 静态原型里通过 CDN：

```html
<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>
<i data-lucide="arrow-right"></i>
<script>lucide.createIcons();</script>
```

或直接复制单个 SVG 进来：[lucide.dev/icons](https://lucide.dev/icons)。统一 2px stroke、`currentColor`、24px viewBox。**禁止给 lucide 图标加 fill**，破坏 stroke 风格。

常用：`arrow-right / arrow-up-right / chevron-down / sparkles / paw-print / heart / github / external-link / calendar / clock / eye / search / settings / menu / x / check / circle / send / file-text / image / code / terminal`。

### 2. 自绘 inline SVG（marketing / 品牌场景用）

参考 `muicv` 的 `packages/website/app/(marketing)/_icons.tsx`：所有 marketing 图标都是手写的 inline SVG，2px stroke、24x24 viewBox、`currentColor`、`strokeLinecap="round"`。**故意不引第三方图标库**，让 marketing 页面保持手作气质。

工作室自绘图标的几何范式：

- 文档 `DocIcon` — 矩形 + 折角 + 几道横线
- 目标 `TargetIcon` — 三同心圆 + 圆点
- 对话 `ChatIcon` — 带尾巴的对话框
- 罗盘 `CompassIcon` — 圆 + 菱形指针
- 火箭 `RocketIcon` — 椭圆 + 尾焰

这些都已经复用到 `ui_kits/marketing/` 里。

### 3. 品牌 mascot & 标志

- `assets/mui-mascot.png` — 柯基 Mui 头像（80×80 viewBox），无背景。
- `assets/mui-mark.png` — Mui 头像装在圆角方块里（1024×1024，favicon / app icon 用）。
- `assets/wordmark.svg` — 「Meathill Studio」字标，serif Fraunces，下方一道黄高亮。
- `assets/paw.svg` — 4 趾 + 掌的 paw 印（`currentColor`，跟随文本色）。
- `assets/blog-favicon.webp` — 山维空间博客的现成 favicon（备用）。

### 4. Emoji 作为图标？

只在前面 "Emoji" 一节列出的情况下用。**Mui 的产品里没有"用 emoji 代替按钮图标"这种做法**。

### 5. 字体类图标（icon font）？

不用。lucide + 自绘 SVG 已经足够，避免再引一套字体增加首屏负担。

---

## 使用

1. 给你的 HTML / React 文件加 `<link rel="stylesheet" href="../colors_and_type.css">`（路径按层级调整）。
2. 在 `<head>` 引入 Google Fonts 三件套（见上文）。
3. 优先使用 CSS 变量；不要写死颜色。
4. 看 `preview/` 里的 cards 找具体组件的视觉范式；看 `ui_kits/` 找完整页面如何组装。

---

## 警告 / 待办

- ⚠️ **没有自托管字体文件。** `fonts/` 目录是空的。生产环境上需要 owner 决定：
  (a) 继续走 Google Fonts CDN（最省事，但 CN 用户偶发慢）；
  (b) self-host —— 我会需要 Fraunces / Nunito / JetBrains Mono 的 woff2 文件（OFL 协议都允许 self-host）。
- ⚠️ 没拿到工作室的**真实产品截图 / 摄影素材**，所以 UI kit 里所有图位都是占位（参考 `muicv` 的 mock 风格手画）。如果有真实素材，请放进 `assets/` 我可以替换。
- ⚠️ 当前色板默认浅色优先。深色 token 在 `colors_and_type.css` 末尾以 `:root.theme-auto` 注册了 stub，但还没在 `preview/` / `ui_kits/` 里完整验证。

---

© Meathill / Meathill Studio.
