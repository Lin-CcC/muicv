# 题型推导框架（question design framework）

不写题库——题库会让 skill 把题当模板用，每个用户拿到一样的题。

写**如何按 (round × category × level × JD × 简历) 推导一道题 + 反馈维度**的推导逻辑。

---

## 推导逻辑（7 步）

每场面试开始前，按以下 7 步生成本场题目清单：

### Step 1：从 round-recipes 拿配方

去 `round-recipes.md` 查本轮的题量、比例、必考锚题、信号。

### Step 2：从 category 决定题型方向

| Category | 题型方向 |
|---|---|
| frontend (web) | DOM / 浏览器 API / React 内部 / 性能 / a11y / build 工具链 |
| mobile | 应用生命周期 / 内存管理 / 原生 API / 跨端框架辩论 |
| backend | 系统设计 / 数据库 / 并发 / 缓存 / 队列 |
| fullstack | frontend + backend 各占一半，但深度浅一档 |
| data engineer | ETL / Spark / 数仓建模 / Airflow / SQL 优化 |
| ml engineer | 模型训练 / 部署 / mlops / 业务理解 |
| data scientist | 统计 / 实验设计 / 业务指标 / 可解释性 |
| devops / sre | 可观测性 / 故障演练 / 自动化 / 容量规划 |
| security | 威胁建模 / 漏洞 / 合规 |
| pm | 优先级权衡 / 用户研究 / 上下游沟通 / 数据决策 |
| designer | 用户旅程 / 设计系统 / 跨职能协作 |
| em | 团队建设 / 招聘 / 绩效 / 1-on-1 / 跨组协作 |

### Step 3：从 level 决定深度

| Level | 题目深度 |
|---|---|
| junior | 基础概念 + 写代码 + 简单场景题 |
| mid | 实践细节 + 跟过 senior 的项目里负责什么 |
| senior | 实践细节 + 权衡 + 自己 own 的模块 |
| staff | 架构决策 + 跨团队影响 + 技术选型理由 |
| principal | 战略 + 模糊问题界定 + 业务价值与技术深度的取舍 |
| em (any level) | 管理决策 + 处理人和事的具体场景，**不**问技术深度 |

### Step 4：从 JD 段落抽要点

把 JD 拆成几段：
- **Responsibilities**（每条 → 1 道相关题）
- **Requirements**（每条 → 1 道针对性题）
- **Nice-to-have**（每条 → 0-1 道，看时间够不够）

例：JD Responsibilities 写 "Lead the design of high-throughput event ingestion pipeline" → 推一道"假设要设计一个能扛 N QPS 的事件 pipeline，你怎么开始"。

### Step 5：从简历 highlight 挑追问素材

读 version 文件的每段 experience / project，找出**带数字 / 带技术栈 / 带具体动作**的 highlight。这些是面试官最容易追问的点。

例：简历写 "scaled service from 5k to 100k QPS using Redis cache + DB sharding" → 必追"具体怎么 sharding？哪条 hot key？做完后 latency 是什么样？"

### Step 6：组合 5-8 题

按 round-recipes 的题量基准，从前 5 步的输出里组合。每道题在内部记录：

```
{
  序号: 1,
  题面: "JD 提到要设计高吞吐事件 pipeline，假设需要扛 50k QPS，你会怎么开始？",
  来源: "JD Responsibilities 第 1 条",
  考核点: "系统设计 + 容量估算",
  预期追问: ["怎么估容量", "选 Kafka 还是 Pulsar 为什么", "失败重试策略"],
}
```

### Step 7：抛题前显式说来源

跟用户说："这道题对应你 JD 里 Required Skills 第 3 条 'distributed systems experience'，我故意挑这个因为你简历里没看到分布式经验。"

**透明度让用户知道 skill 不是瞎出题**。这本身也是教育——用户知道面试官也是这么想的。

---

## 题型 × 维度 示例（4 个，覆盖 round × category × level 的不同组合）

### `hiring-manager × senior × backend`

**必有一道项目深挖**：

选简历上 highlight 数最多的那个 experience（说明用户最熟），问该项目最有挑战的技术决策 + **追问 3 层**（每层都是基于上一层用户的回答）。

```
Q: 我看你在 ACME Corp 主导支付系统重构，能讲讲那个项目最难的技术决策吗？
（用户答："最难的是从单体拆成微服务"）

追问 1: 拆分边界你是按什么标准切的？
（用户答："按业务领域，DDD"）

追问 2: 拆分后怎么保证跨服务的数据一致性？
（用户答："saga + outbox pattern"）

追问 3: outbox 表本身的可靠性怎么保证？比如 outbox 写入成功但消息发送失败？
```

3 层下去基本能看出用户是真做过还是讲故事。

### `peer-cross × staff × frontend`

**必有一道协作 BQ**：

挑简历里**跨团队**的 highlight，问"你怎么处理 [对方团队不配合 / 优先级冲突 / 技术分歧] 的情况"。

```
Q: 你简历写过 "led design system migration across 3 product teams"。
   讲一次跟其中某个团队意见不合，最后达成共识的故事。
```

peer 关心的是协作，不是你单干能力。

### `skip-level × principal × IC`

**必有一道战略题**：

结合 JD 里的"业务方向"段落，问"接手这个领域 12 个月你的技术 roadmap"。

```
Q: 假设你下周一开始负责我们的 platform 团队（ref JD About the Role 第 2 段），
   12 个月内你的技术 roadmap 是什么？要解决哪 3 个最重要的问题？
   你怎么衡量这些问题被解决了？
```

skip-level 关心的是判断力 + 优先级 + 可衡量的成功——不是你能不能写代码。

### `hr × any`

**必问 2 道**：
- 你为什么离开上家？
- 薪资期望多少？包括哪些 component（base / bonus / RSU / 签字费）？

这两题**hr 轮的真正考点**。skill 在这里的反馈不是"答得对不对"，而是**有没有踩雷**：
- 离职原因里有怨气、甩锅、暴露文化适配问题 → 雷
- 薪资期望太高（超过 JD 隐含 range 30%+） / 太低（被 lowball）→ 雷

---

## 反馈维度（双输入轨）

| 维度 | 语音模式（client）| 打字模式（skill）|
|---|---|---|
| 内容质量（事实 / 量化 / STAR）| ✅ 评 | ✅ 评 |
| 答题时长 vs 期望 | ✅ 评（带秒数：BQ 60-90s 合理；< 30s 偏浅；> 3min 偏啰嗦）| ❌ **显式说"打字不评时长"** |
| 流利度（停顿次数 / 重复）| ✅ 评（仅当显著影响理解时提）| ❌ 不评 |
| 填充词频率（"嗯" / "那个" / "就是"）| ✅ 评（仅当 > 1次/15s 时提）| ❌ 不评 |
| 回答结构（开场 / 主体 / 收尾）| ✅ 评 | ✅ 评 |

**关键约束**：

- **打字模式下不要假评时长 / 流利度**——明确告知反馈维度受限，并在每题反馈结尾加一句"你实际面试时这题应该控制在 60-90 秒"作为提示参考
- **语音模式下** STT 工具会返回 `{transcript, durationMs, fillerCount}` 这种结构化数据，按这些 metric 评，**不要**编造时长数字

---

## review 子模式范围（限本场内）

模拟面试结束后，用户可能想深入讨论某道题。skill 进入 **review 子模式**。**严格画线**：

| 用户问 | review 怎么处理 |
|---|---|
| 这道题怎么改写更好 | 给优化角度 + 示范改写（标"以下是示范，不是你的事实"）|
| 这道题考的核心是什么 | 1-2 句答（不展开教学）|
| 我整场哪里弱 | 总评深化（已在 d 步做过一次，可二次深化）|
| 这道题如果换成 X 公司会怎么问 | **拒绝**（超出本场范围）|
| 给我讲讲分布式一致性 / 什么是 CAP | **拒绝**（教学不归 review）|
| 我是否应该投 staff 还是 senior | **拒绝**（→ muicv-coaching）|
| 我面挂了下次怎么办 | **拒绝**（→ muicv-debrief 复盘真实面试 / muicv-coaching 聊职业）|

review 子模式的 3 条**硬规则**（写进 SKILL.md）：

1. review 只在**当前模拟面试场内**有效。结束后用户再问"上次那道题"就提示新开 muicv-debrief 或 coaching。
2. review **不教知识**，只讲**这道题的答题策略**。
3. review 给示范改写时**永远标注 "以下是示范，不是你的事实"**。
