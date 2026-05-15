# Debug & Eval 详细规范 v1.1

> 鼎捷面试 Demo 的 Tab 3（Debug & Eval）详细规范。
> 用途：作为 Claude Code 实现 Debug & Eval 的精确输入。
> 文档定位：**可解释性 + 评测（observability + eval）**——是 Agent Console 运行时（runtime）的事后审查位。

---

## 0. 文档定位 & 阅读指南

Debug & Eval 是面试 Demo 的**收口位**，承担两个核心任务：

1. **让 Agent Console 的每条 Trace 都可追溯、可解释**（PD-7「透明」的延伸：不仅运行时透明，事后也可审）
2. **承接 X4 一键复盘的跳转入口**——让"6 步剧本 → 复盘 → Trace 细节 → 指标 → 回到 Agent Console 查看具体订单"形成完整闭环

本 spec 的章节结构延续 Agent Console spec：

| 维度 | Agent Console | Debug & Eval |
|---|---|---|
| 主轴 | 剧本时间轴 × 三栏状态切片 | Trace 时间线 × 指标看板 |
| 数据 | 实时生成 | **直接读 `useScenarioStore((s) => s.traces)`**（详见 §3.1）|
| 验收 | 6 步剧本能跑通 | 基线 23 条 trace（含 4 次人工）/ Step 5 调参后 24 条 + 双栏指标（actual + target）+ 跨 Tab 闭环 |

**阅读顺序建议**：先读 §3 Trace 时间线（这是骨架），再读 §3.7 Trace 生命周期（避免实装时拍脑袋猜 rerun 行为），最后 §4-§6。

---

## 1. 布局总览

延续 Skill Builder / Agent Console 的三栏布局：

```
┌──────────────┬──────────────────────────┬──────────────┐
│              │                          │              │
│ 左：Trace    │   中：Trace 详情          │ 右：指标看板  │
│   时间线     │                          │              │
│              │  - 选中 trace 的完整      │ - 命中率      │
│ - 按 step    │    input / output JSON   │ - 安全层覆盖率│
│   分组       │  - 关联订单卡片           │ - 业务自动率  │
│ - 类型 badge │  - 跳回 Agent Console    │ - Token 累计  │
│   (filter/   │    的入口                │ - 平均延迟    │
│   risk/      │  - 关联模型 / 耗时       │ - 累计成本    │
│   call-skill │                          │ - 子 Skill   │
│   /human/    │                          │   调用成功率 │
│   config/    │                          │              │
│   intent)    │                          │ ⚠ 双栏显示：  │
│              │                          │  actual 来自 │
│ - 时间戳     │                          │  本次剧本    │
│   单调递增   │                          │  target 标   │
│              │                          │  PD-6 示意   │
│ - P0 加 type │                          │              │
│   filter     │                          │              │
│              │                          │              │
└──────────────┴──────────────────────────┴──────────────┘
```

**顶部全局区**（延续 Tab 1/2）：

- 左侧：当前数据源指示器（"本次剧本 N 条 trace · 始于 08:00:00"）
- 右侧：⭐「返回 Agent Console」按钮（链回剧本现场）+ "导出 JSON" 按钮（P2 实装）

**底部状态条**：

- 左：trace 类型分布微图（基线 23 条 = `intent` 1 / `config-change` 1 / `filter` 10 / `risk` 6 / `call-skill` 1 / `human-decision` 4；走 Step 5 调参后再 +1 `config-change` = 24 条 · 详见 §3.7）
- 右："本次基于 mock 数据，actual 为真实运行值，target 标 PD-6 示意" 提示

---

## 2. 全局设计原则

| 原则 | 实现方式 | 关联 PD |
|---|---|---|
| **Trace 是 Agent 决策的唯一权威记录** | 不在 Debug Tab 重新计算业务，只读 `useScenarioStore.traces` | PD-7 延伸 |
| **actual 真实 / target 示意 分两栏诚实呈现** | 不混用，actual 来自 trace 计数、target 明示 PD-6 | PD-6 |
| **空状态可演示** | 没跑剧本时显示"请先到 Agent Console 启动剧本"，不假装有数据 | 演示稳定性 |
| **跨 Tab 联动状态契约清晰** | 详见 §6（X4 跳转后 AC 状态、DE→AC 高亮订单的运行时 snapshot）| 系统一致性 |
| **B 端工具风** | 表格密、信息密，不做 C 端"卡片 + 留白" 的可视化 | CLAUDE.md §4.1 |

**禁止**：

- 任何"AI 评测"的虚假指标（如"准确率 92%"无评测基准）——B 端 PM 知道这种数字必须有 baseline
- 试图在 Debug Tab 修改 trace（trace 是只读的运行记录）
- 用图表库（如 ECharts、Recharts）画指标——SVG 手画或纯数字卡片即可

**继承 CLAUDE.md §5.4 不做单元测试**——本 spec 不要求任何测试，包括 selector / 生命周期 / 契约护栏。验收通过人工走查 §9 清单。

---

## 3. 左栏：Trace 时间线规范

### 3.1 数据来源

`useScenarioStore((s) => s.traces)` —— 直接读 Agent Console 写入的 trace 数组。

**Phase 3 数据源单一**：**不引入 `evalStore`**。CLAUDE.md §7 曾设想 trace/指标在 `evalStore`，但 Phase 2 实装时为简化跨 store 通信，把 trace 直接写在了 `scenario-store.traces`。Phase 3 沿用此设计。

**未来迁移**：Phase 4 部署后如果接入真 LLM（详见 `demo_scripts.md §2`）+ 多场景对比需求，再把 trace 迁移到独立的 `evalStore`。迁移代价：约 30 分钟 + 全局搜索替换 `useScenarioStore.traces` → `useEvalStore.traces`。

### 3.2 列定义（按 trace 类型组织）

每条 trace 显示一行：

```
┌─────────────────────────────────────┐
│ [step badge]  [type badge]          │
│ trace-003 · +250ms                  │
│ filter · PO-2025-001 · hit=true     │
└─────────────────────────────────────┘
```

| 元素 | 说明 |
|------|------|
| Step badge | "S1" / "S2" / "S3" 颜色按 step（蓝/紫/橙/绿/红/灰） |
| Type badge | filter / risk / call-skill / human / config / intent 颜色按类型 |
| Trace ID | trace-001..N 单调递增 |
| 相对时间戳 | `+Nms` 相对剧本开始（startedAt） |
| 摘要 | 一句话：`type · 关联对象 · 关键输出`（关联对象解析规则见 §4.3） |

### 3.3 分组方式

按 step 分 6 段（即使某 step 没 trace 也保留分组标题，显示"该步无 trace"）：

| Step | Trace 组成 | 数量 |
|---|---|---|
| **Step 1 触发** | IntentTrace + ConfigChangeTrace(scope='scenario') | 1 + 1 |
| **Step 2 扫描** | FilterTrace（每条订单一条） | 10 |
| **Step 3 安全层 + 多智能体** | RiskTrace（每条命中订单一条）+ CallSkillTrace（PO-001 齐套预警）+ **HumanDecisionTrace ×4**（PO-001/002/005/007 的人工决策）| 6 + 1 + 4 |
| **Step 4 用户追问** | 无 trace —— 演示节点，不产生决策 | 0 |
| **Step 5 配置调整 + 重跑** | ConfigChangeTrace(scope='thisRunOnly' / 'persist') | 1 |
| **Step 6 收尾** | 无 trace | 0 |

**基线总计**：**23 条 trace**（剧本完整走完含 4 次人工决策，但**不走** Step 5 调参）。走 Step 5 调参后 **+1 = 24 条**。详见 §3.7。

> ⚠️ **HumanDecisionTrace 归入 Step 3**：实装时 `submitHumanDecision` 写 trace 的 `step` 字段固定为 3（agent_console_spec §10.3 + scenario-store.ts 行为）。理由：人工决策**逻辑上属于 safety-block 的延伸**，不属于"用户追问"的 Step 4。如果用户在 Step 4-6 之间补点「待人工」按钮，trace 仍写 step=3。

### 3.4 选中行为

点击某 trace 行 → 中栏切到该 trace 的详情。当前选中行用 accent 边框高亮。

### 3.5 空状态

剧本未启动（`useScenarioStore.traces.length === 0`）时显示：

```
左栏：
┌─────────────────────────────────────┐
│        📊 暂无 Trace 数据             │
│                                     │
│  请先到 Agent Console 启动剧本       │
│  剧本运行后 trace 会在此处汇集       │
│                                     │
│  [→ 跳转到 Agent Console]            │
└─────────────────────────────────────┘
```

### 3.6 P0 必须的最小过滤器

按 step 分组适合"讲述演示"但不适合"工程师调 bug"。P0 必须在左栏顶部加 **两个 toggle filter**（详见 §8.1）：

- **按类型筛选**：复选框，多选；默认全选。**内部 value 必须使用真实 TS 类型字符串**（与 `TraceLog['type']` 对齐）：
  ```typescript
  type FilterType = 'intent' | 'filter' | 'risk' | 'call-skill' | 'human-decision' | 'config-change';
  // UI label 可显示简短中文："意图 / 筛选 / 风险 / 子 Skill / 人工决策 / 配置变更"
  ```
- **按订单筛选**：单选下拉，列出本次剧本所有出现过的 `orderId`（约 10 个 PO-2025-xxx）+ "全部"选项

应用 filter 后：
- 不命中 filter 的 trace 隐藏（不只是变灰）
- 分组段落（Step 1-6）仍显示，但段落标题后追加"(已隐藏 N 条)"
- 全部被 filter 隐藏的段落整段折叠

实现：filter 状态用 `useState` 在 Trace 列表组件内管理（不进 store）。

### 3.7 ⭐ Trace 生命周期契约（必读）

剧本从启动到结束、再到重置 / 再次运行，trace 的行为必须明确：

#### 3.7.1 初次运行（不含 Step 5 调参）

剧本走完 6 步、用户做完 4 次人工决策、**但不走 Step 5 调参** → **23 条 trace**：

```
trace-001  intent          Step 1   +0ms     IntentTrace
trace-002  config-change   Step 1   +50ms    ConfigChangeTrace(scope='scenario')
trace-003  filter          Step 2   +274ms   FilterTrace × 10
...
trace-012  filter          Step 2   +514ms
trace-013  risk            Step 3   +880ms   RiskTrace × 6
...
trace-018  risk            Step 3   +1280ms
trace-019  call-skill      Step 3   +1600ms  CallSkillTrace
trace-020  human-decision  Step 3   +Mms     HumanDecisionTrace × 4
...
trace-023  human-decision  Step 3   +Pms
```

第 24 条仅在用户走 Step 5 调参路径时产生（详见 3.7.2）。

#### 3.7.2 Step 5 调参（D7 浮卡 → applyThisRunOverride）

用户在 D7 卡确认 → **追加 1 条 ConfigChangeTrace**：

```
trace-024  config-change   Step 5   +Qms     ConfigChangeTrace(scope='thisRunOnly' | 'persist')
```

**关键约定（避免实装拍脑袋）**：

- ❌ rerun **不重新写** FilterTrace × 10 或 RiskTrace × 6
- ✅ 只写 1 条 `ConfigChangeTrace`，其 `output.affectedOrderIds` 标注调参影响的订单（如 PO-2025-009）
- ✅ `updatedRows` 内部状态变更（PO-009 从 pendingHuman → autoApproved）**不写入 trace**，作为派生状态由 §5 指标卡 actual 一栏反映

**理由**：rerun 是"基于新配置重评估"，**业务事实**（哪条订单符合什么规则）没变，变的是**规则本身**。所以应当只追加 ConfigChange，不重复写 Filter/Risk。如果 v2 需要"前后对比"，再加 `source: 'rerun'` 字段。

#### 3.7.3 完全重置（reset 按钮）

`scenario-store.reset()` 清空 `traces: []`、`runtimeRows` 重新 init、`thisRunConfigOverride: {}`、`mockCursor: null`、计时器全清。

**但是**：如果用户在 Step 5 选了 `persist=true`，`useSkillStore.config` 已被持久修改 —— **reset 不回滚 useSkillStore**（这是 persist 的语义）。Debug Tab 空状态。

#### 3.7.4 第二次 demo 运行（reset 后再启动）

从 trace-001 重新开始计数。**前一次的 trace 完全丢失，不存档、不归档**。

> 这是 demo 简化设计，不是生产行为。生产里 trace 必须写入持久层（DB / OLAP），按 `sessionId` 区分。Demo 阶段单 session 全 in-memory，符合 7 天 demo 的工程预算。

#### 3.7.5 验证清单

实装 Debug & Eval 时，用以下案例验证：

| 操作序列 | 预期 trace 数 |
|---|---|
| 启动剧本 → 走到 Step 3 → 不点「待人工」→ 直接结束 | 19（23 基线 − 4 条 human-decision；不走 Step 5）|
| 完整走完含 4 次人工决策 + 不走 Step 5 | 23 |
| 完整走完含 4 次人工决策 + 走 Step 5 调参 | 24 |
| 重置 → 重新启动 → 走到 Step 2 结束 | 12（intent + config + 10 filter）|

### 3.8 面试讲点

> 时间线按 step 分组是"产品视角默认"，按 type + 订单 filter 是"工程视角辅助"——两个视角并存的设计是 B 端 observability tool 的核心。**B 端运维工程师看 trace 不是只看"时间发生了什么"，更看"哪个业务步骤"和"哪条订单"的横切面**。把 trace 按业务 step 分组 + 同时支持订单维度过滤，是把"工程视角"翻译成"业务视角"的关键设计。

---

## 4. 中栏：Trace 详情面板规范

### 4.1 头部

选中 trace 时显示：

```
┌─────────────────────────────────────┐
│ trace-003 · FilterTrace             │
│ Step 2 · +250ms                     │
│ Model: deepseek-v3 · Token: 18      │
│ Latency: 22ms · actorId: demo-isv   │
│ authorizationResult: granted-mock   │
└─────────────────────────────────────┘
```

注：`authorizationResult` 字段一律显示，让面试官看到 RBAC 接口已预留（agent_console_spec §7.3 + §10.1）。

### 4.2 Input / Output 区

按 discriminated union 类型渲染。**字段名严格遵循 agent_console_spec §10.1 的真实 TS 类型**，不重命名：

| Trace 类型 | Input 字段 | Output 字段 |
|---|---|---|
| `intent` | `triggerSource` + `payload?` | `intent` + `confidence` |
| `filter` | `orderId` + `filter`（完整 FilterConfig 快照）| `hit` + `failedRules?: string[]`（**复数**，仅 hit=false 时存在；可能因多条规则同时不命中而有多项）|
| `risk` | `orderId` | `riskLevel` + `safetyBlocked` + `autoApproved` + `ruleApplied[]` |
| `call-skill` | `callerSkillId` + `targetOrderId` + `affectedWorkOrderIds[]` + `requestedAt` + `timeoutMs` | `status` + `shortageCount` + `affectedWorkOrderIds[]` + `suggestion` + `confidence` （ok 分支）/ `status` + `fallback` + `errorMessage`（error 分支）|
| `human-decision` | `orderId` + `promptedReason` | `decision` + `clickedBy` |
| `config-change` | `path` + `oldValue` + `newValue` | `scope` + `affectedOrderIds[]` |

**渲染规则**：

- 每个字段用 `key: value` 等宽字体排版（11px monospace）
- 复杂值（嵌套对象 / 数组）默认折叠，显示前 3 行 + "展开"按钮（P1 实装；P0 全部展开）
- 字段名固定排序（按 TS interface 声明顺序）

### 4.3 关联订单卡片（P0 必做）

按 trace 类型解析关联订单 ID 的规则：

| Trace 类型 | 关联订单 ID 来源 | 卡片显示 |
|---|---|---|
| `filter` / `risk` / `human-decision` | `input.orderId` | 单卡片 |
| `call-skill` | `input.targetOrderId` | 单卡片 |
| `config-change` | `output.affectedOrderIds[0]` —— **demo 简化路线**：只显示第一条 | 单卡片 + 文案后缀 "及 N-1 条其他订单"（当 affectedOrderIds.length > 1 时）|
| `intent` | 无关联订单 | 不显示卡片 |

> ⚠️ **简化决策**（B-2 修复）：本 demo 剧本里 `config-change` 的 `affectedOrderIds` 在 Step 1 是 `['PO-2025-004', '005', '009']`、Step 5 是 `['PO-2025-009']` —— 多订单场景只在 Step 1 出现一次。生产环境需要"多订单全列出"才合适，这里走简化路线：卡片只展示首条订单完整字段 + 一行后缀提示。`§6.4` 的 `highlightedOrderId` 也保持单值不升级数组。

卡片样式：

```
┌─────────────────────────────────────┐
│ 关联订单                              │
│ ─────────────────────────            │
│ PO-2025-001 · FAS-M8-A270-001        │
│ 高强度内六角螺栓 M8×40 · ¥28,500     │
│ 供应商：苏州精工紧固件 (A 级)        │
│ 关键件 · 影响 2 张在制工单           │
│                                     │
│ [↗ 在 Agent Console 查看此订单]      │
└─────────────────────────────────────┘
```

「在 Agent Console 查看此订单」按钮的跨 Tab 行为详见 §6.2.2。

**P0 实装**：基础卡片显示（订单字段）。
**P1 实装**：「↗」按钮跳转 + AC 订单高亮（详见 §6.2）。

### 4.4 空状态

未选中 trace 时显示：

```
中栏：
┌─────────────────────────────────────┐
│  从左侧选择一条 Trace 查看详情       │
│                                     │
│  共 N 条 trace 待审查                │
└─────────────────────────────────────┘
```

### 4.5 面试讲点

> Trace 详情用 discriminated union 渲染——同样的 schema 反向用于 UI 模板。**Trace schema 不仅是后端契约，也是前端组件的 props 类型。这种"schema-driven UI"是 B 端运维工具的核心模式**。

---

## 5. 右栏：指标看板规范

### 5.1 ⭐ actual + target 双栏指标（PD-6 落点）

每张指标卡同时显示两类数字，让"诚实"和"信息密度"兼顾：

- **actual（本次剧本）**：从 `useScenarioStore.traces` 直接计算的真实运行值。**不撒谎**——这是 trace 反推出来的事实
- **target（PD-6 示意）**：基于 ISV 调研 / 类似 Agent 产品 baseline / 平台预期 SLA 的目标基准。**明示"目标值（示意）"**，不假装是评测结果

| 卡片 | actual 计算 | target（示意） | 演示讲点 |
|---|---|---|---|
| **命中率** | `filterTraces.where(hit).length / totalFilterTraces` = 6/10 = 60% | ≥ 60% | 默认配置覆盖率，反映筛选规则的"召回粒度" |
| **安全层覆盖率** | `riskTraces.where(safetyBlocked).length / filteredCount` = 4/6 = 67% | 25-40% | 当前剧本高风险订单密度异常，可对比生产数据 |
| **业务层自动率** | `riskTraces.where(autoApproved).length / filteredCount` = 1-2/6 | ≥ 25% | 业务层规则自动化覆盖深度 |
| **人工介入率** | `safetyOverride + manualReview / filteredCount` = 4-5/6 | ≤ 50% | 衡量"AI 是否真正减负"——超过 50% 说明规则太保守 |
| **子 Skill 调用成功率** | `callSkillTraces.where(status='ok').length / total` = 1/1 = 100% | ≥ 95% | 多智能体协同的可用性 SLA |
| **平均 Token / 决策** | `totalTokens / decisionsCount` | < 2k | 单决策算力成本 |
| **平均延迟** | `Σ latencyMs / N` | < 500ms | 用户感知响应速度 |
| **累计成本** | `tokens × 单价` | < ¥1 / 剧本 | 单次扫描成本，对比人工跟催 |

> ⚠️ **selectMetrics 返回新对象 → 使用时必须 `useShallow(selectMetrics)`**（CLAUDE.md §5.5）

### 5.2 指标选择理由（应对面试官追问）

为什么选这 8 个？

- **3 + 1 业务覆盖**（命中率 / 安全 / 自动 / 人工介入）—— 反映 PD-3 三层固定优先级的执行实况
- **1 协同**（子 Skill 成功率）—— 反映多智能体（MACP 故事）的工程可靠性
- **3 平台运营**（Token / 延迟 / 成本）—— 反映平台 PM 的运营观

**为什么没选**：
- `callSkill 延迟` —— 单条调用，统计意义不足；可在详情卡看具体数字
- `filter 漏判率` —— 没 ground truth，无法计算
- `rerun delta` —— 单剧本最多 1 次 rerun，不构成时序指标
- `规则覆盖率`（每条规则被触发频率）—— 演示价值低，留 v2

### 5.3 视觉规范

```
┌─────────────────────────────────────┐
│ 命中率                          🟢   │
│ ────────────────────                 │
│ Actual: 60%   ▓▓▓▓▓▓▓▓░░░ (6/10)    │
│ Target: ≥ 60% ▓▓▓▓▓▓▓▓░░░（PD-6 示意）│
│                                     │
│ ⓘ actual 来自本次剧本 trace 计数    │
│ ⓘ target 是 ISV 调研 + 平台 SLA 假设│
└─────────────────────────────────────┘
```

- 数字字体大（actual 18px / target 14px），其他文字 11px
- actual 对比条用 accent 色，target 对比条用 muted
- "actual" 和 "target" 永远成对出现，单独显示视为 bug
- 右上角状态信号 🟢🟡🔴（详见 §5.4）

### 5.4 状态信号

每个指标卡片右上角根据 actual vs target 的关系显示。**信号规则按 metric 的 direction 区分**——避免"越低越好"的指标被乘法区间误判：

每个 metric 必须声明一个 `direction` 字段：

| direction | 语义 | 信号规则 |
|---|---|---|
| `higherBetter` | 越高越好（target 形式 `≥ X`）| 🟢 `actual ≥ target` · 🟡 `actual ≥ target × 0.8` · 🔴 `actual < target × 0.8` |
| `lowerBetter` | 越低越好（target 形式 `≤ X` / `< X`）| 🟢 `actual ≤ target` · 🟡 `actual ≤ target × 1.2` · 🔴 `actual > target × 1.2` |
| `rangeTarget` | 目标区间（target 形式 `[low, high]`）| 🟢 `actual ∈ [low, high]` · 🟡 `actual ∈ [low × 0.8, high × 1.2]` · 🔴 区间外 |

按 §5.1 8 个 metric 的 direction 分配：

- `higherBetter`：命中率 / 业务层自动率 / 子 Skill 调用成功率
- `lowerBetter`：人工介入率 / 平均 Token / 平均延迟 / 累计成本
- `rangeTarget`：安全层覆盖率（25-40% 区间，过低=规则太松，过高=数据集异常）

**重要**：状态信号本身不标"示意" —— 因为 actual 是真实计算、target 是声明的（已标示意）、二者关系是"事实判断"。但 **target 的合理性**是 PD-6 示意 —— 这一点在卡片底部的注脚里说明。

### 5.5 面试讲点

> actual 是真的，target 是示意，二者并排让面试官看到两个东西：
>
> 1. **指标体系本身的设计**——选哪 8 个、为什么不选别的（§5.2 已备）
> 2. **诚实但不空洞**——actual 真实计算、target 标 PD-6，没有混用造成"看似有评测其实没有"的错觉
>
> 如果面试官问"target 哪来的"，回答：「ISV 调研访谈 + Coze / Dify 等类似产品 baseline + 平台 SLA 假设。生产版本要做 50+ ISV 的 baseline 实测，target 才能从'示意'升'共识'。」

---

## 6. 与 Agent Console 的联动

### 6.1 跨 Tab 状态契约（必读）

跨 Tab 跳转涉及两个全局状态来源：

1. `useScenarioStore` —— Agent Console 的全部运行时状态（traces / runtimeRows / currentStep / 等等）
2. `useSkillStore` —— Skill Builder 的配置（可被 persist=true 的 D7 调参影响）

**核心约束**：**跳 Tab 不重置任何 store 状态**，所有跳转都是"读视角切换"。

### 6.2 跳转入口

#### 6.2.1 AC → DE 跳转

| 触发点 | 行为 | 优先级 |
|---|---|---|
| X4 一键复盘 Modal「跳转 Debug & Eval」按钮 | 切到 DE Tab + 左栏自动选中 trace-001（IntentTrace） + 关闭复盘 Modal | **P0** |
| 决策面板「引用 Skill 配置」每条规则的 `↗` 链接 | 切到 DE Tab + 按 type 'risk' 过滤 + 自动选中第一条相关 trace | P2 |

#### 6.2.2 DE → AC 跳转

| 触发点 | 行为 | 优先级 |
|---|---|---|
| 顶部「返回 Agent Console」按钮 | 切到 AC Tab，保留 AC 当前 currentStep / runtimeRows（详见 6.3）| **P0** |
| 详情面板「在 Agent Console 查看此订单」按钮 | 切到 AC Tab + 订单表自动滚动到该订单 + 高亮 3 秒 | **P1**（不是 P2！）|

> **修订理由**（Codex review #3）：DE → AC 订单高亮是"三个 Tab 故事性闭环"的最强一击。从 P2 升级到 P1。

### 6.3 ⭐ 跳转后的 AC 状态契约

X4 复盘 Modal 出现时 AC 的状态：`currentStep === 'done'`，runtimeRows 已完成全部分类。

点击「跳转 Debug & Eval」后切到 DE → 用户检视 trace → 点「返回 Agent Console」回到 AC：

**预期 AC 状态**：
- `currentStep` 保持 `'done'`（不重置）
- 所有 runtimeRows 保留最终状态（人工已派发 / 自动同意 / 未命中）
- 复盘 Modal **不重新打开**（用户已经看过）
- 一键复盘按钮仍然高亮可点（如需再次查看复盘）

**预期 AC 不做的事**：
- 不重跑剧本
- 不重置 runtimeRows
- 不清空 traces

实装方式：因为 `useScenarioStore` 是全局的，跨 Tab 切换不会触发任何 store mutation。唯一需要保证的是 X4 Modal 的 `closeReviewModal()` 在跳转前调用一次。

### 6.4 DE → AC 订单高亮的实装契约

需要在 `useScenarioStore` 加一个临时字段：

```typescript
interface ScenarioState {
  // ... 现有字段
  /** P1 新增：DE 跳过来时要高亮的订单 ID，3 秒后自动清空 */
  highlightedOrderId: string | null;
}

// action
setHighlightedOrder: (orderId: string | null) => void;
```

OrderTable 组件检查 `highlightedOrderId === order.id`，true 时加 `ring-2 ring-accent animate-pulse` 类名 + 自动 scrollIntoView。

3 秒后由 setTimeout 调 `setHighlightedOrder(null)` 自动清除。

### 6.5 面试讲点

> 三个 Tab 不是孤岛——X4 复盘按钮天然把面试官从 Agent Console 引到 Debug & Eval；DE 的「在 Agent Console 查看此订单」反向回去 + 自动滚动高亮，让面试官**视觉感知到"trace 不是死数据，是 runtime 状态的另一张脸"**。这种**故事性闭环**比单点功能完整度更能讲清楚"平台 PM 视角"。

---

## 7. 给 Claude Code 的实现指引

### 7.1 不要做的事

- 不要在 Debug Tab 引入新的 store（直接读 `useScenarioStore`）
- 不要重新计算 trace（trace 是 Agent Console 写入的事实）
- 不要画复杂的 D3/ECharts 图表（B 端简洁优先，SVG 手画足够）
- 不要假装指标全是"实测"（PD-6 + §5.1 双栏约束）
- 不要为 DE → AC 跳转做特殊路由（直接用 TanStack Router 的 `navigate('/agent-console')`）

### 7.2 组件拆分建议

```
src/components/debug-eval/
├── trace-list.tsx              # 左栏：按 step 分组的 trace 列表 + filter
├── trace-list-filter.tsx       # 左栏顶部 type filter + order filter (P0)
├── trace-list-group.tsx        # 单个 step 分组容器
├── trace-list-item.tsx         # 单条 trace（badge + 摘要）
├── trace-detail.tsx            # 中栏：选中 trace 的详情
├── trace-detail-input.tsx      # input 区域（按 type 渲染）
├── trace-detail-output.tsx     # output 区域
├── related-order-card.tsx      # 中栏关联订单卡片
├── eval-dashboard.tsx          # 右栏指标看板（含双栏 actual + target）
├── eval-metric-card.tsx        # 单个指标卡片
└── empty-state.tsx             # 空状态（trace 为空时）
```

### 7.3 关键 selector（D-impl 阶段新增）

⚠️ **以下 4 个 selector 当前 `src/stores/scenario-store.ts` 尚未实装**。D-impl 阶段在该文件末尾追加（紧跟现有的 `selectGroupedOrderIds` / `selectHud` / `selectCotStep`）：

```typescript
// 按 step 分组的 trace
export function selectTracesByStep(state: ScenarioState): Map<number, TraceLog[]> {
  const map = new Map<number, TraceLog[]>();
  for (const t of state.traces) {
    const arr = map.get(t.step) ?? [];
    arr.push(t);
    map.set(t.step, arr);
  }
  return map;
}

// 指标计算 —— 必须 useShallow 保护
// 每个 metric 是 struct，包含 actual + target + direction（§5.4 信号灯规则用）
type MetricDirection = 'higherBetter' | 'lowerBetter' | 'rangeTarget';

interface Metric {
  actual: number;
  /** target: number for higherBetter/lowerBetter, [low, high] for rangeTarget */
  target: number | [number, number];
  direction: MetricDirection;
  /** 用于显示的单位（"%" / "ms" / "¥" / null）*/
  unit: string | null;
}

export function selectMetrics(state: ScenarioState): {
  hitRate: Metric;            // higherBetter, target=0.6
  safetyRate: Metric;         // rangeTarget, target=[0.25, 0.4]
  autoApproveRate: Metric;    // higherBetter, target=0.25
  manualReviewRate: Metric;   // lowerBetter, target=0.5
  callSkillSuccess: Metric;   // higherBetter, target=0.95
  avgToken: Metric;           // lowerBetter, target=2000
  avgLatency: Metric;         // lowerBetter, target=500
  totalCost: Metric;          // lowerBetter, target=1
} { ... }

// 从 trace 反向解析关联订单 ID 列表（详见 §4.3）
// 返回数组：config-change 一条 trace 可能关联多条订单（affectedOrderIds）
export function resolveOrderIds(trace: TraceLog): string[] {
  switch (trace.type) {
    case 'filter':
    case 'risk':
    case 'human-decision':
      return [trace.input.orderId];
    case 'call-skill':
      return [trace.input.targetOrderId];
    case 'config-change':
      return trace.output.affectedOrderIds;
    case 'intent':
      return [];
  }
}

// trace 类型 + 订单 ID 过滤（P0 filter 用）
export function filterTraces(
  traces: TraceLog[],
  types: TraceLog['type'][],
  orderId: string | null,
): TraceLog[] {
  return traces.filter((t) => {
    if (!types.includes(t.type)) return false;
    if (orderId === null) return true;
    return resolveOrderIds(t).includes(orderId);
  });
}
```

⚠️ **selectMetrics 返回新对象 → 使用时必须 `useShallow(selectMetrics)`**（CLAUDE.md §5.5）

### 7.4 类型严格度

`TraceLog` 是 discriminated union。详情面板渲染时用 `switch (trace.type)` 而不是 `if`，让 TS 在每个 case 里收窄类型。

---

## 8. 实现优先级

### 8.1 P0（必做，~2-3h）

- 左栏 Trace 时间线（按 step 分组 + badge + 摘要）
- **左栏 P0 filter**（type 多选 + 订单单选）—— from §3.6
- 中栏 Trace 详情（按 type 渲染 input/output，全展开不折叠）
- **中栏关联订单卡片基础显示**（不含跳转按钮）—— from §4.3，回应 Codex #11
- 右栏指标看板（8 张卡片 actual + target 双栏）—— from §5.1
- 顶部「返回 Agent Console」按钮（行为详见 §6.3）
- **X4 复盘 Modal 的「跳转 Debug & Eval」按钮真实可点 + 自动选中 trace-001** —— from §6.2.1
- 空状态（trace 为空时引导跳 Agent Console）

### 8.2 P1（必做，~1.5h）

- **DE → AC 订单高亮跳转**（详见 §6.4，需 scenario-store 加 `highlightedOrderId` 字段）—— from §6.2.2，**从 P2 升级**
- 详情面板 input/output 长字段折叠（默认 3 行 + "展开"按钮）
- 指标卡片对比条（SVG actual/target 并排）+ 状态信号图标 🟢🟡🔴
- 底部 trace 类型分布微图

### 8.3 P2（如有时间）

- 决策面板「引用 Skill 配置」`↗` 跳转过滤 trace —— from §6.2.1
- 多选订单 filter（当前 P0 只支持单选）
- 导出 JSON 按钮（实装下载）
- 时间线视图切换（list / timeline 横轴）

### 8.4 取舍说明

- **不做**：完整 search（在 search 框输入 free text 过滤）—— P0 的 type + order filter 已覆盖 90% 调试场景，free search 收益边际
- **不做**：trace 对比（前后对比、多场景对比）—— 单 session 不需要
- **不做**：任何形式的单元测试（CLAUDE.md §5.4 硬约束，本 spec §2 已声明继承）

---

## 9. 验收清单

完成后，必须能演示（按操作顺序）：

- [ ] 进 Debug & Eval Tab，剧本未跑过时显示空状态 + "请先到 Agent Console 启动剧本"
- [ ] 在 Agent Console 跑完完整剧本（含 4 次人工 + 不走 Step 5）→ 切到 Debug & Eval → 看到 **23 条** trace（详见 §3.7.5 验证清单）
- [ ] Trace 按 step 6 段分组清晰可见，HumanDecisionTrace ×4 在 Step 3 段（§3.3）
- [ ] 顶部 type filter 复选框工作：取消 `human-decision` → 隐藏 4 条人工决策 trace，分组段落标注"(已隐藏 4 条)"
- [ ] 订单 filter 选 `PO-2025-001` → 只剩 1 `filter` + 1 `risk` + 1 `call-skill` + 1 `human-decision` = 4 条 trace
- [ ] 点击某 trace，中栏详情完整渲染（按类型 discriminated）
- [ ] 中栏关联订单卡片显示正确字段（按 §4.3 解析规则）
- [ ] 右栏 8 张指标卡，每张都同时显示 actual 和 target
- [ ] 点「返回 Agent Console」回到剧本现场，currentStep 仍为 'done'，runtimeRows 不变（§6.3）
- [ ] **从 DE 点订单卡片「↗ 在 Agent Console 查看此订单」→ AC 自动滚动到该订单 + 高亮 3 秒**（P1 必做）
- [ ] X4 复盘 Modal 的「跳转 Debug & Eval」按钮可点 + 跳过去后自动选中 trace-001
- [ ] 走 Step 5 调参（persist=true）→ Debug Tab 看到 **24 条**（多 1 条 ConfigChangeTrace scope='persist'）+ 切 Skill Builder Tab 看到业务层延期阈值已改

如果这 12 步能完整走通，Debug & Eval Tab 的面试演示就成立了。

---

## 10. Mock 数据 vs 生产环境差异（应对面试官追问）

如果面试官问"上生产数据后这个 Tab 要改什么"，以下是预备答案：

| 维度 | Mock（当前）| 生产 |
|---|---|---|
| **数据规模** | 单 session 23-24 条 trace | 单 session 100-1000+ trace；左栏必须分页 + 虚拟滚动 |
| **多子 Skill 并行** | 仅 1 个 CallSkillTrace（齐套预警）| 同一 Step 可能并发 3-5 个 callSkill；详情卡需展示子 trace 树（如 Span 模型）|
| **PII / 敏感字段** | 详情面板全展开（供应商名、金额、合同号都明文） | 必须接入字段级 RBAC 脱敏；`actorId` 不在白名单时金额显示 `¥***` |
| **持久化** | 全内存，reset 清空 | 写入 OLAP（如 ClickHouse）+ S3 归档；按 `sessionId` / `tenantId` 分区 |
| **指标 target** | 标"PD-6 示意" | 必须做 50+ ISV baseline 实测，target 升级为"实测均值 + 95p" |
| **跨剧本对比** | 不支持（单 session）| Debug Tab 加"场景对比"视图（剧本 A vs B 的指标 delta）|
| **告警** | 无 | 指标 🔴 状态 → 触发告警 webhook（Slack / 钉钉）|

> 这些差异写进 spec 不是"为 v2 留路"，是**应对面试官追问的预备答案**。Banner 演示时不会主动提，但被问到时能马上对答。

---

**文档版本**：v1.1（吸收 Codex 对抗式 review 的 5 条 HIGH + 5 条 MEDIUM + 2 条 LOW）
**最后更新**：2026-05-15
**关联文档**：
- `docs/agent_console_spec.md` §10（TraceLog discriminated union 契约）
- `docs/mock_data_schema.md`（10 条订单数据 + 规则纯函数）
- `CLAUDE.md` §5.4 + §5.5（不做测 + zustand selector 硬约束）
- `docs/demo_scripts.md` §2（真 LLM 接入方案）
