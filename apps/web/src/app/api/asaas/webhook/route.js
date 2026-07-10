import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'node:crypto';
import { duracaoDias, getPlano, TIER_IDS } from '../../../../config/planos.js';

// Comparação resistente a timing attacks.
function timingSafeEqualStr(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Eventos que confirmam pagamento (ativa/renova o plano).
const EVENTOS_ATIVACAO = ['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'];

export async function POST(request) {
  try {
    // ── SEGURANÇA: valida o token do webhook ──────────────────────
    // No painel do Asaas você define um "Token de autenticação" para o
    // webhook; o Asaas o envia no header `asaas-access-token` em toda
    // chamada. Configure ASAAS_WEBHOOK_TOKEN com o MESMO valor.
    const expected = process.env.ASAAS_WEBHOOK_TOKEN;
    if (!expected) {
      console.error('ASAAS_WEBHOOK_TOKEN não configurado — recusando webhook.');
      return json({ error: 'Webhook não configurado' }, 500);
    }
    const provided = request.headers.get('asaas-access-token') || '';
    if (!timingSafeEqualStr(provided, expected)) {
      console.warn('Webhook Asaas com token inválido — recusado.');
      return json({ error: 'Não autorizado' }, 401);
    }

    const body = await request.json();
    const event = body?.event;
    const payment = body?.payment;
    console.log('Webhook Asaas:', event, payment?.id);

    if (!EVENTOS_ATIVACAO.includes(event)) {
      return json({ received: true, action: 'ignored', event }, 200);
    }
    if (!payment) {
      return json({ error: 'Pagamento ausente no evento' }, 400);
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      console.error('SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes — não é possível ativar.');
      return json({ error: 'Configuração do servidor incompleta' }, 500);
    }
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Localiza o plano pela assinatura (ou pelo cliente como fallback).
    const subId = payment.subscription;
    const custId = payment.customer;
    let query = supabaseAdmin
      .from('planos_usuario')
      .select('id, email, tier')
      .limit(1);
    if (subId) query = query.eq('asaas_subscription_id', subId);
    else if (custId) query = query.eq('asaas_customer_id', custId);
    else return json({ error: 'Pagamento sem assinatura/cliente' }, 400);

    const { data: plano, error: fetchError } = await query.maybeSingle();
    if (fetchError) {
      console.error('Erro ao buscar plano:', fetchError);
      return json({ error: 'Erro interno ao buscar plano' }, 500);
    }

    let tier = plano?.tier || 'basico';
    if (!TIER_IDS.includes(tier)) tier = 'basico';
    const cota = getPlano(tier)?.cotaPesquisas ?? 0;

    // Validade = ciclo (30d) + 5 dias de folga até a próxima cobrança automática.
    const dias = duracaoDias(tier) + 5;
    const dataInicio = new Date();
    const dataFim = new Date(dataInicio);
    dataFim.setDate(dataFim.getDate() + dias);

    const patch = {
      status: 'ativo',
      tier,
      plano: tier,
      pesquisas_cota: cota,
      data_inicio: dataInicio.toISOString(),
      data_fim: dataFim.toISOString(),
      asaas_subscription_id: subId || plano?.asaas_subscription_id,
      asaas_customer_id: custId || plano?.asaas_customer_id,
      updated_at: new Date().toISOString(),
    };

    if (plano) {
      const { error: updErr } = await supabaseAdmin
        .from('planos_usuario')
        .update(patch)
        .eq('id', plano.id);
      if (updErr) {
        console.error('Erro ao renovar plano:', updErr);
        return json({ error: 'Erro ao ativar plano' }, 500);
      }
    } else {
      // Sem registro pendente: cria um ativo. Sem e-mail conhecido, usa o do cliente.
      const { error: insErr } = await supabaseAdmin.from('planos_usuario').insert({
        email: payment.customerEmail || `asaas_${custId}`,
        created_at: new Date().toISOString(),
        ...patch,
      });
      if (insErr) {
        console.error('Erro ao inserir plano:', insErr);
        return json({ error: 'Erro ao criar plano' }, 500);
      }
    }

    console.log(`Plano ${tier} ativado/renovado até ${dataFim.toISOString()}`);
    return json({ success: true });
  } catch (error) {
    console.error('Erro interno no webhook Asaas:', error);
    return json({ error: 'Erro interno do servidor' }, 500);
  }
}
