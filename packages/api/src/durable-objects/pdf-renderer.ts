import { DurableObject } from 'cloudflare:workers';

/**
 * PDF 渲染 Durable Object。
 *
 * 每个 PdfRenderer 实例背后对应一个 Cloudflare Container（见 wrangler.jsonc 的 containers 配置）。
 * Container 内跑一个 Hono + Puppeteer 的 HTTP server（见 container/server.ts），监听 3000 端口。
 *
 * 请求流向：Worker → `env.PDF_RENDERER.get(id)` → 本 DO.fetch() → container port 3000 → Puppeteer → PDF
 *
 * MVP 采用纯冷启动：没有 sleepAfter 配置，Cloudflare 会按默认策略自动在空闲后 sleep。
 * 后续如需保活，可在这里加 `ctx.container.setSleepAfter(Xms)` 等配置。
 */
export class PdfRenderer extends DurableObject<CloudflareBindings> {
  /** Container 内部 server 监听的端口，必须和 container/server.ts 里一致。 */
  private static readonly CONTAINER_PORT = 3000;

  constructor(ctx: DurableObjectState, env: CloudflareBindings) {
    super(ctx, env);

    // 在 DO 初始化时启动 Container，让第一个真实请求少等一点
    // （后续仍会有冷启动，因为 DO 本身可能被唤醒）
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
   * Worker 转发过来的请求。body 里包含 { markdown, template } 之类渲染参数，
   * 我们直接原样代理到 container 内 /render 端点。
   */
  override async fetch(request: Request): Promise<Response> {
    if (!this.ctx.container) {
      return Response.json(
        { error: 'Container API 不可用' },
        { status: 500 },
      );
    }

    const port = this.ctx.container.getTcpPort(PdfRenderer.CONTAINER_PORT);

    // 转发到 container 内 /render 端点（Container HTTP server 路径）
    const url = new URL(request.url);
    const forwardUrl = new URL('/render', `http://container${url.search}`);

    const containerResponse = await port.fetch(forwardUrl.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });

    return containerResponse;
  }
}
