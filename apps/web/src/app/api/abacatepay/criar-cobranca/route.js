import { createClient } from '@supabase/supabase-js';
import { PLANOS, TIER_IDS } from '../../../../config/planos.js';

export async function POST(request) {
  try {
    const body = await request.json();
    // `tier` é o novo campo; `plano` mantido por compatibilidade de payload.
    const { nome, email, cpf, telefone } = body;
    const tier = body.tier || body.plano;

    // Validação básica
    if (!nome || !email || !cpf || !tier) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios faltando: nome, email, cpf, tier' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (!TIER_IDS.includes(tier)) {
      return new Response(
        JSON.stringify({ error: 'Plano inválido. Use "basico", "medio" ou "maximo".' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }
    const planConfig = PLANOS[tier];

    const ABACATEPAY_API_KEY = process.env.ABACATEPAY_API_KEY;
    const APP_URL = process.env.APP_URL || 'http://localhost:4000';

    if (!ABACATEPAY_API_KEY) {
      console.error('ABACATEPAY_API_KEY não configurada');
      return new Response(
        JSON.stringify({ error: 'Serviço de pagamento não configurado. Contate o suporte.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Limpar CPF e telefone
    const cpfLimpo = String(cpf).replace(/\D/g, '');
    const telefoneLimpo = String(telefone ?? '').replace(/\D/g, '');

    // Criar cobrança na AbacatePay
    const abacateRes = await fetch('https://api.abacatepay.com/v1/billing/create', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ABACATEPAY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        frequency: 'ONE_TIME',
        methods: ['PIX', 'CREDIT_CARD'],
        products: [
          {
            externalId: `plano-${tier}-opinai`,
            name: `${planConfig.nome} OpinAI`,
            description: planConfig.descricao,
            quantity: 1,
            price: planConfig.preco,
          },
        ],
        customer: {
          name: nome.trim(),
          email: email.trim().toLowerCase(),
          cellphone: telefoneLimpo,
          taxId: cpfLimpo,
        },
        returnUrl: `${APP_URL}/pagamento/sucesso`,
        completionUrl: `${APP_URL}/pagamento/sucesso`,
      }),
    });

    const abacateData = await abacateRes.json();

    if (!abacateRes.ok) {
      console.error('Erro AbacatePay:', abacateData);
      return new Response(
        JSON.stringify({
          error: 'Erro ao gerar cobrança no sistema de pagamento. Tente novamente.',
          details: abacateData,
        }),
        { status: 502, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const billingId = abacateData?.data?.id;
    const billingUrl = abacateData?.data?.url;

    if (!billingUrl) {
      return new Response(
        JSON.stringify({ error: 'Resposta inválida do sistema de pagamento.' }),
        { status: 502, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Registrar cobrança pendente no Supabase (usa service role para bypassar RLS)
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
      const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

      const { error: dbError } = await supabaseAdmin.from('planos_usuario').upsert(
        {
          email: email.trim().toLowerCase(),
          status: 'pendente',
          tier: tier,
          plano: tier, // compat: coluna antiga
          pesquisas_cota: planConfig.cotaPesquisas,
          abacatepay_billing_id: billingId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'email', ignoreDuplicates: false },
      );

      if (dbError) {
        // Não bloqueia o fluxo, só loga o erro
        console.error('Erro ao salvar plano pendente:', dbError);
      }
    } else {
      console.warn('SUPABASE_SERVICE_ROLE_KEY não configurada — cobrança não foi registrada no banco.');
    }

    return new Response(
      JSON.stringify({ url: billingUrl, billingId }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Erro interno em criar-cobranca:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
