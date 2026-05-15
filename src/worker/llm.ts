/**
 * 真 LLM 接入 —— 4 个 endpoint + token gating + Moonshot 调用 + 手写 type guard 校验。
 * 详见 docs/demo_scripts.md §2。
 *
 * 失败一律返回非 200，前端自动 fallback mock。
 */

export interface Env {
  MOONSHOT_API_KEY?: string;
  REAL_LLM_GATE_TOKEN?: string;
  ASSETS: Fetcher;
}

// ─── 配置 ────────────────────────────────────────────

const MOONSHOT_API_URL = 'https://api.moonshot.cn/v1/chat/completions';
const MOONSHOT_MODEL = 'moonshot-v1-32k';

const ALLOWED_ORIGINS = new Set([
  'https://arenaai.info',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

type EndpointId =
  | 'risk-judge'
  | 'orchestrate-call'
  | 'answer-question'
  | 'parse-config-intent';

interface EndpointQuota {
  maxInputBytes: number;
  maxOutputTokens: number;
}

const ENDPOINT_QUOTAS: Record<EndpointId, EndpointQuota> = {
  'risk-judge': { maxInputBytes: 16_000, maxOutputTokens: 700 },
  'orchestrate-call': { maxInputBytes: 12_800, maxOutputTokens: 500 },
  // 中文 1 char ≈ 1.5-2 tokens；解释 + citedRules 容易超 500 token 被截断 → JSON 失败
  'answer-question': { maxInputBytes: 19_200, maxOutputTokens: 900 },
  'parse-config-intent': { maxInputBytes: 12_800, maxOutputTokens: 400 },
};

// ─── 顶层 handler ─────────────────────────────────────

export async function handleLlmRequest(
  request: Request,
  env: Env,
  endpoint: EndpointId,
): Promise<Response> {
  // 1. Origin 严格匹配
  const origin = request.headers.get('Origin') ?? '';
  if (!ALLOWED_ORIGINS.has(origin)) {
    return jsonError(403, 'origin_not_allowed');
  }

  // 2. token gating（URL 参数 ?real-llm=<token>）
  const url = new URL(request.url);
  const reqToken = url.searchParams.get('real-llm');
  if (!reqToken || reqToken === 'true' || reqToken === 'false') {
    return jsonError(401, 'token_missing_or_boolean');
  }
  if (!env.REAL_LLM_GATE_TOKEN || reqToken !== env.REAL_LLM_GATE_TOKEN) {
    return jsonError(401, 'token_invalid');
  }

  // 3. API key 兜底
  if (!env.MOONSHOT_API_KEY) {
    return jsonError(503, 'llm_key_missing');
  }

  // 4. body 长度预检 + 流式读取
  const quota = ENDPOINT_QUOTAS[endpoint];
  let bodyText: string;
  try {
    bodyText = await readBodyWithCap(request, quota.maxInputBytes);
  } catch (e) {
    if (e instanceof BodyTooLargeError) return jsonError(413, 'body_too_large');
    if (e instanceof EmptyBodyError) return jsonError(400, 'empty_body');
    throw e;
  }

  // 5. JSON 解析
  let input: unknown;
  try {
    input = JSON.parse(bodyText);
  } catch {
    return jsonError(400, 'invalid_json');
  }

  // 6. 路由到 endpoint
  try {
    const llmResponse = await callMoonshot(env.MOONSHOT_API_KEY, endpoint, input, quota.maxOutputTokens);

    // 7. 解析 LLM 输出 + 校验
    const validated = validateResponse(endpoint, llmResponse);
    if (validated === null) {
      // 写到 wrangler tail 方便诊断（前端只能看到 reason，无法看到 raw 内容）
      console.error(
        `[llm_output_invalid] ${endpoint} raw=${llmResponse.slice(0, 600)}`,
      );
      return jsonError(502, 'llm_output_invalid');
    }

    return Response.json(validated, {
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    // Moonshot 超时 / 网络错误 / 429（quota）
    const msg = e instanceof Error ? e.message : 'unknown';
    if (msg.includes('timeout')) return jsonError(504, 'llm_timeout');
    if (msg.includes('429') || msg.includes('quota'))
      return jsonError(503, 'llm_quota_exceeded');
    return jsonError(502, `llm_upstream_error:${msg.slice(0, 80)}`);
  }
}

// ─── Moonshot API client ───────────────────────────────

async function callMoonshot(
  apiKey: string,
  endpoint: EndpointId,
  userInput: unknown,
  maxTokens: number,
): Promise<string> {
  const systemPrompt = SYSTEM_PROMPTS[endpoint];
  const body = {
    model: MOONSHOT_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: JSON.stringify(userInput) },
    ],
    max_tokens: maxTokens,
    temperature: 0.3,
    response_format: { type: 'json_object' },
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25_000);

  let resp: Response;
  try {
    resp = await fetch(MOONSHOT_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('llm_timeout');
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }

  if (resp.status === 429) throw new Error('429_quota_exceeded');
  if (!resp.ok) {
    throw new Error(`upstream_${resp.status}`);
  }

  const result = (await resp.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = result.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    throw new Error('llm_no_content');
  }
  return content;
}

// ─── Prompt templates（spec §2.2） ─────────────────────

const SYSTEM_PROMPTS: Record<EndpointId, string> = {
  'risk-judge': `你是制造业采购协同 Agent 的风险判断模块。给定一条采购订单和当前 Skill 的安全/业务规则配置，输出风险等级、处理建议和思考链（CoT）。

严格输出 JSON 格式，不要有任何额外文字：
{
  "riskLevel": "high" | "medium" | "low",
  "safetyBlocked": boolean,
  "recommendation": "humanIntervene" | "autoDispatchTaskCard" | "autoApprove",
  "cot": string[]
}

判断原则：
1. 安全层（关键件 / 单一来源 / 影响在制工单 / 财务合规）任一触发 → safetyBlocked=true → 必须 humanIntervene
2. 业务层（延期阈值 / 供应商等级 / 客户重要性）按配置判断
3. cot 必须 3-5 步，能解释判断路径，不能用空话`,

  'orchestrate-call': `你是采购协同 Agent 的工具编排模块。给定一条订单的风险评估结果，决定是否调用「齐套预警 Skill」。

齐套预警 Skill 的能力：评估订单延期对在制工单排产的影响（缺料数、影响工单 ID）。

输出 JSON：
{
  "shouldCall": boolean,
  "request": {
    "callerSkillId": "purchaseFollowUp",
    "targetOrderId": string,
    "affectedWorkOrderIds": string[],
    "timeoutMs": 5000
  } | null,
  "reasoning": string
}

调用决策原则：
- 影响在制工单 > 0 且 riskLevel=high → shouldCall=true
- 仅有客户订单影响 → shouldCall=false
- 普通跟催 → shouldCall=false`,

  'answer-question': `你是采购协同 Agent 的对话模块。采购员对某条订单的处理结果提出疑问，你需要解释。

**严格只输出 JSON 对象，不要包裹 markdown、不要前后加任何文字**。字段名必须**完全**使用以下英文驼峰键，不能用 snake_case 或中文：

{
  "explanation": "<中文解释，120-220 字。引用具体规则路径>",
  "citedRules": ["safety.critical", "business.autoApproveIfDelayLE"]
}

解释原则：
- 引用具体规则路径（如 "safety.critical" / "business.autoApproveIfDelayLE"），citedRules 必须是字符串数组（即使只有一条也要包数组）
- 业务层延期阈值只看事实延期（supplierDelayReply），与供应商等级无关——这是常见误解，必须说清
- 安全层覆盖业务层时必须明说"被安全层覆盖"，并说明触发了哪条安全层硬规则
- explanation 控制在 220 字以内，避免被 token 上限截断
- 不要承诺无法兑现的事（如"我帮你改" / "我已记录"）`,

  'parse-config-intent': `你是采购协同 Agent 的配置编辑助手。采购员用自然语言请求修改 Skill 配置，你需要解析为结构化 action。

**重要约束**：
1. 你**永远不能**修改 automationBoundary.safety.* —— 安全层硬规则受平台保护
2. 所有配置变更**仅在本次剧本生效**（thisRunOnly）。任何"以后都按这个"/"保存这个设置"等请求，返回 reject(reason='persist_requires_manual_ui')
3. 高风险 action 你不能直接输出，必须 reject(reason='confirm_required_via_ui') 并把意图填到 proposedAction

允许直接输出的低风险 action：
- updateAutoApproveDelayDays: 业务层延期阈值（0-7 整数）
- toggleAutoApproveDelay: 延期自动同意规则开关
- updateMaxFollowUpCount: 跟催次数上限（1-5 整数）

需要 UI 二次确认的高风险 action（必须 reject）：
- toggleAutoApproveTierA
- toggleMustHumanIfCustomerKA
- updateAutoApproveAmountLimit

输出 JSON（严格匹配下面 4 种之一）：
{ "action": "updateAutoApproveDelayDays", "value": <0-7 int>, "explanation": string }
{ "action": "toggleAutoApproveDelay", "value": <boolean>, "explanation": string }
{ "action": "updateMaxFollowUpCount", "value": <1-5 int>, "explanation": string }
{ "action": "reject", "reason": "safety_path_locked" | "out_of_range" | "persist_requires_manual_ui" | "confirm_required_via_ui" | "unrecognized_intent", "proposedAction"?: {...}, "explanation": string }`,
};

// ─── 手写 type guard 校验（替代 zod，零依赖） ──────────

function validateResponse(endpoint: EndpointId, raw: string): unknown {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;

  switch (endpoint) {
    case 'risk-judge':
      return validateRiskJudge(parsed) ? parsed : null;
    case 'orchestrate-call':
      return validateOrchestrate(parsed) ? parsed : null;
    case 'answer-question':
      return validateAnswerQuestion(parsed) ? parsed : null;
    case 'parse-config-intent':
      return validateParseConfig(parsed) ? parsed : null;
  }
}

function validateRiskJudge(o: object): boolean {
  const x = o as Record<string, unknown>;
  return (
    (x.riskLevel === 'high' || x.riskLevel === 'medium' || x.riskLevel === 'low') &&
    typeof x.safetyBlocked === 'boolean' &&
    (x.recommendation === 'humanIntervene' ||
      x.recommendation === 'autoDispatchTaskCard' ||
      x.recommendation === 'autoApprove') &&
    Array.isArray(x.cot) &&
    x.cot.length >= 3 &&
    x.cot.length <= 6 &&
    x.cot.every((s) => typeof s === 'string')
  );
}

function validateOrchestrate(o: object): boolean {
  const x = o as Record<string, unknown>;
  if (typeof x.shouldCall !== 'boolean') return false;
  if (typeof x.reasoning !== 'string') return false;
  if (x.shouldCall) {
    const r = x.request as Record<string, unknown> | null;
    if (!r || typeof r !== 'object') return false;
    if (r.callerSkillId !== 'purchaseFollowUp') return false;
    if (typeof r.targetOrderId !== 'string') return false;
    if (!Array.isArray(r.affectedWorkOrderIds)) return false;
    if (typeof r.timeoutMs !== 'number') return false;
  }
  return true;
}

function validateAnswerQuestion(o: object): boolean {
  const x = o as Record<string, unknown>;
  if (typeof x.explanation !== 'string' || x.explanation.length === 0)
    return false;
  // 兼容 LLM 偶尔返回 snake_case；就地 normalize 到 citedRules
  if (x.citedRules === undefined && Array.isArray(x.cited_rules)) {
    x.citedRules = x.cited_rules;
  }
  // citedRules 缺失 → 用 [] 兜底（不该让"没列规则"导致整条 fallback）
  if (x.citedRules === undefined) {
    x.citedRules = [];
    return true;
  }
  if (!Array.isArray(x.citedRules)) return false;
  return x.citedRules.every((s) => typeof s === 'string');
}

function validateParseConfig(o: object): boolean {
  const x = o as Record<string, unknown>;
  if (typeof x.explanation !== 'string') return false;

  switch (x.action) {
    case 'updateAutoApproveDelayDays':
      return (
        typeof x.value === 'number' &&
        Number.isInteger(x.value) &&
        x.value >= 0 &&
        x.value <= 7
      );
    case 'toggleAutoApproveDelay':
      return typeof x.value === 'boolean';
    case 'updateMaxFollowUpCount':
      return (
        typeof x.value === 'number' &&
        Number.isInteger(x.value) &&
        x.value >= 1 &&
        x.value <= 5
      );
    case 'reject': {
      const validReasons = new Set([
        'safety_path_locked',
        'out_of_range',
        'persist_requires_manual_ui',
        'confirm_required_via_ui',
        'unrecognized_intent',
      ]);
      if (typeof x.reason !== 'string' || !validReasons.has(x.reason))
        return false;
      // proposedAction 字段可选（仅 confirm_required_via_ui 时存在）
      if (x.reason === 'confirm_required_via_ui') {
        const p = x.proposedAction as Record<string, unknown> | undefined;
        if (!p || typeof p !== 'object') return false;
        const allowed = new Set([
          'toggleAutoApproveTierA',
          'toggleMustHumanIfCustomerKA',
          'updateAutoApproveAmountLimit',
        ]);
        if (typeof p.action !== 'string' || !allowed.has(p.action)) return false;
        if (p.action === 'updateAutoApproveAmountLimit') {
          if (typeof p.value !== 'number' || p.value < 0 || p.value > 1_000_000)
            return false;
        } else if (typeof p.value !== 'boolean') return false;
      }
      return true;
    }
    default:
      return false;
  }
}

// ─── Body 长度预检 + 流式读取（spec §2.3 ⑤） ────────────

class BodyTooLargeError extends Error {}
class EmptyBodyError extends Error {}

async function readBodyWithCap(req: Request, maxBytes: number): Promise<string> {
  const contentLength = req.headers.get('content-length');
  if (contentLength && Number(contentLength) > maxBytes) {
    throw new BodyTooLargeError();
  }
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
        await reader.cancel();
        throw new BodyTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (received === 0) throw new EmptyBodyError();
  // 合并 chunks 后解码
  const merged = new Uint8Array(received);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.length;
  }
  return new TextDecoder().decode(merged);
}

// ─── 错误响应 helper ────────────────────────────────────

function jsonError(status: number, reason: string): Response {
  return Response.json(
    { error: reason, timestamp: Date.now() },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}

// ─── CORS preflight ────────────────────────────────────

export function handleCorsPreflight(request: Request): Response | null {
  if (request.method !== 'OPTIONS') return null;
  const origin = request.headers.get('Origin') ?? '';
  if (!ALLOWED_ORIGINS.has(origin)) {
    return new Response(null, { status: 403 });
  }
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '600',
    },
  });
}

// ─── 端点 ID 解析 ──────────────────────────────────────

export function parseLlmEndpoint(pathname: string): EndpointId | null {
  // /agent-builder/api/llm/{endpoint}
  const match = pathname.match(/^\/agent-builder\/api\/llm\/([a-z-]+)\/?$/);
  if (!match) return null;
  const ep = match[1];
  if (
    ep === 'risk-judge' ||
    ep === 'orchestrate-call' ||
    ep === 'answer-question' ||
    ep === 'parse-config-intent'
  ) {
    return ep;
  }
  return null;
}
