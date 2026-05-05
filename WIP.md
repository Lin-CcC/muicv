# WIP：Mui简历开发计划

最后更新：2026-05-05

## 方向

把核心业务能力封装成 **Claude Code Skills + 轻量 API + Electron 桌面端**，用户在自己熟悉的
AI agent（Claude Code / Codex / Cursor 等）里直接调用；简历素材作为 **Markdown + YAML
frontmatter** 存在 `.claude/muicv/`，由用户用 git 自己管理。完整背景见 README.md。

## 当前进行中

### Phase 13：muicv-interview STT 集成与题库共享

**P1b：STT (whisper) 集成 [issue #1](https://github.com/meathill/muicv/issues/1)** —— 拆 4 个里程碑分批做：

- ✅ **M1**：后端 `POST /audio/transcribe`（Cloudflare Workers AI Whisper-large-v3-turbo），
  按分钟扣 token（`stt_transcribe`，草案 100 / 分钟）。25MB / 10min 上限。
- ✅ **M2**：客户端走通——agent tool `record_and_transcribe_response` + renderer 录音
  面板（MediaRecorder + WebAudio RMS 静音/pause 检测）+ macOS 麦克风权限 + Hardened
  Runtime entitlement + `NSMicrophoneUsageDescription`。filler / pause 客户端算。
- ⏳ **M3**：本地 whisper.cpp（`nodejs-whisper`）+ 模型管理 + 引导 UI + 云端 fallback。
- ⏳ **M4**：录音复盘 skill `muicv-audio-review` + `transcribe_audio_file` agent tool +
  `audio-reviews/` 目录 + `AudioReviewFrontmatter` schema。

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
