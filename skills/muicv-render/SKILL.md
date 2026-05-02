---
name: muicv-render
description: 把 `versions/` 下的简历 Markdown 渲染成 PDF，调 Mui简历后端 API 完成渲染（后端跑 Cloudflare Container + Puppeteer）。使用场景：用户说「把简历导出 PDF」「渲染简历」「把这份版本变成 PDF」「下载一版投递用的 PDF」等。依赖 `muicv-generate` 生成的 version 文件；依赖网络（要调 HTTP API）。
---

# muicv-render

把一份已经生成的简历 Markdown 渲染成 PDF 文件，保存到同名路径（`versions/foo.md` → `versions/foo.pdf`）。

**这是 skill 里唯一需要联网的核心能力**（抓 JD 在 muicv-jobs）。调用 API **必须**配 `MUICV_API_KEY`（在 https://muicv.com/dashboard/api-keys 创建）；鉴权 / 计费 / 错误处理统一规范见 [docs/skill-api-key.md](../../docs/skill-api-key.md)。

## 前置检查

1. 素材库根下 `versions/` 里是否有简历？没有 → 提示先调 `muicv-generate`（路径相对素材库根）
2. 用户指定了哪份？
   - 明确指定（文件名或路径）→ 用它
   - 没指定 → 列出最近 3 个 version 让用户选（按 mtime 排序）
3. 确认 API 地址。**按以下顺序**解析：
   1. 用户在本次对话明确指定的 URL（"渲染到 localhost:8787"）
   2. 环境变量 `MUICV_API_BASE`（如果用户在 shell 里 export 了）
   3. 默认值 `https://api.muicv.com`

4. **API key gate**（强制；规范详见 [docs/skill-api-key.md](../../docs/skill-api-key.md)）

   `/render` 端点强制 Bearer 鉴权，且按 `PDF_RENDER_COST` 扣 token。读 `MUICV_API_KEY` 环境变量：

   - **没设 / 为空** → 别调 API，原文发下面这段教育文案给用户：

     > 还没看到你配置 muicv API key。渲染 PDF 需要 key 来识别身份和计费。
     > 一次性配好就行，以后 skill 自己读：
     >
     > 1. 浏览器打开 **https://muicv.com/dashboard/api-keys**
     >    （还没注册先去 muicv.com 注册——注册赠 10K token）
     > 2. 点「创建 key」，给它起个名（比如"我的 mac"），复制弹出来的
     >    **`mui_xxxxxxxx...`**（只显示一次，错过就只能撤销重发）
     > 3. 写到 shell rc 里：
     >    ```bash
     >    # macOS / Linux
     >    echo 'export MUICV_API_KEY="mui_刚才复制的那串"' >> ~/.zshrc
     >    source ~/.zshrc
     >    # bash 用户把 .zshrc 换成 .bashrc / .bash_profile
     >
     >    # Windows (PowerShell)
     >    setx MUICV_API_KEY "mui_刚才复制的那串"
     >    # 然后重开终端
     >    ```
     > 4. 验证：`echo $MUICV_API_KEY`（Windows: `echo %MUICV_API_KEY%`）
     >    看到 `mui_` 开头 36 字符 → 配好了
     > 5. 回来跟我说"重试渲染"

   - **格式不合法**（不匹配 `/^mui_[A-Za-z0-9]{32}$/`）→ 别调 API，回：

     > 你这个 key 看起来不像 muicv 发的。可能复制时漏了字符或多了空格、引号；
     > 去 https://muicv.com/dashboard/api-keys 重新发一份再 export 试试。

   - **合法** → 继续渲染流程。

## 渲染流程

### 1. 读取 version 文件

用 Read 读 `versions/<file>.md` 的完整内容（含 frontmatter，API 那边也会解析）。

### 2. 调用 API

```bash
curl -X POST "${MUICV_API_BASE}/render" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${MUICV_API_KEY}" \
  -d '{"markdown": "<整个 .md 文件内容>", "template": "default"}' \
  --output "<version 文件同名的 .pdf>"
```

参数：
- `markdown`（必填）：version md 文件的**完整内容**（含 frontmatter）
- `template`（可选，默认 `default`）：目前只有 `default` 一个模板

响应：
- `200` + `application/pdf`：直接是 PDF 二进制
- `400` + JSON：参数错误（例如 markdown 为空）
- `401` + JSON `{"error":"missing-api-key" | ...}`：key 没带 / 被拒。**不要重试**，按下方「错误处理小抄」处理
- `402` + JSON `{"error":"insufficient-balance", "balance":..., "required":...}`：余额不够。把 balance/required 念给用户，让他去 https://muicv.com/dashboard 充值
- `502` + JSON：container 侧异常
- 网络错误 / 超时：告诉用户可能是首次调用 Container 冷启动（5-10s），让用户重试一次

### 3. 保存文件

PDF 路径：把 `.md` 后缀换成 `.pdf`，和 version 同目录。
- 例：`versions/google-swe-2026-04-23.md` → `versions/google-swe-2026-04-23.pdf`
- 如果目标文件已存在 → 问用户要不要覆盖；不要默默覆盖

### 4. 告诉用户路径 + 尺寸

```
✓ versions/google-swe-2026-04-23.pdf (148 KB, 2 页)
```

能读到页数就顺便告诉用户（可从 PDF 头部解析，或粗略按"每页约 N KB"估算；不必精确）。

## 使用模板（MVP）

当前只有 `default` 模板：A4、单栏、黑白、中英字体兼容。

未来（规划，非 MVP）：
- `compact`：密度更高，适合 5 年以上经验
- `academic`：带论文列表的学术版
- `bilingual`：中英对照

用户可以在调用时说"换个模板 compact"，skill 把 `template` 参数改一下。MVP 阶段告诉用户"暂时只有 default"。

## 调用示例

```
用户：把我刚才生成的那份 google 简历导出 PDF

Claude：
  1. Glob versions/google-*.md
  2. 找到 versions/google-swe-2026-04-23.md
  3. Read 全文
  4. Bash curl → versions/google-swe-2026-04-23.pdf
  5. 告诉用户：✓ versions/google-swe-2026-04-23.pdf (148 KB, 2 页)
```

## 注意事项

- **首次调用可能慢（5-10s）**：Container 冷启动，属于 MVP 已知限制。用户第二次调用会快很多（<1s，热请求）
- **网络异常时的提示**：如果 curl 超时或连接错，先建议用户检查网络 / API 地址；不要重试 >2 次
- **不要对 PDF 做后处理**：拿到就存，不要改文件名以外的任何事
- **保留源 md**：渲染 PDF 不删除源 md；用户可能想再渲染一次

## 与其他 skill 的协作

- `muicv-generate` → 产出 version md → `muicv-render` 导出 PDF
- `muicv-critique` 评审完用户满意 → 再 render
- 如果用户渲染后发现排版问题，**建议去调 API 团队改模板**，不要自己在 md 里加 HTML 尝试绕过（会被 API 的模板覆盖）

## 错误处理小抄

每条响应都尽量翻译成"用户能直接行动"的话，不要原样抛 HTTP 状态码。规范见 [docs/skill-api-key.md](../../docs/skill-api-key.md)。

| 现象 | 给用户怎么说 |
|---|---|
| `MUICV_API_KEY` 没 export | 走前置检查里的 API key 教育流程，五步详细发给用户 |
| `MUICV_API_KEY` 格式异常（不匹配 `/^mui_[A-Za-z0-9]{32}$/`）| "你这个 key 看起来不像 muicv 发的。可能复制时漏了字符或多了空格、引号；去 https://muicv.com/dashboard/api-keys 重新发一份再 export 试试。" |
| `401 missing-api-key` / `401 unauthorized` | "muicv 拒了这个 key（可能在 dashboard 撤销过、或者过期）。去 https://muicv.com/dashboard/api-keys 重新发一份，更新 shell rc 后 `source` 一下再来。" **不要重试**。 |
| `402 insufficient-balance` | 把响应里的 `balance` / `required` 念给用户："你的余额不够这次渲染（需 X，剩 Y）。去 https://muicv.com/dashboard 充值后重试。" |
| `429 rate-limited` | "调太频了，等 60s 再试。" |
| `502` / 网络错 / 超时 | 首次冷启动 5-10s 属正常，重试一次；连续失败提示去 https://status.muicv.com 看服务状态 |
