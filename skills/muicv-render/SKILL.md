---
name: muicv-render
description: 把 `versions/` 下的简历 Markdown 渲染成 PDF，调 Mui简历后端 API 完成渲染（后端跑 Cloudflare Container + Puppeteer）。使用场景：用户说「把简历导出 PDF」「渲染简历」「把这份版本变成 PDF」「下载一版投递用的 PDF」等。依赖 `muicv-generate` 生成的 version 文件；依赖网络（要调 HTTP API）。
---

# muicv-render

把一份已经生成的简历 Markdown 渲染成 PDF 文件，保存到同名路径（`versions/foo.md` → `versions/foo.pdf`）。

**这是 skill 里唯一需要联网的核心能力**（抓 JD 在 muicv-jobs）。MVP 阶段 API 匿名可用 + 速率限制，未来加账号/订阅。

## 前置检查

1. 素材库根下 `versions/` 里是否有简历？没有 → 提示先调 `muicv-generate`（路径相对素材库根）
2. 用户指定了哪份？
   - 明确指定（文件名或路径）→ 用它
   - 没指定 → 列出最近 3 个 version 让用户选（按 mtime 排序）
3. 确认 API 地址。**按以下顺序**解析：
   1. 用户在本次对话明确指定的 URL（"渲染到 localhost:8787"）
   2. 环境变量 `MUICV_API_BASE`（如果用户在 shell 里 export 了）
   3. 默认值 `https://api.muicv.com`

4. 如果环境变量里有 `MUICV_API_KEY`（用户在 https://muicv.com/dashboard 创建的），
   调 API 时带上 `Authorization: Bearer $MUICV_API_KEY`。没设也能用（走 IP
   速率，但额度更紧）。带 key 的好处：识别身份、未来计费按用户、用量可在 dashboard 看到。

## 渲染流程

### 1. 读取 version 文件

用 Read 读 `versions/<file>.md` 的完整内容（含 frontmatter，API 那边也会解析）。

### 2. 调用 API

```bash
curl -X POST "${MUICV_API_BASE}/render" \
  -H "Content-Type: application/json" \
  ${MUICV_API_KEY:+-H "Authorization: Bearer ${MUICV_API_KEY}"} \
  -d '{"markdown": "<整个 .md 文件内容>", "template": "default"}' \
  --output "<version 文件同名的 .pdf>"
```

参数：
- `markdown`（必填）：version md 文件的**完整内容**（含 frontmatter）
- `template`（可选，默认 `default`）：目前只有 `default` 一个模板

响应：
- `200` + `application/pdf`：直接是 PDF 二进制
- `400` + JSON：参数错误（例如 markdown 为空）
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
