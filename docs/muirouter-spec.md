# muirouter 集成笔记

> muirouter 已实现 MCP（streamable HTTP transport），见
> https://muirouter.com/mcp 。以下记录 muicv 这一端**怎么调**、解析、排查。

---

## 1. 协议形态

| 项 | 值 |
|---|---|
| 协议 | Model Context Protocol (MCP) over JSON-RPC 2.0 over Streamable HTTP |
| Endpoint | `POST https://api.muirouter.com/mcp` |
| 认证 | `Authorization: Bearer <muirouter API key>` |
| Key 格式 | `sk-gw-...`（前缀 `sk-gw-`） |
| Content-Type | 请求 `application/json`；响应可能 `application/json` 或 `text/event-stream`（SSE） |

**没有传统 REST endpoint**——所有功能都通过 MCP 工具调用，包括余额查询。

## 2. 调用余额（muicv 现在用的）

```http
POST /mcp HTTP/1.1
Host: api.muirouter.com
Authorization: Bearer sk-gw-XXXXXXXX
Content-Type: application/json
Accept: application/json, text/event-stream

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "get_balance",
    "arguments": {}
  }
}
```

响应 envelope（JSON-RPC 2.0）：

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      { "type": "text", "text": "钱包余额..." }
    ],
    "structuredContent": {
      // 真正的结构化数据（如 muirouter 实现了的话）
    },
    "isError": false
  }
}
```

## 3. muicv 的解析策略（lenient）

代码：[`packages/website/lib/muirouter.ts`](../packages/website/lib/muirouter.ts) `parseBalance()`。

优先级：
1. `result.structuredContent` 直接拿对象
2. 否则 `result.content[0].text` JSON.parse 兜底

字段名 lenient 匹配（任一命中即可）：

| muicv 内部字段 | muirouter 字段名候选 |
|---|---|
| `balanceCents` | `balance_cents` / `balanceCents` / `wallet_cents` / `amount_cents`，或 `balance` / `wallet_balance` / `wallet` / `amount` 当作元 *100 |
| `lifetimeToppedUpCents` | `total_topped_up_cents` / `topped_up_cents` / `lifetime_topped_up_cents` / `totalToppedUpCents`，或 `total_topped_up` / `topped_up` / `lifetime_topped_up` / `totalToppedUp` 当作元 |
| `lifetimeSpentCents` | `total_spent_cents` / `spent_cents` / `lifetime_spent_cents` / `totalSpentCents`，或对应元字段 |
| `currency` | `currency`，缺省 `CNY` |
| `updatedAt` | `updated_at` / `updatedAt`，缺省当前时间 |

**如果 muirouter 实际响应的字段名不在上述清单**，dashboard 会显示 `muirouter balance 字段未识别：{...}` 错误（前 200 字符）。把响应贴出来加 case 即可。

## 4. 错误状态映射

| muicv 状态 | 触发条件 |
|---|---|
| `invalid` | HTTP 401/403；JSON-RPC error `code: -32001`；error message 含 `unauth`/`invalid key`/`forbidden` |
| `pending` | HTTP 404（端点未上线，dashboard 显示"待上线"提示） |
| `error` | 其他 4xx/5xx、网络错、JSON 解析错、字段未识别 |
| `ok` | 解析成功，写入 D1 缓存 |

## 5. 触发时机

- **绑定时**：`POST /api/muirouter` 立刻调一次。401/403 拒绝绑定（key 无效）；其他状态都允许绑定，把错误存到 `muirouterLink.lastError`
- **手动刷新**：dashboard 点 "刷新余额" → `POST /api/muirouter/refresh`
- **不会自动定时拉**（避免对 muirouter 频繁打）

D1 缓存 TTL：无主动失效，每次刷新都覆盖。

## 6. 排查命令

```bash
# 直接打 muirouter，看真实响应（用你自己 sk-gw- key）
curl -X POST https://api.muirouter.com/mcp \
  -H "Authorization: Bearer sk-gw-XXXXXXXX" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_balance","arguments":{}}}'
```

如果响应 OK 但 muicv dashboard 报"字段未识别"，把响应里 `result.structuredContent` 或 `result.content[0].text` 贴出来，给 `parseBalance()` 加候选字段名。

## 7. 历史

最初版本（v1）我们假设 muirouter 提供 REST `GET /api/v1/balance`，写了对应 client 和 spec。后来确认 muirouter 实际实现的是 MCP（更通用、可扩展），重写了 client 走 JSON-RPC `tools/call get_balance`。该 spec 已废弃，留这一段说明背景。

可扩展能力（暂未在 muicv 用）：

| MCP 工具 | 用途 | muicv 计划 |
|---|---|---|
| `get_usage` | 消费明细 | M4 dashboard 用量图 |
| `list_recharges` | 充值记录 | M4 充值历史卡片 |
| `list_models` | 模型 + 价格 | electron app 选模型 |
| `create_topup_session` | Stripe 充值链接 | M4 dashboard 一键充值 |
| `image_generation` | 图像生成 | 暂不接 |
