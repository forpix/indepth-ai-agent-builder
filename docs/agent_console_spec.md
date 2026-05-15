# Agent Console 详细规范 v1.0

> B 端 SaaS 演示 Demo 的 Tab 2（Agent Console）详细规范。
> 用途：作为 Claude Code 实现 Agent Console 的精确输入，避免自由发挥。
> 文档定位：**运行时（runtime）UI 规范**，与 Skill Builder（config-time）形成对照。

---

## 0. 文档定位 & 阅读指南

Agent Console 是演示 Demo 的**运行时演示位**，承担两个核心任务：

1. **让 Skill Builder 里配置的规则"活起来"**——配置不是静态文档，是运行时真实约束
2. **展示 Agent 决策的透明度（PD-7）和人工确认（PD-8）**——回应"AI 黑盒"的常见质疑

本 spec 的章节结构和 Skill Builder spec **不同**：

| 维度 | Skill Builder spec | Agent Console spec |
|---|---|---|
| 主轴 | 模块 × 配置项 × 默认值 | 剧本时间轴 × 三栏状态切片 |
| 核心交付 | 一张完备的配置项表 | 一段 90 秒能跑通的复合剧本 |
| 验收方式 | 每个字段都能调 | 6 步剧本能一次性走完 |

**阅读顺序建议**：先读 §3 复合剧本（这是骨架），再读 §4-§6 三栏规范（这是细节）。

---

## 1. 布局总览

整屏延续 Skill Builder 的三栏布局，但栏目语义完全不同：

```
┌──────────────┬──────────────────────────┬──────────────┐
│              │                          │              │
│ 左：对话面板  │     中：订单表             │ 右：决策面板  │
│              │                          │              │
│ - Agent 消息  │  - 10 条 Mock PO         │ - 当前意图    │
│ - 用户消息    │  - 扫描动画              │ - 引用 Skill  │
│ - 思考链 CoT  │  - 状态条 + 覆盖标签       │ - 模型路由可视化│
│ - 引用 Skill  │  - 高风险自动置顶         │ - Token / 成本│
│   悬浮卡      │                          │ - Memory 摘要 │
│              │                          │ - 多智能体协作图│
└──────────────┴──────────────────────────┴──────────────┘
```

**顶部全局区**（延续 Skill Builder Tab 的 header）：

- 左侧：当前剧本指示器（如 "08:00 定时触发 · 第 3 步 / 6"）
- 右侧：⭐ **演示模式按钮**（点一下整个 90 秒剧本自动播完）

**底部状态条**（新增）：

- 实时 HUD：累计 Token / 累计成本 / 平均延迟
- 右下角：⭐ "一键复盘"按钮（剧本结束后高亮）

---

## 2. 全局设计原则

| 原则 | 实现方式 | 关联 PD |
|------|---------|--------|
| **决策必须透明** | 每个 Agent 动作必须在右栏决策面板有对应展开项 | PD-7 |
| **关键动作必须人工** | 安全层覆盖的订单永远显示「待人工」按钮，不能被剧本跳过 | PD-8 |
| **配置→运行单向可见，运行→配置反向可跳** | 决策面板的每条规则后挂跳回 Skill Builder 的链接 | 系统级一致性 |
| **炫技服务于产品判断** | 每个动画/可视化必须对应一条 PD，不做纯装饰 | 见 §11 |
| **演示稳定性优先** | 每个炫点都有 fallback 静态版（动画挂了能用静态截图模式过场） | 见 §11.4 |
| **业务术语 B 端 SaaS化** | "任务卡"代替"通知"、"智能体"代替"Agent" | PD-9 |

**禁止**：

- 居中模态弹窗打断剧本节奏（人工确认用内嵌按钮）
- 任何"Agent 在思考..."的黑盒占位（要么真展示 CoT，要么不展示）
- 真接 LLM API（第一阶段全 mock，确保剧本时序可控）

---

## 3. ⭐ 复合剧本逐帧脚本（核心章节）

**剧本总长度**：90 秒（演示模式自动播放时）/ 2-3 分钟（手动模式）

**剧本主题**：8 点定时触发 → 扫单 → 安全层拦截关键件 → 多智能体协同确认齐套影响 → 采购员追问 → 反向调参重跑

**剧本前提**：10 条 mock 订单（见 §3.7），其中 PO-009 是关键炫点订单。

### 3.1 剧本步骤总览

| 步骤 | 时间 | 主要动作 | 炫点 |
|------|------|---------|------|
| Step 1 | 0-5s | 定时触发，进入扫描态 | — |
| Step 2 | 5-15s | 扫描动画 + 流式分析输出 | D3 扫描动画、D4 Token 计数 |
| Step 3 | 15-35s | 安全层拦截 PO-001 + 调用齐套预警 Skill | D2 思考链、D6 多智能体图 |
| Step 4 | 35-55s | 采购员追问 PO-005 的覆盖原因 | D4 模型路由可视化、PD-7 透明 |
| Step 5 | 55-80s | ⭐ 浮起迷你 Skill Builder 改参数 + 立刻重跑 | D7 反向呼应 |
| Step 6 | 80-90s | 剧本收尾 + 一键复盘高亮 | X4 一键复盘 |

### 3.2 Step 1：定时触发开场（0-5s）

**三栏状态切片**：

```
左栏（对话面板）           中栏（订单表）              右栏（决策面板）
─────────────────────     ─────────────────────       ─────────────────────
[顶部时钟] 08:00          10 条订单全部默认状态        "等待触发..."
[系统消息]                                            
⏰ 定时触发命中                                        [启动后] 
   Skill: 制造业采购                                  Trace #1 已写入:
   交期跟催 v1.0.0                                    剧本配置覆盖
                                                       scope=scenario
─────────────────────     ─────────────────────       ─────────────────────
```

**Step 1 内部动作（按时间顺序）**：

1. **t=0s**：左栏顶部出现系统消息"⏰ 08:00 定时触发"
2. **t=0.5s**：⭐ **剧本配置覆盖**——scenario-store 计算 `scenarioConfigOverride` 并应用到 effective config（详见 `mock_data_schema.md` §5）：
   - `filter.supplier.replyStatus`: `['notReplied']` → `['notReplied', 'repliedDelay']`
   - `filter.supplier.delayRateThreshold`: `0.3` → `0`
3. **t=0.5s（同时）**：写一条 `ConfigChangeTrace` 标记 `scope: 'scenario'`（详见 §10.1 + §10.2）
4. **t=1-4s**：界面进入扫描态，等待 Step 2 接管

**演示模式快进**：步骤 1 在演示模式下可加速到 0.5s 内跑完，不需要让评审者看时钟。

**讲述要点（PD-7 透明度的具体体现）**：

> 剧本配置覆盖不是"为了 demo 偷偷改配置"——是 **Agent 根据场景动态调整筛选规则** 的产品能力。这条覆盖动作在 Trace 里全程可见，演示完后可以点开 Debug & Eval Tab 给评审者看。**Skill Builder 的 default 配置不被污染**，普通 ISV 打开应用看到的仍然是"精准跟催未回复 + 高延期率供应商"，剧本场景只在 Agent Console 的 scenario-store 里 merge 这个 override。

**演示模式快进**：此步骤 0.5s 即可，不需要让评审者看时钟。

### 3.3 Step 2：扫描动画 + 流式分析（5-15s）

**中栏炫点（D3 扫描动画）**：

- 一道淡蓝色光带从订单表第 1 行扫到第 10 行（每行 0.3s，总 3s）
- 被命中的订单（满足筛选规则）变蓝色边框 + 行末出现 "命中" 标签
- 未命中的订单淡化（opacity 60%）
- 扫描完成后**命中订单自动置顶排序**（按风险等级降序）

**右栏炫点（D4 Token 计数 + 模型路由可视化）**：

- 顶部「意图分析」流式打字输出：
  - "全量扫描跟催场景"
  - "应用筛选: 到货前 7 天 + 未回复 + 供应商 A/B"
  - "命中: 6/10"
- Token 计数器从 0 跳到 245（每帧 +N 的滚动数字）
- 模型路由小图标：一个箭头从"用户输入"流向 DeepSeek-V3（小绿点闪烁表示"工作中"）

**左栏**：

- Agent 气泡（流式）："扫描完成。10 条订单中 6 条命中跟催规则，其中 4 条高风险。"
- 这条气泡末尾有「展开思考链」按钮（D2 炫点位）

### 3.4 Step 3：安全层拦截 + 多智能体协同（15-35s）⭐

**剧本主线**：PO-2025-001（关键件 + 影响 2 张在制工单）触发安全层 → Agent 自动调用「齐套预警 Skill」确认影响范围 → 子 Skill 返回结果。

**中栏**：

- PO-2025-001 行末橙色覆盖标签："⚠ 安全层覆盖：必须人工"
- PO-2025-001 行左侧 4px 状态条变橙色
- PO-2025-001 行最右出现「待人工」按钮（不可跳过，PD-8）

**右栏（决策面板更新）**：

| 字段 | 显示内容 |
|------|---------|
| 当前意图 | 高风险订单识别 → 触发安全层硬规则 |
| 引用 Skill 配置 | `安全层 / 关键件 → 必须人工` ← [跳回 Skill Builder] |
| 模型路由 | 风险判断 → GPT-4（小图标在"工作"） |
| Token 累计 | 245 → 482 |

**右栏底部出现多智能体协作图（D6 炫点）**：

```
┌──────────────────────────────────────────┐
│ 多智能体协作                              │
│                                          │
│    [采购跟催] ─────小球→ [齐套预警]       │
│         ↑                    │            │
│         └──────小球←────────┘            │
│                                          │
│ 齐套预警 Skill 返回：                     │
│ 因 PO-001 影响 WO-2025-0312 排产，        │
│ 齐套已断（缺料 2 项）                     │
└──────────────────────────────────────────┘
```

**左栏**：

- Agent 气泡（流式）："PO-2025-001 是关键件且影响 2 张在制工单，触发安全层。已联动齐套预警 Skill 确认：齐套已断，缺料 2 项。建议人工立即介入。"
- 这条气泡可展开「思考链」（D2）——内部 CoT 节选：
  ```
  1. 检测到关键件 = yes，安全层硬规则触发
  2. 检测到影响在制工单数 = 2，需要齐套影响评估
  3. 调用关联 Skill: completenessAlert（齐套预警）
  4. 子 Skill 返回缺料数 = 2，置信度 0.91
  5. 综合判断: 必须人工，建议优先级 P0
  ```

### 3.5 Step 4：采购员追问（35-55s）

**剧本主线**：用户对 PO-2025-005（关键件 + 已回复延期 1 天）的安全层覆盖提出疑问，Agent 解释规则优先级。这是剧本里**唯一一条"业务层规则真实会触发但被安全层覆盖"**的订单（详见 `mock_data_schema.md` §2.1 对照表），承担"规则优先级可视化"的核心演示职责。

**左栏**：

- 用户气泡（mock 输入，自动打字效果）："PO-005 怎么没自动同意？供应商都回复延期才 1 天了。"
- Agent 气泡（流式）："PO-2025-005 供应商已回复延期 1 天，单看延期天数原本满足业务层「延期 ≤ 2 天自动同意」（业务层延期阈值只看事实延期天数，不看供应商等级）。但物料 SMT-CTRL-V3-B11 是关键件，被安全层覆盖。规则优先级：安全 > 业务 > 效率。"

**中栏**：

- 鼠标自动 hover 到 PO-2025-005，行高亮
- 行末展开一个迷你气泡："业务层规则被安全层覆盖 ← 关键件硬规则"

**右栏（决策面板更新）**：

- 出现「规则优先级可视化」组件：
  ```
  🛡 安全层  > 📋 业务层  > ⚡ 效率层
  ✓ 关键件    ✗ 延期 ≤ 2 天   —
   （覆盖）     （被覆盖，划除线）
  ```
- Token 累计 482 → 689

### 3.6 Step 5：⭐ 反向跳回 Skill Builder 改参数（55-80s）

**剧本主线**：用户希望临时放宽业务层「延期 ≤ N 天自动同意」的 N 值，Agent 在面板内**原地浮起迷你 Skill Builder 卡片**，用户调整后剧本立刻按新规则重跑。

**关键交互（D7 炫点）**：

- 用户气泡（mock）："最近天气原因供应商普遍延期，把延期容忍能从 2 天调到 3 天吗？"
- Agent 回复："可以。这是业务层可配置项。我帮你打开配置卡片。"
- **此时屏幕中央浮起一个迷你 Skill Builder 卡片**（不切 Tab，原地编辑）：
  ```
  ┌──────────────────────────────────────────┐
  │ 业务层 · 延期自动同意                      │
  │                                          │
  │ 启用 [开]                                 │
  │ 延期天数 ≤ [Slider: 2 ── 3 ─── 7]         │
  │                                          │
  │ ℹ 调整后影响:                              │
  │   PO-2025-009 (延期 3 天) 将被纳入        │
  │   自动同意范围                            │
  │                                          │
  │ [取消]  [确认并立即生效]                  │
  └──────────────────────────────────────────┘
  ```
- 用户拖动 slider 从 2 到 3
- 卡片底部预览实时变化（"PO-2025-009 将被纳入..."）
- 用户点「确认并立即生效」
- 卡片关闭 → **剧本自动重跑最后扫描步骤**：
  - 中栏 PO-2025-009 状态从"待人工"变为"已自动派发"
  - 行末新增标签"已自动同意"（绿色）
  - 行末出现绿色 ✓ 动画
- 右栏决策面板新增条目："配置变更已应用 / PO-2025-009 已自动派发任务卡"

### 3.7 Step 6：剧本收尾 + 一键复盘（80-90s）

**左栏**：

- Agent 气泡："本次扫描完成：6 条命中、4 条已人工处理（安全层覆盖）、1 条业务层自动同意、1 条调参后自动同意（PO-009）。"
- "需要查看完整决策路径吗？" + 「查看复盘」按钮

**右下角**：

- ⭐ 「一键复盘」按钮高亮（X4 炫点）
- 点击后弹出**桑基图或时间线浓缩图**，展示整个 90 秒的决策路径：
  ```
  10 条订单
    ├─ 6 命中
    │   ├─ 4 安全层覆盖 → 人工 (PO-001/002/005/007)
    │   ├─ 1 业务层自动同意 → 任务卡 (PO-004)
    │   └─ 1 配置变更后自动同意 (PO-009)
    └─ 4 未命中 (PO-003 C 级 / PO-006 超时 / PO-008 完结 / PO-010 已确认)
  ```
- 复盘图底部有「跳转到 Debug & Eval」链接（自然过渡到 Tab 3）

### 3.8 Mock 订单数据（剧本前提）

10 条订单的样本组合（满足 CLAUDE.md §8.1 要求）。本表只是剧本视角的角色分配——**完整字段、规则纯函数、每条订单的预期状态矩阵见 [`docs/mock_data_schema.md`](./mock_data_schema.md)**。如本表与 `mock_data_schema.md` 冲突，以后者为准。

| ID | 命中？ | 类型 | 关键属性 | 剧本中的作用 |
|----|--------|------|---------|-------------|
| PO-2025-001 | ✓ | 命中-高风险 | 关键件 + 影响 2 张在制工单 + A 级 | Step 3 主角：安全层覆盖 + 触发 callSkill |
| PO-2025-002 | ✓ | 命中-高风险 | 单一来源 + 已二次跟催 + 影响 KA 客户 + A 级 | 安全层覆盖（陪衬） |
| PO-2025-003 | ✗ | 不命中 | C 级供应商（被供应商等级筛掉） | 演示供应商等级筛选有效 |
| PO-2025-004 | ✓ | 命中-业务层自动 | 已回复延期 2 天 + A 级 | 业务层自动同意范例（命中调参前的阈值） |
| PO-2025-005 | ✓ | 命中-高风险 | 关键件 + 已回复延期 1 天 + A 级 | Step 4 主角：业务层规则真实触发但被安全层覆盖 |
| PO-2025-006 | ✗ | 不命中 | dueInDays=14 超出 7 天阈值 | 演示时间窗筛选有效 |
| PO-2025-007 | ✓ | 命中-高风险 | 关键件 + 单一来源 + A 级 | 安全层覆盖（陪衬，双重硬规则） |
| PO-2025-008 | ✗ | 不命中 | 已完结 + B 级 | 演示完结状态筛选有效 |
| PO-2025-009 | ✓ | ⭐ 关键炫点 | 已回复延期 3 天 + B 级 | Step 5 主角：调参前待人工 → 调参后业务层自动同意 |
| PO-2025-010 | ✗ | 不命中 | 已回复确认 + A 级 | 演示回复状态筛选有效 |

**剧本所有数字的唯一来源**（与 `mock_data_schema.md` §4.1 一致）：

- 命中 6 / 未命中 4
- 高风险 4（PO-001/002/005/007，全部触发安全层）
- 业务层自动同意 1（PO-004，延期 2 ≤ 阈值 2）
- 调参后自动同意 1（PO-009，延期 3 ≤ 新阈值 3）
- 人工处理 4（=高风险数=安全层覆盖数）

> 注（4-C2 修正）：剧本运行所需的两处配置调整 **不动 default**，由 Agent Console 的 `scenario-store` 在 Step 1 启动时计算 `scenarioConfigOverride` 覆盖：
> 1. `filter.supplier.replyStatus` 覆盖为 `['notReplied', 'repliedDelay']`——让 PO-004/005/009 命中
> 2. `filter.supplier.delayRateThreshold` 覆盖为 `0`（关闭过滤）——让 PO-002/004/005/009 不被延期率筛掉
>
> 覆盖动作在 Step 1 写一条 `ConfigChangeTrace(scope='scenario')`，全程可见可追溯。详见 `mock_data_schema.md` §5。

### 3.9 演示讲点（剧本主旨）

> 这个剧本是有意设计的「**复合演示**」——一个 90 秒的故事里同时呈现：
>
> 1. **定时触发 + 自然语言追问 + 反向配置**——三种触发方式并存（呼应 PD-1）
> 2. **安全层硬规则真的拦住一条订单**——不是抽象规则表，是运行时真实约束（呼应 PD-3）
> 3. **多智能体协同（callSkill）的产品形态**——主 Skill 自动调用齐套预警 Skill，结果反馈回来（呼应 MACP 故事）
> 4. **「配置即生效」**——用户调一个参数，运行中的剧本立刻按新规则重跑（D7，最强炫点）
> 5. **决策透明**——每一步都在右栏决策面板有展开项，可追溯（PD-7）
>
> 这种"一镜到底"的复合剧本设计，比单点功能演示要难得多——它要求 Skill Builder、Agent Console、Debug & Eval 三个 Tab 的状态完全打通。

---

## 4. 左栏：对话面板规范

### 4.1 消息类型

| 类型 | 来源 | 样式 |
|------|------|------|
| 系统消息 | 定时触发、事件触发 | 居中、灰色、含图标（⏰/⚡） |
| Agent 消息 | 智能体输出 | 左对齐、蓝灰底气泡、可展开思考链 |
| 用户消息 | 采购员输入（mock） | 右对齐、白底气泡 |
| 引用消息 | Agent 调用其他 Skill | 嵌入子卡片，标题"调用 Skill: XXX" |

### 4.2 Agent 消息的"思考链"展开（D2 炫点）

每条 Agent 消息末尾有一个折叠按钮"展开思考链"：

```
┌─────────────────────────────────────┐
│ Agent: PO-2025-001 触发安全层...    │
│                                     │
│ ▼ 展开思考链（CoT）                  │
│ ┌─────────────────────────────────┐ │
│ │ 1. 检测关键件 = yes             │ │
│ │ 2. 检测影响在制工单 = 2 张      │ │
│ │ 3. 调用 completenessAlert       │ │
│ │ 4. 综合判断: 必须人工           │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

**实现细节**：CoT 内容预先 mock 在 `src/mocks/cot-traces.ts` 里，按 step 编号检索。

### 4.3 流式打字效果

所有 Agent 输出都用打字效果（30 字符/秒），不要 instant 出现。这是"AI 在思考"的视觉证据。

**演示模式优化**：演示模式下打字速度提速 3 倍（90 字符/秒），保证 90 秒总时长。

### 4.4 引用 Skill 的悬浮卡

Agent 消息里提到其他 Skill 时（如"齐套预警 Skill"），该词带下划线，hover 时浮出迷你 Skill 卡：

```
┌─────────────────────┐
│ 齐套预警 Skill v1.2 │
│ 适用: 装备制造       │
│ 月调用: 856 次       │
│ [查看详情]           │
└─────────────────────┘
```

### 4.5 演示讲点

> 对话面板的设计原则是**让对话有结构**。C 端聊天产品的气泡只承载文本，但 B 端 Agent 必须让评审者一眼看到："这条消息背后有意图、有引用、有思考链"。
>
> 思考链可展开是 PD-7「透明」的具体落点——不写"Agent 在思考..."这种黑盒占位文案。

---

## 5. 中栏：订单表规范

### 5.1 列定义

| 列名 | 字段 | 显示规则 |
|------|------|---------|
| 状态条 | （4px 左边框） | 蓝=命中 / 橙=安全层覆盖 / 灰=未命中 / 绿=已自动同意 |
| 订单号 | `id` | `PO-2025-XXX` |
| 物料 | `materialCode` + `materialName` | 编码 + 名称，编码用 monospace |
| 数量 / 金额 | `quantity` / `amount` | 数字右对齐，使用 tabular-nums |
| 供应商 | `supplierName` + `supplierTier` | 名称 + A/B/C 徽章 |
| 到货倒计时 | `dueInDays` | "N 天后" / "已逾期 N 天" |
| 回复状态 | `supplierReplyStatus` | 未回复=灰 / 延期=黄 / 确认=绿 |
| 风险标签 | 计算字段 | 关键件 / 单一来源 / 影响 KA 等多标签 |
| 处理状态 | 计算字段 | 待人工 / 已自动派发 / 待确认 |
| 操作 | — | 「待人工」按钮（PD-8 不可跳过） |

### 5.2 扫描动画规范（D3 炫点）

**触发时机**：剧本 Step 2 开始时 / 每次重跑时。

**动画细节**：

- 淡蓝色 1px 横线从表头扫到表尾，每行 0.3s 高亮（背景色 `rgba(14, 165, 233, 0.08)`）
- 命中的行最终保留蓝色边框 1px + 浅蓝底
- 未命中的行 opacity 降到 60%
- 扫描结束后 0.5s 内命中行自动置顶（用 CSS transition 平滑过渡）

**Fallback 兜底**：动画挂了的情况下，直接显示终态（命中变蓝、未命中淡化、命中置顶），不影响剧本继续。

### 5.3 行末"待人工"按钮（PD-8）

被安全层覆盖的订单：

- 行末按钮文案"待人工"，强调色为 accent
- 点击后展开一个内嵌侧栏（不弹模态），含三个按钮：
  - 「同意派发」（绿色）
  - 「改派人工」（accent 主色）
  - 「跳过本次」（灰色）
- 点击后 toast 提示"决策已记入 Memory"

### 5.4 演示讲点

> 订单表的扫描动画是"看得见的 AI 在思考"——比对话框里的"Agent 在思考..."黑盒文案有杀伤力 10 倍。当评审者看到 10 行从上往下被扫描、命中条目自动置顶，他会立刻 get 到"这个产品理解扫单的实质"。
>
> 行末「待人工」按钮永远不可跳过——这是 PD-8 的硬约束，不允许为了演示流畅省略这一步。

---

## 6. 右栏：决策面板规范

### 6.1 字段表

决策面板共 6 个 section，默认展开前 3 个，后 3 个折叠：

| Section | 内容 | 默认 | 关联 PD |
|---------|------|------|--------|
| 当前意图 | 一句话描述当前 Agent 在做什么 | 展开 | PD-7 |
| 引用 Skill 配置 | 列出当前决策依赖的 Skill 配置项 + 跳回链接 | 展开 | 系统级一致性 |
| Memory 摘要 | 过往 N 条相关决策（mock，固定 3 条） | 展开 | PD-7 |
| 模型路由 | 当前任务用的模型 + 小图标 + 状态 | 折叠 | 模块六呼应 |
| Token / 成本 | 累计 Token / 累计成本 / 平均延迟 | 折叠 | 平台 PM 视角 |
| 多智能体协作 | 子 Skill 调用图（D6） | 折叠（剧本触发时自动展开） | MACP 故事 |

### 6.2 "引用 Skill 配置" 跳回链接（D7 入口之一）

每条引用项后挂一个跳回链接（icon: ↗）：

```
┌─────────────────────────────────────┐
│ 引用 Skill 配置                      │
│                                     │
│ • 安全层 / 关键件 → 必须人工        │
│   [↗ 在 Skill Builder 查看]         │
│                                     │
│ • 业务层 / 延期 ≤ 2 天自动同意      │
│   [↗ 在 Skill Builder 查看]         │
│   [⚙ 临时调整]  ← D7 浮起迷你卡入口 │
└─────────────────────────────────────┘
```

- 点 `[↗]` 切到 Skill Builder Tab，并高亮对应配置项
- 点 `[⚙]` **原地浮起迷你配置卡**（不切 Tab，见 §7）

### 6.3 模型路由可视化（D4 炫点）

```
┌─────────────────────────────────────┐
│ 模型路由                             │
│                                     │
│ 当前任务: 风险判断                   │
│                                     │
│ [用户输入] ──→ [GPT-4 🟢 工作中]    │
│                                     │
│ Token: 245 → 482 (+237)              │
│ 延迟: 1.2s                           │
└─────────────────────────────────────┘
```

模型名旁的小绿点闪烁表示"工作中"，工作完成后变成稳定的绿色 ✓。

### 6.4 多智能体协作图（D6 炫点）

详见 §3.4 中已描述的 ASCII 草图。**实现要点**：

- 用 SVG 绘制，不引入 d3
- 主 Skill 和子 Skill 各画一个圆圈（直径 36px）
- 调用时一个小球（直径 8px）从主圈飞到子圈（500ms 动画）
- 子 Skill 返回时小球从子圈飞回主圈
- 圈下方显示 Skill 名称 + 状态文字

**Fallback 兜底**：动画挂了直接显示终态（两个圈 + 静态连线 + 子 Skill 返回结果文本）。

### 6.5 Memory 摘要（PD-7 落点）

固定 mock 3 条过往决策：

```
┌─────────────────────────────────────┐
│ Memory（过往 3 条相关决策）          │
│                                     │
│ • 5 月 8 日 关键件订单 PO-014       │
│   决策: 人工立即介入                │
│ • 5 月 6 日 单一来源订单 PO-009     │
│   决策: 升级到采购主管               │
│ • 5 月 4 日 KA 客户订单 PO-002      │
│   决策: 人工 + 通知销售             │
└─────────────────────────────────────┘
```

**作用**：演示"Agent 不是无记忆的", 配合 PD-8 的"决策已记入 Memory" toast。

### 6.6 演示讲点

> 决策面板是 PD-7「透明度」的核心展示位。我设计了 6 个 section，刻意不让它"一眼看完"——B 端 PM 知道，**信息密度是 B 端工具的美学**，不是 C 端的"简洁"。
>
> Memory 摘要是埋的钩子——评审者如果问"Agent 怎么从历史决策学习", 我可以直接指着这 3 条说"v1 是 mock，v2 我会接平台的决策日志库, 这是 PD-7 的延伸"。

---

## 7. ⭐ 跨栏炫点：浮起迷你 Skill Builder（D7）

### 7.1 触发方式

三个入口：

1. **用户主动**：右栏决策面板某条规则后的 `[⚙ 临时调整]` 按钮
2. **Agent 引导**：剧本 Step 5 里，用户用自然语言提出调参需求，Agent 自动浮起卡片
3. **LLM 高风险 action 强制 UI 二次确认**（4-C1 修复）：当真实 LLM 模式（`?real-llm=<session-token>`）下 L4 LLM 返回 `reject(reason='confirm_required_via_ui', proposedAction=...)`——表示用户用自然语言提出了**高风险变更意图**（关闭 KA 必须人工 / 启用 A 级自动同意 / 调高金额上限），LLM 不能直接生效，必须弹此卡片**预填 `proposedAction.value`** 等用户点确认。详见 `demo_scripts.md` §2.2 + §2.6。

### 7.2 卡片形态

- **位置**：屏幕中央，半透明遮罩（rgba(15, 23, 42, 0.4)）
- **尺寸**：480px × 自适应高度
- **不切 Tab**：必须留在 Agent Console，让用户视觉上感受到"我没离开当前剧本"

### 7.3 卡片内容

只显示当前剧本相关的 1-2 个配置项，**不展示完整 Skill Builder**（避免认知负担）：

```
┌──────────────────────────────────────┐
│ 临时调整：业务层 / 延期自动同意       │
│                                      │
│ 启用            [开]                  │
│ 延期天数 ≤      [Slider: 2 → 3]      │
│                                      │
│ ⚠ 调整后影响（实时预览）:             │
│ • PO-2025-009（延期 3 天）将被纳入   │
│   自动同意                            │
│                                      │
│ ☑ 仅本次剧本生效                     │
│ ☐ 永久保存到 Skill 配置               │
│                                      │
│ [取消]  [确认并立即生效]             │
└──────────────────────────────────────┘
```

**关键 UX**：

- "调整后影响"实时计算（拖 slider 时实时刷新）
- 默认勾选"仅本次剧本生效"，避免污染 Skill Builder 的真实配置
- 用户也可勾"永久保存"，此时 Skill Builder 里的对应配置会同步更新

**⚠️ RBAC 边界（7-C1 + 生产实现要求）**：

Agent Console 在 demo 阶段是 ISV 视角的运行时观察 + 调参界面，剧本里"采购员追问"只是 mock 输入。生产实现里 Agent Console 会被采购员（终端用户）直接使用——**采购员视角不应有权限永久修改 Skill 配置**，否则会跨越 ISV 与采购员的角色边界。

生产实现必须做的事：
- D7 卡的"永久保存"checkbox **仅 ISV/admin 角色可见可勾选**——采购员视角下整条勾选项隐藏或禁用
- 所有 D7 持久化操作必须通过 worker 端 RBAC 校验，trace 写入 `actorId`/`tenantId`/`authorizationResult`（接口已在 §10.1 TraceBase 预留）
- "仅本次剧本生效"对所有角色开放（运行时改 zustand store 不跨权限边界）

Phase 1 demo 阶段不实现真实 RBAC——所有用户视为 ISV，trace 里 actorId 填 `'demo-isv-banner'`、authorizationResult 填 `'granted-mock'`。**这是有意的简化**，目的是聚焦核心剧情；生产实现按上述要求加 RBAC。

**演示讲述化为加分项**：

> 你看 Trace 里我每条都留了 actorId / tenantId / authorizationResult 三个字段。在 demo 里都是 mock 值，但 schema 已经为生产 RBAC 留好接口——这是平台 PM 视角的做法："demo 可以省略实现细节，但接口必须为生产留好钩子"。等 demo 升级到生产 SaaS，加 SSO 后这些字段直接落地。

### 7.4 确认后的剧本重跑

用户点「确认并立即生效」后：

1. 卡片关闭（300ms 淡出）
2. 中栏受影响的订单状态立刻更新（PO-2025-009 行的状态条从橙变绿）
3. 行末出现绿色 ✓ 弹跳动画
4. 右栏决策面板新增一条："配置变更已应用 / PO-2025-009 已自动派发任务卡"
5. Token 计数器累加（重跑消耗的 Token）

### 7.5 演示讲点

> D7 是这个 Demo 的**最高潮**——一句话总结就是"**配置即生效**"。
>
> 真实平台里，ISV 调一个参数，可能要重启服务、重跑 ETL、刷缓存，反馈时间是分钟级。我在产品形态上做了一个判断：**让"调参→看效果"的反馈延迟尽量接近 0**。这不是工程能力问题，是 ISV 工作流的核心痛点——他们调一个参数后最焦虑的是"我刚才那一下到底起没起作用"。
>
> 浮起迷你卡而不是切 Tab，是为了**视觉上不打断剧本上下文**——这是 B 端工具的核心交互原则之一。

---

## 8. 人工确认交互（PD-8）

### 8.1 触发场景

- 安全层覆盖的订单 → 行末"待人工"按钮
- 业务层配置为"必须人工"的订单 → 同上
- 用户主动改派的订单 → 同上

### 8.2 交互形态

**绝对不用**居中模态弹窗——打断剧本节奏。

**采用**行末展开的内嵌侧栏（slide-in 200ms）：

```
┌───────────────────────────────────────────────────┐
│ PO-2025-001 | ... | ... | 关键件 | 待人工 [展开▼] │
├───────────────────────────────────────────────────┤
│  人工决策面板                                       │
│                                                    │
│  当前情况:                                          │
│  • 关键件 + 影响 2 张在制工单                       │
│  • 齐套预警: 缺料 2 项                              │
│                                                    │
│  Memory 提示:                                       │
│  • 上次类似订单（PO-014）你选择了"立即介入"         │
│                                                    │
│  [同意派发]  [改派人工]  [跳过本次]                │
└───────────────────────────────────────────────────┘
```

### 8.3 决策后反馈

- 点击任一按钮后 200ms 内显示 toast："决策已记入 Memory"
- 行末按钮文案变为"已处理"（灰色，不可再点）
- 右栏 Memory 摘要新增一条

### 8.4 演示讲点

> 人工确认是 PD-8 的硬约束，**不能为了演示流畅省略**。我把它做成内嵌侧栏而不是模态弹窗，是因为模态会打断剧本节奏——但完全省掉确认按钮就违反产品判断了。
>
> "决策已记入 Memory"的 toast 提示是埋的钩子——它呼应 PD-7 透明度，也为 v2 的"基于历史决策的自适应路由"留了产品入口。

---

## 9. ⭐ 全局炫点：演示模式（X1）与一键复盘（X4）

### 9.1 演示模式（X1）

**入口**：顶部全局区右侧的「▶ 演示模式」按钮。

**行为**：点击后整个 90 秒剧本自动播放，期间：

- 用户输入用打字效果自动模拟（不需要手动输入）
- 各栏的动画按预定时序自动触发
- 顶部出现进度条（蓝色光带）
- 任何时刻可点「暂停」/「重置」

**实现细节**：用一个状态机驱动剧本步骤切换，每一步对应一个 `setTimeout`/`setInterval` 链。

#### 9.1.1 ⭐ 人工确认在演示模式下的处理（关键）

PD-8 要求"行末「待人工」按钮不可跳过"，与 X1 "90 秒自动播完" 看似矛盾。**解决方案：mock 鼠标光标自动点击**。

**机制**：

- 屏幕上叠加一个**伪鼠标光标**（SVG 小箭头 + 轻微阴影，区别于真实系统光标）
- 剧本预定义的 `humanDecisionScript`：每条命中订单 + 预设决策按钮的映射
- 到剧本对应步骤时，伪光标**可见地滑动**到目标按钮位置（300ms 动画），停 200ms，然后触发按钮真实点击事件
- 视觉效果："观众看到光标移过去，按钮被点了"——演示了 PD-8 的存在，没有绕过 UI

**`humanDecisionScript` 内容**（剧本预设）：

```typescript
const humanDecisionScript = [
  { orderId: 'PO-2025-001', decision: 'dispatchToManager', delayMs: 0 },     // Step 3 内
  { orderId: 'PO-2025-002', decision: 'dispatchToManager', delayMs: 800 },   // Step 3 内陆续
  { orderId: 'PO-2025-005', decision: 'dispatchToManager', delayMs: 1600 },  // Step 4 处理
  { orderId: 'PO-2025-007', decision: 'dispatchToManager', delayMs: 2400 },  // Step 4 处理
] as const;
```

**手动模式下的行为**：

- 手动模式时光标不出现，等待用户真实点击
- 若手动模式跑到 Step 6 时仍有未处理的人工决策，复盘图显示"⚠️ X 条订单未做人工决策"
- 这避免"演示流畅性" 凌驾于产品判断

**演示讲点**：

> 这个处理是产品判断的延伸——演示模式下我用 mock 光标演示了"人工确认动作"，而不是绕过它。视觉上观众能清晰看到"这是一个不可省略的步骤"，但不影响 90 秒剧本流畅性。如果评审者追问"演示模式是不是作弊"——我可以现场切到手动模式，停在某个待人工订单前，亲自点击。

**作用**：

1. 演示现场"我点一下，你看完"——彻底消除手抖/卡壳风险
2. 让评审者可以一边看一边问，不用我盯着屏幕操作
3. 通过可见的伪光标演示 PD-8 的"人工确认不可跳过"——产品判断不被自动化压制

### 9.2 一键复盘（X4）

**入口**：剧本结束后右下角的「一键复盘」按钮高亮。

**形态**：点击后弹出一个**全屏 Modal**（这次允许用 Modal，因为剧本已结束），内含：

```
┌─────────────────────────────────────────────────┐
│ 本次决策路径复盘                                  │
│                                                  │
│   10 条订单                                       │
│      ├─ 6 命中筛选                                │
│      │   ├─ 4 安全层覆盖 → 人工                  │
│      │   │   ├─ PO-001 已派发主管                 │
│      │   │   ├─ PO-002 已派发主管                 │
│      │   │   ├─ PO-005 已派发主管                 │
│      │   │   └─ PO-007 已派发主管                 │
│      │   ├─ 1 业务层自动同意 → 任务卡             │
│      │   │   └─ PO-004 已自动同意                 │
│      │   └─ 1 配置变更后自动同意                  │
│      │       └─ PO-009 已自动同意（D7 触发）     │
│      └─ 4 未命中筛选                              │
│          ├─ PO-003 (C 级被筛掉)                  │
│          ├─ PO-006 (超出时间窗)                  │
│          ├─ PO-008 (已完结)                      │
│          └─ PO-010 (已回复确认)                  │
│                                                  │
│   累计: Token 1.2k / 成本 ¥0.08 / 平均延迟 0.9s   │
│                                                  │
│   [跳转到 Debug & Eval 查看 Trace]                │
└─────────────────────────────────────────────────┘
```

**作用**：

1. 让 3 个 Tab 不再是孤岛——复盘按钮**自然过渡到 Debug & Eval**
2. 平台 PM 的"决策可追溯"视角——一次扫描 90 秒内做的所有决策都能复盘
3. 累计 Token / 成本 / 延迟 数据呼应 §6.1 的运营观

### 9.3 演示讲点

> 演示模式（X1）是演示稳定性兜底——动画时序如果手动操作有 bug，自动播放至少能保证主流程跑通。
>
> 一键复盘（X4）是产品收口——它让评审者从 Agent Console 自然走向 Debug & Eval Tab，避免"三个 Tab 各讲一遍"的割裂感。

---

## 10. 数据流出 → Debug & Eval

剧本运行过程中产生的所有事件写入 **`useScenarioStore.traces`**，供 Debug & Eval Tab 直接读取。

> ⚠️ **数据源修订**（2026-05-15）：spec v1.0 设计为写入独立的 `evalStore`，但 Phase 2 实装时为简化跨 store 通信，trace 直接落到 `scenario-store.traces`。Debug & Eval Tab（`docs/debug_eval_spec.md` v1.1）已对齐此设计。Phase 4 之后接入真 LLM / 多场景对比时再迁移到独立 `evalStore`。

### 10.1 Trace 日志结构（P0-6 类型契约）

Trace 用 **discriminated union** 而不是 `input/output: unknown`，避免实现时拍脑袋猜字段：

```typescript
type TraceLog =
  | IntentTrace
  | FilterTrace
  | RiskTrace
  | CallSkillTrace
  | HumanDecisionTrace
  | ConfigChangeTrace;

interface TraceBase {
  id: string;              // trace-001 / trace-002 ...
  step: number;            // 1-6
  timestamp: number;       // ms since 剧本开始
  modelUsed?: ModelId;
  tokenUsed?: number;
  latencyMs?: number;

  /**
   * RBAC 接口预留（7-C1）——Phase 1 全部填 mock 值：
   *   actorId: 'demo-isv-banner'
   *   tenantId: 'demo-tenant-001'
   *   authorizationResult: 'granted-mock'
   * Phase 2+ 接 SSO 后填真实身份。生产实现里所有"配置变更"和"D7 persist"操作
   * 必须有 authorizationResult='granted' 才能落地，否则在 worker 层拒绝。
   */
  actorId?: string;
  tenantId?: string;
  authorizationResult?: 'granted' | 'denied' | 'granted-mock';
}

interface IntentTrace extends TraceBase {
  type: 'intent';
  input: { triggerSource: 'schedule' | 'manual' | 'event' | 'nl'; payload?: string };
  output: { intent: string; confidence: number };
}

interface FilterTrace extends TraceBase {
  type: 'filter';
  input: { orderId: string; filter: FilterConfig };
  output: { hit: boolean; failedRules?: string[] };  // 命中 / 被哪条筛选规则排除
}

interface RiskTrace extends TraceBase {
  type: 'risk';
  input: { orderId: string };
  output: {
    riskLevel: 'high' | 'medium' | 'low';
    safetyBlocked: boolean;
    autoApproved: boolean;
    ruleApplied: string[];  // 'safety.critical' / 'business.autoApproveIfDelayLE' 等
  };
}

interface CallSkillTrace extends TraceBase {
  type: 'call-skill';
  input: CompletenessAlertRequest;
  output: CompletenessAlertResponse | CallSkillError;
}

interface HumanDecisionTrace extends TraceBase {
  type: 'human-decision';
  input: { orderId: string; promptedReason: string };
  output: { decision: 'dispatchToManager' | 'reassignManual' | 'skip'; clickedBy: 'user' | 'mockCursor' };
}

interface ConfigChangeTrace extends TraceBase {
  type: 'config-change';
  input: { path: string; oldValue: unknown; newValue: unknown };
  output: {
    /**
     * scope 三种值的含义：
     * - 'scenario': 剧本启动时 scenario-store 计算的初始覆盖，整个剧本生命周期有效（4-C2）
     * - 'thisRunOnly': 用户/LLM 在剧本进行中触发的临时变更，仅影响本次剧本剩余步骤
     * - 'persist': 用户在 D7 卡片勾选"永久保存"后，写入 defaultSkillConfig 持久化
     */
    scope: 'scenario' | 'thisRunOnly' | 'persist';
    affectedOrderIds: string[];
  };
}
```

### 10.2 子 Skill 调用契约（CompletenessAlert）

PD-9 的"调用其他 Skill"在剧本里的具体形态。即使 Phase 1/2 是 mock 实现，schema 也必须固定：

```typescript
interface CompletenessAlertRequest {
  callerSkillId: 'purchaseFollowUp';
  targetOrderId: string;
  affectedWorkOrderIds: string[];
  requestedAt: number;  // ms timestamp
  /** 调用方期望的最大耗时，超时即视为失败 */
  timeoutMs: number;    // 默认 5000
}

interface CompletenessAlertResponse {
  status: 'ok';
  shortageCount: number;            // 缺料项数
  affectedWorkOrderIds: string[];   // 实际受影响的工单
  suggestion: 'humanIntervene' | 'rescheduleMRP' | 'proceedWithRisk';
  confidence: number;               // 0-1
}

interface CallSkillError {
  status: 'timeout' | 'unavailable' | 'lowConfidence';
  /** 调用失败时主 Skill 的兜底处理 */
  fallback: 'humanIntervene' | 'continueWithoutChildResult';
  errorMessage: string;
}
```

**失败处理约定**：

- `status: 'timeout'`（5s 内无响应）→ 主 Skill 默认 fallback 为 `humanIntervene`，UI 显示"齐套预警调用超时，已升级人工"
- `status: 'lowConfidence'`（confidence < 0.5）→ 同上
- `status: 'unavailable'`（子 Skill 未发布或被禁用）→ 主 Skill 继续执行，但 Trace 标记 `callSkill` 跳过

**剧本固定 mock 响应**（演示用，写在 `src/mocks/cot-traces.ts`）：

```typescript
const MOCK_COMPLETENESS_ALERT_RESPONSE: CompletenessAlertResponse = {
  status: 'ok',
  shortageCount: 2,
  affectedWorkOrderIds: ['WO-2025-0312', 'WO-2025-0315'],
  suggestion: 'humanIntervene',
  confidence: 0.91,
};
```

### 10.3 写入时机

- Step 1 触发时写一条 `IntentTrace`
- **Step 1 启动剧本时**写一条 `ConfigChangeTrace(scope='scenario')`（4-C2 修复，记录 scenarioConfigOverride）
- Step 2 扫描时写 10 条 `FilterTrace`（每个订单一条，含命中或被哪条规则筛掉）
- Step 3 对每条命中订单写 `RiskTrace`（含 safetyBlocked / autoApproved 决策）
- Step 3 调用子 Skill 写 `CallSkillTrace`（含完整 request/response，失败时写 error）
- Step 5 用户/LLM 调参写 **一条** `ConfigChangeTrace`（含 path、旧值、新值、影响的订单 ID）；`scope` 字段二选一：D7 卡默认勾"仅本次剧本生效" → `scope='thisRunOnly'`，用户改勾"永久保存到 Skill 配置" → `scope='persist'`（同时实装代码会同步 update `useSkillStore.config`）。**不是写两条**
- 每次人工确认（伪光标或真实点击）写 `HumanDecisionTrace`（`clickedBy` 字段区分来源）

### 10.4 演示讲点

> 这一节的核心产品判断：**运行时的每一步都必须产生 Trace**。这不是"为了 Debug Tab 好做"的工程便利，是平台 PM 视角的硬要求——**没有 Trace 就没有可解释性，没有可解释性就没有企业级 Agent**。

---

## 11. 给 Claude Code 的实现指引

### 11.1 状态机驱动剧本

剧本步骤用一个状态机管理，建议放在 `src/stores/scenario-store.ts`：

```typescript
type ScenarioStep = 'idle' | 'trigger' | 'scanning' | 'safety-block'
                  | 'user-question' | 'config-adjust' | 'rerun' | 'done';

interface ScenarioState {
  currentStep: ScenarioStep;
  isAutoPlaying: boolean;     // 演示模式开关
  playbackSpeed: 1 | 2 | 3;   // 1x / 2x / 3x
  hitOrders: string[];         // 命中订单 ID
  blockedOrders: string[];     // 安全层覆盖的订单 ID
  autoApprovedOrders: string[];
  traces: TraceLog[];

  /**
   * 剧本级配置覆盖（4-C2）
   * 启动剧本时计算一次，运行期间只读。
   * 剧本期间所有规则判断用 effectiveConfig = deepMerge(defaultSkillConfig, scenarioConfigOverride)。
   * 详见 mock_data_schema.md §5。
   */
  scenarioConfigOverride: {
    filter: {
      supplier: {
        replyStatus: ['notReplied', 'repliedDelay'];
        delayRateThreshold: 0;
      };
    };
  };
}
```

#### 11.1.1 状态机产品级行为契约（P0-5）

完整的状态转移表交给 Claude Code 实现时自决，但以下 **4 条产品级行为** 是必须锁定的，不允许工程偷工：

| # | 行为 | 强约束 |
|---|------|--------|
| **B1** | **Pause 后 timer 可恢复**（不重新跑当前步） | 暂停时立刻保存当前步内的相对进度（如扫描已扫到第 5 行 / 流式打字已输出 X 字符）；resume 时从该相对进度续跑。**严禁**简单重启当前步。 |
| **B2** | **Reset 把所有 PO 状态回到 idle**，并清空 traces；Skill 配置临时变更（§7.3 "仅本次剧本生效"）也回滚 | reset 行为对用户必须是"完全清盘"的可信承诺。如果有任何状态残留，下次跑会出现"幽灵覆盖"。 |
| **B3** | **重跑只重置最后一次扫描结果**，不清空 traces | Step 5 调参后的自动重跑（§3.6）只回滚 PO 状态和重新跑 Step 2-3，**保留前面的 traces**——这是 Trace "可追溯" 的硬要求，Debug 时能看到"调参前后"的对比。 |
| **B4** | **演示模式异常时 fallback 到手动模式** | timer 异常、伪光标失败、LLM 调用超时 等任何运行时错误 → 切到 `ScenarioStep` 的当前步 + `isAutoPlaying=false`，等待用户手动推进。**严禁**整个 demo 卡死。 |

**完整状态转移表（事件、guard、side effects、idempotency）不在 spec 范围内**——这是 Claude Code 工程实现时的细节决定，但任何实现都必须满足上述 4 条 B1-B4 行为。**验证方式：人工走查 §13 验收清单**（与 CLAUDE.md §5.4 + `docs/debug_eval_spec.md` §2 一致，**不做任何形式的单元测试**，包括"契约护栏"。早期 spec v1.0 曾建议写 4 个最小单测，已废弃）。

### 11.2 动画时序常量

集中放在 `src/lib/scenario-timings.ts`：

```typescript
export const TIMINGS = {
  scanRowDelay: 300,        // 每行扫描 300ms
  typingSpeed: 30,          // 30 字符/秒
  typingSpeedFast: 90,      // 演示模式提速到 90 字符/秒
  cardFadeOut: 300,         // 迷你卡片淡出
  callSkillBall: 500,       // 多智能体小球飞行
  totalDuration: 90_000,    // 总时长 90 秒
} as const;
```

### 11.3 Mock CoT 与 Mock 对话

预生成放在 `src/mocks/`：

- `cot-traces.ts`：每步的思考链文本（按 step 编号）
- `conversation-scripts.ts`：用户问句和 Agent 回复（按 step 编号）
- `purchase-orders.ts`：扩到 10 条（详见 `docs/mock_data_schema.md`）

### 11.4 Fallback 兜底策略 ⭐

**炫技动画必须有静态 fallback**——动画 bug 时 demo 不能整个崩。

| 炫点 | 动画失败时的兜底 |
|------|----------------|
| D2 思考链 | 直接显示 CoT 文本（不流式打字） |
| D3 扫描动画 | 直接显示终态（命中变蓝、置顶） |
| D4 Token 计数 | 直接显示终值（不滚动） |
| D6 多智能体图 | 显示静态图（两个圈 + 静态连线） |
| D7 浮起迷你卡 | 改用普通 Modal |
| X1 演示模式 | 退化为手动模式（用户点按钮推进每一步） |
| X4 一键复盘 | 显示文本版的路径树（不画桑基图） |

**实现方式**：用一个全局 `prefersReducedMotion` 或 `fallbackMode` flag 在 `scenario-store` 里，开发模式默认 false，URL 加 `?fallback=true` 时强制启用。

**注**：上表 fallback 针对**动画失败**。真实 LLM 模式（`?real-llm=<session-token>`）相关的 fallback——session token 过期、单日 token 配额触发、Zod 校验失败——走的是**另一条降级路径**（LLM → mock），由 worker 端 503/401/502 触发，前端自动 fallback 到 mock 路径。详见 `demo_scripts.md` §2.3 第 4 条 + §3.3 演示失败兜底表。

### 11.5 不要做的事

- 不要把 mock 数据散落在组件里（统一在 `src/mocks/`）
- 不要在剧本进行中允许用户修改 Skill Builder 的真实配置（除非 §7.3 勾选了"永久保存"）

### 11.6 关于真实 LLM 接入（可选增强）

**默认实现**：Agent 输出、CoT、Token 计数全部 mock，剧本稳定性优先。

**可选增强**：Phase 2 之后可选择性接入真 LLM 到 4 个关键决策点（Step 3 风险综合判断 + Step 3 callSkill 编排 + Step 4 自然语言追问 + Step 5 自然语言改参意图解析），让"Agent 推理"在演示现场可验证。**完整方案、prompt template、成本估算、CF Workers 部署架构见 [`docs/demo_scripts.md`](./demo_scripts.md) §2**。

这是 P1 增强项，不影响主剧本实现。两种模式（全 mock / 部分真 LLM）通过 URL 参数 `?real-llm=<simple-token>` 切换——**token 是 wrangler secret `REAL_LLM_GATE_TOKEN` 的 random string，Worker 端简单 equals 校验**。boolean 形式（如 `?real-llm=true`）**一律视为非法**，前端和 Worker 双重拒绝。详细工程细节（Origin 精确校验、endpoint 级请求体长度限制、max_tokens 约束、任何失败 fallback mock、Anthropic 平台月度 budget cap 作为成本最后防线）见 `demo_scripts.md` §2.3。

---

## 12. 实现优先级

### 12.1 P0（必做，第 4 天完成）

- 三栏布局骨架（替换当前的 PlaceholderColumn）
- 10 条 mock 订单 + 订单表（无动画版）
- 对话面板（消息类型 + 流式打字，无思考链）
- 决策面板基础版（前 3 个 section）
- 复合剧本的 Step 1-3（手动推进）
- 行末「待人工」按钮 + 内嵌侧栏（PD-8 不能砍）

### 12.2 P1（必做，第 5 天完成）

- D3 扫描动画
- D6 多智能体协作图
- 复合剧本的 Step 4-6
- 决策面板后 3 个 section（含 D4 模型路由可视化、Token 计数）
- D2 思考链展开
- **D7 浮起迷你 Skill Builder + 立刻重跑**（最强炫点，从 P2 升 P1）
- X1 演示模式（含伪光标）
- X4 一键复盘

### 12.3 P2（如有时间，第 6 天补）

- 引用 Skill 悬浮卡（§4.4）
- Memory 摘要的"已记入"toast 动画
- 可选真实 LLM 接入（详见 `demo_scripts.md` §2）

### 12.4 取舍说明

如果第 4-5 天工期紧张，**优先砍 X4（一键复盘）的桑基图**——退化为文本版路径树即可，剧本仍能讲通。
**绝对不要砍**：D7、PD-8 人工确认、伪光标方案——这三个是产品判断的硬约束，不是炫点。

---

## 13. 验收清单

完成后，必须能演示以下场景（演示现场用）：

- [ ] 点「演示模式」按钮，整个 90 秒剧本自动跑完（X1）
- [ ] 中栏扫描动画清晰可见，命中订单自动置顶（D3）
- [ ] PO-2025-001 行出现橙色「安全层覆盖」标签，行末「待人工」按钮可点（PD-8）
- [ ] 右栏决策面板出现多智能体协作图，主→子 Skill 小球动画完整（D6）
- [ ] 用户追问 PO-2025-005 时，决策面板展开"规则优先级覆盖图"（PD-3 落点）
- [ ] 浮起迷你 Skill Builder 卡片，用户拖 Slider 后 PO-2025-009 状态立刻变绿（D7）
- [ ] Token 计数器全程累加，最终值约 1.2k（D4）
- [ ] 剧本结束后「一键复盘」按钮高亮，点击后能跳转到 Debug & Eval（X4）
- [ ] 整个流程 90 秒内跑完

如果这 9 步能完整跑通，Agent Console 的项目演示就成立了。

---

**文档版本**：v1.1（吸收 Codex 对抗式审查的 P0-1~P0-6 + P1-7 + P1-8 修复）
**用途**：Claude Code 实现 Agent Console 的精确输入
**关联文档**：
- `docs/mock_data_schema.md` —— 10 条订单字段、规则纯函数、预期状态矩阵（剧本数字的唯一来源）
- `docs/demo_scripts.md` —— FAQ 备弹 + 可选真实 LLM 增强方案 + 项目演示节奏控制
