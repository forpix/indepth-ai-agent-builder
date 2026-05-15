# Agent Builder

> B2B Agent 编排工作台演示 —— 用低代码搭出可调试、可复用、可监控的制造业 Agent。
>
> 🌐 Live demo: **https://arenaai.info/agent-builder**

一个面向 B2B AI 产品经理岗位的作品集 Demo。围绕"制造业采购交期跟催"这个具体业务场景，展示 Agent 编排平台的三个核心模块如何协同：Skill 编排、Agent 运行时、Trace 调试与指标评估。

---

## 三个 Tab

### 1. Skill Builder

用**结构化配置面板**（刻意不做拖拽画布形态）搭出一个可发布的 Skill：

- 触发方式 / 筛选规则 / 动作配置 / 自动化边界 / 模型路由 / 知识检索 / 元信息
- **三态选择**（yes / no / any）处理"包含 / 排除 / 不约束"业务语义
- **安全 > 业务 > 效率三层固定优先级**，安全层 Toggle disabled
- **Low Code 与 Code View 双向可读 + 分级转换**，承认表达能力不对等
- **实时冲突预警**（useMemo 计算）

### 2. Agent Console

**6 步复合剧本**（约 90s，可一键自动播放）演示 Agent 实际跑起来的样子：

| Step | 阶段 | 演示要点 |
|------|------|---------|
| 1 | 08:00 定时触发 | Skill 引用 + cron 触发源 |
| 2 | 扫描 + 流式分析 | 10 条订单中 6 条命中跟催规则 |
| 3 | 安全层拦截 + 子 Skill 调用 | 关键件 + 影响在制工单 → 调用齐套预警 Skill |
| 4 | 采购员追问 | "PO-005 为什么没自动同意？" → Agent 解释规则优先级 |
| 5 | 反向调参 | 用户提调参意图，**浮起迷你 Skill Builder 卡**（不切 Tab），slider 实时预览影响范围，确认后自动重跑 |
| 6 | 一键复盘 | 完整决策路径回顾 |

右侧**决策面板**展示当前意图、引用 Skill 配置、规则优先级触发、Memory 摘要、模型路由、Token / 成本、多智能体协作图（采购跟催 ↔ 齐套预警）—— 不能用一个黑盒 "Agent 在思考..." 应付。

### 3. Debug & Eval

- **Trace 时间轴**：6 种 trace 类型 discriminated union（intent / filter / risk / call-skill / human-decision / config-change），完整记录决策路径
- **指标看板**：命中率、安全层覆盖率、p95 延时、Token / 成本等 8 张卡，**双列展示「实测 + 目标」并明确标注「目标值（示意）」** —— 不写"实测 92%"这种误导文字
- **跨 Tab 联动**：点 trace 跳订单详情高亮 3 秒，点订单回跳对应 trace

---

## 关键产品判断

完整清单在 `CLAUDE.md` §9，节选最关键几条：

| ID | 判断 | 工程含义 |
|----|------|---------|
| PD-1 | UI 用结构化配置面板，**不做拖拽画布** | 不引入 react-flow / react-dnd |
| PD-2 | 物料属性用**三态选择**（yes/no/any） | "否"和"不限"是两种语义，不能简化为 boolean |
| PD-3 | 自动化边界用**安全 > 业务 > 效率三层固定优先级** | 安全层 Toggle 必须 disabled |
| PD-4 | Low Code 与 Code View **双向可读 + 分级转换** | 不承诺"双向无损"，承认表达能力不对等 |
| PD-6 | Eval 指标全部标注"目标值（示意）" | 不写"实测 92%"这种误导文字 |
| PD-7 | Agent 决策面板**必须透明**（意图、参数、Memory） | 不能用一个黑盒 "Agent 在思考..." 应付 |
| PD-8 | 关键动作必须**人工确认**（Human-in-the-loop） | 不能为了流畅省略确认弹窗 |
| PD-10 | 模型路由配置必须显式（DeepSeek / GPT-4 / Qwen 等具体型号） | 不用"默认模型"这种含糊词 |

---

## 技术栈

| 类别 | 选型 | 备注 |
|------|------|------|
| 构建 | Vite | |
| 框架 | React 18 | 函数组件 + Hooks |
| 语言 | TypeScript | `strict` + `noUncheckedIndexedAccess`，零 `any` 兜底 |
| 状态 | zustand v5 | 注意嵌套 selector 必须 `useMemo` + 稳定 dep，见 `CLAUDE.md` §5.5 |
| 路由 | TanStack Router | |
| 样式 | Tailwind CSS 4 + shadcn/ui | |
| 代码编辑器 | monaco-editor | 用于 Code View 切换 |
| 部署 | Cloudflare Workers | 静态站 + LLM gateway |
| 真 LLM 接入（可选） | Moonshot AI (Kimi) | OpenAI-compatible，token-gated |

---

## 本地运行

```bash
pnpm install
pnpm dev          # http://localhost:5173/agent-builder
```

类型检查 / 构建 / 部署：

```bash
pnpm typecheck    # tsc -b --noEmit（必须用 -b，否则 project references 下的
                  # tsconfig.app.json 会被跳过，漏掉所有真实错误）
pnpm build
pnpm deploy       # Cloudflare Workers
```

---

## 真 LLM 模式（可选）

默认全 mock 模式跑 demo（演示节奏稳定 90s 不依赖网络）。如需切到真 LLM 模式：

1. 在 Cloudflare 端设两个 secret：
   ```bash
   npx wrangler secret put MOONSHOT_API_KEY
   npx wrangler secret put REAL_LLM_GATE_TOKEN  # 任意 random string
   ```
2. 打开 `<your-host>/agent-builder/agent-console?real-llm=<your-token>`
3. 4 个接入点在背后调 Moonshot：
   - **L1**: Step 3 风险评估 CoT（思考链）
   - **L2**: Step 3 子 Skill 编排决策
   - **L3**: Step 4 PO-005 追问解释（替换 mock 文本）
   - **L4**: Step 5 配置意图自然语言解析

任何失败（超时、429 配额、token 截断、validator reject）→ 非 200 → 前端**静默回退 mock**，不打断剧本节奏。所有 LLM 写 token / 成本 / 延时到右下角 HUD。

详见 [`docs/demo_scripts.md`](docs/demo_scripts.md) §2。

---

## 项目结构

```
src/
├── routes/             # TanStack Router（3 个 Tab）
├── components/
│   ├── ui/             # shadcn/ui
│   ├── skill-builder/
│   ├── agent-console/
│   └── debug-eval/
├── stores/             # zustand: skill-store + scenario-store
├── types/              # TS 类型（含 Trace discriminated union）
├── mocks/              # 10 条订单 fixture + 对话脚本 + CoT 文本
├── lib/                # 工具函数 + LLM client
└── worker/             # Cloudflare Worker（含 LLM gateway）

docs/
├── skill_builder_spec_v1.md         # Tab 1 详细规范
├── skill_builder_config_spec_v1.md  # Tab 1 配置项精修表
├── agent_console_spec.md            # Tab 2 详细规范（经 8 轮对抗式审查）
├── debug_eval_spec.md               # Tab 3 详细规范（经 3 轮对抗式审查）
├── mock_data_schema.md              # 10 条订单 fixture + 规则纯函数 + 预期状态矩阵
└── demo_scripts.md                  # 演示剧本 + 真 LLM 增强方案
```

---

## 设计权衡

几个意识到但**故意**没做的事情：

- **不做拖拽画布**：避开 Dify / Coze 形态，差异化为结构化配置面板。代价是不能可视化连线。
- **不承诺 Low Code ↔ Code View 双向无损**：复杂表达式从 Code 转回 Low Code 时降级为占位，明示给用户。
- **Eval 指标只标"目标值（示意）"**：demo 没有真流量，写"实测 92%"是误导。
- **演示模式 100% mock 优先**：90s 演示节奏稳定性 > 真 LLM 噱头。真 LLM 模式作为 P1 增强项，演示当天可选启用。
- **多租户 / RBAC 接口预留**：trace 写 `actorId` / `tenantId` / `authorizationResult: 'granted-mock'` 字段，但 demo 不实装授权检查。

完整设计上下文：[`CLAUDE.md`](CLAUDE.md) §14 章。
