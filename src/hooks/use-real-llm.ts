/**
 * 真 LLM 模式开关 —— 从 URL 参数 `?real-llm=<token>` 读取。
 *
 * 设计约束（demo_scripts §2.3）：
 * - `?real-llm=true` 或 `?real-llm=false` 一律拒绝（boolean 值不等于任何 random string）
 * - token 不是空字符串
 * - 实际 token 校验在 Worker 端做（应用层只读 URL；rejected 的请求由 worker 返回 401）
 *
 * 返回非 hook 静态读取（URL 不会动态变化，整段剧本期间稳定）。
 */
export function readRealLlmToken(): string | null {
  if (typeof window === 'undefined') return null;
  const token = new URLSearchParams(window.location.search).get('real-llm');
  if (!token) return null;
  if (token === 'true' || token === 'false') return null;
  // 不限长度——worker 端 exact match 已是真实安全边界，前端短串拦截只会徒增 demo 易用性损失
  return token;
}

/** 全局 cache：URL 不会动态变化，初次读取后存住，避免每次 fetch 重新解析 URL */
let cachedToken: string | null | undefined;
export function getRealLlmToken(): string | null {
  if (cachedToken === undefined) cachedToken = readRealLlmToken();
  return cachedToken;
}

/** 是否启用真 LLM 模式（前端判断用） */
export function isRealLlmEnabled(): boolean {
  return getRealLlmToken() !== null;
}
