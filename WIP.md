# WIP：Mui简历开发计划

最后更新：2026-05-03

## 方向

把核心业务能力封装成 **Claude Code Skills + 轻量 API + Electron 桌面端**，用户在自己熟悉的
AI agent（Claude Code / Codex / Cursor 等）里直接调用；简历素材作为 **Markdown + YAML
frontmatter** 存在 `.claude/muicv/`，由用户用 git 自己管理。完整背景见 README.md。

## 当前进行中

### Phase 13：muicv-interview STT 集成与题库共享

**P1b 待办 → 已开 issue [#1](https://github.com/meathill/muicv/issues/1)：STT (whisper) 集成**

把 muicv-interview 实时录音 + "录音复盘 skill"（TODO 上原本独立的）合并成一个 issue
跟踪——共用后端 `/audio/transcribe` 端点 + 客户端 whisper.cpp + agent tools
（`record_and_transcribe_response` / `transcribe_audio_file`）。详细任务清单 / 关键
决策 / 验证步骤都在 issue body 里，这里不重复。

**P1c 待办（视用户量再决定）—— 云端题库共享**：

- 把 `interviews/*.md` 里的高分题（脱敏后）汇总成众包题库
- 出题时优先复用同维度（round × category × level）的高分种子，仍按 JD/简历微调

## 下一步

按 [TODO.md](./TODO.md)：

- 云同步 skill（muicv 平台 / GitHub 双通道）— **本期做了 muicv 平台 server 端，skill 端下一轮**
- 成为面试官 skill（角色互换，让用户练习当面试官）
- 入职辅导 / 理解保险 类职场辅导 skill
