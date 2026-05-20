import { createClient } from '@supabase/supabase-js';

const PLANOS_CONFIG = {
  mensal: {
    externalId: 'plano-mensal-opinai',
    name: 'Plano Mensal OpinAI',
    description: 'Acesso completo à plataforma OpinAI por 1 mês',
    price: 9900, // R$ 99,00 em centavos
    duracaoDias: 30,
  },
  anual: {
    externalId: 'plano-anual-opinai',
    name: 'Plano Anual OpinAI',
    description: 'Acesso completo à plataforma OpinAI por 12 meses',
    price: 89000, // R$ 890,00 em centavos
    duracaoDias: 365,
  },
};

export async function POST(request) {
  try {
    const body = await request.json();
    const { nome, email, cpf, telefone, plano } = body;

    // Validação básica
    if (!nome || !email || !cpf || !plano) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios faltando: nome, email, cpf, plano' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const planConfig = PLANOS_CONFIG[plano];
    if (!planConfig) {
      return new Response(
        JSON.stringify({ error: 'Plano inválido. Use "mensal" ou "anual"' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

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
    const cpfLimpo = cpf.replace(/\D/g, '');
    const telefoneLimpo = telefone.replace(/\D/g, '');

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
            externalId: planConfig.externalId,
            name: planConfig.name,
            description: planConfig.description,
            quantity: 1,
            price: planConfig.price,
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
    const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tuedlrtbnlguhnudttac.supabase.co';
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (SUPABASE_SERVICE_KEY) {
      const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

      const { error: dbError } = await supabaseAdmin.from('planos_usuario').upsert(
        {
          email: email.trim().toLowerCase(),
          status: 'pendente',
          plano: plano,
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
