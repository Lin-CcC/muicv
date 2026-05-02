---
name: muicv-sync
description: MuiCV 平台云同步——把本地素材库整体推到云端（push）或从云端拉回来覆盖本地（pull）。两个子任务：`push` 上传本地所有 .md 到 muicv 云端 D1，`pull` 从云端把活动版快照下载到本地（自动备份现有文件）。使用场景：用户说「同步到云端」「上传简历素材」「云同步」「备份到云端」「换了新机器，把素材拉回来」「从云端恢复」「下载我的简历」「pull 远程素材」等。需要在 https://muicv.com/dashboard 创建 mui_ API key 并 export 到 `MUICV_API_KEY`；需要网络。
---

# muicv-sync

把整个本地素材库（profile / experience / projects / versions / 全部 .md）作为一份完整快照在本地和 muicv 云端之间双向同步。云端只保留一份**活动版** + 最近 5 份历史；用户可在 https://muicv.com/dashboard/sync 查看、回滚、清空。

**边界（重要）**：
- **整库同步语义**：push 是把当前本地工作目录所有 .md 完整覆盖云端活动版；pull 是把云端活动版完整下载到本地（本地多出来的文件不动）。**没有按文件挑选 / merge / diff**——要细粒度操作请直接编辑文件。
- **last-write-wins**：每次 push 前云端会自动归档当前活动版到 history（保留最近 5 份），所以"误覆盖"可在 dashboard 一键恢复。
- **单库上限**：1 MB / 500 文件。超限服务端会 400。素材库再大就要清理（删旧 versions / critiques）。

> 鉴权 / 计费 / 错误处理统一规范见 [docs/skill-api-key.md](../../docs/skill-api-key.md)。云同步本身**不扣 token**，但同样强制 Bearer 鉴权。

---

## 前置检查

> ⚠️ **教育用户优先**：如果发现 `MUICV_API_KEY` 没设，**先把下面"如何拿到 key"的步骤完整告诉用户**，不要执行任何 push/pull。这是 skill 用户和 client 用户的关键差异——skill 里 key 是用户自己 export 的，client 里登录后是自动注入的。第一次配 key 是一次性投入，但绝大多数用户没做过这件事。

### 1. 素材库根

prelude 已探查 `**/profile.md`：
- **push** 必须有根，否则报错让用户先 `muicv-core` 初始化或编辑素材
- **pull** 没有根也行——会把云端内容下载到当前工作目录，相当于在新机器恢复

### 2. API 地址（同 muicv-render / muicv-jobs 的优先级）

1. 用户对话明确指定的 URL（"同步到 localhost:8787"）
2. 环境变量 `MUICV_API_BASE`
3. 默认 `https://api.muicv.com`

### 3. API key 教育流程（关键）

云同步两个端点都强制 Bearer 鉴权。读 `MUICV_API_KEY` 环境变量；**没设或为空** → 别开始 push/pull，把下面整套发给用户：

> 还没看到你配置 muicv API key。云同步需要 key 来识别身份和计费（云同步本身不扣 token，但同样强制鉴权）。一次性配好就行，以后 skill 自己读：
>
> 1. 浏览器打开 **https://muicv.com/dashboard/api-keys**（如果还没注册，先去 muicv.com 注册——注册赠 10K token）
> 2. 点「创建 key」，给它起个名（比如"我的 mac"），复制弹出来的 **`mui_xxxxxxxx...`**（只显示一次，错过就只能撤销重发）
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
> 4. 验证：`echo $MUICV_API_KEY`（Windows: `echo %MUICV_API_KEY%`）看到 `mui_` 开头 36 字符 → 配好了
> 5. 回来跟我说"重试同步"

**已设但格式异常**（不匹配 `/^mui_[A-Za-z0-9]{32}$/`）→ 别调 API，回：

> 你这个 key 看起来不像 muicv 发的。可能复制时漏了字符或多了空格、引号；
> 去 https://muicv.com/dashboard/api-keys 重新发一份再 export 试试。

**已设格式正确** → 继续 push/pull 流程。第一次跑流程前可以选择性调一次 `GET ${MUICV_API_BASE}/me` 验证 key 有效（200 = 通过；401 = key 已被撤销/过期，让用户重新生成）。如果用户性子急可省略这一步。

---

## 子任务：push（同步到云端）

**触发**：用户说「同步到云端」「上传到 muicv」「备份素材到云端」「云同步」等。

### 流程

1. 确认素材库根存在（profile.md 父目录）。如果根不在工作目录顶层，所有路径都按**相对素材库根**计算，不是相对工作目录。
2. Glob 素材库根下所有 `.md` 文件（递归）：
   ```
   Glob: **/*.md
   ```
   过滤掉路径里含以下任一段的（隐藏目录 / 依赖 / 备份）：
   - 任何以 `.` 开头的目录段（`.git/`、`.vscode/`、`.muicv-pull-backup-*/` 等）
   - `node_modules/`
3. 对每个文件用 Read 拿内容，组装成 JSON：
   ```json
   {
     "files": {
       "profile.md": "<内容>",
       "experience/google-2024.md": "<内容>",
       "projects/muicv.md": "<内容>"
     }
   }
   ```
   路径全用 `/` 分隔（即使 Windows 上也是；服务端要求 `/`）。
4. 在调 API 前**自检大小和文件数**：
   - 总字节数 > 900 KB（接近 1 MB 上限）→ 提醒用户"快超上限了，建议清掉旧的 versions/ 或 critiques/"，但仍可继续
   - 总字节数 > 1 MB 或文件数 > 500 → **不要发请求**，直接告诉用户超限要先清理
5. 调 API：
   ```bash
   curl -sS -X POST "${MUICV_API_BASE}/resume/sync" \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer ${MUICV_API_KEY}" \
     -d @<(cat <<'JSON'
   { ... 上面组装的 JSON ... }
   JSON
   )
   ```
   实际操作时把 JSON 写到临时文件再 `-d @<file>`，避免大 body 在命令行里被截断。
6. 响应：
   - `200 OK` + `{ hash, sizeBytes, fileCount, updatedAt }` → 上传成功
   - `400` → 路径校验失败（含 `..` / 非 .md / 太长）或超限。把 `error` 字段返回的具体原因转告用户
   - `401` → key 无效或被撤销，让用户去 dashboard 重发 key
   - `5xx` / 网络错 → 让用户重试一次；连续失败提示去 https://muicv.com 检查服务

### 报告格式

```
✓ 已同步 12 个文件到云端 (43.2 KB)
  hash: a1b2c3d4...
  最后同步：2026-05-01 14:23
  在 https://muicv.com/dashboard/sync 查看历史 / 回滚
```

---

## 子任务：pull（从云端恢复）

**触发**：用户说「从云端恢复」「拉远程素材」「下载我的简历」「换了新机器把素材同步过来」等。

### 流程

1. 解析 API_BASE + API_KEY（同上）。
2. 调 API：
   ```bash
   curl -sS "${MUICV_API_BASE}/resume/snapshot" \
     -H "Authorization: Bearer ${MUICV_API_KEY}"
   ```
3. 响应：
   - `200 OK` + `{ files: {...}, hash, sizeBytes, fileCount, updatedAt }`
   - `404 no-snapshot` → 云端还没快照，提示"先在另一台机器 push 过才能 pull"
   - `401` / `5xx` → 同 push
4. **写盘前先备份**（避免本地未提交修改丢失）：
   - 找出所有「云端有 + 本地也有但内容不同」的文件
   - 把这些本地文件**先**复制到 `.muicv-pull-backup-<YYYYMMDD-HHmmss>/` 下（保持相对路径），用 Bash `cp` 或 Read+Write
   - 一份没改的文件不必备份（节省空间）
   - 完全没本地素材库（pull 到空目录） → 跳过备份
5. 写入云端文件：
   - 对 `files` 里的每个 `<path, content>`：用 Write 写到 `<素材库根>/<path>`
   - 子目录不存在自动创建（Write 一般会处理；不行就先 `mkdir -p`）
6. **本地多出来的文件不动**（云端不存在但本地有的 .md，比如新写但还没 push 的 experience）。如果用户想"完全镜像云端"，告诉他先手动删本地多余文件再 pull。

### 报告格式

```
✓ 从云端拉取了 12 个文件 (43.2 KB)
  云端 hash: a1b2c3d4...
  最后同步：2026-05-01 14:23

  📦 5 个本地文件已被覆盖；旧版备份在 .muicv-pull-backup-20260501-143022/
  ➕ 7 个新文件已写入
  💡 本地还有 3 个云端没有的 .md，未触碰（如要完全镜像请手动删除）
```

---

## 子任务：status（可选，看一眼云端状态）

**触发**：用户问「云端有多少东西」「最后什么时候同步的」等只想看不想动的需求。

直接引导去 https://muicv.com/dashboard/sync —— 那里有完整的状态卡 + 历史列表 + 一键回滚 / 清空。skill 不重复造 UI。

如果用户坚持要 skill 报，调 `GET /resume/snapshot` 后**只显示 metadata**（hash/sizeBytes/fileCount/updatedAt + 文件列表），不要把 files 内容写到本地。

---

## 错误处理小抄

每条响应都尽量翻译成"用户能直接行动"的话，不要原样抛 HTTP 状态码。规范见 [docs/skill-api-key.md](../../docs/skill-api-key.md)。

通用映射（同所有联网 skill）：

| 现象 | 给用户怎么说 |
|---|---|
| `MUICV_API_KEY` 没 export | 走前置检查里的「API key 教育流程」，五步详细发给用户 |
| `MUICV_API_KEY` 格式异常（不匹配 `/^mui_[A-Za-z0-9]{32}$/`）| "你这个 key 看起来不像 muicv 发的。可能复制时漏了字符或多了空格、引号；去 https://muicv.com/dashboard/api-keys 重新发一份再 export 试试。" |
| `401 missing-api-key` / `401 unauthorized` | "muicv 拒了这个 key（可能在 dashboard 撤销过、或者过期）。去 https://muicv.com/dashboard/api-keys 重新发一份，更新 shell rc 后 `source` 一下再来。" **不要重试**。 |
| `429 rate-limited` | "调太频了，等 60s 再试。" |
| 网络错 / 超时 | API 一般 <1s；超时多半是网络。"试一次没通常就别再硬试，先看看 https://status.muicv.com 或检查本地网络（dashboard 能正常打开吗？）" |

业务特有（sync 自己的）：

| 现象 | 给用户怎么说 |
|---|---|
| `400` 路径 / 超限 | 把 server 的 `error` 字段原话转给用户（例如「only .md files are supported: foo.txt」「total size exceeds 1048576 bytes」）；超限就建议清 versions/ critiques/ 旧文件 |
| `404 no-snapshot`（pull）| "云端还没有这个账号的快照——先在另一台机器或本机说'同步到云端'才能 pull" |

---

## 调用示例

### 例 1：第一次 push

```
用户：把我的素材同步到云端
Claude：
  1. Glob **/*.md 找到 profile.md, experience/*.md, projects/*.md ... 共 12 个
  2. Read 每个文件
  3. 组装 JSON 写到临时文件 /tmp/muicv-sync-payload.json
  4. curl POST /resume/sync 带 Authorization 头
  5. 拿到 { hash, sizeBytes: 44213, fileCount: 12, updatedAt: 1714564800000 }
  6. 报告：✓ 已同步 12 个文件到云端 (43.2 KB)，hash a1b2..
```

### 例 2：换新机器 pull

```
用户：换了台 Mac，把我的简历拉回来
Claude：
  1. 检查 MUICV_API_KEY 已 export
  2. curl GET /resume/snapshot
  3. 拿到 12 个文件
  4. 当前工作目录没有 profile.md → 跳过备份
  5. 依次 Write 12 个文件到工作目录（含子目录 experience/, projects/）
  6. 报告：✓ 从云端拉取了 12 个文件 (43.2 KB)
```

### 例 3：本地改过又 pull（备份场景）

```
用户：从云端覆盖本地
Claude：
  1. curl GET /resume/snapshot
  2. 对比：experience/google-2024.md 本地内容 ≠ 云端
  3. 把本地这份 cp 到 .muicv-pull-backup-20260501-143022/experience/google-2024.md
  4. Write 云端版到 experience/google-2024.md
  5. 其他没改的不备份
  6. 报告：✓ 拉取 12 个文件，1 个本地版本已备份到 .muicv-pull-backup-...
```

---

## 与其他 skill 的协作

- `muicv-core` 初始化 / 增删素材 → push 上云
- 换机器 → pull 把素材库重建
- 本地编辑后 → 再次 push 覆盖云端（旧版自动归档到 history）
- dashboard `/dashboard/sync` 一键回滚 / 清空（skill 不做这些破坏性动作的 UI，让用户去 web 端）
