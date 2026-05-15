# SaaS UI Kit — High-density productivity dashboard

工作室所有 SaaS / 后台 / 控制台类产品的视觉范式。和 marketing 的"纸卡 + 阳光"完全不同：
**密度优先、克制黄色、墨边只用在主 CTA 上**。其它地方走轻量 `--shadow-xs` 软影 + 1px ruler。

## 调性 — "工具台，不是杂志"

- 280–960px 主内容区，4px 基准间距，多用 8/12/14/16px
- KPI 数字用 Fraunces serif（display），列表 / 表头用 mono
- 主色黄只在：当前选中导航、主 CTA、状态徽章上下文
- 状态徽章按 `--color-success / warning / danger / mute` 严格分级，不滥用

## 包含组件

| 文件 | 渲染什么 |
| --- | --- |
| `Sidebar.jsx` | 左侧导航：搜索 + 两组（工作区 / 系统）+ 用户 footer。`Icon(name, size)` 工具函数（lucide-style 内联 SVG）共用给其它文件。 |
| `TopBar.jsx`  | sticky 顶栏：面包屑 + 动作按钮组（通知、导入、新建版本） |
| `Overview.jsx`| 概览页：4 个 KPI + 双栏（最近版本表格 + 活动 log） |
| `Versions.jsx`| 简历版本管理表：filter tabs + 搜索 + 数据表（含匹配度进度条、STAR 评分、状态徽章、多选） |
| `Settings.jsx`| 设置页：账户 / 模型 + token / 通知 三个分组，含 input、select、toggle |
| `Placeholder.jsx` | 未实现 section 的占位空状态（带图标 + 一句话 + CTA） |

## 运行

打开 `index.html`。点左侧导航在不同 section 之间切换，演示交互（filter、select、toggle、表格行选中）都通过 React state 工作。

## 改它

- 数据：每个 `.jsx` 的顶部 / 底部都有数据常量（`RECENT`、`ACTIVITY`、`VERSIONS`），改这里。
- 列宽 / 表格密度：`saas.css` `.table th / td` 的 `padding: 9px 10px`。**不要**超过 12px，否则失去密度感。
- 新增 section：在 `Sidebar.jsx` 的 `groups` 加一项，在 `index.html` 的 `switch` 加一个 case，再写一个组件 / 复用 `Placeholder`。

## 设计要点

- 表格行 hover = `--color-fluff`，selected = `color-mix(yellow 25%, paper)`，绝不用纯白
- 进度条颜色按阈值切：`>=75 success`、`>=50 warning`、`<50 danger`
- 主 CTA 用 `.btn-primary`（黄底 + 墨边 + 2px 黄深阴影），其它操作用 `.btn`（cream 底 + 软影），ghost 操作用 `.btn-ghost`
- 表头始终全大写、mono、`--color-mute`，sticky 到面板顶部
- KPI 数字用 Fraunces 给"数据感"一个文化质地
- 所有 form-row 用 200px 标签列 + 1fr 内容列的 grid，避免在窄屏堆叠
