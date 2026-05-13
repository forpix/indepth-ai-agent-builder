export default {
  async fetch(request: Request, env: { ASSETS: Fetcher }) {
    const url = new URL(request.url);
    if (url.pathname === '/agent-builder' || url.pathname.startsWith('/agent-builder/')) {
      url.pathname = url.pathname.replace(/^\/agent-builder/, '') || '/';
    }
    // 必须用 normalized URL 重建 request，否则 ASSETS 收到 /agent-builder/... 找不到资源
    return env.ASSETS.fetch(new Request(url.toString(), request));
  },
};
