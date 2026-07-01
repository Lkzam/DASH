import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'node:crypto';
import { duracaoDias, getPlano, TIER_IDS } from '../../../../config/planos.js';

// Comparação de strings resistente a timing attacks.
function timingSafeEqualStr(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function POST(request) {
  try {
    // ── SEGURANÇA: validar o segredo do webhook ──────────────────
    // A AbacatePay envia o segredo configurado como query param
    // (?webhookSecret=...). Sem esta checagem, qualquer pessoa que
    // descubra a URL pode forjar um evento "billing.paid" e ativar
    // um plano pago de graça. Configure ABACATEPAY_WEBHOOK_SECRET no .env
    // com o MESMO valor cadastrado no painel da AbacatePay.
    const expectedSecret = process.env.ABACATEPAY_WEBHOOK_SECRET;
    if (!expectedSecret) {
      console.error('ABACATEPAY_WEBHOOK_SECRET não configurada — recusando webhook.');
      return new Response(JSON.stringify({ error: 'Webhook não configurado' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(request.url);
    const providedSecret =
      url.searchParams.get('webhookSecret') ||
      request.headers.get('x-webhook-secret') ||
      '';

    // Comparação em tempo constante para evitar timing attacks
    if (!timingSafeEqualStr(providedSecret, expectedSecret)) {
      console.warn('Webhook AbacatePay com segredo inválido — requisição recusada.');
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();

    console.log('AbacatePay webhook recebido:', JSON.stringify(body, null, 2));

    // Validar evento
    const event = body?.event;
    if (!event) {
      return new Response(JSON.stringify({ error: 'Evento não especificado' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Processar apenas pagamentos confirmados
    if (event !== 'billing.paid' && event !== 'BILLING_PAID') {
      console.log('Evento ignorado:', event);
      return new Response(JSON.stringify({ received: true, action: 'ignored' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const billing = body?.data?.billing || body?.billing;
    if (!billing) {
      return new Response(JSON.stringify({ error: 'Dados da cobrança ausentes' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const billingId = billing.id;
    const customerEmail = billing?.customer?.email?.toLowerCase();

    if (!customerEmail && !billingId) {
      return new Response(JSON.stringify({ error: 'E-mail ou ID da cobrança ausente' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log(`Pagamento confirmado — billing: ${billingId}, email: ${customerEmail}`);

    // Conectar ao Supabase com service role
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      console.error('SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configuradas — não é possível ativar o plano');
      return new Response(JSON.stringify({ error: 'Configuração do servidor incompleta' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Buscar o registro pendente (por billing_id ou email)
    let query = supabaseAdmin
      .from('planos_usuario')
      .select('id, email, tier, plano, status');

    if (billingId) {
      query = query.eq('abacatepay_billing_id', billingId);
    } else {
      query = query.eq('email', customerEmail);
    }

    const { data: planoExistente, error: fetchError } = await query.maybeSingle();

    if (fetchError) {
      console.error('Erro ao buscar plano:', fetchError);
      return new Response(JSON.stringify({ error: 'Erro interno ao buscar plano' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const emailFinal = planoExistente?.email || customerEmail;
    // tier vem do registro pendente criado em criar-cobranca; fallback seguro
    let tier = planoExistente?.tier || planoExistente?.plano || 'basico';
    if (!TIER_IDS.includes(tier)) tier = 'basico';
    const dias = duracaoDias(tier);
    const cota = getPlano(tier)?.cotaPesquisas ?? 0;

    const dataInicio = new Date();
    const dataFim = new Date(dataInicio);
    dataFim.setDate(dataFim.getDate() + dias);

    if (planoExistente) {
      // Atualizar plano existente para ativo
      const { error: updateError } = await supabaseAdmin
        .from('planos_usuario')
        .update({
          status: 'ativo',
          tier: tier,
          plano: tier,
          pesquisas_cota: cota,
          data_inicio: dataInicio.toISOString(),
          data_fim: dataFim.toISOString(),
          abacatepay_billing_id: billingId || planoExistente.abacatepay_billing_id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', planoExistente.id);

      if (updateError) {
        console.error('Erro ao ativar plano:', updateError);
        return new Response(JSON.stringify({ error: 'Erro ao ativar plano' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } else {
      // Criar novo registro ativo (caso não exista pendente)
      const { error: insertError } = await supabaseAdmin.from('planos_usuario').insert({
        email: emailFinal,
        status: 'ativo',
        tier: tier,
        plano: tier,
        pesquisas_cota: cota,
        abacatepay_billing_id: billingId,
        data_inicio: dataInicio.toISOString(),
        data_fim: dataFim.toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (insertError) {
        console.error('Erro ao inserir plano:', insertError);
        return new Response(JSON.stringify({ error: 'Erro ao criar plano' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    console.log(`Plano ativado com sucesso para: ${emailFinal} até ${dataFim.toISOString()}`);

    return new Response(JSON.stringify({ success: true, email: emailFinal }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Erro interno no webhook:', error);
    return new Response(JSON.stringify({ error: 'Erro interno do servidor' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
