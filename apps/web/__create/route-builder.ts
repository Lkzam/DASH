import { Hono } from 'hono';
import type { Handler } from 'hono/types';
import updatedFetch from '../src/__create/fetch';

const API_BASENAME = '/api';
const api = new Hono();

if (globalThis.fetch) {
  globalThis.fetch = updatedFetch;
}

// Bundla TODOS os route.js em build-time (Vite). Funciona igual em dev e em
// produção — sem varredura de filesystem em runtime (que quebrava o build/deploy,
// pois `src/app/api` não existe dentro de build/server/).
const routeModules = import.meta.glob('../src/app/api/**/route.js', { eager: true });

// Deriva o path Hono a partir da chave do glob.
// Ex.: '../src/app/api/asaas/webhook/route.js' -> '/asaas/webhook'
function getHonoPathFromKey(key: string): string {
  const rel = key.replace('../src/app/api/', '').replace(/\/route\.js$/, '');
  if (!rel || rel === 'route.js') return '/';
  const parts = rel.split('/').filter(Boolean);
  const transformed = parts.map((segment) => {
    const match = segment.match(/^\[(\.{3})?([^\]]+)\]$/);
    if (match) {
      const [, dots, param] = match;
      return dots === '...' ? `:${param}{.+}` : `:${param}`;
    }
    return segment;
  });
  return `/${transformed.join('/')}`;
}

function registerRoutes() {
  api.routes = [];
  // Rotas mais específicas (mais profundas) primeiro.
  const entries = Object.entries(routeModules).sort((a, b) => b[0].length - a[0].length);

  for (const [key, mod] of entries) {
    const route = mod as Record<string, unknown>;
    const honoPath = getHonoPathFromKey(key);
    const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const;

    for (const method of methods) {
      const fn = route[method];
      if (typeof fn !== 'function') continue;

      const handler: Handler = async (c) => {
        const params = c.req.param();
        return await (fn as (req: Request, ctx: { params: Record<string, string> }) => Promise<Response>)(
          c.req.raw,
          { params }
        );
      };

      switch (method) {
        case 'GET': api.get(honoPath, handler); break;
        case 'POST': api.post(honoPath, handler); break;
        case 'PUT': api.put(honoPath, handler); break;
        case 'DELETE': api.delete(honoPath, handler); break;
        case 'PATCH': api.patch(honoPath, handler); break;
      }
    }
  }
}

registerRoutes();

export { api, API_BASENAME };
