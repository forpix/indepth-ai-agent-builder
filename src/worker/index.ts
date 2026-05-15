import {
  type Env,
  handleCorsPreflight,
  handleLlmRequest,
  parseLlmEndpoint,
} from './llm';

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);

    // ─── 真 LLM endpoint（demo_scripts §2） ────────────
    // CORS preflight
    const cors = handleCorsPreflight(request);
    if (cors) return cors;

    // POST /agent-builder/api/llm/{endpoint}
    const llmEndpoint = parseLlmEndpoint(url.pathname);
    if (llmEndpoint) {
      if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
      }
      return handleLlmRequest(request, env, llmEndpoint);
    }

    // ─── SPA fallback ──────────────────────────────────
    if (url.pathname === '/agent-builder' || url.pathname.startsWith('/agent-builder/')) {
      url.pathname = url.pathname.replace(/^\/agent-builder/, '') || '/';
    }
    return env.ASSETS.fetch(new Request(url.toString(), request));
  },
};
