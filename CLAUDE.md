# CLAUDE.md — 鼎捷面试 Demo 项目上下文

> 这份文件是 Claude Code 的项目持久上下文。每次会话开始时自动加载，作为所有产品和工程决策的依据。
> Maintainer：Banner（候选人）
> 用途：鼎捷数智 B 端 Agent 产品经理岗位面试 Demo

---

## 0. 会话启动协议（每次会话第一步）

**Claude Code 在执行任何代码任务前，必须先做以下三件事**：

1. 读取本 `CLAUDE.md` 全文，并在回复中显式确认你读到了哪些章节
2. 读取 `docs/` 目录下与当前任务相关的所有 spec 文件
3. 如果当前任务涉及的 spec 文件**不存在**或**不完整**，**立即停下来询问 Banner**，不要根据项目名脑补需求

**违反这个协议会浪费 Banner 的时间，且产出的代码很可能要返工。**

会话开始时请用以下格式回复：

```
已加载：
✓ CLAUDE.md
✓ docs/skill_builder_spec.md
✗ docs/debug_eval_spec.md（不存在，需要时会停下来询问）

当前任务理解：[一句话描述]
计划：[3-5 个步骤]
等待 Banner 确认后开始执行。
```

---

## 1. 项目身份

### 1.1 这是什么

一个面向鼎捷数智 B 端 Agent 产品经理岗位的**面试演示 Demo**。

模拟"鼎捷 Indepth AI 智能体平台"上的一个**采购协同 Agent 编排工作台**——展示如何用低代码搭出可调试、可复用、可监控的制造业采购跟催 Agent。

### 1.2 不是什么

- **不是真正的商业产品**——是为单次面试演示准备的产品原型
- **不是 SaaS / 多租户系统**——所有数据 mock 在前端，不写后端
- **不是 Dify / Coze 复刻**——明确避开拖拽画布形态，用结构化配置面板差异化
- **不是给终端用户用的**——目标用户是 ISV 开发者和业务顾问，不是采购员

### 1.3 给谁看

第一观众：鼎捷面试官（资深产品总监或架构师）。

他们看 Demo 时会关注：

- 产品判断的深度和精确度
- Agent / Skill / Tool / Workflow 边界划分是否站得住
- 是否真正理解"平台 PM"和"应用 PM"的视角差
- 工程实现的完整度（能否本地跑、能否部署）

---

## 2. 技术栈（不可协商）

| 类别 | 选型 | 备注 |
|------|------|------|
| 构建工具 | Vite | 不要换成 Next.js / CRA |
| 框架 | React 18 | 函数组件 + Hooks |
| 语言 | TypeScript | `strict: true`，不允许 `any` 兜底 |
| 样式 | Tailwind CSS | 不要写独立 CSS 文件，不要 styled-components |
| 组件库 | shadcn/ui | 优先用现成组件，不要自己造轮子 |
| 路由 | TanStack Router | 不要换成 React Router |
| 状态管理 | zustand | 不要用 Redux / Context API 跨层传递 |
| 代码编辑器 | monaco-editor | 用于 Code View 切换 |
| 部署目标 | Cloudflare Workers | 静态站，第二阶段做 |
| AI SDK | @anthropic-ai/sdk | 第二阶段集成，第一阶段全 mock |

**禁止引入**：

- 任何 UI 库的"Pro"或"Enterprise"版（避免学习成本和样式冲突）
- 任何 server-side 框架（这是纯前端 demo）
- 任何收费服务（Banner 自己付费的求职项目）

---

## 3. 目录结构（强制遵守）

```
dingjie-agent-builder/
├── CLAUDE.md                       # 本文件
├── docs/                                   # 所有详细 spec
│   ├── skill_builder_spec_v1.md            # Tab 1 详细规范（已存在）
│   ├── skill_builder_config_spec_v1.md     # Tab 1 配置项精修表（已存在）
│   ├── agent_console_spec.md               # Tab 2 详细规范（已就绪 v1.1）
│   ├── debug_eval_spec.md                  # Tab 3 详细规范（待写）
│   ├── mock_data_schema.md                 # Mock 数据 schema（已就绪 v1.0）
│   └── demo_scripts.md                     # 面试演示剧本（已就绪 v1.0）
├── src/
│   ├── main.tsx
│   ├── App.tsx                     # 顶层布局 + 路由
│   ├── routes/                     # TanStack Router 路由
│   │   ├── __root.tsx
│   │   ├── skill-builder.tsx       # Tab 1
│   │   ├── agent-console.tsx       # Tab 2
│   │   └── debug-eval.tsx          # Tab 3
│   ├── components/
│   │   ├── ui/                     # shadcn/ui 组件
│   │   ├── skill-builder/          # Tab 1 专用组件
│   │   ├── agent-console/          # Tab 2 专用组件
│   │   └── debug-eval/             # Tab 3 专用组件
│   ├── stores/                     # zustand stores
│   │   ├── skill-store.ts          # Skill 配置状态
│   │   ├── agent-store.ts          # Agent 运行状态
│   │   └── eval-store.ts           # Eval 指标状态
│   ├── types/                      # TS 类型定义
│   │   ├── skill.ts                # Skill schema（核心）
│   │   ├── agent.ts                # Agent 运行时类型
│   │   └── mock-data.ts            # Mock 数据类型
│   ├── mocks/                      # Mock 数据
│   │   ├── purchase-orders.ts      # 10 条采购订单
│   │   ├── skills.ts               # 预置 Skill 配置
│   │   └── trace-logs.ts           # Trace 日志
│   ├── lib/                        # 工具函数
│   │   ├── conflict-detector.ts    # 冲突预警检测
│   │   └── skill-runner.ts         # Mock Skill 执行引擎
│   └── styles/
│       └── globals.css             # Tailwind 入口
├── public/
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── vite.config.ts
└── .claudeignore
```

**约定**：

- 一个组件一个文件，文件名 `kebab-case.tsx`，组件名 `PascalCase`
- 类型定义集中在 `src/types/`，**不要散落在组件内部**
- Mock 数据集中在 `src/mocks/`，**不要在组件里硬编码**
- 工具函数集中在 `src/lib/`，**不要在组件里写复杂业务逻辑**

---

## 4. 视觉风格（不可协商）

### 4.1 整体调性

**B 端工具风**，刻意远离 C 端互联网产品的活泼感。参考鼎捷雅典娜官网的工业级调色。

### 4.2 色板

```typescript
const colors = {
  primary: '#3B5C7E',      // 主蓝灰（鼎捷风）
  accent:  '#0EA5E9',      // 强调蓝（关键操作）
  bg:      '#F8FAFC',      // 浅灰背景
  surface: '#FFFFFF',      // 卡片白底
  border:  '#E2E8F0',      // 边框灰
  text:    '#0F172A',      // 主文字（近黑）
  muted:   '#64748B',      // 次要文字
  success: '#10B981',      // 通过/成功
  warning: '#F59E0B',      // 冲突预警
  danger:  '#EF4444',      // 风险/失败
};
```

**禁止**：

- 任何渐变色（除非是细微的 shadow）
- 玻璃拟态 / 毛玻璃效果
- 圆角超过 8px 的元素
- 纯黑 `#000000`（用 `#0F172A` 代替）

### 4.3 字体

- **不引入外部字体**，用系统字体栈
- 数字用 tabular-nums（保证表格对齐）

### 4.4 间距

- 严格遵守 Tailwind 4 的间距体系（4/8/12/16/24 px）
- 不要用 5/7/13 这种奇数间距

---

## 5. 代码风格

### 5.1 TS 严格度

```json
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "noImplicitAny": true
}
```

**不允许的"偷懒"**：

- `any` 兜底（用 `unknown` + 类型守卫代替）
- `as` 强转（除非有注释说明为什么需要）
- 空函数返回 `void` 但参数没标类型

### 5.2 命名规范

| 类别 | 规则 | 示例 |
|------|------|------|
| 组件 | PascalCase | `SkillFilterPanel` |
| Hook | use + PascalCase | `useSkillStore` |
| 类型 | PascalCase | `SkillConfig`, `AgentState` |
| 枚举 | PascalCase + 单数 | `TriggerType`，不是 `TriggerTypes` |
| 常量 | UPPER_SNAKE_CASE | `MAX_FOLLOWUP_COUNT` |
| 文件 | kebab-case | `skill-filter-panel.tsx` |

### 5.3 注释

- **不要**写 `// 这是一个 button`这种说废话的注释
- **必须**写"为什么这么做"的注释，特别是涉及产品判断的地方
- 复杂业务逻辑前用块注释解释设计意图

示例：

```typescript
// ⚠️ 产品判断：三态选择而不是 Toggle
// 二态 Toggle 会让"否"和"不限"混淆，三态是处理"包含 / 排除 / 不约束"业务语义的正解。
// 不要简化为 boolean。
type MaterialCriticalFilter = 'yes' | 'no' | 'any';
```

### 5.4 不要做的事

- 不要写"演进路线"型的代码（v1/v2/v3）——演进只在文档里讲，代码只实现 v1
- 不要为了"扩展性"加抽象层——这是 demo，所有抽象必须服务当前演示需求
- 不要做单元测试——demo 不需要，时间用在 UI 打磨上更值

### 5.5 工程硬约束（踩过坑、写下来防再犯）

- **zustand selector 返回对象/数组时必须包 `useShallow`**：

  ```typescript
  // ❌ 错误：返回新对象字面量 + zustand v5 默认 Object.is 比较 + StrictMode 双触发 → 初次挂载死循环
  const hud = useScenarioStore(selectHud);

  // ✅ 正确（只对"扁平对象 / 原始值数组"有效）
  import { useShallow } from 'zustand/react/shallow';
  const hud = useScenarioStore(useShallow(selectHud));
  ```

  规则：selector 返回**字段直访**（如 `(s) => s.currentStep`）可以裸用；返回**新构造的扁平对象/数组**（如 `selectHud` 算出 `{ totalTokens, cost }`）必须 `useShallow`。

- **嵌套对象 selector 用 `useShallow` 仍然会死循环** —— `useShallow` 只做一层浅比较，selector 返回 `{ hitRate: { actual, target }, ... }` 这种嵌套结构时，每个内层对象 ref 每次都变，`Object.is(prev.hitRate, next.hitRate)` 仍是 false → 循环。

  ```typescript
  // ❌ 错误：selectMetrics 返回 8 个嵌套 Metric struct，useShallow 拦不住
  const metrics = useScenarioStore(useShallow(selectMetrics));

  // ✅ 正确：在组件里 useMemo 用稳定 ref 作 dep
  const traces = useScenarioStore((s) => s.traces);  // 字段直访，稳定
  const metrics = useMemo(() => selectMetrics({ traces } as never), [traces]);
  ```

  判断：如果 selector 返回的对象**有嵌套字段且每次重新构造**，必须走 useMemo + 稳定 dep 的模式，不能依赖 useShallow。

- **type check 必须用 `npm run typecheck`（= `tsc -b --noEmit`），不能裸跑 `tsc --noEmit`**：根 `tsconfig.json` 用了 project references，没 `-b` 时只检查根项目而跳过 `tsconfig.app.json`，会漏掉所有真实错误。

---

## 6. 当前阶段优先级

### Phase 1：Skill Builder 骨架（第 1-2 天）

**P0（必做）**：

- 三栏布局（左导航 / 中配置 / 右预览）
- 顶部按钮区（保存、发布、Code View 切换）
- 模块二：触发方式
- 模块三：筛选规则（含三态选择 + 隐式联动可视化）
- 模块五：自动化边界（含三层固定优先级 + 冲突预警）
- 右侧 Skill 卡片预览

**P1（第 3 天补）**：

- 模块四：动作配置
- 模块六：模型路由
- 模块七：知识检索
- Code View 切换（用 monaco-editor）
- 模拟运行抽屉

**P2（如有时间）**：

- 模块一：元信息
- Diff 功能
- 模板市场入口

### Phase 2：Agent Console（第 4-5 天）

详细 spec 见 [`docs/agent_console_spec.md`](docs/agent_console_spec.md) v1.1（已就绪，经 8 轮 Codex 对抗式审查）+ [`docs/mock_data_schema.md`](docs/mock_data_schema.md) v1.0（10 条订单 fixture + 规则纯函数 + 预期状态矩阵）。

剧本主线已定型：**6 步复合剧本（90 秒）** —— 定时触发 → 扫单 → 安全层拦截 → 多智能体协同 → 采购员追问 → 反向调参重跑 → 一键复盘。

**P0（必做，第 4 天完成）**：

- 三栏布局骨架（替换 `src/routes/agent-console.tsx` 现有 placeholder）
- 10 条 mock 订单 + 订单表（无动画版，按 `mock_data_schema.md` §2.2 完整 TS fixture）
- 新建 `src/stores/scenario-store.ts` 实现 `scenarioConfigOverride` 覆盖机制（**不动 `skill-defaults.ts` 的 default**）
- 对话面板（消息类型 + 流式打字，无思考链）
- 决策面板基础版（前 3 个 section）
- 复合剧本的 Step 1-3（手动推进）
- 行末「待人工」按钮 + 内嵌侧栏（PD-8 不能砍）

**P1（必做，第 5 天完成）**：

- D3 扫描动画 / D6 多智能体协作图 / D7 浮起迷你 Skill Builder + 立刻重跑
- 复合剧本的 Step 4-6
- 决策面板后 3 个 section（含 D4 模型路由可视化、Token 计数）
- D2 思考链展开
- X1 演示模式（含伪鼠标光标 + `humanDecisionScript`）
- X4 一键复盘

**P2（如有时间）**：

- 引用 Skill 悬浮卡
- Memory 摘要的"已记入"toast 动画
- 可选真实 LLM 接入（详见 [`docs/demo_scripts.md`](docs/demo_scripts.md) §2 —— 4 个 LLM 接入点 + Worker 端方向路由 + simple token gating + Anthropic budget cap 兜底）

**绝对不要砍**：D7、PD-8 人工确认、伪光标方案——这三个是产品判断的硬约束。

### Phase 3：Debug & Eval（第 6 天）

- Trace 面板 + 指标看板
- 详细 spec 见 `docs/debug_eval_spec.md`（待写）
- **Trace 数据契约已在** [`docs/agent_console_spec.md`](docs/agent_console_spec.md) **§10 定义完整**（discriminated union: IntentTrace / FilterTrace / RiskTrace / CallSkillTrace / HumanDecisionTrace / ConfigChangeTrace）—— Phase 3 写 spec 时只需补"Trace 面板 UI"和"指标看板字段"

### Phase 4：部署（第 7 天）

- 部署到 Cloudflare Workers
- 挂域名

---

## 7. 跨屏共享状态约定

三个 Tab 之间有以下数据流：

```
Skill Builder 配置好 Skill 
    ↓ (zustand: skillStore)
Agent Console 运行该 Skill 处理用户对话
    ↓ (zustand: agentStore，产生 trace 日志)
Debug & Eval 展示 trace 和指标
```

**共享状态原则**：

- 配置类数据（Skill 配置）放 `skillStore`
- 运行时数据（对话、订单、决策、Trace、autoPlay 状态）放 `scenarioStore`（Phase 2 实装时合并了原计划的 `agentStore`）
- ~~指标和 Trace 放 `evalStore`~~ —— Phase 2/3 实装时 trace 直接落 `scenarioStore.traces`，`evalStore` 留作 Phase 4 之后接真 LLM / 多场景对比时的迁移目标
- **不要**用一个超大的 global store

---

## 8. Mock 数据约定

### 8.1 采购订单 Mock

`src/mocks/purchase-orders.ts` 必须导出 **10 条** 订单，覆盖以下样本组合：

| 样本数 | 类型 | 用途 |
|--------|------|------|
| 3 条 | 普通跟催（未来 7 天到货、未回复） | 演示基础筛选 |
| 2 条 | 高风险（关键件 + 历史延期高 + 影响齐套） | 演示安全层触发 |
| 2 条 | 已二次跟催未回复 | 演示跟催次数上限 |
| 1 条 | 单一来源 + 关键客户订单影响 | 演示穿透影响链 |
| 1 条 | 供应商已回复确认 | 演示已处理状态 |
| 1 条 | 供应商已回复延期 2 天（在自动同意范围） | 演示业务层自动同意 |

详细字段定义见 [`docs/mock_data_schema.md`](docs/mock_data_schema.md) v1.0（**已就绪**——含 10 条完整 TS fixture、5 个规则纯函数、每条订单按 6 步剧本的预期状态矩阵）。剧本所有数字（命中 6/10、安全层覆盖 4 条、业务层自动 1 条、调参后自动 1 条）都从该 schema 反推。

### 8.2 数据真实性

所有 Mock 数据**必须用制造业风格**，不要写"螺丝 100 个 → 张三 → 苏州工厂"这种笼统数据。

物料编码要有形如 `FAS-M8-A270-001`（紧固件-M8 规格-A2-70 材质-序号）的工业级编码感。

---

## 9. 关键产品判断（不许擅自改）

以下是产品 PM（Banner）已经拍板的设计，**Claude Code 不允许自己改这些判断**。如果遇到这些判断在工程上"不好实现"，**停下来问 Banner**，不要自作主张简化。

| 编号 | 产品判断 | 工程含义 |
|------|---------|---------|
| PD-1 | UI 用结构化配置面板，**不做拖拽画布** | 不要引入 react-flow / react-dnd |
| PD-2 | 物料属性用**三态选择**（yes/no/any） | 不能简化为 boolean |
| PD-3 | 自动化边界用**安全>业务>效率三层固定优先级** | 安全层 Toggle 必须 disabled |
| PD-4 | Low Code 与 Code View **双向可读 + 分级转换** | 不承诺"双向无损"，承认表达能力不对等 |
| PD-5 | 冲突预警**实时显示** | 用 `useMemo` 而不是手动触发 |
| PD-6 | Eval 指标全部标注"目标值（示意）" | 不要写"实测 92%"这种误导文字 |
| PD-7 | Agent 决策面板**必须透明**（展示意图、参数、Memory） | 不能用一个黑盒 "Agent 在思考..." 应付 |
| PD-8 | 关键动作必须**人工确认**（Human-in-the-loop） | 不能为了流畅省略确认弹窗 |
| PD-9 | 通知形态用**任务卡**（鼎捷雅典娜原生术语），不叫"消息"或"通知" | UI 文案严格使用"任务卡" |
| PD-10 | 模型路由配置必须显式（DeepSeek / GPT-4 / Qwen 等具体型号） | 不能用"默认模型"这种含糊词 |

---

## 10. Claude Code 不能擅自做的决定

遇到以下情况，**必须停下来问 Banner**：

1. 引入新的依赖库（哪怕是小工具）
2. 改变第 9 节的任何一条产品判断
3. 修改 mock 数据的字段结构（schema 是产品判断的一部分）
4. 改变三个 Tab 的视觉风格或配色
5. 决定"P0 / P1 / P2 该做到什么程度"的边界
6. 创建 `docs/` 下的新文件（除非 Banner 明确要求）
7. 在面试演示剧本里增加或减少步骤

**正确做法**：直接在回复里说"这里需要你的产品决定：[选项 A] vs [选项 B]，我推荐 [A]，理由是 [...]"，然后等回复。

---

## 11. Claude Code 可以自主决定的事

- 组件内部的实现细节
- TS 类型的具体写法
- Tailwind 类名的组合
- 文件夹内的子文件如何拆分
- 工具函数的命名和签名
- mock 数据的具体内容（字段格式遵守 schema 即可）
- 注释和文档字符串

---

## 12. 引用清单

会话中根据当前任务，按需读取以下文件：

| 文件 | 用途 | 状态 |
|------|------|------|
| `docs/skill_builder_spec_v1.md` | Tab 1 详细规范 | ✅ 已存在 |
| `docs/skill_builder_config_spec_v1.md` | Tab 1 配置项精修表 | ✅ 已存在 |
| `docs/agent_console_spec.md` | Tab 2 详细规范 | ✅ 已就绪 v1.1（经 8 轮 Codex 对抗式审查） |
| `docs/debug_eval_spec.md` | Tab 3 详细规范 | ⏳ 完成 Phase 2 后写（Trace 契约已在 agent_console_spec §10 定义） |
| `docs/mock_data_schema.md` | Mock 数据字段定义 | ✅ 已就绪 v1.0（10 条 fixture + 规则纯函数 + 预期状态矩阵） |
| `docs/demo_scripts.md` | 面试演示剧本 + 真 LLM 增强方案 | ✅ 已就绪 v1.0（FAQ + 4 个 LLM 接入点 + 演示节奏控制） |

---

## 13. 与 Banner 的协作约定

Banner 的工作模式偏好（基于过往会话沉淀）：

- **诚实优先**：技术做不到的事情坦率说，不要硬编代码
- **少而精**：宁可问清楚再写，不要写一堆需要返工的代码
- **拍板权在 Banner**：所有产品判断由 Banner 决定，Claude Code 是工程执行者
- **可演示优先于完美**：第一目标是面试当天能跑，不是工程质量满分
- **不要过度乐观**：估时间往长了估，做完了说"提前完成"比说"延期"好

---

## 14. 失败模式预警

以下行为会让 Banner 不满意，请避免：

- ❌ 不读 spec 就开始写代码
- ❌ 默认引入不在第 2 节列表里的库
- ❌ 在代码里写"// TODO: 之后再补"——要么现在写，要么去问
- ❌ 把产品判断简化为"工程默认值"（比如把三态偷偷改成二态）
- ❌ 写一长串代码后才说"我不太确定 X 该怎么做"
- ❌ 用英文写本应是中文的 UI 文案（这是鼎捷面试，UI 全中文）
- ❌ 视觉风格往"AI 风 / 科技感 / 未来感"靠（要 B 端工具风）

---

**文档版本**：v1.1（Phase 2 spec 就绪后更新）
**最后更新**：2026-05-14
**当前 Phase**：Phase 1 完成 → 进入 Phase 2 - Agent Console
**下一个任务**：基于 [`docs/agent_console_spec.md`](docs/agent_console_spec.md) v1.1 + [`docs/mock_data_schema.md`](docs/mock_data_schema.md) v1.0 实现 Agent Console 的 P0 模块（详见 §6 Phase 2）
