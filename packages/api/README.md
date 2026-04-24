@muicv/api
===

Mui简历 skill 背后的 Cloudflare Worker。对外承担本地 / agent 做不了的事：PDF 渲染（现在）、JD 抓取（规划）、模板库、将来的账号/订阅。

## 架构

```
skill (muicv-render) → POST /render
                          ↓
                   Hono Worker (src/index.ts)
                          ↓
                   Durable Object (PdfRenderer)
                          ↓
                   Cloudflare Container
                   (Node + Chromium + Puppeteer，监听 :3000)
                          ↓
                   HTML → PDF → bytes 原路返回
```

Container 在 MVP 阶段**纯冷启动**：首次调用 5-10s，热调用 <1s。后续如需保活，给 `PdfRenderer` DO 加 `ctx.container.sleepAfter(...)`。

## 本地开发

前置：装了 Docker（OrbStack / Docker Desktop / Colima 都行）。

```bash
# 装依赖（pnpm workspace root 一次就够）
pnpm install

# 启动 wrangler dev（自动 build docker 镜像、起 container、起 worker）
pnpm --filter @muicv/api dev

# 测试
curl -X POST http://localhost:8787/render \
  -H "Content-Type: application/json" \
  -d '{"markdown": "# Hello\n\n## Summary\n\n一段测试。"}' \
  --output /tmp/test.pdf
open /tmp/test.pdf
```

首次运行会拉 `node:22-slim` 镜像 + `apt-get install chromium`，耗时 2-5 分钟；之后走 Docker 层缓存，很快。

## 部署

```bash
pnpm --filter @muicv/api deploy
```

`wrangler deploy` 会自动：
1. 用 `container/Dockerfile` 构建镜像
2. 推到 Cloudflare 托管的 Container Registry
3. 部署 Worker + 声明 DO + Container 绑定

## 目录

- `src/index.ts` — Hono Worker，路由 `/render`、`/health`
- `src/durable-objects/pdf-renderer.ts` — Container 的 DO 包装
- `container/Dockerfile` — Node 22 + Chromium + Noto 字体
- `container/server.ts` — Puppeteer HTTP server（复用 browser 实例）
- `container/templates/default.html` — A4 单栏简历模板

## 添加新模板

1. 在 `container/templates/` 下新增 `<name>.html`（用 `{{title}}`、`{{content}}` 两个占位符）
2. Skill 调 API 时传 `template: "<name>"`
3. Dockerfile 会自动 COPY 过去，重新部署即可

## 环境变量 / 配置

目前 MVP 不需要环境变量。未来：

- `MUICV_ALLOWED_ORIGINS`（CORS）
- 账号/订阅相关的 secret（用 `wrangler secret put`）
