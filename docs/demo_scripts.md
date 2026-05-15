# 项目演示备弹手册 v1.0

> 用途：演示现场被追问时的标准答案 + 可选真实 LLM 增强方案的工程蓝图 + 演示节奏控制策略。
> 目标读者：Maintainer（项目作者）/ Claude Code（实现 §2 真 LLM 接入时的工程指引）。
> 关联文档：`docs/agent_console_spec.md`（功能规范）、`docs/mock_data_schema.md`（数据契约）。

---

## 0. 文档定位

本文档解决 Codex 对抗式审查的 P1-8：**Demo 全 mock，"Agent 推理 / 多智能体协同" 的叙事在技术派评审者面前站不住脚**。

三个章节各自承担：

| 章节 | 解决什么 | 适用场景 |
|------|---------|---------|
| §1 FAQ 备弹 | 业务派 / 产品派评审者的追问 | 不用切真实模式，口头讲清楚即可 |
| §2 渐进式真实 LLM 方案 | 技术派评审者的实质质疑 | 现场切 `?real-llm=<simple-token>`（书签触发），让 DevTools 里出现真 API 请求 |
| §3 演示节奏控制 | 何时讲、何时切、何时停 | 通用，所有演示 |

**核心战略**：默认演示模式跑 mock 版（稳定，给业务派看），技术派追问时切真实 LLM 模式（DevTools 可验证）。这一招比"加 FAQ"杀伤力大得多——**让"Agent"在评审者的电脑上当场跑一次**。

---

## 1. FAQ 备弹（6 个高频追问）

### Q1：你这个 Demo 凭什么叫 "Agent"，不就是规则 + 动画吗？

**标答**（30 秒）：

> 这个问题我自己也反复想过。我的判断是：**Agent 和规则的边界，不在"用没用 LLM"，而在"决策是否被静态枚举"**。
>
> Skill Builder 配置的所有规则（安全层 / 业务层 / 效率层）只是**判定边界**，不是决策本身。运行时真正决定"这条订单该怎么处理"的是 4 个不能用 if-else 完整枚举的判断：
>
> 1. **风险综合判断**：关键件 + 单一来源 + 影响在制工单 + 客户重要性，组合空间是 2^4=16 种，加上每种的优先级权重——规则能列，但解释成本高
> 2. **何时调用子 Skill**：齐套预警 Skill 调还是不调？这是"工具选择"问题，是 Agent 的核心能力
> 3. **自然语言追问**：用户问"PO-005 怎么没自动同意？"——这必须 LLM，规则做不到
> 4. **自然语言改参**：用户说"延期容忍调到 3 天"——这是意图理解，规则也做不到
>
> 这 4 个点是真 Agent。其他步骤（扫单筛选、动画展示）用规则就够，**不是所有步骤都要 LLM 才叫 Agent**——一个好的 Agent 系统应该"该用 LLM 时用 LLM，能用规则时用规则"。这是平台 PM 视角的核心判断。
>
> 如果你想看真实 API 调用，我现在切到真实模式（演示 §3 的切换动作）。

**关键句**："决策是否被静态枚举" 是这条回答的核心锚点。**不要**说"全 mock 是有意的"——这是认输。

### Q2：你怎么衡量这个 Agent 做得好不好？

**标答**（45 秒）：

> 我把指标拆成三层：

| 指标层级 | 指标 | 目标值 | 衡量方式 |
|---------|------|--------|---------|
| 效果层 | 跟催回复率提升 | 基线 +15pp | 对比启用前后 7 天 |
| 效果层 | 安全层拦截准确率 | ≥ 95%（人工复核样本） | 人工 review trace |
| 效率层 | 平均决策延迟 | ≤ 2s | Trace 里的 latencyMs |
| 效率层 | 模型路由成本 | ≤ ¥0.05 / 单订单 | Token × 单价 |
| 信任层 | 人工接管率 | 5%-15% 区间 | 太低=Agent 越权；太高=Agent 不可信 |
| 信任层 | 调参频次 | 上线后递减 | 配置稳定性 |

> 这 3 层是有顺序的——**先看效果，再看效率，最后看信任**。信任层的"调参频次递减"是反直觉的关键：Agent 上线初期 ISV 频繁调参是好事（说明在用），但 3 个月后还频繁调参就是问题（说明 Agent 不可信，每次都要人介入）。
>
> 这些指标的实测值我会在 Debug & Eval Tab 里全部用 mock 数据展示，且每条都标注"目标值（示意）"——不写"实测 92%" 这种误导文字（PD-6）。

### Q3：如果 LLM 输出格式不对，你怎么处理？

**标答**（30 秒）：

> 这是工程问题，也是产品问题。我的方案是 3 层防护：

| 层 | 机制 | 失败后的行为 |
|----|------|------------|
| 1. Prompt 约束 | 用 JSON Schema 强约束输出格式，prompt 末尾贴 schema 示例 | 减少错误率到 < 2% |
| 2. 后端校验 | CF Workers 解析时用 Zod 校验，不通过直接拒收 | 拒收即重试（最多 2 次） |
| 3. 兜底降级 | 重试仍失败 → 降级到 mock 响应，UI 显示"LLM 异常已降级" | 用户看到降级提示，不卡死 |

> 对剧本来说，第 3 层最关键——**演示稳定性优先于真实性**。所以即使切到真实 LLM 模式，如果 LLM 抽风，Demo 不会崩。

### Q4：核心用户为什么是 ISV（开发者+业务顾问），不是采购员？

**标答**（45 秒）：

> 这是产品定位的核心判断。B 端 SaaS 平台的商业模式是**平台 + ISV 生态**，不是直销给最终用户。B 端 AI Agent 平台的客户分两层：
>
> - **直接客户**：ISV 开发者 + 业务顾问——他们用这个平台搭 Agent 卖给制造企业
> - **间接受益人**：终端制造企业的采购员
>
> Skill Builder 这个 Tab 完全是给 ISV 的（采购员看不懂筛选规则配置）。Agent Console Tab 是给采购员看的运行时界面——但 ISV 在 Agent Console 看到 Trace 时，能反向去 Skill Builder 调参。
>
> 这也是我刻意做"反向跳回 Skill Builder"（D7 炫点）的原因——它服务的是 ISV 的"调参→看效果"工作流，不是采购员的工作流。
>
> 一句话：**ISV 是平台 PM 的核心用户，采购员是应用 PM 的核心用户**。我做的是平台 PM 视角的 demo。

### Q5：你来自货运 IM 行业（满帮），凭什么做制造业 Agent？

**标答**（60 秒，最重要的问题）：

> 我没有制造业从业经验，但我有 **B 端关键词匹配演进到 Agent 架构** 的实战经验，这是我应聘 B 端 AI PM 岗位的核心可迁移能力。
>
> 满帮 IM 早期是关键词匹配的客服路由系统——司机发"运费多少"，关键词命中"运费"，路由到运费咨询客服。这套系统的天花板我在 2023 年触到了：
>
> - **命中率瓶颈**：司机的真实话术千变万化，"价钱怎么算" / "钱多少" / "这单赚多少"都是同一个意图，关键词加得越多冲突越多
> - **场景割裂**：货主和司机的同一句话，意图完全不同（货主说"赶时间" = 加急派单，司机说"赶时间" = 推迟揽货）
> - **决策不可解释**：客服质疑"为什么这条没路由给我"，工程查日志要 2 小时
>
> 我们后来的演进路径：意图分类用 LLM → 关键决策点用 LLM → 工具调用编排（Agent 雏形）。这条路和今天的 Agent 架构方向完全一致。
>
> 制造业采购协同表面看离 IM 远，本质上**都是"约束 × 信号 × 决策"的问题**：
>
> | 满帮 IM | 制造业采购 |
> |---------|-----------|
> | 司机/货主消息 = 信号 | 供应商回复 / 订单到货倒计时 = 信号 |
> | 关键词 + 用户角色 = 约束 | 安全层规则 + 业务层规则 = 约束 |
> | 路由给哪个客服 = 决策 | 自动同意 / 派任务卡 / 升级人工 = 决策 |
>
> 业务领域可以学，"从规则系统演进到 Agent 系统的产品判断" 是经验。

**关键句**："约束 × 信号 × 决策" 是核心抽象，记牢。

### Q6：Skill / Agent / Tool 的边界你怎么划？

**标答**（45 秒）：

> 这是平台 PM 必须能答的问题。我的边界定义：
>
> - **Tool**：原子操作，无状态。例如"发送企业微信消息"、"查询 MRP 计划"。Tool 的接口是确定的，不需要 LLM 决策怎么用，只需要 LLM 决策**用不用**和**传什么参数**。
> - **Skill**：一组业务规则 + 触发条件 + 动作配置的封装。例如"采购交期跟催 Skill"。Skill 是可配置的，由 ISV 在 Skill Builder 上搭建。
> - **Agent**：一个能在运行时**编排 Skills 和 Tools**、维持 Memory、自然语言交互的智能体。Agent 不是配置出来的，是平台底座提供的运行时能力。
>
> 三者关系：**Agent 调用 Skill，Skill 调用 Tool**。这一层级关系是 B 端 AI Agent 平台、多智能体协同协议的产品骨架。
>
> 我的 demo 里：
> - "齐套预警 Skill" 是 Skill 不是 Tool（它有自己的业务规则）
> - "发送企业微信" 是 Tool（在 Skill 内部使用）
> - "采购协同 Agent" 是运行时编排者（不在 Skill Builder 里配置，而是平台提供）

---

## 2. ⭐ 渐进式真实 LLM 增强方案

### 2.1 方案总览

**目标**：让 4 个关键决策点真接 LLM，其余保持 mock。技术派评审者追问时切到真实模式，DevTools 里出现真 API 请求。

**4 个真 LLM 接入点**：

| ID | 步骤 | LLM 任务 | 输入 | 输出 |
|----|------|---------|------|------|
| **L1** | Step 3a 风险综合判断 | 给定订单 + 规则上下文 → 输出风险等级 + 处理建议 + CoT | PO + 规则配置 | `{ riskLevel, recommendation, cot[] }` |
| **L2** | Step 3b callSkill 编排 | 决定是否调用齐套预警 Skill + 传什么参数 | PO + 主 Skill 上下文 | `{ shouldCall, request? }` |
| **L3** | Step 4 自然语言追问 | 处理"PO-005 怎么没自动同意？"类追问 | 用户问题 + 当前 PO 状态 | `{ explanation, citedRules[] }` |
| **L4** | Step 5 自然语言改参 | 解析"延期容忍调到 3 天" → 结构化 action | 用户改参请求 + Skill schema | `{ action, path, value, scope }` |

**模型选择**：默认 Claude Haiku 4.5（`claude-haiku-4-5-20251001`）—— 便宜、快、中文能力够用。

**触发开关**：URL 参数 `?real-llm=<simple-token>`（token 是 `wrangler secret REAL_LLM_GATE_TOKEN` 的 random string，详见 §2.3）。不带参数或 token 不匹配时仍跑全 mock 版。**boolean 值显式拒绝**：`?real-llm=true` 不等于任何 random string，自然被 Worker 拒绝；前端解析时也加 guard 避免误用。

### 2.2 各接入点的 Prompt Template 草稿

#### L1: 风险综合判断（Step 3a）

```typescript
const SYSTEM_PROMPT_L1 = `
你是制造业采购协同 Agent 的风险判断模块。给定一条采购订单和当前 Skill 的安全/业务规则配置，输出风险等级、处理建议和思考链（CoT）。

严格输出 JSON 格式，不要有任何额外文字：
{
  "riskLevel": "high" | "medium" | "low",
  "safetyBlocked": boolean,
  "recommendation": "humanIntervene" | "autoDispatchTaskCard" | "autoApprove",
  "cot": string[]  // 3-5 步思考过程
}

判断原则：
1. 安全层（关键件 / 单一来源 / 影响在制工单 / 财务合规）任一触发 → safetyBlocked=true → 必须 humanIntervene
2. 业务层（延期阈值 / 供应商等级 / 客户重要性）按配置判断
3. 输出的 cot 必须能解释你的判断路径，不能用空话
`;

// 调用时输入：
const userMessage = JSON.stringify({
  order: PurchaseOrder,
  config: { safety: ..., business: ... }
});
```

**输出 JSON Schema**：

```typescript
const L1_RESPONSE_SCHEMA = z.object({
  riskLevel: z.enum(['high', 'medium', 'low']),
  safetyBlocked: z.boolean(),
  recommendation: z.enum(['humanIntervene', 'autoDispatchTaskCard', 'autoApprove']),
  cot: z.array(z.string()).min(3).max(5),
});
```

#### L2: callSkill 编排（Step 3b）

```typescript
const SYSTEM_PROMPT_L2 = `
你是采购协同 Agent 的工具编排模块。给定一条订单的风险评估结果，决定是否调用「齐套预警 Skill」。

齐套预警 Skill 的能力：评估订单延期对在制工单排产的影响（缺料数、影响工单 ID）。

输出 JSON：
{
  "shouldCall": boolean,
  "request": {  // shouldCall=true 时必填
    "callerSkillId": "purchaseFollowUp",
    "targetOrderId": string,
    "affectedWorkOrderIds": string[],
    "timeoutMs": 5000
  } | null,
  "reasoning": string  // 一句话说明
}

调用决策原则：
- 影响在制工单 > 0 且 riskLevel=high → 应该调用
- 仅有客户订单影响 → 不需要调用（不在齐套预警职责内）
- 普通跟催 → 不调用
`;
```

#### L3: 自然语言追问（Step 4）

```typescript
const SYSTEM_PROMPT_L3 = `
你是采购协同 Agent 的对话模块。采购员对某条订单的处理结果提出疑问，你需要解释。

输出 JSON：
{
  "explanation": string,  // 自然语言解释，2-3 句
  "citedRules": string[]  // 引用的规则路径，如 "safety.critical", "business.autoApproveIfDelayLE"
}

解释原则：
- 引用具体规则，不要泛泛而谈
- 业务层延期阈值只看事实延期（supplierDelayReply），与供应商等级无关——这是常见误解，必须说清
- 安全层覆盖业务层时必须明说"被安全层覆盖"，并说明触发了哪条安全层硬规则
- 不要承诺无法兑现的事（如"我帮你改" / "我已记录"）
`;

// 输入：
{
  question: "PO-005 怎么没自动同意？",
  orderContext: PurchaseOrder,
  appliedRules: ['safety.critical', 'business.autoApproveIfDelayLE'],
  decisionResult: 'humanIntervene'
}
```

#### L4: 自然语言改参（Step 5）

**⚠️ 两层安全设计**（Codex 第二轮 C2 + 第四轮 4-C1 修复）：

1. **Schema 白名单层**（C2）：L4 输出 schema 是 discriminated union，不接受任意 `path: string`——LLM 永远不能改 safety 路径，永远不能写超范围 value
2. **风险分级层**（4-C1）：白名单内的 action 还要分"低风险（LLM 输出直接生效）"和"高风险（必须经 D7 UI 二次确认）"——避免 prompt injection 让 LLM 在用户不知情时降低安全门槛

**风险分级表**：

| 分类 | Action | 直接生效？ | 风险评估 |
|------|--------|-----------|---------|
| 低风险 | `updateAutoApproveDelayDays`（0-7） | ✓ 直接生效，仅 thisRunOnly | 取值空间窄，不能绕过安全层 |
| 低风险 | `toggleAutoApproveDelay` | ✓ 直接生效，仅 thisRunOnly | 只是阈值规则开关，关闭只会让更多订单走人工 |
| 低风险 | `updateMaxFollowUpCount`（1-5） | ✓ 直接生效，仅 thisRunOnly | 取值空间窄，且只影响跟催频次不影响审批 |
| **高风险** | `toggleAutoApproveTierA` | ✗ LLM 必须 reject，弹 D7 UI 确认 | 开启会让所有 A 级供应商自动同意，**绕过延期阈值** |
| **高风险** | `toggleMustHumanIfCustomerKA` | ✗ LLM 必须 reject，弹 D7 UI 确认 | 关闭会让 KA 客户走自动路径，**降低关键客户审核标准** |
| **高风险** | `updateAutoApproveAmountLimit` | ✗ LLM 必须 reject，弹 D7 UI 确认 | 调高会扩大自动同意金额，**放宽财务风险敞口** |

```typescript
// Prompt
const SYSTEM_PROMPT_L4 = `
你是采购协同 Agent 的配置编辑助手。采购员用自然语言请求修改 Skill 配置，你需要解析为结构化 action。

**重要约束**：
1. 你**永远不能**修改 automationBoundary.safety.* —— 安全层硬规则受平台保护。
2. 所有配置变更**仅在本次剧本生效**（thisRunOnly）。任何"以后都按这个"/"保存这个设置"等请求，返回 reject(reason='persist_requires_manual_ui')。
3. 配置 action 分两类（见下表），**高风险 action 你不能直接输出**——你的任务是提取用户意图填到 reject.proposedAction 字段，由 UI 弹卡让用户二次确认。

允许直接输出的低风险 action（你可以决定）：
- updateAutoApproveDelayDays: 业务层「延期 ≤ N 天自动同意」的 N 值（0-7 整数）
- toggleAutoApproveDelay: "延期自动同意"规则开关
- updateMaxFollowUpCount: 跟催次数上限（1-5 整数）

需要 UI 二次确认的高风险 action（你必须返回 reject(reason='confirm_required_via_ui') 并把意图填到 proposedAction）：
- toggleAutoApproveTierA: A 级供应商自动同意开关 ⚠️ 会扩大自动同意范围
- toggleMustHumanIfCustomerKA: KA 客户必须人工开关 ⚠️ 关闭会降低关键客户审核
- updateAutoApproveAmountLimit: 自动同意金额上限（元，0-1000000）⚠️ 放宽财务风险敞口

输出 JSON（严格匹配下面 4 种 schema 之一）：
{ "action": "updateAutoApproveDelayDays", "value": <0-7 int>, "explanation": string }
{ "action": "toggleAutoApproveDelay", "value": <boolean>, "explanation": string }
{ "action": "updateMaxFollowUpCount", "value": <1-5 int>, "explanation": string }
{
  "action": "reject",
  "reason": "safety_path_locked" | "out_of_range" | "persist_requires_manual_ui" | "confirm_required_via_ui" | "unrecognized_intent",
  // 仅 reason='confirm_required_via_ui' 时填，其他情况省略
  "proposedAction"?: { "action": "toggleAutoApproveTierA", "value": <boolean> }
                  | { "action": "toggleMustHumanIfCustomerKA", "value": <boolean> }
                  | { "action": "updateAutoApproveAmountLimit", "value": <0-1000000 int> },
  "explanation": string
}
`;
```

**Server-side Zod schema**（CF Workers 必须用这个校验，不通过即拒收）：

```typescript
import { z } from 'zod';

// 可能需要 D7 二次确认的 action 集合（7-C2 修复：重命名 + 扩展）
//
// 原 HIGH_RISK_ACTION_SCHEMA 仅含 3 个本质高风险 action。
// 7-C2 后增加 2 个"低风险但放宽方向需要确认"的 action——
// updateAutoApproveDelayDays 和 toggleAutoApproveDelay 由 Worker 端
// 在 §2.2.1 风险路由阶段判断方向：放宽方向才转 reject 用 proposedAction 携带。
const CONFIRMABLE_ACTION_SCHEMA = z.discriminatedUnion('action', [
  // 本质高风险 3 条（4-C1 移出 LLM 直接生效）
  z.object({
    action: z.literal('toggleAutoApproveTierA'),
    value: z.boolean(),
  }),
  z.object({
    action: z.literal('toggleMustHumanIfCustomerKA'),
    value: z.boolean(),
  }),
  z.object({
    action: z.literal('updateAutoApproveAmountLimit'),
    value: z.number().int().min(0).max(1_000_000),
  }),
  // 7-C2 新增：低风险 action 在"放宽方向"时由 Worker 转 reject 路径承载
  z.object({
    action: z.literal('updateAutoApproveDelayDays'),
    value: z.number().int().min(0).max(7),
  }),
  z.object({
    action: z.literal('toggleAutoApproveDelay'),
    value: z.boolean(),
  }),
]);

// ── reject 子 schema 按 reason 拆分（5-C3 修复）──
// 旧版用 proposedAction.optional() 允许 'confirm_required_via_ui' 不带 proposedAction，
// 但前端代码假设它一定存在 → schema-valid 的 LLM 响应会让 UI 崩溃或显示空表单。
// 新版：'confirm_required_via_ui' 必须有 proposedAction；其他 reason 不能有 proposedAction（.strict()）。
const L4_REJECT_SCHEMA = z.union([
  // confirm_required_via_ui 必须有 proposedAction（含 7-C2 的方向放宽路径）
  z.object({
    action: z.literal('reject'),
    reason: z.literal('confirm_required_via_ui'),
    proposedAction: CONFIRMABLE_ACTION_SCHEMA,  // required, NOT optional
    explanation: z.string().min(1).max(200),
  }).strict(),
  // 其他 reason 一律不能有 proposedAction（strict 拒绝额外字段）
  z.object({
    action: z.literal('reject'),
    reason: z.enum([
      'safety_path_locked',
      'out_of_range',
      'persist_requires_manual_ui',
      'unrecognized_intent',
    ]),
    explanation: z.string().min(1).max(200),
  }).strict(),
]);

const L4_RESPONSE_SCHEMA = z.union([
  // ── 低风险：直接生效路径 ──
  z.object({
    action: z.literal('updateAutoApproveDelayDays'),
    value: z.number().int().min(0).max(7),
    explanation: z.string().min(1).max(200),
  }).strict(),
  z.object({
    action: z.literal('toggleAutoApproveDelay'),
    value: z.boolean(),
    explanation: z.string().min(1).max(200),
  }).strict(),
  z.object({
    action: z.literal('updateMaxFollowUpCount'),
    value: z.number().int().min(1).max(5),
    explanation: z.string().min(1).max(200),
  }).strict(),
  // ── reject 路径（按 reason 拆分见上方 L4_REJECT_SCHEMA）──
  L4_REJECT_SCHEMA,
]);
```

**前端处理约定**（4 路径，按优先级匹配）：

1. **LLM 返回低风险 action**（非 reject）→ 前端直接调 `setConfig` mutator 写到 zustand store，**仅 thisRunOnly**
2. **LLM 返回 `reject(reason='confirm_required_via_ui', proposedAction=...)`**（4-C1 新路径）→ 前端弹 §7.3 的 D7 浮起卡，**预填 `proposedAction.value`**，等用户点「确认并立即生效」才执行 setConfig
3. **LLM 返回 `reject(reason='persist_requires_manual_ui')`** → 前端弹 §7.3 D7 浮起卡让用户**手动勾选"永久保存"**
4. **其他 reject reason** / Zod 校验失败 → 在对话气泡里显示 `explanation`，不弹卡，不变更配置

**前端 belt-and-suspenders 兜底**（5-C3 加强）：尽管 Zod schema 已经保证 `reason='confirm_required_via_ui'` 必有 `proposedAction`，前端代码仍要在 path 2 入口加显式 guard：

```typescript
if (response.action === 'reject' && response.reason === 'confirm_required_via_ui') {
  if (!response.proposedAction) {
    // 理论上不可达（Zod schema 已挡），但加防御性兜底
    console.error('[L4] confirm_required_via_ui 缺少 proposedAction，fallback to mock');
    fallbackToMock();
    return;
  }
  openD7Card({ prefill: response.proposedAction.value });
}
```

理由：schema 校验在 worker 端做，前端拿到的是已校验响应；但如果 worker 实现有 bug 或 schema 被绕过，前端这一层 guard 是最后防线——**不能因为 schema 应该保证就盲信**。

**为什么把高风险 action 移出 LLM 直接生效路径？** 即使 schema 白名单防住了 prompt injection 写 safety 路径，**白名单内的高风险 action 本身就足以降低本次剧本的安全门槛**——比如把 `autoApproveAmountLimit` 调到 ¥1,000,000，意味着百万级订单可以走业务层自动同意路径，**绕过原本由金额上限提供的财务兜底**。即使 `thisRunOnly` 也防不了"本次剧本派任务卡的不可逆动作"。把高风险 action 强制走 UI 二次确认是**纵深防御**的最后一道——LLM 提取意图、UI 让人类拍板。

#### 2.2.1 Worker 端方向路由（7-C2 修复）

LLM 直接输出的低风险 action（`updateAutoApproveDelayDays` / `toggleAutoApproveDelay`）**调大调小的风险不对称**：

- **收紧方向**（让更多订单走人工）→ 降低自动同意范围 → 安全
- **放宽方向**（让更多订单自动派任务卡）→ 扩大自动同意范围 + 派发动作不可逆 → **不安全**

LLM schema 不需要变（让 LLM 输出语义统一），Worker 端在收到响应后做方向判断：

```typescript
// Worker 端：LLM 响应 → 风险路由
async function handleL4Response(llmResponse: L4Response, effective: SkillConfig) {
  if (llmResponse.action === 'reject') return llmResponse;  // reject 透传

  // 低风险 action 但需检查方向
  if (llmResponse.action === 'updateAutoApproveDelayDays') {
    const oldDays = effective.automationBoundary.business.autoApproveIfDelayLE.days;
    if (llmResponse.value > oldDays) {
      // 放宽方向 → 转 reject 让前端走 D7 二次确认
      return {
        action: 'reject',
        reason: 'confirm_required_via_ui',
        proposedAction: { action: 'updateAutoApproveDelayDays', value: llmResponse.value },
        explanation: `延期阈值从 ${oldDays} 天放宽到 ${llmResponse.value} 天会扩大自动同意范围，需 UI 二次确认`,
      };
    }
    // 收紧方向 → 直接透传
    return llmResponse;
  }

  if (llmResponse.action === 'toggleAutoApproveDelay') {
    const oldEnabled = effective.automationBoundary.business.autoApproveIfDelayLE.enabled;
    if (llmResponse.value === true && oldEnabled === false) {
      // 从关闭到启用 = 放宽方向
      return {
        action: 'reject',
        reason: 'confirm_required_via_ui',
        proposedAction: { action: 'toggleAutoApproveDelay', value: true },
        explanation: `启用"延期自动同意"规则会扩大自动同意范围，需 UI 二次确认`,
      };
    }
    // 关闭或保持当前状态 → 直接透传
    return llmResponse;
  }

  if (llmResponse.action === 'updateMaxFollowUpCount') {
    // 跟催次数不影响自动同意范围，任意方向都直接生效
    return llmResponse;
  }

  return llmResponse;
}
```

**完整方向判断表**：

| LLM 输出 action | 当前值 | 提议 value | 方向 | Worker 处理 |
|------------------|-------|-----------|------|-----------|
| `updateAutoApproveDelayDays` | days = 2 | 5 | 放宽 | 转 reject + 弹 D7 |
| `updateAutoApproveDelayDays` | days = 5 | 2 | 收紧 | 直接透传 |
| `updateAutoApproveDelayDays` | days = 3 | 3 | 等值 | 直接透传（noop） |
| `toggleAutoApproveDelay` | false | true | 放宽 | 转 reject + 弹 D7 |
| `toggleAutoApproveDelay` | true | false | 收紧 | 直接透传 |
| `toggleAutoApproveDelay` | true | true | 等值 | 直接透传（noop） |
| `updateMaxFollowUpCount` | 任意 | 任意 | 不影响自动同意 | 始终直接透传 |

**为什么不让 LLM 自己判断方向？** 三个理由：

1. **职责分离**：LLM 提取用户意图，Worker 做安全策略——这是清晰的关注点分离
2. **避免 prompt injection 绕过**：如果让 LLM 决定方向，攻击者可以通过 prompt 让 LLM 把"放宽"标成"收紧"
3. **当前值是 effectiveConfig 的运行时状态**，Worker 直接可读；让 LLM 拿不到完整 config 状态可以减小 prompt 体积

### 2.3 部署架构（简化版）

**设计原则**：成本控制移到 Anthropic 平台层（dashboard 设月度 budget cap），应用层只做**基础访问控制 + 输入约束 + LLM 输出校验**。早期版本曾设计 HMAC session token + DO 配额计数等加固机制——但 Maintainer 选择"在 Anthropic 平台设月度 budget $5"作为最后防线后，应用层的复杂配额机制变得过度设计。

```
┌──────────────┐         ┌─────────────────────────┐       ┌──────────────┐
│  浏览器       │         │ Cloudflare Workers       │       │  Anthropic   │
│              │         │ (本项目 worker/)          │       │     API      │
│  Agent       │ ─POST─→ │  /api/llm/:endpoint      │ ─POST→│              │
│  Console     │ ←JSON── │                          │ ←JSON │  Haiku 4.5   │
│              │         │  ① simple token 校验     │       │              │
│              │         │  ② Origin 精确匹配       │       │              │
│              │         │  ③ 请求体长度限制（防滥用）│       │              │
│              │         │  ④ Zod 校验 LLM 输出     │       │              │
│              │         │  ⑤ 任何失败 → fallback   │       │              │
└──────────────┘         └─────────────────────────┘       └──────────────┘
                                   │
                                   ├─→ secret: ANTHROPIC_API_KEY
                                   └─→ secret: REAL_LLM_GATE_TOKEN
                                       （Maintainer 用 wrangler secret put 生成
                                        random string，演示后可重置）

                                                       ┌─────────────────────┐
                                  ⚠ 成本最后防线 ────→ │ Anthropic Dashboard │
                                                       │  月度 budget cap $5 │
                                                       │  超额自动停服        │
                                                       └─────────────────────┘
```

**API 端点设计**（基于本项目已有 `src/worker/index.ts`）：

```
POST /api/llm/risk-judge          → L1
POST /api/llm/orchestrate-call    → L2
POST /api/llm/answer-question     → L3
POST /api/llm/parse-config-intent → L4
```

**关键工程细节（5 条）**：

1. **Simple Token 校验**
   - URL 参数 `?real-llm=<random-string>`，token 是 Maintainer 用 `wrangler secret put REAL_LLM_GATE_TOKEN` 生成的 32 字节 url-safe random string
   - Worker 端简单 `equals` 校验：`requestToken === env.REAL_LLM_GATE_TOKEN` 才放行
   - 不需要 HMAC、不需要 exp、不需要签名工具链——简化路线
   - **吊销机制**：Maintainer 在演示后直接 `wrangler secret put REAL_LLM_GATE_TOKEN` 重新生成 secret，旧 token 立刻失效
   - **boolean 值显式拒绝**：`?real-llm=true` 不等于任何 random string，自然被拒——前端解析 URL 参数时也加 guard，避免误用

   #### ⚠️ 已识别的可接受风险（Codex 6-C2 + 8-C1 反复指出）

   **URL 携带 bearer secret 易泄露**——Codex 在第 6 轮和第 8 轮两次指出这个安全反模式，列出 6 条泄露路径：

   1. 浏览器历史记录
   2. 演示截图 / 屏幕共享（最常见的实战泄露场景）
   3. CDN / 代理服务器访问日志
   4. analytics 工具捕获（GA / Sentry / 等）
   5. HTTP referrer header（跨页面跳转时）
   6. 用户手动复制 URL 分享

   **Origin 严格校验防不住此攻击**——一旦 token 泄露，攻击者只要从浏览器访问 allowed origin（demo 部署的域名）就能成功调用，Origin 检查放行。

   **这是 demo 阶段有意做的工程权衡**：

   - **风险被外部系统 cap**：Anthropic 平台月度 budget cap = $5/月。即使 token 泄露被全网攻击者刷，单月封顶损失 ≈ ¥35。budget 达上限后 Anthropic 自动停服（429）→ Worker 转 503 → 前端 fallback mock，攻击不会无限造成损失
   - **应用层加固代价不对等**：用 Authorization header + 服务端 session 能彻底解决泄露问题，但 demo 工程量增加（启动多一步本地手动输入 token），与"省 ¥35"不对等
   - **生产 SaaS 必须改造**：如本 demo 升级为多租户 SaaS，必须切到 Authorization header + 短期 server-issued session + 显式吊销；当前 URL token 模式禁止上生产

   **演示时被追问的话术**：

   > "Codex 反复指出 URL token 易泄露——我两轮评估后维持现状，因为外部系统（Anthropic budget cap）已经把损失硬性 cap 在 ¥35/月以内，应用层做加固是过度设计。这是平台 PM 视角的风险定价：用 ¥35 的最坏损失换 demo 工程量收益。如果是生产 SaaS 我会切 Authorization header，但 demo 阶段这个权衡成立。"

   **禁止事项**（spec 强制）：

   - Worker 端日志**不能**记录 token 值（即使 debug 也不行）
   - 前端 console 输出**不能**包含 token
   - 任何 Trace 日志写出 actorId/tenantId 时**不能**附带 raw token——只能写"token 校验结果"（如 `'granted-mock'`）

2. **Origin 精确校验**（不依赖 CORS）
   - Worker 主动检查请求头 `Origin` 必须**精确匹配** Maintainer 的 demo 域名（如 `https://agent-builder.banner.workers.dev`）
   - **拒绝** `*.workers.dev` 通配——防止 attacker 在自己的 workers.dev subdomain 上代理
   - CORS 仍要正确配置防浏览器误用，但访问控制靠 Origin 主动校验

3. **⭐ Endpoint 级请求体长度限制 + max_tokens**（防 prompt injection 滥用 + 防 body bomb DoS）

   每个 endpoint 定义最坏情况上限：

   ```typescript
   const ENDPOINT_QUOTAS = {
     'risk-judge':       { maxInputBytes: 16_000, maxOutputTokens: 500 },  // L1（约 4000 中文字符）
     'orchestrate-call': { maxInputBytes: 12_800, maxOutputTokens: 400 },  // L2
     'answer-question':  { maxInputBytes: 19_200, maxOutputTokens: 500 },  // L3 用户输入字段最长 1000 chars
     'parse-config':     { maxInputBytes: 12_800, maxOutputTokens: 300 },  // L4 用户输入字段最长 500 chars
   } as const;
   ```

   **⚠️ Body 必须在读取前就限制大小**（Codex 8-C2 修复）：

   早期版本写的伪代码是 `await req.text()` 然后再 `if (body.length > ...)` 检查长度——这等于**整个 body 已经被读进 Worker 内存才发现超额**。CF Workers 平台 body 上限是 100MB，攻击者可以塞 100MB 让 Worker 在调 Anthropic 前就 burn 内存/CPU。

   **正确实现：Content-Length 预检 + 流式读取 + 超 cap 中断**：

   ```typescript
   async function readBodyWithCap(req: Request, maxBytes: number): Promise<string> {
     // 1. Content-Length 预检（如果 header 存在，server 端可信）
     const contentLength = req.headers.get('content-length');
     if (contentLength && Number(contentLength) > maxBytes) {
       throw new BodyTooLargeError();
     }

     // 2. 流式读取，超 cap 立即中断（防 Content-Length 缺失或伪造）
     const reader = req.body?.getReader();
     if (!reader) throw new EmptyBodyError();
     const chunks: Uint8Array[] = [];
     let received = 0;
     try {
       while (true) {
         const { done, value } = await reader.read();
         if (done) break;
         received += value.length;
         if (received > maxBytes) {
           // 显式取消底层连接，释放下游资源
           await reader.cancel();
           throw new BodyTooLargeError();
         }
         chunks.push(value);
       }
     } finally {
       reader.releaseLock();
     }
     return new TextDecoder().decode(concatChunks(chunks));
   }

   // Worker 入口
   async function handleLlmRequest(endpoint: keyof typeof ENDPOINT_QUOTAS, req: Request) {
     const quota = ENDPOINT_QUOTAS[endpoint];
     let body: string;
     try {
       body = await readBodyWithCap(req, quota.maxInputBytes);
     } catch (e) {
       if (e instanceof BodyTooLargeError) {
         return new Response('Request body too large', { status: 413 });
       }
       if (e instanceof EmptyBodyError) {
         return new Response('Empty body', { status: 400 });
       }
       throw e;
     }
     // ... JSON 解析 + Zod 校验 + 调 Anthropic 时传 max_tokens = quota.maxOutputTokens
   }
   ```

   **关键点**：

   - `Content-Length` 头部预检是**第一道防线**——大多数合法请求都会带这个 header；攻击者伪造小 header 但实际塞大 body 时，第二道防线兜底
   - 流式读取 + 累加字节 + 超 cap 主动 `reader.cancel()`——这才是真正的"读取前限制"
   - **不要**用 `await req.text()` 然后查 `body.length`——这违反"读前限制"原则

   **必须的测试 case**（Phase 2 实现时写）：

   ```typescript
   test('塞 10MB body 时 Worker 必须 413 且 Anthropic 不被调用', async () => {
     const bigBody = 'x'.repeat(10 * 1024 * 1024);  // 10MB
     const mockAnthropic = vi.fn();
     const response = await handleLlmRequest('risk-judge', new Request('/api/llm/risk-judge', {
       method: 'POST',
       body: bigBody,
     }));
     expect(response.status).toBe(413);
     expect(mockAnthropic).not.toHaveBeenCalled();  // 关键：Anthropic 没有被调用
   });
   ```

   这是契约护栏单测（同 CLAUDE.md §5.4 例外原则），不计入"demo 不做单测"约束。

   **这层限制不防成本**（成本靠 Anthropic 平台 budget cap）：

   - **它防的是 prompt injection**：攻击者塞 10 万字 prompt 试图榨干 budget
   - **也防 body bomb DoS**：攻击者塞 100MB body 试图打死 Worker（8-C2 修复后即使 Anthropic 没被调，Worker 也不会 OOM）
   - **也防 LLM 输出失控**（Anthropic 默认 max_tokens 是 4096，单次 ¥0.02；我们限到几百 token，单次 ¥0.001）

4. **Zod 校验 LLM 输出**（与 §2.2 一致）
   - 所有 LLM response 在 worker 端用 Zod schema 校验
   - 解析失败返回 502 + 降级 hint，前端 fallback mock

5. **任何失败一律 fallback mock**
   - 401（token 无效）/ 403（Origin 不匹配）/ 413（请求过长）/ 502（Zod 校验失败）/ 504（Anthropic 超时）/ 503（Anthropic 平台 budget 已用尽，Anthropic 返回 429 时 Worker 转 503）
   - 任何非 200 响应 → 前端自动降级到 mock 路径，Trace 记录 `fallbackReason`
   - 演示永远不会因为 LLM 路径出问题而整个崩

**为什么不做应用层配额计数**：

成本控制最可靠的层是 Anthropic 平台 dashboard。Anthropic 提供月度 budget cap——达到后自动停服（API 返回 429）。这是平台级硬约束，比 CF Workers KV/DO 计数都可靠（KV 不原子、DO 工程量大且 spec 反复迭代仍有边界 case）。**应用层做配额计数是过度设计**——Maintainer 设置 `$5/月` budget cap 后：

- 单次完整剧本约 2500 token ≈ ¥0.028 ≈ $0.004
- $5 月预算 = 约 1250 次完整剧本演练，**约 50× 安全裕量**
- 即使 token 完全泄露被恶意刷，最坏损失 = 月预算 $5 ≈ ¥35
- 超额后 Anthropic 自动停服，攻击不会无限造成损失

如 demo 升级为生产 SaaS，再回头加 Cloudflare Access + 应用层配额。

### 2.4 成本估算

| 项 | 单次剧本消耗 | 单价（Haiku 4.5） | 单次成本 |
|----|------------|------------------|---------|
| L1 输入 | ~600 token | $0.80/M | $0.0005 |
| L1 输出 | ~200 token | $4/M | $0.0008 |
| L2 输入 | ~400 token | $0.80/M | $0.0003 |
| L2 输出 | ~150 token | $4/M | $0.0006 |
| L3 输入 | ~500 token | $0.80/M | $0.0004 |
| L3 输出 | ~150 token | $4/M | $0.0006 |
| L4 输入 | ~400 token | $0.80/M | $0.0003 |
| L4 输出 | ~100 token | $4/M | $0.0004 |
| **小计** | ~2500 token | | **$0.0039 ≈ ¥0.028** |

**全周期预算**：

- 演示前演练 100 次：¥2.8
- 演示当场跑 5 次：¥0.14
- **总成本约 ¥3**——完全可承受

**防刷预算（简化方案，靠 Anthropic 平台层兜底）**：

- Maintainer 在 Anthropic 平台 dashboard（console.anthropic.com）设置**月度 budget cap = $5**（约 ¥35）
- 单次完整剧本 ≈ ¥0.028，$5 月预算允许约 **1,250 次完整剧本演练**——约 50× 安全裕量
- **最坏情况**（token 泄露被全网攻击者刷）：单月封顶损失 ≈ ¥35
- 一旦达到 budget cap，Anthropic API 自动返回 429 → Worker 转 503 → 前端 fallback mock
- 触发后演示**自动降级**，Maintainer 讲述话术："这正好演示一下兜底机制——API budget 用尽自动降级"
- **简化的代价**：相比 4-C3 加固版（应用层 DO 配额），单日颗粒度的硬上限失去——但月度 budget cap 是更可靠的真实硬约束（平台层 vs 应用层）

### 2.5 真 LLM 模式 vs Mock 模式的差异处理

| 维度 | Mock 模式（默认） | 真 LLM 模式（`?real-llm=<simple-token>`） |
|------|------------------|----------------------------|
| L1 风险判断输出 | 预生成 CoT 字符串 | LLM 实时生成（90-150 字符/秒打字效果保持） |
| L2 callSkill 决策 | 固定调用 | LLM 决策（**有概率不调用**——这点要在 §3 节奏控制里处理） |
| L3 追问回复 | 固定 mock 文本 | LLM 实时回复 |
| L4 改参解析 | 跳过解析步骤，直接弹卡 | LLM 解析后再弹卡（含 LLM 提取的 `action` 类型 + value） |
| Token 计数 | 跳数字（视觉效果） | 真实 token 累加 |
| 模型路由小图标 | 静态显示 | 真实工作中状态 |
| 平均延迟 | 0ms | 实测约 1-2s |

**L2 的不确定性处理**（关键）：

真 LLM 在 L2 可能决定"不调用齐套预警 Skill"——这会破坏剧本的 D6 炫点（多智能体协作图）。两种处理：

- **方案 A**：prompt 里加更强引导，让 LLM 在影响在制工单 > 0 时几乎确定调用（实测约 95%+ 调用率）
- **方案 B**：L2 输出 `shouldCall=false` 时，前端 fallback 到预设的"应该调用" 决策，并在 trace 里标注"⚠️ LLM 建议不调用，但被剧本兜底覆盖"——演示透明性，但牺牲一点真实感

**推荐**：方案 A。L2 在 prompt 里强调"影响在制工单 > 0 是必须调用的硬触发条件"，把 LLM 的不确定性框在窄区间。

### 2.6 LLM 路径 vs 手动 D7 路径的权限边界（含 4-C1 风险分级 + 7-C2 方向感）

§7.3（agent_console_spec）的 D7 浮起迷你 Skill Builder 卡片支持"☐ 永久保存到 Skill 配置"勾选项，与 L4 LLM 路径**职责不同**：

| 路径 | 触发 | 允许的变更范围 | 允许 `persist`？ | 二次确认 |
|------|------|--------------|----------------|---------|
| **LLM L4 收紧方向** | 用户自然语言追问被解析为低风险 action 且**方向是收紧**（如延期阈值降低 / 关闭延期自动同意） | `updateAutoApproveDelayDays` ↓ / `toggleAutoApproveDelay`=false / `updateMaxFollowUpCount` | ❌ 始终 `thisRunOnly` | 不需要——Worker 透传，前端直接 setConfig |
| **LLM L4 放宽方向**（7-C2 新增） | 用户意图涉及低风险 action 但**方向是放宽**（如延期阈值升高 / 启用延期自动同意） | Worker 端方向路由后转 `reject(reason='confirm_required_via_ui', proposedAction=...)` | ❌ 始终 `thisRunOnly` | **必须**通过 §7.3 D7 浮起卡二次确认 |
| **LLM L4 高风险** | 用户意图涉及 KA 必须人工开关 / A 级自动同意 / 金额上限调整 | L4 直接返回 `reject(reason='confirm_required_via_ui', proposedAction=...)` | ❌ 始终 `thisRunOnly` | **必须**通过 §7.3 D7 浮起卡二次确认 |
| **手动 D7** | 用户主动点决策面板 `[⚙ 临时调整]` 或 Agent 引导浮起卡 | §7.3 卡片暴露的全部字段 | ✓ 可选（默认 `thisRunOnly`，且 RBAC 仅 ISV 可勾选 persist） | UI 卡片自身就是确认 |

**核心边界**（5 条纵深防御）：

1. **LLM 永远不能写 safety 路径**——schema 白名单不允许（C2）
2. **LLM 永远不能单独 `persist`**——所有持久化必须 UI 二次确认（C2）
3. **LLM 永远不能单独执行高风险 action**——KA 开关 / A 级自动同意 / 金额上限调整 必须 UI 二次确认（4-C1）
4. **LLM 永远不能单独扩大自动同意范围**——任何"放宽方向"的低风险 action 也必须 UI 二次确认（7-C2）
5. **手动 D7 是最高权限路径**——人类直接操作 UI，可以做 LLM 不能做的事，但 persist 勾选仅 ISV 角色可见（7-C1）

这条边界设计是**用户 + LLM + UI + RBAC 四方权限互相制衡**：LLM 只在"低风险且收紧方向"范围内自主，任何会扩大自动同意范围或跨权限边界的操作都必须有人类视觉确认。即使 prompt injection 或 LLM 抽风，最坏情况也只是"LLM 提出建议但被 UI 卡住等用户确认"——**配置永远不会在用户不知情时被悄悄放宽**。

---

## 3. 项目演示节奏控制

### 3.1 默认开场流程（适合所有评审者）

| 阶段 | 时长 | 你做什么 | 说什么 |
|------|------|---------|--------|
| 1. 项目介绍 | 30s | 不操作，口头介绍 | "B 端 AI Agent 平台上一个采购协同 Agent 工作台的产品原型，从产品判断到工程实现都是我做的" |
| 2. 三 Tab 总览 | 20s | 鼠标依次悬停三个 Tab | "Skill Builder 是 ISV 配置位，Agent Console 是运行时演示，Debug & Eval 是评测复盘" |
| 3. Skill Builder 速览 | 60s | 切到 Skill Builder，依次点 触发/筛选/自动化边界 | 重点讲三态选择、三层固定优先级、冲突预警 |
| 4. ⭐ Agent Console 演示模式 | 90s | 切到 Agent Console，点「演示模式」 | 不要在 90 秒里持续解说，让画面自己讲。剩余时间留给观众的眼睛 |
| 5. Debug & Eval 复盘 | 30s | 点剧本结束时的"一键复盘" | "这是平台 PM 视角的指标体系——3 层" |
| **总长** | **3 分 50 秒** | | |

### 3.2 何时切真实 LLM 模式

**信号**：评审者说出以下任意一句话——

- "这是真的 LLM 调用吗？"
- "Token 是写死的吗？"
- "这跟规则有什么区别？"
- "你这个 CoT 是预录的？"

**动作**：

1. 点击**事先准备好的浏览器书签**（指向 `?real-llm=<simple-token>`，token 是 `wrangler secret REAL_LLM_GATE_TOKEN` 的当前值，见 §2.3 第 1 条）。不要现场敲 URL。演示后可通过 `wrangler secret put REAL_LLM_GATE_TOKEN` 立刻吊销旧 token。
2. F12 打开 DevTools 的 Network 面板
3. 重新点「演示模式」
4. 让评审者看到 4 次 `POST /api/llm/*` 请求 + 真实 response

**话术**：

> "我刚切到了真实 LLM 模式。你可以看 Network 面板——这 4 个请求分别是风险判断、工具编排、自然语言追问、自然语言改参，都是真接 Claude Haiku 的。Token 计数从这里读真实值，不是写死。"

### 3.3 演示失败兜底

| 场景 | 兜底方案 |
|------|---------|
| 网络断了 | 切回默认 mock 模式（去掉 URL 参数）。话术："网络问题，切回 mock 模式继续讲产品判断" |
| 真 LLM 输出格式错（Zod 失败 → 502） | 前端自动降级到 mock（§2.3 第 4-5 条）。话术："这就是我刚才讲的多层防护——你看输出格式不对时自动降级了" |
| Token 校验失败（401） | UI 自动 fallback mock + 顶部 banner 提示。话术："token 失效了，我现场重新生成一个"（用 `wrangler secret put REAL_LLM_GATE_TOKEN`，需要新书签——演示中遇到不推荐折腾，直接降级讲述更优） |
| **Anthropic 月度 budget 用尽**（429 → 503） | UI 自动 fallback mock + 顶部 banner 提示"API budget 已用尽，已自动切换为 mock 模式"。话术："这正好演示一下兜底机制——Anthropic 平台层的月度 budget cap 是最后防线，超额自动停服。这套设计在生产 SaaS 上也是同样思路" |
| 演示模式动画卡死 | 点「重置」（依靠 §11.1.1 状态机契约 B2）。话术："我重置一下" |
| 评审者追问超出剧本范围 | 切到手动模式，停在某一步说"我点开这条 trace 看看" | 

### 3.4 关键原则

1. **不要在演示模式期间持续解说**——画面会说话，你的解说会和画面打架
2. **被追问时优先用 §1 FAQ，不要慌着切真实模式**——切真实模式是"硬证据"，应该是最后的杀手锏，不是开场炫技
3. **真实模式跑完一遍就够，不要反复切**——演示稳定性优先
4. **如果一次都没被追问到要切真实模式——这是好事，说明 mock 版讲服了观众**

---

## 4. 关联文档与待补内容

**关联**：

- `docs/agent_console_spec.md` —— 功能规范
- `docs/mock_data_schema.md` —— 数据契约
- `CLAUDE.md` —— 项目根上下文

**待补**（不阻塞当前 Phase 1/2）：

- §1 FAQ 还可以加 Q7-Q10（如"配置项之间冲突你怎么处理"、"B 端 SaaS 多智能体协同协议你怎么理解"等），按评审反馈迭代
- §2 真 LLM 接入的工程实现属于 P2 增强项，Phase 1/2 完成后再做
- §3 演示节奏中的"信号-动作"映射表可以在多次模拟演示后再修订

---

**文档版本**：v1.0
**用途**：Maintainer 演示现场备弹 + Claude Code 实现真 LLM 接入时的工程蓝图
**最后更新**：2026-05-14
