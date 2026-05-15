# App UI Kit — Mui简历 mobile

把工作室的视觉语言落到手机 app 形态。iOS 设备 chrome 用 starter component (`ios-frame.jsx`)，内部全部走 Meathill Studio 自家 token 和组件。

## 4 个 click-thru 屏幕

| Tab | 屏幕 | 内容 |
| --- | --- | --- |
| 概览 | `Home.jsx` | 大标题 + 2 列 KPI（素材数 / token 用量）+ 最近简历版本列表 + Mui 的建议 callout |
| 对话 | `Chat.jsx` | 全屏聊天流：用户消息、Mui 回复 + 内联 tool call + "Mui 在思考" 跳动小球 + 双行动按钮选择 + 底部 composer |
| 素材 | `Editor.jsx`| 经历编辑表单：分组卡片（标题 / 动作 / 结果 / 标签）+ Mui 评审 callout + 底部双 CTA（取消 / 保存） |
| 设置 | `Settings.jsx`| 账户卡 + token 用量进度条 + 模型 / 通知 / 同步 列表 + 关于 |

切换通过底部 4-tab `TabBar.jsx`，按 design system 的 `.m-tabbar`（兼容 iOS safe area 但底色用 Meathill cream/yellow）。

## 运行

打开 `index.html`。所有屏幕都包裹在 `<IOSDevice width={402} height={874}>` 里，外面是 dot grid + sun gradient 背景，模拟"产品截图"的页面氛围。

## 改它

- 屏幕数据：每个 `Screen*.jsx` 顶部 / 内部有数据常量，直接改。
- 加新屏幕：写 `Screen<Name>.jsx`，在 `TabBar.jsx` 加 tab 项，在 `index.html` 的 `if` 里加分支。
- 用 Android 设备 chrome：把 `ios-frame.jsx` 换成 starter `android_frame.jsx`，外部 wrap 改成 `<AndroidDevice>`，内部组件不用动。

## 设计要点

- 字号比桌面稍大：标题 26px、body 16px、小标签 12px。**绝不缩到 13 以下。**
- 底部 tab bar、composer、CTA 都用 `backdrop-filter: blur(12px)` 让滚动内容透过去——仅在浮动条上用，背景大块不用模糊。
- 列表样式：`.m-list` = paper 底 + 1px rule-strong 描边 + radius-md。**不用 iOS 自带的圆角分组，要用 Meathill 的紧凑风格。**
- 状态徽章 `.m-pill` 全部 mono 字体 + 10px + 大写。和桌面 SaaS 表格的徽章是同一套规范。
- 主 CTA 用墨边 + 黄底 + 2px 黄深阴影；次 CTA 用墨边 + cream 底 + 2px 墨阴影。和 marketing 的 `.press` / `.press-ink` 视觉一致，只是按钮高度增加到 12px 适合触控。
