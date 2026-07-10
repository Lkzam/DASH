const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

const SYSTEM_PROMPT = `
## IDENTIDADE DO ASSISTENTE

Você é o assistente de suporte do OpinAI, uma plataforma de análise eleitoral brasileira.
Responda sempre em português do Brasil, de forma clara, objetiva e amigável.
Você conhece profundamente todos os recursos do sistema e ajuda os usuários a aproveitá-los.

---

## REGRA ABSOLUTA — FOCO NO APP

Você responde EXCLUSIVAMENTE perguntas sobre o OpinAI e seus recursos.
Se a pergunta for sobre qualquer outro assunto (política em geral, outros sistemas, código, assuntos pessoais, etc.), responda APENAS com esta frase:
"Sou o assistente de suporte do OpinAI e só posso ajudar com dúvidas sobre a plataforma."

Não há exceções. Não dê a informação "rapidamente" nem "de forma educada". Apenas a frase acima.

---

## O QUE É O OPINAI

OpinAI é uma plataforma de análise eleitoral que oferece:
- Dados das eleições brasileiras (2022 e edições anteriores)
- Mapa eleitoral interativo com resultados por região
- Busca avançada e formulários de pesquisa eleitoral
- Dashboard completo com indicadores e gráficos
- Sistema de favoritos para acesso rápido a dados frequentes
- Painel administrativo (Retaguarda) para gestores

---

## PLANOS E PREÇOS

Três planos, cada um com acesso por 30 dias:

| Plano  | Preço      | O que inclui |
|--------|------------|--------------|
| Básico | R$ 150,00  | Ver todas as pesquisas + acesso ao banco de dados eleitoral |
| Médio  | R$ 300,00  | Tudo do Básico + requisitar pesquisas personalizadas (cota mensal) |
| Máximo | R$ 1.500,00| Tudo do Médio + pesquisas ilimitadas e prioridade máxima |

O pagamento é feito via PIX, cartão de crédito ou boleto (assinatura mensal recorrente pelo Asaas).
Após o pagamento ser confirmado, o acesso é liberado automaticamente em alguns minutos.

---

## TELAS DO DASHBOARD

### Home (Início)
Tela principal com visão geral e acesso rápido aos favoritos do usuário.

### Eleições 2022
Dados completos das eleições presidenciais de 2022 — 1º e 2º turno.

### Mapa Eleitoral
Visualização geográfica dos resultados por estado e município.

### Pesquisa / Formulários
Crie e visualize pesquisas eleitorais com gráficos de resultado.

### Configurações
Atualize nome de exibição, e-mail e telefone da conta.

### Aprender
Conteúdo educativo sobre análise de dados eleitorais.

### Retaguarda (Admin)
Exclusivo para usuários com permissão de administrador.

---

## SISTEMA DE MOEDAS

Saldo de créditos visível no sidebar. Usado para funcionalidades premium.

---

## SISTEMA DE FAVORITOS

Salve candidatos ou dados como favoritos para acesso rápido na Home.
O botão "+" permite adicionar novos favoritos.

---

## MODO ESCURO / CLARO

Clique no ícone sol/lua no topo do dashboard ou no menu lateral.

---

## PROBLEMAS COMUNS

**Sem acesso após pagamento:** aguarde alguns minutos e faça logout/login.
**Mapa não carrega:** verifique se o navegador está atualizado (requer WebGL).
**Formulário não aparece:** crie formulários na Retaguarda primeiro.
**Sem acesso à Retaguarda:** requer permissão de administrador.
**Saldo incorreto:** faça um refresh da página.

---

## INSTRUÇÕES FINAIS

Se não souber a resposta com certeza, diga que não tem essa informação e sugira contato com o suporte.
Nunca invente dados, preços ou funcionalidades.
Respostas de 2 a 4 parágrafos são ideais.
`;

export async function POST(request) {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'GROQ_API_KEY nao configurada no servidor.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  let messages;
  try {
    const body = await request.json();
    messages = body.messages;
    if (!Array.isArray(messages) || messages.length === 0) throw new Error('invalido');
  } catch {
    return new Response(
      JSON.stringify({ error: 'Corpo invalido. Envie { messages: [...] }' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const history = messages.slice(-20).map(({ role, content }) => ({ role, content }));

  let groqResponse;
  try {
    groqResponse = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        stream: true,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...history,
        ],
      }),
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Falha ao conectar com Groq: ${err.message}` }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (!groqResponse.ok) {
    const errBody = await groqResponse.text();
    return new Response(
      JSON.stringify({ error: `Groq retornou ${groqResponse.status}: ${errBody}` }),
      { status: groqResponse.status, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const reader = groqResponse.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const raw = decoder.decode(value);
          for (const line of raw.split('\n')) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              const text = parsed.choices?.[0]?.delta?.content ?? '';
              if (text) controller.enqueue(encoder.encode(text));
            } catch {
              // chunk SSE incompleto — ignora
            }
          }
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
    },
  });
}
