# WIP：Mui简历开发计划

最后更新：2026-05-10

## 方向

把核心业务能力封装成 **Claude Code Skills + 轻量 API + Electron 桌面端**，用户在自己熟悉的
AI agent（Claude Code / Codex / Cursor 等）里直接调用；简历素材作为 **Markdown + YAML
frontmatter** 存在 `.claude/muicv/`，由用户用 git 自己管理。完整背景见 README.md。

## 当前进行中

### Phase 14：首次体验设计改版

目标：普通求职者第一次进入时，3 分钟内理解 Mui简历的主路径并完成第一步。

- [x] 补齐 `PRODUCT.md` / `DESIGN.md`，让设计改动有稳定上下文。
- [x] 网站首页改成“下载桌面 app → 导入/记录素材 → 针对岗位生成简历”的单主线。
- [x] 下载页增加“下载后第一分钟”，把系统放行说明后移。
- [x] Dashboard 首页改成任务型入口，计费说明降级。
- [x] 桌面 app 增加首次 onboarding view。
- [x] 没有对话时显示任务型入口，不再只提示左栏新建。
- [x] 跑 `@muicv/app` 测试和类型检查、`@muicv/website` 构建、`impeccable` 静态扫描和格式化。

### Phase 13：muicv-interview STT 集成与题库共享

**P1b：STT (whisper) 集成 [issue #1](https://github.com/meathill/muicv/issues/1)** —— 拆 4 个里程碑分批做：

- ✅ **M1**：后端 `POST /audio/transcribe`（Cloudflare Workers AI Whisper-large-v3-turbo），
  按分钟扣 token（`stt_transcribe`，草案 100 / 分钟）。25MB / 10min 上限。
- ✅ **M2**：客户端走通——agent tool `record_and_transcribe_response` + chatbox 麦克风
  按钮 + renderer 录音面板（MediaRecorder + WebAudio RMS 静音/pause 检测）+ macOS
  麦克风权限 + Hardened Runtime entitlement + `NSMicrophoneUsageDescription`。
- ✅ **M3**：本地 whisper.cpp 走 plugin 模式——独立 workflow [whisper-engine.yml](.github/workflows/whisper-engine.yml)
  多平台 build + Developer ID 签 + Apple notarize → GitHub Release `whisper-engine-vX.Y.Z`。
  app 端按需从 release + HuggingFace 下载到 `<userData>/whisper-engine/`，跟主 app 解耦升版。
  设置页 `WhisperEngineCard` 管引擎 / 模型 / 偏好。renderer 用 `OfflineAudioContext` 转
  16kHz mono WAV，云端 / 本地共用一份格式。`local-preferred` 偏好 + 引擎 + 默认模型都装
  好才走本地，否则云端；本地失败不自动 fallback（隐私优先）。
- ✅ **M4**：录音复盘 skill [muicv-audio-review](skills/muicv-audio-review/SKILL.md) +
  `transcribe_audio_file` agent tool + `audio-reviews/` 目录 + `AudioReviewFrontmatter`
  schema。renderer 用 OfflineAudioContext 解任意音频格式（mp3 / m4a / webm / ogg / flac）→
  16k mono WAV，复用 M3 同一套 provider switch（local / cloud）。

issue #1 全部 4 个里程碑落地完成。

MiMo ASR 调研结论：8B PyTorch + CUDA-only，桌面端不可行；中文方言强，作未来云端 provider
备选（P2）。客户端本地化只能继续走 whisper.cpp。

**P1c 待办（视用户量再决定）—— 云端题库共享**：

- 把 `interviews/*.md` 里的高分题（脱敏后）汇总成众包题库
- 出题时优先复用同维度（round × category × level）的高分种子，仍按 JD/简历微调

## 下一步

按 [TODO.md](./TODO.md)：

- 云同步 skill（muicv 平台 / GitHub 双通道）— **本期做了 muicv 平台 server 端，skill 端下一轮**
- 成为面试官 skill（角色互换，让用户练习当面试官）
- 入职辅导 / 理解保险 类职场辅导 skill
