import { createClient } from '@supabase/supabase-js';
import { PLANOS, TIER_IDS } from '../../../../config/planos.js';

// Base da API do Asaas. Produção por padrão; use o sandbox em testes:
//   ASAAS_API_URL=https://api-sandbox.asaas.com/v3
const ASAAS_URL = process.env.ASAAS_API_URL || 'https://api.asaas.com/v3';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { nome, email, cpf, telefone } = body;
    const tier = body.tier || body.plano;

    if (!nome || !email || !cpf || !tier) {
      return json({ error: 'Campos obrigatórios faltando: nome, email, cpf, tier' }, 400);
    }
    if (!TIER_IDS.includes(tier)) {
      return json({ error: 'Plano inválido. Use "basico", "medio" ou "maximo".' }, 400);
    }
    const plan = PLANOS[tier];

    const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
    if (!ASAAS_API_KEY) {
      console.error('ASAAS_API_KEY não configurada');
      return json({ error: 'Serviço de pagamento não configurado. Contate o suporte.' }, 500);
    }
    const APP_URL = process.env.APP_URL || 'http://localhost:4000';
    const headers = { 'Content-Type': 'application/json', access_token: ASAAS_API_KEY };

    const emailLimpo = email.trim().toLowerCase();
    const cpfLimpo = String(cpf).replace(/\D/g, '');
    const telLimpo = String(telefone ?? '').replace(/\D/g, '');

    // 1. Reusa o cliente se já existir (evita duplicados); senão cria.
    let customerId = null;
    try {
      const buscaRes = await fetch(
        `${ASAAS_URL}/customers?email=${encodeURIComponent(emailLimpo)}`,
        { headers },
      );
      if (buscaRes.ok) {
        const busca = await buscaRes.json();
        customerId = busca?.data?.[0]?.id ?? null;
      }
    } catch { /* segue e cria abaixo */ }

    if (!customerId) {
      const custRes = await fetch(`${ASAAS_URL}/customers`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: nome.trim(),
          email: emailLimpo,
          cpfCnpj: cpfLimpo,
          mobilePhone: telLimpo || undefined,
          externalReference: emailLimpo,
        }),
      });
      const cust = await custRes.json();
      if (!custRes.ok || !cust.id) {
        console.error('Erro ao criar cliente Asaas:', cust);
        return json({ error: 'Erro ao registrar cliente no pagamento.', details: cust }, 502);
      }
      customerId = cust.id;
    }

    // 2. Cria a assinatura MENSAL. billingType UNDEFINED = cliente escolhe
    //    PIX, cartão ou boleto na página de pagamento.
    const hoje = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const subRes = await fetch(`${ASAAS_URL}/subscriptions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        customer: customerId,
        billingType: 'UNDEFINED',
        value: plan.preco / 100, // config está em centavos; Asaas usa reais
        nextDueDate: hoje,
        cycle: 'MONTHLY',
        description: `${plan.nome} OpinAI`,
        externalReference: tier,
      }),
    });
    const sub = await subRes.json();
    if (!subRes.ok || !sub.id) {
      console.error('Erro ao criar assinatura Asaas:', sub);
      return json({ error: 'Erro ao gerar a assinatura. Tente novamente.', details: sub }, 502);
    }

    // 3. Pega o link (invoiceUrl) da primeira cobrança da assinatura.
    let invoiceUrl = null;
    try {
      const payRes = await fetch(`${ASAAS_URL}/subscriptions/${sub.id}/payments`, { headers });
      if (payRes.ok) {
        const pays = await payRes.json();
        invoiceUrl = pays?.data?.[0]?.invoiceUrl ?? null;
      }
    } catch { /* trata abaixo */ }

    if (!invoiceUrl) {
      return json({ error: 'Assinatura criada, mas o link de pagamento não foi gerado.' }, 502);
    }

    // 4. Registra pendente no Supabase (service_role bypassa RLS).
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
      const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      const { error: dbError } = await supabaseAdmin.from('planos_usuario').upsert(
        {
          email: emailLimpo,
          status: 'pendente',
          tier,
          plano: tier,
          pesquisas_cota: plan.cotaPesquisas,
          asaas_customer_id: customerId,
          asaas_subscription_id: sub.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'email', ignoreDuplicates: false },
      );
      if (dbError) console.error('Erro ao salvar plano pendente:', dbError);
    } else {
      console.warn('SUPABASE_SERVICE_ROLE_KEY ausente — assinatura não registrada no banco.');
    }

    return json({ url: invoiceUrl, subscriptionId: sub.id });
  } catch (error) {
    console.error('Erro interno em criar-assinatura:', error);
    return json({ error: 'Erro interno do servidor.' }, 500);
  }
}
