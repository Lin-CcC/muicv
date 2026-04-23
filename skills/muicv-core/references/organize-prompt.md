# organize 子任务参考：把零散素材整理成可复用的条目

> 本文件是 `muicv-core` skill 的 `organize` 子任务的扩展说明。只在 SKILL.md 主文档不足时加载。

## 背景

新用户在 `.claude/muicv/` 里收集素材时常见的问题：

- **同一事实被多次记录**：比如在 `experience/acme.md` 里写了"主导了新版 dashboard 的上线"，又在 `achievements.md` 里单独列了一遍
- **碎片化不完整**：只有"开始接触 Vue"这种半句话，缺时间/上下文/结果
- **混淆**：把 AI 给过的建议或示例当成了用户本人的事实

`organize` 的任务是把这些问题处理掉——合并、补齐、去重——**但严格遵循不编造原则**。

## 核心约束（不得违反）

1. **只能使用用户已写入文件的事实**。可以合并、改写表达、调整措辞；**不能新增事实、不能推断、不能编造细节**。
2. **AI 的建议/示例/改写不是事实**。如果用户没有明确确认过一条改写，那就不算用户的事实。
3. **时间冲突时优先用户最新、最具体的陈述**。但不要擅自推断日期；不确定就留空（或保留多个版本让用户选）。

## 整理目标

- **去重**：同一事实的重复表达（即使措辞不同）不要多份。典型判别：同一时间段、同一对象（公司/项目）、同一动作。
- **关联**：把同主题的零散记录合并成更完整的一条。例：
  - 散：`skills.md` 的 "Vue" + `experience/acme.md` 的 "负责前端" + `achievements.md` 的 "带领 4 人团队"
  - 合：`experience/acme.md` 的 "带领 4 人前端团队使用 Vue 重构 ..."（前提是这些确实是同一段经历、用户明确表达过）
- **具体化**：优先"可写进简历"的表述——包含时间、对象、技术栈、结果/影响。但**具体化只能用已有信息**，不能为了具体去编造数字。

## 执行步骤（给 skill 调用时参考）

1. **扫描**：`Glob .claude/muicv/**/*.md`，按 frontmatter `type` 分桶。
2. **找问题**：
   - 跨文件同义记录（比较 title / highlight 文本相似度）
   - 单条过短或缺时间（例如 highlight 只有一个动词短语）
   - achievements.md 里的条目能不能归到某段 experience 或 project 下
3. **列清单给用户看**：每组问题给出「现状 / 建议合并方案」，引用原文。
4. **逐组征求同意**：**不要批量应用**。每组让用户 approve / reject / 修改方案后，再用 Edit 落盘。
5. **改完报告**：给出改了哪些文件、几条变更。不主动 git commit。

## 反例（不要做）

- ❌ 把"我在 A 公司做过前端"合成"我在 A 公司做了 3 年前端"——时长是编造
- ❌ 用户写了"项目影响了用户体验"，改写成"项目将用户留存率提升 20%"——数字是编造
- ❌ 看到用户说"我会 React"，在 experience 里加"精通 React"——程度描述是推断
- ❌ 一次性改几十条，最后给用户看 diff ——破坏用户掌控感

## 正例

- ✅ experience/acme.md 的 highlight "主导 dashboard 上线" 和 achievements.md 的 "2024 Q2 把 dashboard 上线了" → 合并到 experience，achievements 条目删除
- ✅ skills.md 的 `- Vue` 和 experience 里零散提到的 Vue 使用 → skills.md 保留项，experience 不变（两处表达不同层面）
- ✅ 一条 highlight "用 Kafka 重构消息队列" 很简短 → 向用户追问"有没有具体场景或结果"而不是自行补全

## 历史

本 prompt 改写自旧 chatbot 版本的 `getMemoryOrganizeSystemPrompt()`（原在 `packages/app/src/server/ai/system-prompts.ts`）。原版输出 JSON，本版针对 markdown 文件操作重写。
