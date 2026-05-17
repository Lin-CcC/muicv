# WIP：Mui简历开发计划

最后更新：2026-05-17

## 当前进行中

### 插队任务：设置页三分组重构

目标：把 app 设置页从单列长滚动改成“通用 / 模型 / Skill”三分组导航，降低选项密度和滚动长度。

- [x] 新增设置页左侧分组导航，右侧只渲染当前分组内容。
- [x] 通用分组放账号、会员/余额、主题、版本更新和安全提示。
- [x] 模型分组放默认 LLM、muirouter、BYOK endpoint 和本地 whisper.cpp 转写。
- [x] Skill 分组保留现有 Skill 市场入口、刷新、错误态和外链行为。
- [x] 跑 app typecheck / test / build 验证。

### 插队任务：腾讯校招内容降级为来源索引 + SEO 检查

目标：腾讯校园招聘 Skill 当前不能轻易装进 MuiCV，所以公开内容改成“存在性 / 官方来源索引”；同时修复 sitemap 未收录 CMS 内容，并检查基础 SEO 配置。

- [x] 用 CMS MCP 更新腾讯校招 Skill / 博客文案，移除 MuiCV 使用 / 安装暗示。
- [x] 修复 sitemap 对 CMS posts / skills / changelog 的动态收录。
- [x] 检查 robots、canonical、metadata、公开 API 与线上 sitemap 输出。
- [x] 跑验证并 commit + push，交给自动部署。

### 插队任务：恢复 changelog 内容 + 修正文列表 marker

目标：把历史 changelog 通过 CMS MCP 写回 Payload，并修复内容详情页 Markdown 列表没有圆点 / 序号的问题。

- [x] 给 CMS MCP 补齐 changelog 创建 / 更新 / 查询工具。
- [x] 用 MCP 把历史 changelog 写入 Payload CMS。
- [x] 修复 `.prose-mui` 下 `ul` / `ol` 的 marker 样式。
- [x] 跑 CMS / website 验证并提交推送。

### 插队任务：Payload CMS 用户 API Key

目标：让 CMS 管理员可以在 Users 里为 MCP / Agent 工作流生成 Payload API Key，不再依赖邮箱密码登录。

- [x] 确认 Payload API Key 需要 `auth.useAPIKey`，不是额外插件。
- [x] 给 `users` collection 开启 API Key。
- [x] 生成对应 D1 migration。
- [x] 更新 Payload 类型。
- [x] 跑 CMS 验证并应用远端 D1 migration。
- [x] MCP client 改为优先使用 Payload 用户 API Key。

### 插队任务：Skill 目录 + 求职内容中心 + Payload CMS

目标：把收集到的求职相关 skill 登记成可维护目录，同时让网站新增可收录页面、app 能列出 skill 并引导安装/查看官方来源。

- [x] 抽出共享内容模型：求职博文、skill catalog、changelog。
- [x] 建立共享内容模型；真实内容改由 Payload CMS 发布，不再写入 seed 基线。
- [x] 网站新增 `/posts`、`/posts/jobs`、`/skills`、`/changelog` 及详情页。
- [x] API 新增公开 catalog 端点，供 app 拉取。
- [x] app 设置页新增 Skill 市场，区分“已内置”和“官方来源”。
- [x] 新增 `packages/cms` Payload 脚手架和 collection 定义。
- [x] 生成 / 更新 Payload 依赖 lockfile。
- [x] CMS 改为复用现有 D1 `muicv`、R2 `muicv` / `site-cache`。
- [x] website posts / skills 数据源切到 Payload REST；CMS 不可用时返回空内容。
- [x] API / app catalog 数据源从 seed 切到 Payload REST。
- [x] 跑 shared/api/app/website/cms 验证。

### 插队任务：腾讯校园招聘 Skill 内容落地

目标：用腾讯校园招聘 Skill 做第一个第三方官方 skill 示例，但内容必须走 Payload CMS，而不是继续写 seed。

- [x] 移除腾讯校园招聘 Skill / 博客的 seed 内容，避免绕过 Payload。
- [x] website / API 内容目录统一读取 Payload；CMS 不可用时返回空内容，不再用 seed 冒充发布内容。
- [x] CMS MCP 补齐 skillExtensions 创建 / 更新工具，让 Agent 可以把 skill 单页写进 Payload。
- [x] app Skill 市场入口只打开 MuiCV 自有详情 / 接入流程，不把用户导向 WorkBuddy。
- [x] 跑 shared/api/app/website/cms 验证。

### 插队任务：连接授权页简化

目标：把浏览器授权页从“解释 API key / dashboard / callback”改成普通用户能立刻理解的“确认连接并回到桌面端继续”。

- [ ] 默认视图只保留账号、连接对象和一个主按钮。
- [ ] 授权成功后只提示“已连接”，把手动 key 复制作为问题排查兜底隐藏起来。
- [ ] 保留安全与错误状态，不暴露不必要的底层概念。
- [ ] 跑 website 构建验证。

### Phase 15：云同步隐私改造

目标：用户对"上云"的信任成本降到最低——服务端默认看不到明文素材；用户对 GitHub 仓库可见性有完整控制权。威胁模型：防 muicv 自己脱库 / 内部员工偷看，不是防 AI provider。

skill 端（已落地）：

- [x] [skills/muicv-sync/SKILL.md](skills/muicv-sync/SKILL.md) 大改：
  - [x] push 加 zip 加密分支（用户给密码 → `zip -e` 打包加密上传到 blob 端点；不给密码 → 走老明文 JSON）
  - [x] pull 先探 blob 端点，404 fallback 明文端点；解压前向用户要密码
  - [x] 文件类型从仅 `.md` 扩到 `.md` + 常见图片（`.jpg/.jpeg/.png/.webp/.gif/.svg`），`.pdf` 排除
  - [x] 单库上限 1 MB → **50 MB**，文件数 500 → **1000**
  - [x] 密码不持久化（不写文件 / env，bash 进程结束即丢；skill 报告里不回显字面值）
- [x] [skills/muicv-git/SKILL.md](skills/muicv-git/SKILL.md) 小改：
  - [x] init 流程加 public/private 询问步骤，去掉硬编码 `--private`
  - [x] init 前加 >50 MB / >1000 文件软提醒，建议把大照片 / `versions/*.pdf` 塞 `.gitignore`

服务端（packages/api + packages/website，已落地代码层）：

- [x] R2 bucket binding `MUICV_RESUME_BLOB` —— [packages/api/wrangler.jsonc](packages/api/wrangler.jsonc) + [packages/website/wrangler.jsonc](packages/website/wrangler.jsonc) 各加一份
- [x] D1 schema + migration —— [packages/website/lib/schema.ts:236-263](packages/website/lib/schema.ts:236) + [packages/website/migrations/0013_resume_snapshot_blob.sql](packages/website/migrations/0013_resume_snapshot_blob.sql)
- [x] [packages/api/src/routes/resume-sync-blob.ts](packages/api/src/routes/resume-sync-blob.ts) —— 5 个 handler：push (multipart) / get / download / history / delete
- [x] [packages/api/src/app.ts](packages/api/src/app.ts) 注册 5 个新路由
- [x] [packages/shared/src/resume-sync.ts](packages/shared/src/resume-sync.ts) 加 `validateBlobSummary` + 4 个新常量；老明文上限 1 MB → 50 MB / 500 → 1000（仍仅 `.md`）
- [x] [packages/api/test/routes.test.ts](packages/api/test/routes.test.ts) 加 11 个 blob 路径测试（68 全 pass）
- [x] dashboard `/dashboard/sync` 加密版面板（活动版 + 历史 + 下载 / 删除 / 清空）—— [packages/website/app/(dashboard)/dashboard/sync/page.tsx](packages/website/app/(dashboard)/dashboard/sync/page.tsx) + [sync-actions.tsx](packages/website/app/(dashboard)/dashboard/sync/sync-actions.tsx)
- [x] next.js 代理路由：`/api/resume/sync/blob` (DELETE 清空) / `[id]/download` (GET 下载) / `history/[id]` (DELETE 单条)

部署前操作（用户自己跑）：

- [x] R2 bucket `muicv` 已建好（公开域名 i.muicv.com）
- [ ] `pnpm --filter @muicv/website db:migrate`（应用 0013_resume_snapshot_blob.sql 到 D1 生产库）
- [ ] `pnpm --filter @muicv/api deploy` + `pnpm --filter @muicv/website deploy`（两个 worker 都要更新，因为都新增了 R2 binding）

验证清单：加密 push/pull 端到端字节级一致；明文兜底走老路；照片场景；PDF 自动忽略；密码错给出友好提示且不重试；muicv-git 双路径 + 软提醒。

### Phase 16：姆伊品牌形象重制（暂缓）

目标：基于姆伊真实照片重做 app / website 的 icon、logo、mascot 和求职场景形象；原始照片只作为本地参考，不提交进仓库。

产品方向：

- 姆伊的核心气质是“安静、可靠、陪伴”，不是搞笑 mascot。
- 基础形象要保留图1里的大耳朵、白色鼻梁竖纹、暖金色毛发、趴着睡的松弛感。
- 求职场景可以扩展为：叼来 `Offer`、旁边放简历、对话气泡、放大镜评审、空状态等待。
- 小尺寸 icon 优先识别度；大尺寸场景图优先情感和产品语义。

本轮结论：第一版矢量尝试不够好看，尤其需要避免脸部竖向过长；后续应先做视觉稿/多方案评审，再进入代码替换。


## 方向

把核心业务能力封装成 **Claude Code Skills + 轻量 API + Electron 桌面端**，用户在自己熟悉的
AI agent（Claude Code / Codex / Cursor 等）里直接调用；简历素材作为 **Markdown + YAML
frontmatter** 存在 `.claude/muicv/`，由用户用 git 自己管理。完整背景见 README.md。

> 已完结的 Phase 13（muicv-interview + STT 集成）/ Phase 14（首次体验设计改版）
> 决策与教训已沉淀到 [DEV_NOTE.md](./DEV_NOTE.md) 对应章节。

## 下一步

按 [TODO.md](./TODO.md)：

- 云同步 skill（muicv 平台 / GitHub 双通道）— **server 端 + skill 端均已落地；Phase 15 在做加密改造（见上方）**
- 成为面试官 skill（角色互换，让用户练习当面试官）
- 入职辅导 / 理解保险 类职场辅导 skill
