# TODO

## Skills

### 内容同步

- ~~云同步 skill（muicv 平台）：把全部职业内容上传到 muicv 平台~~ — Phase 10 完整落地（DB / API / dashboard / muicv-sync skill），见 WIP.md
- ~~云同步 skill（GitHub）：把全部职业内容上传到 GitHub~~ — Phase 11 落地为 [muicv-git skill](skills/muicv-git/SKILL.md)（init / sync / clone / status）

### 面试相关

- ~~模拟面试 skill~~ — Phase 13 P0 重写完成：[muicv-interview](skills/muicv-interview/SKILL.md) 按 JD × 简历 × 轮次 × 级别 × 类别 × 输入方式动态推导题目；3 个 references 拆 + 双输入轨设计。**P1 待做**：client 端 STT + 录像集成（独立 phase）
- 录音复盘 skill：上传录音文件 → 提取文本 → 复盘 — 跟 muicv-interview P1b STT 合并到 [issue #1](https://github.com/meathill/muicv/issues/1) 一起做（共用 whisper 底层）
- ~~面试复盘 skill（真实面试后回放分析，跟 muicv-interview 配对）~~ — 落地为 [muicv-debrief](skills/muicv-debrief/SKILL.md)，写到 `debriefs/<company>-<date>.md`
- 成为面试官 skill（角色互换，让用户练习当面试官）

### 职场辅导

- 入职辅导 skill：劳动纪律介绍、员工手册解读等
- 理解保险 skill：五险一金、年轻人的第一份保险等
