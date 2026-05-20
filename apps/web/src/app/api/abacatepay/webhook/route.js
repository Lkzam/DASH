import { createClient } from '@supabase/supabase-js';

const DURACAO_PLANO = {
  mensal: 30,
  anual: 365,
};

export async function POST(request) {
  try {
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
    const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tuedlrtbnlguhnudttac.supabase.co';
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_SERVICE_KEY) {
      console.error('SUPABASE_SERVICE_ROLE_KEY não configurada — não é possível ativar o plano');
      return new Response(JSON.stringify({ error: 'Configuração do servidor incompleta' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Buscar o registro pendente (por billing_id ou email)
    let query = supabaseAdmin
      .from('planos_usuario')
      .select('id, email, plano, status');

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
    const planoTipo = planoExistente?.plano || 'mensal';
    const duracaoDias = DURACAO_PLANO[planoTipo] || 30;

    const dataInicio = new Date();
    const dataFim = new Date(dataInicio);
    dataFim.setDate(dataFim.getDate() + duracaoDias);

    if (planoExistente) {
      // Atualizar plano existente para ativo
      const { error: updateError } = await supabaseAdmin
        .from('planos_usuario')
        .update({
          status: 'ativo',
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
        plano: planoTipo,
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
