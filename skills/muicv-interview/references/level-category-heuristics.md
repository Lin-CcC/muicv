# 级别 / 类别推断（level × category heuristics）

模拟面试出题前**必须**确定候选人的级别和岗位类别。原因很简单：senior frontend 和 junior frontend 拿到一样的题就是垃圾模拟。

**核心原则**：从 JD title + 正文推断 → 让用户**确认或修正** → 用确认后的结果出题。**永远不要静默使用推断结果**。

---

## Level 推断关键词（按命中优先级）

### 1. 显式 ladder（最强信号）

直接看 JD title 或正文里的 ladder 编号：

```
L3 / L4 / L5 / L6 / L7 / L8           # Google / Meta
E3 / E4 / E5 / E6 / E7                # Meta（旧）
SDE I / SDE II / SDE III / Principal  # Amazon
P5 / P6 / P7 / P8                     # 阿里、字节（互联网大厂）
T5 / T6 / T7                          # 华为
M3 / M5 / M6 / M7                     # 阿里管理线
IC1-IC8                               # 通用 IC ladder
```

**坑（要明确告知用户）**：ladder 跨公司**不通用**：
- Google L5 ≈ Meta E5 ≈ Amazon SDE II = senior（5-8 年）
- Microsoft 65 ≈ senior，但 Microsoft "Senior" title 本身可能是 64（mid）
- 国内大厂 P6 ≈ 大厂 senior，P7 ≈ staff，P8+ = principal/director
- 不同公司同 ladder 编号薪资和职责差很多

skill 识别到 ladder 编号时，告诉用户："我看到 L5，但这是哪家公司的 L5？" 让用户明确公司。

### 2. 中文级别词

```
初级 ≈ junior      （0-2 年）
中级 ≈ mid         （2-4 年）
高级 ≈ senior      （4-7 年，但要警告：在中国互联网"高级"普遍 = FAANG mid）
资深 ≈ senior+     （6+ 年）
专家 ≈ staff       （8+ 年）
首席 ≈ principal   （10+ 年）
```

### 3. 英文形容词

```
Junior              → junior
Mid / Mid-Level     → mid
Senior              → senior（注意：在 FAANG ≈ mid 5-8 年；在小厂 = 上限）
Staff               → staff
Principal           → principal
Distinguished       → distinguished（很少见）
Fellow              → fellow（极少见）
Lead                → ⚠️ 歧义 —— 看正文（Tech Lead / Team Lead 完全不同）
```

### 4. 经验年限

如果 JD 说"3+ years"、"5-7 years"等：

```
3+ years    ≈ mid
5-7 years   ≈ senior
8+ years    ≈ staff
10+ years（且强调战略 / 跨组）≈ principal
```

### 5. 管理 vs IC 信号

JD 正文的关键词：

```
"manage / lead a team / direct reports / hire / 团队管理 / 带团队"
  → 管理线（M / EM）

"hands-on / individual contributor / IC / 独立贡献"
  → IC 线
```

---

## 推断流程（按优先级）

```
if title 含 ladder 编号:
  级别 = ladder 映射，但问用户公司
elif title 含中英文级别词:
  级别 = 词典映射
elif 正文有经验年限:
  级别 = 年限映射
else:
  级别 = unknown，让用户自己说

# 然后看 IC vs M 维度
if 正文有"manage / 带团队"信号:
  路线 = manager
else:
  路线 = IC
```

---

## 几个**必须警告**用户的坑

- **Senior 在不同公司的级别相差一档**：FAANG Senior = 5-8 年（mid 偏上），小厂 Senior = 上限（10+ 年）。skill 不能默认按 FAANG 来出题。
- **中文"高级"≠ FAANG Senior**：中国互联网"高级 / Senior" 普遍 = 大厂 mid（3-5 年）。
- **创业公司 / 早期公司**：`Founding Engineer` / `第 N 号员工` 不属于 ladder，按 JD 正文里的工作描述强度推断（如果让你 own 整个 backend 那就是 staff 级；如果让你 follow lead engineer 那就是 mid）。
- **`Lead` title 的歧义**：看正文：
  - 写 "hands-on coding 80%" → Tech Lead（IC 路线，staff/principal 级）
  - 写 "manage 5+ engineers" → Team Lead（manager 路线，M3+）
  - 含糊不清 → 让用户说

---

## Category 清单

按招聘市场常见的分类。**iOS / Android / mobile 单独算一类**，不并 frontend——题型几乎不重叠。

```
frontend (web)                            # React / Vue / Angular / 性能 / DOM / a11y
mobile                                    # iOS / Android / RN / Flutter（在第一步追问亚类）
backend                                   # API / 数据库 / 高并发 / 系统设计
fullstack                                 # 双栖
data engineer / analytics engineer        # ETL / 数仓 / Spark / Airflow
ml / ai engineer                          # research / applied / mlops（第一步追问）
data scientist                            # 跟 ml engineer 不一样，统计 + 业务分析
devops / sre / platform                   # 基础设施 / 可靠性
security                                  # 渗透 / 红队 / 应用安全
qa / sdet                                 # 测试自动化 / 质量保障
embedded / firmware                       # C / 汇编 / 底层
game dev                                  # gameplay / engine / graphics（第一步追问）
pm                                        # technical / consumer / b2b（第一步追问）
designer                                  # ux / visual / product（第一步追问）
em (engineering manager)                  # 单独类，不并 IC，题库完全不同
tpm / program manager                     # 偏跨团队协调
```

skill 推断 category 失败（JD 太模糊）→ 让用户从这个清单里选。

---

## IC vs EM 强制声明

如果推断结果是 manager 类（EM / Tech Lead / "带团队"信号），**强制让用户在第一步明确**自己是哪种：

- **IC**（hands-on coding 100%）：技术深度题 + IC 类 BQ（你怎么 carry 项目、做技术决策）
- **EM**（people manager，0-20% hands-on）：团队建设题 + 管人 BQ（怎么 hire、怎么 fire、怎么处理低绩效、怎么 1-on-1）
- **Tech Lead**（hands-on + 带 1-3 人）：兼有，但题量分配不同（70% IC + 30% leadership）

题库**完全不重叠**——把 IC 和 EM 的题混着出就是给所有人乱出题。这点是 muicv-interview 必须遵守的红线。

---

## 推断输出格式（给用户看）

skill 在第一步问完用户后，**显式**反馈推断结果让用户确认：

```
我读了 JD（targets/google-senior-fe-2026-04-23.md），推断如下：
- 级别：senior（基于 title "Senior Frontend Engineer" + 正文 "5+ years experience"）
- 类别：frontend (web)（基于正文 React / TypeScript / 性能优化关键词）
- 路线：IC（正文没有 manage 关键词）

确认这个判断吗？如果对就说"确认"，要修正就直接说"应该是 staff" 或 "其实是 fullstack"。
```

用户**必须**给出确认或修正才能进入下一步。**不要**默默用推断结果继续。
