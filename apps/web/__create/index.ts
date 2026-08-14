import { AsyncLocalStorage } from 'node:async_hooks';
import nodeConsole from 'node:console';
import { createHash, randomBytes } from 'node:crypto';
import { Hono } from 'hono';
import { contextStorage } from 'hono/context-storage';
import { cors } from 'hono/cors';
import { requestId } from 'hono/request-id';
import { createHonoServer } from 'react-router-hono-server/node';
import { serializeError } from 'serialize-error';
import { getHTMLForErrorPage } from './get-html-for-error-page';
import { API_BASENAME, api } from './route-builder';

const als = new AsyncLocalStorage<{ requestId: string }>();

for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
  const original = nodeConsole[method].bind(console);

  console[method] = (...args: unknown[]) => {
    const requestId = als.getStore()?.requestId;
    if (requestId) {
      original(`[traceId:${requestId}]`, ...args);
    } else {
      original(...args);
    }
  };
}

const app = new Hono();

app.use('*', requestId());

app.use('*', (c, next) => {
  const requestId = c.get('requestId');
  return als.run({ requestId }, () => next());
});

app.use(contextStorage());

// ── Rate limiting simples em memória, por IP+rota ───────────────────────────
// Protege endpoints custosos (IA/Groq) e sensíveis (pagamento/auth) contra
// abuso e força-bruta. OBS: in-memory serve p/ instância única; em ambiente
// multi-instância, migrar para Redis/Upstash.
const rateBuckets = new Map<string, { count: number; reset: number }>();
function rateLimit(opts: { windowMs: number; max: number }) {
  return async (c: any, next: any) => {
    const ip =
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
      c.req.header('x-real-ip') ||
      'unknown';
    const key = `${ip}:${c.req.path}`;
    const now = Date.now();
    const b = rateBuckets.get(key);
    if (!b || now > b.reset) {
      rateBuckets.set(key, { count: 1, reset: now + opts.windowMs });
    } else {
      b.count++;
      if (b.count > opts.max) {
        return c.json({ error: 'Muitas requisições. Tente novamente em instantes.' }, 429);
      }
    }
    return next();
  };
}
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rateBuckets) if (now > v.reset) rateBuckets.delete(k);
}, 60_000).unref?.();

// Aplicar limites nos endpoints nativos do Hono (custo/abuso):
app.use('/api/support/chat', rateLimit({ windowMs: 60_000, max: 20 }));
app.use('/api/retaguarda/chat', rateLimit({ windowMs: 60_000, max: 20 }));
app.use('/api/check-plan', rateLimit({ windowMs: 60_000, max: 40 }));
app.use('/api/check-retaguarda', rateLimit({ windowMs: 60_000, max: 40 }));
app.use('/api/user/data', rateLimit({ windowMs: 60_000, max: 80 }));
// API pública do aplicativo (sem login): limite mais apertado por IP.
app.use('/api/app/*', rateLimit({ windowMs: 60_000, max: 30 }));

// Não vaza detalhes internos (stack/serializeError) para o cliente.
app.onError((err, c) => {
  console.error('[onError]', serializeError(err));
  if (c.req.method !== 'GET') {
    return c.json({ error: 'Ocorreu um erro no servidor.' }, 500);
  }
  return c.html(getHTMLForErrorPage(err), 200);
});

if (process.env.CORS_ORIGINS) {
  app.use(
    '/*',
    cors({
      origin: process.env.CORS_ORIGINS.split(',').map((origin) => origin.trim()),
    })
  );
}

// NOTA: A autenticação do app é 100% Supabase Auth (client → JWT → servidor
// valida em /auth/v1/user). O sistema legado @hono/auth-js (Credentials + Neon)
// e o proxy /integrations/* do scaffold create.xyz foram REMOVIDOS por não
// serem usados e representarem superfície de ataque (CSRF desabilitado).

// ── Suporte IA ──────────────────────────────────────────────────────────────
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GROQ_SYSTEM = `Você é o assistente de suporte do OpinAI, plataforma de análise eleitoral brasileira. Responda sempre em português do Brasil, de forma clara e objetiva.

REGRA ABSOLUTA: responda EXCLUSIVAMENTE sobre o OpinAI. Para qualquer outro assunto, diga apenas: "Sou o assistente de suporte do OpinAI e só posso ajudar com dúvidas sobre a plataforma."

SOBRE O OPINAI:
- Plataforma de análise eleitoral com dados das eleições brasileiras (2022)
- Mapa eleitoral interativo por estado/município
- Formulários e pesquisas eleitorais com gráficos de resultado
- Sistema de favoritos e saldo de moedas
- Painel admin (Retaguarda) para gestores

PLANOS (3 tiers, assinatura MENSAL recorrente via Asaas — PIX, cartão ou boleto):
- Básico — R$150: ver todas as pesquisas + acesso ao banco de dados eleitoral.
- Médio — R$300: tudo do Básico + poder requisitar pesquisas personalizadas (cota mensal).
- Máximo — R$1.500: tudo do Médio + pesquisas ilimitadas e prioridade máxima.

PROBLEMAS COMUNS:
- Sem acesso após pagamento: aguarde alguns minutos e faça logout/login
- Mapa não carrega: navegador desatualizado ou WebGL desabilitado
- Sem acesso à Retaguarda: requer permissão de administrador
- Formulário não aparece: crie formulários na Retaguarda primeiro

Se não souber a resposta, sugira contato com o suporte. Nunca invente dados.`;

app.post('/api/support/chat', async (c) => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return c.json({ error: 'GROQ_API_KEY nao configurada no servidor.' }, 500);
  }

  let messages: { role: string; content: string }[];
  try {
    const body = await c.req.json();
    messages = body.messages;
    if (!Array.isArray(messages) || messages.length === 0) throw new Error();
  } catch {
    return c.json({ error: 'Corpo invalido. Envie { messages: [...] }' }, 400);
  }

  const history = messages.slice(-20).map(({ role, content }) => ({ role, content: String(content) }));

  let groqRes: Response;
  try {
    groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: GROQ_MODEL,
        max_tokens: 1024,
        stream: true,
        messages: [{ role: 'system', content: GROQ_SYSTEM }, ...history],
      }),
    });
  } catch (err: any) {
    return c.json({ error: `Falha ao conectar com Groq: ${err?.message}` }, 502);
  }

  if (!groqRes.ok) {
    const errBody = await groqRes.text();
    return c.json({ error: `Groq retornou ${groqRes.status}: ${errBody}` }, groqRes.status as any);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const reader = groqRes.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = ''; // acumula dados entre chunks para não perder linhas SSE incompletas
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          // { stream: true } preserva caracteres UTF-8 que chegam cortados entre chunks
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          // A última linha pode estar incompleta — guarda para o próximo chunk
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            try {
              const text = JSON.parse(data).choices?.[0]?.delta?.content ?? '';
              if (text) controller.enqueue(encoder.encode(text));
            } catch { /* JSON inválido — linha realmente incompleta */ }
          }
        }
        // Processar qualquer resto no buffer ao terminar
        if (buffer.startsWith('data: ')) {
          const data = buffer.slice(6).trim();
          if (data && data !== '[DONE]') {
            try {
              const text = JSON.parse(data).choices?.[0]?.delta?.content ?? '';
              if (text) controller.enqueue(encoder.encode(text));
            } catch { /* ignorar */ }
          }
        }
        controller.close();
      } catch (err) { controller.error(err); }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' },
  });
});
// ────────────────────────────────────────────────────────────────────────────

// ── Helper: verifica token de qualquer usuário autenticado ───────────────────
async function verificarUsuario(
  supaUrl: string,
  supaKey: string,
  authHeader: string
): Promise<{ ok: true; userId: string; email: string } | { ok: false; status: number; error: string }> {
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return { ok: false, status: 401, error: 'Token não fornecido' };

  const userRes = await fetch(`${supaUrl}/auth/v1/user`, {
    headers: { apikey: supaKey, Authorization: `Bearer ${token}` },
  });
  if (!userRes.ok) return { ok: false, status: 401, error: 'Token inválido' };
  const { id: userId, email } = await userRes.json();
  if (!userId) return { ok: false, status: 401, error: 'Usuário sem ID' };

  return { ok: true, userId, email: email ?? '' };
}

// Mapa de níveis dos tiers — ESPELHA src/config/planos.js (fonte de verdade).
// Mantido inline para o servidor não depender de import cross-JS.
const NIVEL_TIER: Record<string, number> = { basico: 1, medio: 2, maximo: 3 };

// ── Helper: verifica token + PLANO ATIVO (paywall server-side) ──────────────
// nivelMinimo: 1 = básico, 2 = médio, 3 = máximo.
// Retorna 402 (sem plano ativo) ou 403 (plano insuficiente p/ o recurso).
async function verificarPlano(
  supaUrl: string,
  supaKey: string,
  authHeader: string,
  nivelMinimo = 1
): Promise<
  | {
      ok: true;
      userId: string;
      email: string;
      tier: string;
      nivel: number;
      cota: number | null; // null = ilimitado; 0 = nenhum
      dataInicio: string | null;
    }
  | { ok: false; status: number; error: string }
> {
  const base = await verificarUsuario(supaUrl, supaKey, authHeader);
  if (!base.ok) return base;
  const { userId, email } = base;

  const now = new Date().toISOString();
  const planRes = await fetch(
    `${supaUrl}/rest/v1/planos_usuario?select=tier,status,data_fim,data_inicio,permanente,pesquisas_cota&email=eq.${encodeURIComponent(
      email
    )}&limit=20`,
    { headers: { apikey: supaKey, Authorization: `Bearer ${supaKey}`, Accept: 'application/json' } }
  );
  const plans: any[] = planRes.ok ? await planRes.json() : [];
  const ativos = plans.filter(
    (p) => p.permanente === true || (p.status === 'ativo' && p.data_fim && p.data_fim >= now)
  );
  if (ativos.length === 0)
    return { ok: false, status: 402, error: 'Nenhum plano ativo. Assine para acessar.' };

  // Plano ativo de maior nível é o que vale
  const winner = ativos.reduce((melhor, p) =>
    (NIVEL_TIER[p.tier] ?? 1) > (NIVEL_TIER[melhor.tier] ?? 1) ? p : melhor
  );
  const nivel = NIVEL_TIER[winner.tier] ?? 1;
  const tier = (Object.keys(NIVEL_TIER).find((t) => NIVEL_TIER[t] === nivel) ?? 'basico');
  if (nivel < nivelMinimo)
    return { ok: false, status: 403, error: 'Seu plano não inclui este recurso. Faça upgrade.' };

  return {
    ok: true,
    userId,
    email,
    tier,
    nivel,
    cota: winner.pesquisas_cota ?? null,
    dataInicio: winner.data_inicio ?? null,
  };
}

// ── Dados do usuário: favoritos, formulários, CPF ────────────────────────────
app.post('/api/user/data', async (c) => {
  const supaUrl = process.env.SUPABASE_URL!;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const hdrs = {
    apikey: supaKey,
    Authorization: `Bearer ${supaKey}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  // Paywall server-side: exige plano ativo (>= básico). Fecha o bypass em que
  // um usuário logado sem pagar acessava os dados chamando a API direto.
  const auth = await verificarPlano(supaUrl, supaKey, c.req.header('Authorization') ?? '', 1);
  if (!auth.ok) return c.json({ error: auth.error }, auth.status as any);
  const { userId } = auth;

  const body = await c.req.json();
  const { action, favoriteId, screenId, screenLabel, formularioId, cpf } = body;

  // ── FAVORITOS ──────────────────────────────────────────────
  if (action === 'list_favorites') {
    const res = await fetch(
      `${supaUrl}/rest/v1/favoritos_usuario?user_id=eq.${userId}&order=created_at.asc`,
      { headers: hdrs }
    );
    if (!res.ok) return c.json({ error: await res.text() }, 500);
    return c.json(await res.json());
  }

  if (action === 'add_favorite') {
    if (!screenId || !screenLabel) return c.json({ error: 'screenId e screenLabel obrigatórios' }, 400);
    // Evitar duplicata (screenId é controlado pelo cliente → escapar na URL)
    const existRes = await fetch(
      `${supaUrl}/rest/v1/favoritos_usuario?user_id=eq.${userId}&screen_id=eq.${encodeURIComponent(String(screenId))}`,
      { headers: hdrs }
    );
    const existing: any[] = existRes.ok ? await existRes.json() : [];
    if (existing.length > 0) return c.json({ error: 'Já está nos favoritos' }, 409);

    const res = await fetch(`${supaUrl}/rest/v1/favoritos_usuario`, {
      method: 'POST',
      headers: hdrs,
      body: JSON.stringify({ user_id: userId, screen_id: screenId, screen_label: screenLabel }),
    });
    if (!res.ok) return c.json({ error: await res.text() }, 500);
    return c.json({ ok: true });
  }

  if (action === 'remove_favorite') {
    if (!favoriteId) return c.json({ error: 'favoriteId obrigatório' }, 400);
    // favoriteId é controlado pelo cliente → escapar na URL. O guard
    // user_id=eq.${userId} garante que só remove favorito do próprio usuário.
    const res = await fetch(
      `${supaUrl}/rest/v1/favoritos_usuario?id=eq.${encodeURIComponent(String(favoriteId))}&user_id=eq.${userId}`,
      { method: 'DELETE', headers: hdrs }
    );
    if (!res.ok) return c.json({ error: await res.text() }, 500);
    return c.json({ ok: true });
  }

  // ── FORMULÁRIOS (pesquisa) ─────────────────────────────────
  if (action === 'list_formularios') {
    const formsRes = await fetch(
      `${supaUrl}/rest/v1/formularios?select=*&order=created_at.desc`,
      { headers: hdrs }
    );
    if (!formsRes.ok) return c.json({ error: await formsRes.text() }, 500);
    const formularios: any[] = await formsRes.json();

    // As respostas vêm de DUAS origens e ambas contam:
    //   respostas_formulario → quem respondeu pelo site (usuário logado)
    //   app_respostas        → quem respondeu pelo aplicativo (identificado por CPF)
    // Sem somar as duas, uma pesquisa respondida só pelo app aparece com 0.
    const [allRespostasRes, allAppRes] = await Promise.all([
      fetch(`${supaUrl}/rest/v1/respostas_formulario?select=formulario_id`, { headers: hdrs }),
      fetch(`${supaUrl}/rest/v1/app_respostas?select=formulario_id`, { headers: hdrs }),
    ]);
    const allRespostas: any[] = allRespostasRes.ok ? await allRespostasRes.json() : [];
    const allApp: any[] = allAppRes.ok ? await allAppRes.json() : [];

    const countMap: Record<string, number> = {};
    [...allRespostas, ...allApp].forEach((r: any) => {
      countMap[r.formulario_id] = (countMap[r.formulario_id] ?? 0) + 1;
    });

    return c.json(formularios.map(f => ({ ...f, total_respostas: countMap[f.id] ?? 0 })));
  }

  if (action === 'get_form_results') {
    if (!formularioId) return c.json({ error: 'formularioId obrigatório' }, 400);

    // Perguntas
    const perguntasRes = await fetch(
      `${supaUrl}/rest/v1/perguntas_formulario?formulario_id=eq.${formularioId}&order=ordem.asc`,
      { headers: hdrs }
    );
    if (!perguntasRes.ok) return c.json({ error: await perguntasRes.text() }, 500);
    const perguntas: any[] = await perguntasRes.json();

    const perguntasParseadas = perguntas.map((p: any) => ({
      ...p,
      opcoes: p.opcoes
        ? (typeof p.opcoes === 'string' ? JSON.parse(p.opcoes) : p.opcoes)
        : [],
    }));

    // Respostas
    const respostasRes = await fetch(
      `${supaUrl}/rest/v1/respostas_formulario?formulario_id=eq.${formularioId}`,
      { headers: hdrs }
    );
    if (!respostasRes.ok) return c.json({ error: await respostasRes.text() }, 500);
    const respostas: any[] = await respostasRes.json();

    // Buscar emails via Auth Admin API
    const userIds = [...new Set(respostas.map((r: any) => r.respondido_por).filter(Boolean))];
    const userMap: Record<string, string> = {};
    for (const uid of userIds) {
      try {
        const uRes = await fetch(`${supaUrl}/auth/v1/admin/users/${uid}`, { headers: hdrs });
        if (uRes.ok) {
          const u = await uRes.json();
          userMap[uid as string] = u.email ?? `user_${(uid as string).slice(0, 8)}`;
        }
      } catch { /* ignore */ }
      if (!userMap[uid as string]) userMap[uid as string] = `user_${(uid as string).slice(0, 8)}`;
    }

    const parseRespostas = (valor: any): any[] => {
      try {
        return typeof valor === 'string' ? JSON.parse(valor) : (valor ?? []);
      } catch {
        return [];
      }
    };

    const respostasProcessadas = respostas.map((r: any) => {
      const userLabel = userMap[r.respondido_por] ?? `user_${r.respondido_por.slice(0, 8)}`;
      return {
        ...r,
        respostas_array: parseRespostas(r.respostas),
        user_email: userLabel,
        user_name: userLabel,
        origem: 'site',
      };
    });

    // Respostas vindas do APLICATIVO (mesma pesquisa, outra tabela). Quem
    // responde pelo app não tem conta: a identidade é o CPF, do qual só
    // guardamos o hash — por isso o rótulo usa um prefixo anônimo dele.
    const appRes = await fetch(
      `${supaUrl}/rest/v1/app_respostas?formulario_id=eq.${encodeURIComponent(String(formularioId))}`,
      { headers: hdrs }
    );
    const respostasApp: any[] = appRes.ok ? await appRes.json() : [];

    const appProcessadas = respostasApp.map((r: any) => {
      const rotulo = `App · ${String(r.cpf_hash ?? '').slice(0, 8)}`;
      return {
        id: r.id,
        formulario_id: r.formulario_id,
        created_at: r.created_at,
        respostas_array: parseRespostas(r.respostas),
        user_email: rotulo,
        user_name: rotulo,
        origem: 'app',
      };
    });

    const todas = [...respostasProcessadas, ...appProcessadas].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return c.json({ perguntas: perguntasParseadas, respostas: todas });
  }

  // ── CPF ────────────────────────────────────────────────────
  if (action === 'get_cpf') {
    const res = await fetch(
      `${supaUrl}/rest/v1/perfil_usuario?user_id=eq.${userId}&select=cpf`,
      { headers: hdrs }
    );
    const data: any[] = res.ok ? await res.json() : [];
    return c.json({ cpf: data[0]?.cpf ?? '' });
  }

  if (action === 'update_cpf') {
    const cpfDigits = normalizarCpf(cpf);
    // Valida os dígitos verificadores, não só o tamanho: antes qualquer
    // sequência de 11 dígitos passava, e o CPF é a identidade que liga esta
    // conta aos dados do aplicativo.
    if (!cpfValido(cpfDigits)) return c.json({ error: 'CPF inválido' }, 400);

    const existRes = await fetch(
      `${supaUrl}/rest/v1/perfil_usuario?user_id=eq.${userId}&select=cpf`,
      { headers: hdrs }
    );
    const existing: any[] = existRes.ok ? await existRes.json() : [];

    // Travado depois de definido — mesma regra do app: moedas, respostas e
    // resgates ficam atrelados ao CPF, então trocar moveria saldo entre CPFs.
    if (existing[0]?.cpf && existing[0].cpf !== cpfDigits) {
      return c.json({ error: 'O CPF desta conta já foi definido e não pode ser alterado.' }, 409);
    }
    if (existing[0]?.cpf === cpfDigits) return c.json({ ok: true, cpf: cpfDigits });

    // Um CPF por conta (o índice único uq_perfil_cpf é a garantia final).
    const usadoRes = await fetch(
      `${supaUrl}/rest/v1/perfil_usuario?cpf=eq.${encodeURIComponent(cpfDigits)}&select=user_id&limit=1`,
      { headers: hdrs }
    );
    const usado: any[] = usadoRes.ok ? await usadoRes.json() : [];
    if (usado.length > 0 && usado[0].user_id !== userId) {
      return c.json({ error: 'Este CPF já está vinculado a outra conta.' }, 409);
    }

    const agora = new Date().toISOString();
    const gravaRes = existing.length > 0
      ? await fetch(`${supaUrl}/rest/v1/perfil_usuario?user_id=eq.${userId}`, {
          method: 'PATCH', headers: hdrs,
          body: JSON.stringify({ cpf: cpfDigits, cpf_definido_em: agora, updated_at: agora }),
        })
      : await fetch(`${supaUrl}/rest/v1/perfil_usuario`, {
          method: 'POST', headers: hdrs,
          body: JSON.stringify({ user_id: userId, cpf: cpfDigits, cpf_definido_em: agora }),
        });

    // Antes o resultado da gravação era ignorado e a resposta era sempre
    // ok:true — a tela dizia "salvo" mesmo quando nada tinha sido gravado.
    if (!gravaRes.ok) {
      const detalhe = await gravaRes.text();
      console.error('[user/data:update_cpf]', detalhe);
      if (detalhe.includes('23505')) {
        return c.json({ error: 'Este CPF já está vinculado a outra conta.' }, 409);
      }
      return c.json({ error: 'Não foi possível salvar o CPF.' }, 500);
    }

    return c.json({ ok: true, cpf: cpfDigits });
  }

  return c.json({ error: 'Ação desconhecida' }, 400);
});
// ─────────────────────────────────────────────────────────────────────────────

// ── Solicitações de pesquisa (Fase 2 — planos Médio e Máximo) ───────────────
// Médio: cota mensal (pesquisas_cota). Máximo: ilimitado + prioridade 'alta'.
app.post('/api/user/survey', async (c) => {
  const supaUrl = process.env.SUPABASE_URL!;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const hdrs = {
    apikey: supaKey,
    Authorization: `Bearer ${supaKey}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  const body = await c.req.json().catch(() => ({}));
  const { action } = body;

  // Conta solicitações do ciclo atual (desde data_inicio do plano).
  async function contarUsadas(userId: string, dataInicio: string | null): Promise<number> {
    let url = `${supaUrl}/rest/v1/solicitacoes_pesquisa?select=id&user_id=eq.${userId}`;
    if (dataInicio) url += `&created_at=gte.${encodeURIComponent(dataInicio)}`;
    const r = await fetch(url, { headers: hdrs });
    const rows: any[] = r.ok ? await r.json() : [];
    return rows.length;
  }

  // LISTAR as próprias solicitações (qualquer plano ativo)
  if (action === 'list_mine') {
    const auth = await verificarPlano(supaUrl, supaKey, c.req.header('Authorization') ?? '', 1);
    if (!auth.ok) return c.json({ error: auth.error }, auth.status as any);
    const res = await fetch(
      `${supaUrl}/rest/v1/solicitacoes_pesquisa?user_id=eq.${auth.userId}&order=created_at.desc`,
      { headers: hdrs }
    );
    if (!res.ok) return c.json({ error: await res.text() }, 500);
    return c.json(await res.json());
  }

  // CONSULTAR cota (para a UI mostrar quanto resta)
  if (action === 'quota') {
    const auth = await verificarPlano(supaUrl, supaKey, c.req.header('Authorization') ?? '', 1);
    if (!auth.ok) return c.json({ error: auth.error }, auth.status as any);
    const usadas = await contarUsadas(auth.userId, auth.dataInicio);
    const restante = auth.cota === null ? null : Math.max(0, auth.cota - usadas);
    return c.json({ tier: auth.tier, nivel: auth.nivel, cota: auth.cota, usadas, restante });
  }

  // CRIAR solicitação (exige Médio ou Máximo)
  if (action === 'create') {
    const auth = await verificarPlano(supaUrl, supaKey, c.req.header('Authorization') ?? '', 2);
    if (!auth.ok) return c.json({ error: auth.error }, auth.status as any);

    const titulo = String(body.titulo ?? '').trim();
    const objetivo = String(body.objetivo ?? '').trim();
    const publicoAlvo = String(body.publico_alvo ?? '').trim();
    const detalhes = String(body.detalhes ?? '').trim();
    if (!titulo || !objetivo)
      return c.json({ error: 'Título e objetivo são obrigatórios.' }, 400);

    // Cota (Médio). Máximo tem cota null = ilimitado.
    if (auth.cota !== null) {
      const usadas = await contarUsadas(auth.userId, auth.dataInicio);
      if (usadas >= auth.cota)
        return c.json(
          { error: `Cota de ${auth.cota} pesquisas atingida neste ciclo. Faça upgrade para o plano Máximo.` },
          429
        );
    }

    const prioridade = auth.tier === 'maximo' ? 'alta' : 'normal';
    const res = await fetch(`${supaUrl}/rest/v1/solicitacoes_pesquisa`, {
      method: 'POST',
      headers: { ...hdrs, Prefer: 'return=representation' },
      body: JSON.stringify({
        user_id: auth.userId,
        email: auth.email,
        tier: auth.tier,
        titulo,
        objetivo,
        publico_alvo: publicoAlvo || null,
        detalhes: detalhes || null,
        prioridade,
        status: 'pendente',
      }),
    });
    if (!res.ok) return c.json({ error: await res.text() }, 500);
    const [nova] = await res.json();
    return c.json({ ok: true, solicitacao: nova });
  }

  return c.json({ error: 'Ação desconhecida' }, 400);
});
// ─────────────────────────────────────────────────────────────────────────────

// ── Helper: verifica token + permissão de retaguarda ────────────────────────
async function verificarRetaguarda(
  supaUrl: string,
  supaKey: string,
  authHeader: string
): Promise<{ ok: true; userId: string } | { ok: false; status: number; error: string }> {
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return { ok: false, status: 401, error: 'Token não fornecido' };

  const userRes = await fetch(`${supaUrl}/auth/v1/user`, {
    headers: { apikey: supaKey, Authorization: `Bearer ${token}` },
  });
  if (!userRes.ok) return { ok: false, status: 401, error: 'Token inválido' };
  const { id: userId } = await userRes.json();
  if (!userId) return { ok: false, status: 401, error: 'Usuário sem ID' };

  const permRes = await fetch(
    `${supaUrl}/rest/v1/permissoes_retaguarda?user_id=eq.${userId}&ativo=eq.true&limit=1`,
    { headers: { apikey: supaKey, Authorization: `Bearer ${supaKey}` } }
  );
  const perms: any[] = await permRes.json();
  if (!Array.isArray(perms) || perms.length === 0)
    return { ok: false, status: 403, error: 'Sem permissão de retaguarda' };

  return { ok: true, userId };
}

// ── Retaguarda: estatísticas de usuários ─────────────────────────────────────
app.get('/api/retaguarda/stats', async (c) => {
  const supaUrl = process.env.SUPABASE_URL!;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const auth = await verificarRetaguarda(supaUrl, supaKey, c.req.header('Authorization') ?? '');
  if (!auth.ok) return c.json({ error: auth.error }, auth.status as any);

  try {
    // Usa a tabela auth.users via função SQL (evita expor diretamente)
    // Fallback: conta usuários pelos planos_usuario cadastrados
    const res = await fetch(
      `${supaUrl}/rest/v1/planos_usuario?select=created_at`,
      { headers: { apikey: supaKey, Authorization: `Bearer ${supaKey}` } }
    );
    const rows: any[] = await res.json();
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const startOfWeek = new Date(now.getTime() - 7 * 86400000).toISOString();
    const startOfMonth = new Date(now.getTime() - 30 * 86400000).toISOString();

    return c.json({
      total_usuarios: rows.length,
      usuarios_hoje:  rows.filter(r => r.created_at >= startOfDay).length,
      usuarios_semana: rows.filter(r => r.created_at >= startOfWeek).length,
      usuarios_mes:   rows.filter(r => r.created_at >= startOfMonth).length,
    });
  } catch {
    return c.json({ total_usuarios: 0, usuarios_hoje: 0, usuarios_semana: 0, usuarios_mes: 0 });
  }
});

// ── Retaguarda: CRUD de formulários ──────────────────────────────────────────
app.post('/api/retaguarda/forms', async (c) => {
  const supaUrl = process.env.SUPABASE_URL!;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const hdrs = { apikey: supaKey, Authorization: `Bearer ${supaKey}`, 'Content-Type': 'application/json', Accept: 'application/json' };

  const auth = await verificarRetaguarda(supaUrl, supaKey, c.req.header('Authorization') ?? '');
  if (!auth.ok) return c.json({ error: auth.error }, auth.status as any);
  const { userId } = auth;

  const body = await c.req.json();
  const { action, formId, titulo, descricao, perguntas, ativo } = body;
  // Moedas que o app pagará por resposta (>= 0; campo opcional p/ retrocompat.)
  const moedasRecompensa = Math.max(0, parseInt(body.moedasRecompensa, 10) || 0);
  const now = new Date().toISOString();

  const buildPerguntas = (fId: string) =>
    (perguntas ?? []).map((p: any, i: number) => ({
      formulario_id: fId,
      ordem: i + 1,
      texto: p.texto,
      tipo: p.tipo,
      obrigatoria: p.obrigatoria ?? false,
      opcoes: (p.tipo === 'multipla_escolha' || p.tipo === 'checkbox')
        ? (typeof p.opcoes === 'string' ? p.opcoes : JSON.stringify(p.opcoes))
        : null,
      validacao: p.validacao ? (typeof p.validacao === 'string' ? p.validacao : JSON.stringify(p.validacao)) : null,
    }));

  // LIST — busca todos os formulários (ou apenas os ativos)
  if (action === 'list') {
    let url = `${supaUrl}/rest/v1/formularios?select=*&order=created_at.desc`;
    if (ativo !== undefined) url += `&ativo=eq.${ativo}`;
    const res = await fetch(url, { headers: hdrs });
    if (!res.ok) return c.json({ error: await res.text() }, 500);
    return c.json(await res.json());
  }

  // CREATE
  if (action === 'create') {
    const fRes = await fetch(`${supaUrl}/rest/v1/formularios?select=*`, {
      method: 'POST',
      headers: { ...hdrs, Prefer: 'return=representation' },
      body: JSON.stringify({ titulo, descricao, criado_por: userId, ativo: true, moedas_recompensa: moedasRecompensa }),
    });
    if (!fRes.ok) return c.json({ error: await fRes.text() }, 500);
    const [formData] = await fRes.json();

    if (perguntas?.length) {
      await fetch(`${supaUrl}/rest/v1/perguntas_formulario`, {
        method: 'POST', headers: hdrs,
        body: JSON.stringify(buildPerguntas(formData.id)),
      });
    }
    return c.json({ form: formData });
  }

  // UPDATE
  if (action === 'update') {
    const fRes = await fetch(`${supaUrl}/rest/v1/formularios?id=eq.${formId}`, {
      method: 'PATCH', headers: hdrs,
      body: JSON.stringify({ titulo, descricao, moedas_recompensa: moedasRecompensa, updated_at: now }),
    });
    if (!fRes.ok) return c.json({ error: await fRes.text() }, 500);

    await fetch(`${supaUrl}/rest/v1/perguntas_formulario?formulario_id=eq.${formId}`, {
      method: 'DELETE', headers: hdrs,
    });
    if (perguntas?.length) {
      await fetch(`${supaUrl}/rest/v1/perguntas_formulario`, {
        method: 'POST', headers: hdrs,
        body: JSON.stringify(buildPerguntas(formId)),
      });
    }
    return c.json({ ok: true });
  }

  // DELETE
  if (action === 'delete') {
    await fetch(`${supaUrl}/rest/v1/perguntas_formulario?formulario_id=eq.${formId}`, {
      method: 'DELETE', headers: hdrs,
    });
    await fetch(`${supaUrl}/rest/v1/formularios?id=eq.${formId}`, {
      method: 'DELETE', headers: hdrs,
    });
    return c.json({ ok: true });
  }

  // GET_QUESTIONS — carrega perguntas de um formulário pelo server-side (service_role)
  if (action === 'get_questions') {
    if (!formId) return c.json({ error: 'formId obrigatório' }, 400);
    const res = await fetch(
      `${supaUrl}/rest/v1/perguntas_formulario?formulario_id=eq.${formId}&order=ordem.asc`,
      { headers: hdrs }
    );
    if (!res.ok) return c.json({ error: await res.text() }, 500);
    return c.json(await res.json());
  }

  // SUBMIT_RESPONSE — grava resposta do formulário via service_role (ignora RLS)
  if (action === 'submit_response') {
    if (!formId) return c.json({ error: 'formId obrigatório' }, 400);
    const respostas = body.respostas ?? [];
    const res = await fetch(`${supaUrl}/rest/v1/respostas_formulario`, {
      method: 'POST',
      headers: hdrs,
      body: JSON.stringify({
        formulario_id: formId,
        respondido_por: userId,
        respostas: typeof respostas === 'string' ? respostas : JSON.stringify(respostas),
      }),
    });
    if (!res.ok) return c.json({ error: await res.text() }, 500);
    return c.json({ ok: true });
  }

  return c.json({ error: 'Ação desconhecida' }, 400);
});
// ─────────────────────────────────────────────────────────────────────────────

// ── Retaguarda: CRUD de cupons da loja do app ────────────────────────────────
app.post('/api/retaguarda/cupons', async (c) => {
  const supaUrl = process.env.SUPABASE_URL!;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const hdrs = { apikey: supaKey, Authorization: `Bearer ${supaKey}`, 'Content-Type': 'application/json', Accept: 'application/json' };

  const auth = await verificarRetaguarda(supaUrl, supaKey, c.req.header('Authorization') ?? '');
  if (!auth.ok) return c.json({ error: auth.error }, auth.status as any);

  const body = await c.req.json();
  const { action, id } = body;

  if (action === 'list') {
    const res = await fetch(`${supaUrl}/rest/v1/cupons?select=*&order=created_at.desc`, { headers: hdrs });
    if (!res.ok) return c.json({ error: await res.text() }, 500);
    return c.json(await res.json());
  }

  // Campos validados uma vez, usados em create e update
  const PARCEIROS = ['ifood', 'uber', '99', 'outro'];
  const montarCampos = () => {
    const titulo = String(body.titulo ?? '').trim();
    const custo = parseInt(body.custoMoedas, 10);
    const quantidade = Math.max(0, parseInt(body.quantidade, 10) || 0);
    const parceiro = PARCEIROS.includes(body.parceiro) ? body.parceiro : 'outro';
    if (!titulo) return { erro: 'Título é obrigatório' };
    if (!Number.isFinite(custo) || custo <= 0) return { erro: 'Custo em moedas deve ser maior que zero' };
    return {
      campos: {
        titulo,
        descricao: String(body.descricao ?? '').trim() || null,
        parceiro,
        custo_moedas: custo,
        quantidade,
        validade: body.validade || null,
        updated_at: new Date().toISOString(),
      },
    };
  };

  if (action === 'create') {
    const r = montarCampos();
    if (r.erro) return c.json({ error: r.erro }, 400);
    const res = await fetch(`${supaUrl}/rest/v1/cupons?select=*`, {
      method: 'POST',
      headers: { ...hdrs, Prefer: 'return=representation' },
      body: JSON.stringify({ ...r.campos, ativo: true, criado_por: auth.userId }),
    });
    if (!res.ok) return c.json({ error: await res.text() }, 500);
    const [cupom] = await res.json();
    return c.json({ cupom });
  }

  if (action === 'update') {
    if (!id) return c.json({ error: 'id obrigatório' }, 400);
    const r = montarCampos();
    if (r.erro) return c.json({ error: r.erro }, 400);
    const res = await fetch(`${supaUrl}/rest/v1/cupons?id=eq.${encodeURIComponent(String(id))}`, {
      method: 'PATCH', headers: hdrs, body: JSON.stringify(r.campos),
    });
    if (!res.ok) return c.json({ error: await res.text() }, 500);
    return c.json({ ok: true });
  }

  // Ativa/desativa sem mexer nos demais campos (some/aparece na loja do app)
  if (action === 'toggle_ativo') {
    if (!id) return c.json({ error: 'id obrigatório' }, 400);
    const res = await fetch(`${supaUrl}/rest/v1/cupons?id=eq.${encodeURIComponent(String(id))}`, {
      method: 'PATCH', headers: hdrs,
      body: JSON.stringify({ ativo: !!body.ativo, updated_at: new Date().toISOString() }),
    });
    if (!res.ok) return c.json({ error: await res.text() }, 500);
    return c.json({ ok: true });
  }

  if (action === 'delete') {
    if (!id) return c.json({ error: 'id obrigatório' }, 400);
    const res = await fetch(`${supaUrl}/rest/v1/cupons?id=eq.${encodeURIComponent(String(id))}`, {
      method: 'DELETE', headers: hdrs,
    });
    if (!res.ok) return c.json({ error: await res.text() }, 500);
    return c.json({ ok: true });
  }

  return c.json({ error: 'Ação desconhecida' }, 400);
});
// ─────────────────────────────────────────────────────────────────────────────

// ═════════════════════════════════════════════════════════════════════════════
// API PÚBLICA DO APLICATIVO (coleta de pesquisas por CPF, sem login)
// Identificação por CPF com hash SHA-256 + pepper (LGPD: CPF puro nunca é
// gravado). Regras garantidas também por UNIQUE no banco:
//   - 1 resposta por CPF por pesquisa (app_respostas)
//   - 1 resgate por CPF por cupom (cupons_resgates)
// ═════════════════════════════════════════════════════════════════════════════

function normalizarCpf(raw: unknown): string {
  return String(raw ?? '').replace(/\D/g, '');
}

// Validação completa de CPF (dígitos verificadores)
function cpfValido(cpf: string): boolean {
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  for (const pos of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < pos; i++) soma += parseInt(cpf[i], 10) * (pos + 1 - i);
    const dig = ((soma * 10) % 11) % 10;
    if (dig !== parseInt(cpf[pos], 10)) return false;
  }
  return true;
}

function hashCpf(cpf: string): string {
  const pepper = process.env.CPF_PEPPER || '';
  return createHash('sha256').update(`${cpf}${pepper}`).digest('hex');
}

/**
 * Autenticação das rotas do aplicativo.
 *
 * O app deixou de aceitar o CPF no corpo da requisição: ele vem do PERFIL da
 * conta autenticada. Antes, qualquer um que soubesse o CPF alheio podia
 * responder pesquisas e gastar as moedas daquela pessoa chamando a API direto.
 *
 * Note que NÃO há verificarPlano aqui: quem usa o app é o público que responde
 * pesquisa por moedas, não um cliente pagante. Passar pelo paywall (como faz
 * /api/user/data) barraria todo mundo com 402.
 */
async function autenticarApp(supaUrl: string, supaKey: string, authHeader: string) {
  const base = await verificarUsuario(supaUrl, supaKey, authHeader);
  if (!base.ok) return base;

  const res = await fetch(
    `${supaUrl}/rest/v1/perfil_usuario?user_id=eq.${base.userId}&select=cpf,cpf_definido_em`,
    { headers: { apikey: supaKey, Authorization: `Bearer ${supaKey}`, Accept: 'application/json' } }
  );
  const perfil: any[] = res.ok ? await res.json() : [];
  const cpf = perfil[0]?.cpf ?? null;

  // 428: conta válida, mas ainda sem CPF. O app usa isto para mandar o
  // usuário à tela de identificação em vez de mostrar erro genérico.
  if (!cpf) {
    return { ok: false as const, status: 428, error: 'CPF ainda não definido', precisaCpf: true };
  }

  return {
    ok: true as const,
    userId: base.userId,
    email: base.email,
    cpf,
    cpfHash: hashCpf(cpf),
  };
}

// ── App: perfil da conta (CPF) ───────────────────────────────────────────────
// Exige apenas login — NÃO exige plano. É por aqui que o app define o CPF,
// e não por /api/user/data, que é gateado por plano pago.
app.post('/api/app/perfil', async (c) => {
  const supaUrl = process.env.SUPABASE_URL!;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const hdrs = {
    apikey: supaKey, Authorization: `Bearer ${supaKey}`,
    'Content-Type': 'application/json', Accept: 'application/json',
  };

  const auth = await verificarUsuario(supaUrl, supaKey, c.req.header('Authorization') ?? '');
  if (!auth.ok) return c.json({ error: auth.error }, auth.status as any);

  const body = await c.req.json().catch(() => ({}));
  const action = body?.action ?? 'get';

  const perfilRes = await fetch(
    `${supaUrl}/rest/v1/perfil_usuario?user_id=eq.${auth.userId}&select=cpf,cpf_definido_em`,
    { headers: hdrs }
  );
  const perfil: any[] = perfilRes.ok ? await perfilRes.json() : [];
  const atual = perfil[0] ?? null;

  if (action === 'get') {
    return c.json({
      email: auth.email,
      cpf: atual?.cpf ?? null,
      definido_em: atual?.cpf_definido_em ?? null,
    });
  }

  if (action === 'set') {
    // Travado depois de definido: moedas, respostas e resgates ficam presos
    // ao CPF, então trocar permitiria mover saldo e responder duas vezes.
    if (atual?.cpf) {
      return c.json({ error: 'O CPF desta conta já foi definido e não pode ser alterado.' }, 409);
    }

    const cpf = normalizarCpf(body?.cpf);
    if (!cpfValido(cpf)) return c.json({ error: 'CPF inválido' }, 400);

    // Um CPF por conta: dois cadastros do mesmo CPF gerariam o mesmo hash e
    // compartilhariam saldo e respostas.
    const usadoRes = await fetch(
      `${supaUrl}/rest/v1/perfil_usuario?cpf=eq.${encodeURIComponent(cpf)}&select=user_id&limit=1`,
      { headers: hdrs }
    );
    const usado: any[] = usadoRes.ok ? await usadoRes.json() : [];
    if (usado.length > 0 && usado[0].user_id !== auth.userId) {
      return c.json({ error: 'Este CPF já está vinculado a outra conta.' }, 409);
    }

    const agora = new Date().toISOString();
    const gravaRes = atual
      ? await fetch(`${supaUrl}/rest/v1/perfil_usuario?user_id=eq.${auth.userId}`, {
          method: 'PATCH', headers: hdrs,
          body: JSON.stringify({ cpf, cpf_definido_em: agora, updated_at: agora }),
        })
      : await fetch(`${supaUrl}/rest/v1/perfil_usuario`, {
          method: 'POST', headers: hdrs,
          body: JSON.stringify({ user_id: auth.userId, cpf, cpf_definido_em: agora }),
        });

    if (!gravaRes.ok) {
      const detalhe = await gravaRes.text();
      console.error('[app/perfil:set]', detalhe);
      // 23505 = unique_violation: alguém gravou o mesmo CPF entre a checagem
      // acima e este INSERT. O índice único é a garantia final.
      if (detalhe.includes('23505')) {
        return c.json({ error: 'Este CPF já está vinculado a outra conta.' }, 409);
      }
      return c.json({ error: 'Não foi possível salvar o CPF.' }, 500);
    }

    return c.json({ ok: true, cpf, definido_em: agora });
  }

  return c.json({ error: 'Ação desconhecida' }, 400);
});

// ── App: listar pesquisas ativas (+ flag de já respondida se CPF vier) ───────
app.post('/api/app/pesquisas', async (c) => {
  const supaUrl = process.env.SUPABASE_URL!;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const hdrs = { apikey: supaKey, Authorization: `Bearer ${supaKey}`, Accept: 'application/json' };

  const auth = await autenticarApp(supaUrl, supaKey, c.req.header('Authorization') ?? '');
  if (!auth.ok) return c.json({ error: auth.error, precisa_cpf: auth.precisaCpf }, auth.status as any);

  const body = await c.req.json().catch(() => ({}));
  const { action, formularioId } = body;

  // Perguntas de uma pesquisa específica
  if (action === 'perguntas') {
    if (!formularioId) return c.json({ error: 'formularioId obrigatório' }, 400);
    const res = await fetch(
      `${supaUrl}/rest/v1/perguntas_formulario?formulario_id=eq.${encodeURIComponent(String(formularioId))}&select=id,ordem,texto,tipo,obrigatoria,opcoes&order=ordem.asc`,
      { headers: hdrs }
    );
    if (!res.ok) return c.json({ error: 'Erro ao buscar perguntas' }, 500);
    return c.json(await res.json());
  }

  // Lista de pesquisas ativas (default)
  const res = await fetch(
    `${supaUrl}/rest/v1/formularios?ativo=eq.true&select=id,titulo,descricao,moedas_recompensa,created_at&order=created_at.desc`,
    { headers: hdrs }
  );
  if (!res.ok) return c.json({ error: 'Erro ao buscar pesquisas' }, 500);
  const formularios: any[] = await res.json();

  const respRes = await fetch(
    `${supaUrl}/rest/v1/app_respostas?cpf_hash=eq.${auth.cpfHash}&select=formulario_id`,
    { headers: hdrs }
  );
  const respondidas = new Set(
    (respRes.ok ? await respRes.json() : []).map((r: any) => r.formulario_id)
  );
  return c.json(formularios.map(f => ({ ...f, ja_respondeu: respondidas.has(f.id) })));
});

// ── App: responder pesquisa (1x por CPF) e ganhar moedas ─────────────────────
app.post('/api/app/responder', async (c) => {
  const supaUrl = process.env.SUPABASE_URL!;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const hdrs = { apikey: supaKey, Authorization: `Bearer ${supaKey}`, 'Content-Type': 'application/json', Accept: 'application/json' };

  const auth = await autenticarApp(supaUrl, supaKey, c.req.header('Authorization') ?? '');
  if (!auth.ok) return c.json({ error: auth.error, precisa_cpf: auth.precisaCpf }, auth.status as any);
  const cpfHash = auth.cpfHash;

  const body = await c.req.json().catch(() => ({}));
  const { formularioId, respostas } = body;

  if (!formularioId) return c.json({ error: 'formularioId obrigatório' }, 400);
  if (!Array.isArray(respostas) || respostas.length === 0)
    return c.json({ error: 'Envie as respostas da pesquisa' }, 400);

  // Pesquisa precisa existir e estar ativa
  const formRes = await fetch(
    `${supaUrl}/rest/v1/formularios?id=eq.${encodeURIComponent(String(formularioId))}&ativo=eq.true&select=id,moedas_recompensa&limit=1`,
    { headers: hdrs }
  );
  const forms: any[] = formRes.ok ? await formRes.json() : [];
  if (forms.length === 0) return c.json({ error: 'Pesquisa não encontrada ou encerrada' }, 404);
  const moedas = forms[0].moedas_recompensa ?? 0;

  const insRes = await fetch(`${supaUrl}/rest/v1/app_respostas`, {
    method: 'POST',
    headers: hdrs,
    body: JSON.stringify({
      formulario_id: formularioId,
      cpf_hash: cpfHash,
      respostas,
      moedas_ganhas: moedas,
    }),
  });

  if (insRes.status === 409) {
    return c.json({ error: 'Este CPF já respondeu esta pesquisa' }, 409);
  }
  if (!insRes.ok) {
    console.error('[app/responder]', await insRes.text());
    return c.json({ error: 'Erro ao registrar resposta' }, 500);
  }

  return c.json({ ok: true, moedas_ganhas: moedas });
});

// ── App: saldo de moedas do CPF ──────────────────────────────────────────────
async function calcularSaldo(supaUrl: string, hdrs: any, cpfHash: string) {
  const [ganhosRes, gastosRes] = await Promise.all([
    fetch(`${supaUrl}/rest/v1/app_respostas?cpf_hash=eq.${cpfHash}&select=moedas_ganhas`, { headers: hdrs }),
    fetch(`${supaUrl}/rest/v1/cupons_resgates?cpf_hash=eq.${cpfHash}&select=moedas_pagas`, { headers: hdrs }),
  ]);
  const ganhos: any[] = ganhosRes.ok ? await ganhosRes.json() : [];
  const gastos: any[] = gastosRes.ok ? await gastosRes.json() : [];
  const totalGanho = ganhos.reduce((s, r) => s + (r.moedas_ganhas || 0), 0);
  const totalGasto = gastos.reduce((s, r) => s + (r.moedas_pagas || 0), 0);
  return {
    saldo: totalGanho - totalGasto,
    total_ganho: totalGanho,
    total_gasto: totalGasto,
    pesquisas_respondidas: ganhos.length,
    cupons_resgatados: gastos.length,
  };
}

app.post('/api/app/saldo', async (c) => {
  const supaUrl = process.env.SUPABASE_URL!;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const hdrs = { apikey: supaKey, Authorization: `Bearer ${supaKey}`, Accept: 'application/json' };

  const auth = await autenticarApp(supaUrl, supaKey, c.req.header('Authorization') ?? '');
  if (!auth.ok) return c.json({ error: auth.error, precisa_cpf: auth.precisaCpf }, auth.status as any);

  return c.json(await calcularSaldo(supaUrl, hdrs, auth.cpfHash));
});

// ── App: loja de cupons (ativos, com estoque e dentro da validade) ───────────
app.post('/api/app/loja', async (c) => {
  const supaUrl = process.env.SUPABASE_URL!;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const hdrs = { apikey: supaKey, Authorization: `Bearer ${supaKey}`, Accept: 'application/json' };

  const auth = await autenticarApp(supaUrl, supaKey, c.req.header('Authorization') ?? '');
  if (!auth.ok) return c.json({ error: auth.error, precisa_cpf: auth.precisaCpf }, auth.status as any);

  const body = await c.req.json().catch(() => ({}));

  // Cupons que ESTE CPF já resgatou, com o código entregue. O código só
  // aparecia uma vez (no alerta logo após o resgate) e se perdia ao fechar;
  // aqui ele fica recuperável a qualquer momento.
  if (body?.action === 'meus_resgates') {
    const cpfHash = auth.cpfHash;

    const res = await fetch(
      `${supaUrl}/rest/v1/cupons_resgates?cpf_hash=eq.${cpfHash}` +
      `&select=id,codigo_entregue,moedas_pagas,created_at,cupons(id,titulo,descricao,parceiro)` +
      `&order=created_at.desc`,
      { headers: hdrs }
    );
    if (!res.ok) {
      console.error('[app/loja:meus_resgates]', await res.text());
      return c.json({ error: 'Erro ao buscar seus cupons' }, 500);
    }
    const linhas: any[] = await res.json();

    // Achata o embed do PostgREST e tolera cupom apagado depois do resgate.
    return c.json(linhas.map((r) => ({
      id: r.id,
      codigo: r.codigo_entregue,
      moedas_pagas: r.moedas_pagas,
      resgatado_em: r.created_at,
      titulo: r.cupons?.titulo ?? 'Cupom removido',
      descricao: r.cupons?.descricao ?? null,
      parceiro: r.cupons?.parceiro ?? 'outro',
    })));
  }

  const hoje = new Date().toISOString().slice(0, 10);
  const res = await fetch(
    `${supaUrl}/rest/v1/cupons?ativo=eq.true&or=(validade.is.null,validade.gte.${hoje})` +
    `&select=id,titulo,descricao,parceiro,custo_moedas,quantidade,resgatados,validade&order=custo_moedas.asc`,
    { headers: hdrs }
  );
  if (!res.ok) return c.json({ error: 'Erro ao buscar cupons' }, 500);
  const cupons: any[] = await res.json();

  const disponiveis = cupons
    .filter(cp => (cp.quantidade - (cp.resgatados || 0)) > 0)
    .map(({ quantidade, resgatados, ...cp }) => ({
      ...cp,
      estoque_disponivel: quantidade - (resgatados || 0),
    }));

  // Marca quais este CPF já resgatou
  const rRes = await fetch(
    `${supaUrl}/rest/v1/cupons_resgates?cpf_hash=eq.${auth.cpfHash}&select=cupom_id`,
    { headers: hdrs }
  );
  const resgatados = new Set((rRes.ok ? await rRes.json() : []).map((r: any) => r.cupom_id));
  return c.json(disponiveis.map(cp => ({ ...cp, ja_resgatado: resgatados.has(cp.id) })));
});

// ── App: resgatar cupom (1x por CPF por cupom) ───────────────────────────────
app.post('/api/app/resgatar', async (c) => {
  const supaUrl = process.env.SUPABASE_URL!;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const hdrs = { apikey: supaKey, Authorization: `Bearer ${supaKey}`, 'Content-Type': 'application/json', Accept: 'application/json' };

  const auth = await autenticarApp(supaUrl, supaKey, c.req.header('Authorization') ?? '');
  if (!auth.ok) return c.json({ error: auth.error, precisa_cpf: auth.precisaCpf }, auth.status as any);
  const cpfHash = auth.cpfHash;

  const body = await c.req.json().catch(() => ({}));
  const { cupomId } = body;
  if (!cupomId) return c.json({ error: 'cupomId obrigatório' }, 400);

  // Cupom precisa estar ativo, com estoque e dentro da validade
  const hoje = new Date().toISOString().slice(0, 10);
  const cupomRes = await fetch(
    `${supaUrl}/rest/v1/cupons?id=eq.${encodeURIComponent(String(cupomId))}&ativo=eq.true&or=(validade.is.null,validade.gte.${hoje})&limit=1`,
    { headers: hdrs }
  );
  const cupons: any[] = cupomRes.ok ? await cupomRes.json() : [];
  if (cupons.length === 0) return c.json({ error: 'Cupom não encontrado ou indisponível' }, 404);
  const cupom = cupons[0];

  if ((cupom.quantidade - (cupom.resgatados || 0)) <= 0)
    return c.json({ error: 'Cupom esgotado' }, 409);

  // Já resgatou este cupom? Checado antes do saldo para a mensagem ficar
  // correta (o resgate anterior já debitou moedas e mascararia o motivo real).
  // A UNIQUE no banco continua sendo a garantia final contra corridas.
  const jaRes = await fetch(
    `${supaUrl}/rest/v1/cupons_resgates?cupom_id=eq.${encodeURIComponent(String(cupomId))}&cpf_hash=eq.${cpfHash}&select=id&limit=1`,
    { headers: hdrs }
  );
  const ja: any[] = jaRes.ok ? await jaRes.json() : [];
  if (ja.length > 0) return c.json({ error: 'Este CPF já resgatou este cupom' }, 409);

  // Saldo suficiente?
  const { saldo } = await calcularSaldo(supaUrl, hdrs, cpfHash);
  if (saldo < cupom.custo_moedas)
    return c.json({ error: `Saldo insuficiente (você tem ${saldo}, precisa de ${cupom.custo_moedas})` }, 402);

  // Registra o resgate — a UNIQUE (cupom_id, cpf_hash) barra duplicata
  const codigo = `OPINAI-${randomBytes(4).toString('hex').toUpperCase()}`;
  const insRes = await fetch(`${supaUrl}/rest/v1/cupons_resgates`, {
    method: 'POST',
    headers: hdrs,
    body: JSON.stringify({
      cupom_id: cupomId,
      cpf_hash: cpfHash,
      moedas_pagas: cupom.custo_moedas,
      codigo_entregue: codigo,
    }),
  });

  if (insRes.status === 409) {
    return c.json({ error: 'Este CPF já resgatou este cupom' }, 409);
  }
  if (!insRes.ok) {
    console.error('[app/resgatar]', await insRes.text());
    return c.json({ error: 'Erro ao resgatar cupom' }, 500);
  }

  // Atualização otimista do contador de resgatados: só aplica se o valor não
  // mudou desde a leitura (evita corrida simples entre dois resgates).
  await fetch(
    `${supaUrl}/rest/v1/cupons?id=eq.${encodeURIComponent(String(cupomId))}&resgatados=eq.${cupom.resgatados || 0}`,
    {
      method: 'PATCH', headers: hdrs,
      body: JSON.stringify({ resgatados: (cupom.resgatados || 0) + 1 }),
    }
  );

  return c.json({ ok: true, codigo, moedas_pagas: cupom.custo_moedas });
});
// ═════════════════════════════════════════════════════════════════════════════

// ── Retaguarda: listagem de usuários + permissões ────────────────────────────
app.get('/api/retaguarda/users', async (c) => {
  const supaUrl = process.env.SUPABASE_URL!;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const hdrs = { apikey: supaKey, Authorization: `Bearer ${supaKey}`, Accept: 'application/json' };

  const auth = await verificarRetaguarda(supaUrl, supaKey, c.req.header('Authorization') ?? '');
  if (!auth.ok) return c.json({ error: auth.error }, auth.status as any);

  try {
    // Listar todos os usuários via Auth Admin API
    const usersRes = await fetch(`${supaUrl}/auth/v1/admin/users?per_page=1000`, { headers: hdrs });
    if (!usersRes.ok) return c.json({ error: 'Erro ao listar usuários do Auth' }, 500);
    const { users } = await usersRes.json();

    // Buscar permissões ativas
    const permsRes = await fetch(
      `${supaUrl}/rest/v1/permissoes_retaguarda?select=user_id,ativo,concedido_em`,
      { headers: { ...hdrs, 'Content-Type': 'application/json' } }
    );
    const perms: any[] = permsRes.ok ? await permsRes.json() : [];
    const permsMap = new Map(perms.filter(p => p.ativo).map(p => [p.user_id, p]));

    const result = (users || []).map((u: any) => ({
      id: u.id,
      email: u.email ?? '',
      display_name: u.user_metadata?.display_name ?? null,
      created_at: u.created_at,
      tem_permissao: permsMap.has(u.id),
      concedido_em: permsMap.get(u.id)?.concedido_em ?? null,
    }));

    return c.json(result);
  } catch (err: any) {
    return c.json({ error: err?.message ?? 'Erro interno' }, 500);
  }
});

// ── Retaguarda: conceder / revogar permissão ─────────────────────────────────
app.post('/api/retaguarda/permissions', async (c) => {
  const supaUrl = process.env.SUPABASE_URL!;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const hdrs = { apikey: supaKey, Authorization: `Bearer ${supaKey}`, 'Content-Type': 'application/json', Accept: 'application/json' };

  const auth = await verificarRetaguarda(supaUrl, supaKey, c.req.header('Authorization') ?? '');
  if (!auth.ok) return c.json({ error: auth.error }, auth.status as any);

  const { action, targetUserId } = await c.req.json();
  if (!targetUserId) return c.json({ error: 'targetUserId obrigatório' }, 400);

  if (action === 'grant') {
    // Verifica se já existe registro
    const existRes = await fetch(
      `${supaUrl}/rest/v1/permissoes_retaguarda?user_id=eq.${targetUserId}`,
      { headers: hdrs }
    );
    const existing: any[] = existRes.ok ? await existRes.json() : [];

    if (existing.length > 0) {
      await fetch(`${supaUrl}/rest/v1/permissoes_retaguarda?user_id=eq.${targetUserId}`, {
        method: 'PATCH', headers: hdrs,
        body: JSON.stringify({ ativo: true, concedido_por: auth.userId, concedido_em: new Date().toISOString() }),
      });
    } else {
      await fetch(`${supaUrl}/rest/v1/permissoes_retaguarda`, {
        method: 'POST', headers: hdrs,
        body: JSON.stringify({ user_id: targetUserId, ativo: true, concedido_por: auth.userId, concedido_em: new Date().toISOString() }),
      });
    }
    return c.json({ ok: true });
  }

  if (action === 'revoke') {
    await fetch(`${supaUrl}/rest/v1/permissoes_retaguarda?user_id=eq.${targetUserId}`, {
      method: 'PATCH', headers: hdrs,
      body: JSON.stringify({ ativo: false }),
    });
    return c.json({ ok: true });
  }

  return c.json({ error: 'Ação desconhecida' }, 400);
});

// ── Chat de Suporte — Retaguarda (IA especializada em gerência) ──────────────
const GROQ_RETAGUARDA_SYSTEM = `Você é o assistente de suporte da Retaguarda do OpinAI, voltado para usuários com perfil de gerência e administração. Responda sempre em português do Brasil, de forma técnica e objetiva.

REGRA ABSOLUTA: responda EXCLUSIVAMENTE sobre o OpinAI e suas funcionalidades administrativas. Para qualquer outro assunto, diga: "Sou o assistente da Retaguarda do OpinAI e só posso ajudar com questões administrativas da plataforma."

SOBRE A RETAGUARDA:
- Painel administrativo para gestores e administradores do OpinAI
- Acesso restrito: requer permissão concedida por outro administrador
- Dashboard com estatísticas de usuários (total, hoje, semana, mês)

FORMULÁRIOS:
- Criação de formulários com perguntas: texto, número, email, telefone, texto longo, múltipla escolha, checkbox, data, hora
- Perguntas podem ser marcadas como obrigatórias
- Formulários têm status Ativo/Inativo
- Aba "Responder": gerentes respondem formulários ativos
- Resultados aparecem no Dashboard principal na aba "Pesquisa"

GERENCIAMENTO DE PERMISSÕES (tela Configuração):
- Lista usuários com e sem acesso à Retaguarda
- "Conceder Permissão": dá acesso de Retaguarda a um usuário normal
- "Revogar": remove acesso (não é possível revogar o próprio acesso)

DADOS ELEITORAIS (Mapa Eleitoral):
- Base com ~2,2 milhões de registros das Eleições Gerais 2022 (TSE)
- Filtros: Estado → Município → Cargo → Buscar
- Cargos: Presidente, Governador, Senador, Dep. Federal, Dep. Estadual, etc.
- Dados históricos imutáveis — atualização para 2026 requer reimportação

PROBLEMAS COMUNS NA RETAGUARDA:
- Formulário não aparece para responder: verifique se está como "Ativo"
- Erro ao criar formulário: adicione pelo menos uma pergunta
- Usuários não carregam em Configuração: aguarde e recarregue
- Estatísticas zeradas: baseadas em registros de usuários com plano

Se não souber a resposta exata, indique que o administrador técnico deve ser consultado. Nunca invente dados ou procedimentos.`;

// ── Retaguarda: fila de solicitações de pesquisa ────────────────────────────
app.post('/api/retaguarda/survey-requests', async (c) => {
  const supaUrl = process.env.SUPABASE_URL!;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const hdrs = {
    apikey: supaKey,
    Authorization: `Bearer ${supaKey}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  const auth = await verificarRetaguarda(supaUrl, supaKey, c.req.header('Authorization') ?? '');
  if (!auth.ok) return c.json({ error: auth.error }, auth.status as any);

  const body = await c.req.json().catch(() => ({}));
  const { action } = body;

  // LISTAR toda a fila (ordenada: pendentes → prioridade alta → mais antigas)
  if (action === 'list') {
    const res = await fetch(`${supaUrl}/rest/v1/solicitacoes_pesquisa?order=created_at.asc`, {
      headers: hdrs,
    });
    if (!res.ok) return c.json({ error: await res.text() }, 500);
    const rows: any[] = await res.json();
    const pesoStatus: Record<string, number> = {
      pendente: 0,
      em_andamento: 1,
      concluida: 2,
      rejeitada: 3,
    };
    rows.sort((a, b) => {
      const s = (pesoStatus[a.status] ?? 9) - (pesoStatus[b.status] ?? 9);
      if (s !== 0) return s;
      if (a.prioridade !== b.prioridade) return a.prioridade === 'alta' ? -1 : 1;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
    return c.json(rows);
  }

  // ATUALIZAR status / parecer de uma solicitação
  if (action === 'update_status') {
    const { id, status, resposta_admin } = body;
    const validos = ['pendente', 'em_andamento', 'concluida', 'rejeitada'];
    if (!id || !validos.includes(status))
      return c.json({ error: 'id e status válido são obrigatórios' }, 400);
    const res = await fetch(
      `${supaUrl}/rest/v1/solicitacoes_pesquisa?id=eq.${encodeURIComponent(String(id))}`,
      {
        method: 'PATCH',
        headers: hdrs,
        body: JSON.stringify({
          status,
          resposta_admin: resposta_admin ?? null,
          updated_at: new Date().toISOString(),
        }),
      }
    );
    if (!res.ok) return c.json({ error: await res.text() }, 500);
    return c.json({ ok: true });
  }

  return c.json({ error: 'Ação desconhecida' }, 400);
});
// ─────────────────────────────────────────────────────────────────────────────

app.post('/api/retaguarda/chat', async (c) => {
  const supaUrl = process.env.SUPABASE_URL!;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const auth = await verificarRetaguarda(supaUrl, supaKey, c.req.header('Authorization') ?? '');
  if (!auth.ok) return c.json({ error: auth.error }, auth.status as any);

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return c.json({ error: 'GROQ_API_KEY não configurada' }, 500);

  let messages: { role: string; content: string }[];
  try {
    const body = await c.req.json();
    messages = body.messages;
    if (!Array.isArray(messages) || messages.length === 0) throw new Error();
  } catch {
    return c.json({ error: 'Corpo inválido. Envie { messages: [...] }' }, 400);
  }

  const history = messages.slice(-20).map(({ role, content }) => ({ role, content: String(content) }));

  let groqRes: Response;
  try {
    groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: GROQ_MODEL,
        max_tokens: 1024,
        stream: true,
        messages: [{ role: 'system', content: GROQ_RETAGUARDA_SYSTEM }, ...history],
      }),
    });
  } catch (err: any) {
    return c.json({ error: `Falha ao conectar com Groq: ${err?.message}` }, 502);
  }

  if (!groqRes.ok) {
    const errBody = await groqRes.text();
    return c.json({ error: `Groq retornou ${groqRes.status}: ${errBody}` }, groqRes.status as any);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const reader = groqRes.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            try {
              const text = JSON.parse(data).choices?.[0]?.delta?.content ?? '';
              if (text) controller.enqueue(encoder.encode(text));
            } catch { /* JSON inválido */ }
          }
        }
        if (buffer.startsWith('data: ')) {
          const data = buffer.slice(6).trim();
          if (data && data !== '[DONE]') {
            try {
              const text = JSON.parse(data).choices?.[0]?.delta?.content ?? '';
              if (text) controller.enqueue(encoder.encode(text));
            } catch { /* ignorar */ }
          }
        }
        controller.close();
      } catch (err) { controller.error(err); }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' },
  });
});
// ─────────────────────────────────────────────────────────────────────────────

// ── Verificação de permissão Retaguarda (server-side, ignora RLS) ───────────
// Usa service_role_key para consultar permissoes_retaguarda sem restrições de RLS.
app.get('/api/check-retaguarda', async (c) => {
  const supaUrl = process.env.SUPABASE_URL;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supaUrl || !supaKey) {
    return c.json({ hasPermission: false, error: 'Servidor sem configuração Supabase' }, 500);
  }

  const authHeader = c.req.header('Authorization') ?? '';
  const userToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!userToken) {
    return c.json({ hasPermission: false, error: 'Token não fornecido' }, 401);
  }

  // Verificar token e obter user_id via Supabase Auth API
  let userId: string;
  try {
    const userRes = await fetch(`${supaUrl}/auth/v1/user`, {
      headers: { apikey: supaKey, Authorization: `Bearer ${userToken}` },
    });
    if (!userRes.ok) {
      return c.json({ hasPermission: false, error: 'Token inválido ou expirado' }, 401);
    }
    const userData = await userRes.json();
    userId = userData.id ?? '';
    if (!userId) {
      return c.json({ hasPermission: false, error: 'Usuário sem ID' }, 401);
    }
  } catch {
    return c.json({ hasPermission: false, error: 'Erro ao verificar token' }, 500);
  }

  // Consultar permissoes_retaguarda com service_role (ignora RLS)
  try {
    const permRes = await fetch(
      `${supaUrl}/rest/v1/permissoes_retaguarda?select=ativo&user_id=eq.${userId}&ativo=eq.true&limit=1`,
      {
        headers: {
          apikey: supaKey,
          Authorization: `Bearer ${supaKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    );
    const perms: any[] = await permRes.json();
    const hasPermission = Array.isArray(perms) && perms.length > 0;
    return c.json({ hasPermission, userId });
  } catch {
    return c.json({ hasPermission: false, error: 'Erro ao consultar permissão' }, 500);
  }
});
// ─────────────────────────────────────────────────────────────────────────────

// ── Verificação de plano (server-side, ignora RLS) ──────────────────────────
// Usa service_role_key para consultar planos_usuario sem restrições de RLS.
// O token do usuário é verificado via Supabase Auth antes de qualquer consulta.
app.get('/api/check-plan', async (c) => {
  const supaUrl = process.env.SUPABASE_URL;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supaUrl || !supaKey) {
    return c.json({ hasAccess: false, error: 'Servidor sem configuração Supabase' }, 500);
  }

  // Token do usuário vem no header Authorization: Bearer <access_token>
  const authHeader = c.req.header('Authorization') ?? '';
  const userToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!userToken) {
    return c.json({ hasAccess: false, error: 'Token não fornecido' }, 401);
  }

  // Verificar o token e obter email via Supabase Auth API
  let email: string;
  try {
    const userRes = await fetch(`${supaUrl}/auth/v1/user`, {
      headers: {
        apikey: supaKey,
        Authorization: `Bearer ${userToken}`,
      },
    });
    if (!userRes.ok) {
      return c.json({ hasAccess: false, error: 'Token inválido ou expirado' }, 401);
    }
    const userData = await userRes.json();
    email = (userData.email ?? '').toLowerCase().trim();
    if (!email) {
      return c.json({ hasAccess: false, error: 'Usuário sem email' }, 401);
    }
  } catch {
    return c.json({ hasAccess: false, error: 'Erro ao verificar token' }, 500);
  }

  // Consultar planos_usuario com service_role (ignora RLS)
  const now = new Date().toISOString();
  try {
    const planRes = await fetch(
      `${supaUrl}/rest/v1/planos_usuario?select=id,status,data_fim,permanente&email=eq.${encodeURIComponent(email)}&limit=10`,
      {
        headers: {
          apikey: supaKey,
          Authorization: `Bearer ${supaKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    );
    const plans: any[] = await planRes.json();
    const hasAccess =
      Array.isArray(plans) &&
      plans.some((p) => p.permanente === true || (p.status === 'ativo' && p.data_fim >= now));
    return c.json({ hasAccess, email });
  } catch {
    return c.json({ hasAccess: false, error: 'Erro ao consultar plano' }, 500);
  }
});
// ─────────────────────────────────────────────────────────────────────────────

// ── Electoral Supabase API ─────────────────────────────────────────────────
// Dados das eleições 2022 importados do TSE → Supabase.
// Execute apps/web/scripts/importar_dados_tse.py UMA VEZ para popular o banco.
// Rode apps/web/supabase-resultados.sql no Supabase SQL Editor primeiro.
const electoralCache = new Map<string, { data: unknown; ts: number }>();
const ELECTORAL_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

async function supabaseRPC(functionName: string, params: Record<string, string>): Promise<any[]> {
  const supaUrl = process.env.SUPABASE_URL;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supaUrl || !supaKey) throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY necessários no .env');

  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${supaUrl}/rest/v1/rpc/${functionName}?${qs}`, {
    headers: {
      apikey: supaKey,
      Authorization: `Bearer ${supaKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase RPC ${functionName}: HTTP ${res.status} — ${body.slice(0, 300)}`);
  }
  return res.json();
}

// GET /api/electoral/municipios?uf=SP&cargo=6
// Retorna: [{ nome: "SÃO PAULO", codigo: "SÃO PAULO" }, ...]
app.get('/api/electoral/municipios', async (c) => {
  // Banco de dados eleitoral = recurso pago (>= básico). Paywall server-side.
  const auth = await verificarPlano(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    c.req.header('Authorization') ?? '',
    1
  );
  if (!auth.ok) return c.json({ error: auth.error }, auth.status as any);

  const uf = (c.req.query('uf') ?? '').toUpperCase();
  const cargo = c.req.query('cargo') ?? '6';
  if (!uf) return c.json({ error: 'Parâmetro uf obrigatório' }, 400);

  const cacheKey = `municipios:${uf}:${cargo}`;
  const cached = electoralCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < ELECTORAL_CACHE_TTL) return c.json(cached.data);

  try {
    const rows = await supabaseRPC('get_municipios_eleitorais', { p_uf: uf, p_cargo: cargo });
    // codigo = nome (usamos o nome como chave — sem dependência de código TSE)
    const municipios = rows.map((r: any) => ({ nome: r.municipio_nome, codigo: r.municipio_nome }));
    electoralCache.set(cacheKey, { data: municipios, ts: Date.now() });
    return c.json(municipios);
  } catch (err: any) {
    return c.json({ error: err.message }, 502);
  }
});

// GET /api/electoral/candidatos?uf=SP&municipio=SÃO%20PAULO&cargo=6
// Retorna: { candidatos: [...], totalVotos: number, municipio: string }
app.get('/api/electoral/candidatos', async (c) => {
  // Banco de dados eleitoral = recurso pago (>= básico). Paywall server-side.
  const auth = await verificarPlano(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    c.req.header('Authorization') ?? '',
    1
  );
  if (!auth.ok) return c.json({ error: auth.error }, auth.status as any);

  const uf = (c.req.query('uf') ?? '').toUpperCase();
  const municipio = c.req.query('municipio') ?? '';
  const cargo = c.req.query('cargo') ?? '6';
  if (!uf || !municipio) return c.json({ error: 'Parâmetros uf e municipio obrigatórios' }, 400);

  const cacheKey = `candidatos:${uf}:${municipio}:${cargo}`;
  const cached = electoralCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < ELECTORAL_CACHE_TTL) return c.json(cached.data);

  try {
    const rows = await supabaseRPC('get_candidatos_eleitorais', {
      p_uf: uf,
      p_municipio: municipio,
      p_cargo: cargo,
    });
    const candidatos = rows.map((r: any) => ({
      nome: r.candidato_nome,
      nomeCompleto: r.candidato_nome,
      numero: r.candidato_numero,
      partido: r.partido,
      nomePartido: r.nome_partido,
      votos: Number(r.votos),
      situacao: r.situacao,
    }));
    const totalVotos = candidatos.reduce((s: number, cand: any) => s + cand.votos, 0);
    const result = { candidatos, totalVotos, municipio };
    electoralCache.set(cacheKey, { data: result, ts: Date.now() });
    return c.json(result);
  } catch (err: any) {
    return c.json({ error: err.message }, 502);
  }
});
// ─────────────────────────────────────────────────────────────────────────────

app.route(API_BASENAME, api);

// IMPORTANTE: sem `await` aqui de propósito.
// O server-build (app React Router) importa símbolos deste módulo, e este módulo
// (via createHonoServer → importBuild) importa o server-build. Com `top-level await`
// isso vira um deadlock circular de ESM (o servidor não sobe em produção). Exportar
// a Promise sem await deixa este módulo terminar de avaliar; o listen acontece como
// efeito colateral dentro do createHonoServer.
export default createHonoServer({
  app,
  defaultLogger: false,
});
