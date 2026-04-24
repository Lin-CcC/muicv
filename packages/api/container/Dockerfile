# Puppeteer + Chromium 运行环境，用于 PDF 渲染。
#
# 基础镜像选 node:22-slim：Debian 精简版，能 apt 装 chromium。
# 总大小约 500-700MB 压缩后，冷启动时间 5-8s。
#
# 注意：
# - 用 puppeteer-core 而不是 puppeteer（避免下载内置 Chromium）
# - Chromium 走系统包管理，路径 /usr/bin/chromium
# - 跑 Chromium 必须有 --no-sandbox（在 server.ts 里传）

FROM node:22-slim AS base

# 安装 Chromium + 常见字体（含中日韩）+ 一些运行时依赖
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        chromium \
        fonts-noto \
        fonts-noto-cjk \
        fonts-noto-color-emoji \
        dumb-init \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV NODE_ENV=production

WORKDIR /app

# 先装依赖（利用 Docker 层缓存）
COPY package.json ./
# 没 lockfile 时直接 npm install；build 时间能接受
RUN npm install --omit=dev

# 再拷业务代码
COPY server.ts ./
COPY templates ./templates

# 用非 root 用户跑（安全）
RUN groupadd -r app && useradd -r -g app app \
    && chown -R app:app /app
USER app

EXPOSE 3000

# dumb-init 作为 PID 1，正确处理信号（让 puppeteer 优雅退出）
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "--experimental-strip-types", "server.ts"]
