import { DurableObject } from 'cloudflare:workers';

/**
 * BrowserContainer Durable Object
 *
 * 背后挂着一个 Cloudflare Container（见 wrangler.jsonc 的 containers 配置），
 * 容器里跑 Node + Chromium + Puppeteer + Hono（container/server.ts）。
 * DO 本身是个透明代理：Worker 调 `stub.fetch('http://do/<path>', ...)`，
 * 请求的 pathname 原样转发到 container 的 HTTP server（监听 :3000）。
 *
 * 目前 container 暴露：
 *   - GET  /health
 *   - POST /render       （简历 markdown → PDF）
 *   - POST /jobs/fetch   （JD URL → 清洗后的 markdown + meta）
 *
 * MVP 采用纯冷启动。后续如需保活，可加 `ctx.container.sleepAfter(...)`。
 */
export class BrowserContainer extends DurableObject<CloudflareBindings> {
  /** Container 内 HTTP server 监听的端口，必须和 container/server.ts 里一致。 */
  private static readonly CONTAINER_PORT = 3000;

  constructor(ctx: DurableObjectState, env: CloudflareBindings) {
    super(ctx, env);

    this.ctx.blockConcurrencyWhile(async () => {
      if (!this.ctx.container) {
        throw new Error('Container API 不可用。请确认 wrangler.jsonc 里声明了 containers。');
      }
      if (!this.ctx.container.running) {
        this.ctx.container.start();
      }
    });
  }

  /**
   * 透明代理：把请求的 pathname/query/body/method/headers 原样转给 container 内 server。
   * Worker 侧用 `stub.fetch('http://do/<path>', ...)`，`do` host 只是占位，
   * 真正决定路由的是 pathname。
   */
  override async fetch(request: Request): Promise<Response> {
    if (!this.ctx.container) {
      return Response.json({ error: 'Container API 不可用' }, { status: 500 });
    }

    const incoming = new URL(request.url);
    const port = this.ctx.container.getTcpPort(BrowserContainer.CONTAINER_PORT);
    const target = new URL(incoming.pathname + incoming.search, 'http://container');

    return port.fetch(target.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });
  }
}
