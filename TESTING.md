# TESTING

## 环境要求

- Node.js >= 24
- pnpm（见根目录 `package.json` 的 `packageManager`）
- Docker（可选，跑 `packages/api` 的 Container 时需要）

## 安装依赖

在仓库根目录执行：

```bash
pnpm install
```

## 运行测试

目前测试主要来自：

- `packages/shared`：领域类型/工具的 smoke test

测试使用 Node 内置 test runner。

```bash
pnpm test
```

只跑某个包：

```bash
pnpm --filter @muicv/shared test
```

## 启动开发服务器

Web 主体（landing + 未来 dashboard）：

```bash
# 纯 Next.js dev（最快）
pnpm dev

# OpenNext / Wrangler 本地预览（贴近生产 Worker 环境）
pnpm dev:cf
```

API（PDF 渲染 + JD 抓取 + waitlist，需要 Docker）：

```bash
pnpm dev:api
```

## 验证 Cloudflare 部署

`packages/website` 和 `packages/api` 都已接入 wrangler，本地可 dry-run：

```bash
# website：先在本地 D1 跑 migrations（M2 起会有 users 等表）
pnpm --filter @muicv/website cf-typegen

# website：构建 Worker bundle（不部署）
pnpm --filter @muicv/website cf:build

# api：dry-run 含 Docker 镜像构建
pnpm --filter @muicv/api build
```

## 说明

- 端到端测试待补齐
- `packages/api` 的 Container 在本地 dev 需要 Docker（OrbStack / Docker Desktop / Colima 任选）
