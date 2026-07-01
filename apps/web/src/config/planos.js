// ============================================================================
// OpinAI — FONTE ÚNICA DE VERDADE DOS PLANOS
// ----------------------------------------------------------------------------
// Toda referência a preço, tier, cota ou duração deve vir DAQUI.
// Consumido por: página /planos, landing, criar-cobranca, webhook,
// base de conhecimento da IA. O servidor (índex.ts) espelha apenas o
// mapa de níveis (NIVEL_TIER) para checagem de acesso.
//
// ⚙️  AJUSTES RÁPIDOS:
//   - Preço: campo `preco` (em CENTAVOS) + `precoLabel` (exibição)
//   - Cota de pesquisas do Médio: campo `cotaPesquisas` do tier 'medio'
//   - Duração do acesso por compra: campo `duracaoDias`
// ============================================================================

export const PLANOS = {
  basico: {
    id: 'basico',
    nome: 'Plano Básico',
    nivel: 1,
    preco: 15000, // R$ 150,00 (centavos)
    precoLabel: 'R$ 150,00',
    periodo: 'por mês',
    duracaoDias: 30,
    cotaPesquisas: 0, // não pode requisitar pesquisas
    descricao: 'Acesso às pesquisas e ao banco de dados eleitoral.',
    itens: [
      'Ver todas as pesquisas',
      'Acesso ao banco de dados eleitoral (TSE)',
      'Dashboard e mapa eleitoral',
      'Suporte por e-mail',
    ],
  },
  medio: {
    id: 'medio',
    nome: 'Plano Médio',
    nivel: 2,
    preco: 30000, // R$ 300,00
    precoLabel: 'R$ 300,00',
    periodo: 'por mês',
    duracaoDias: 30,
    cotaPesquisas: 5, // requisições de pesquisa por ciclo (ajustável)
    descricao: 'Tudo do Básico + poder requisitar pesquisas.',
    itens: [
      'Tudo do plano Básico',
      'Requisitar pesquisas personalizadas',
      'Até 5 requisições por mês',
      'Suporte prioritário',
    ],
  },
  maximo: {
    id: 'maximo',
    nome: 'Plano Máximo',
    nivel: 3,
    preco: 150000, // R$ 1.500,00
    precoLabel: 'R$ 1.500,00',
    periodo: 'por mês',
    duracaoDias: 30,
    cotaPesquisas: null, // null = ilimitado
    descricao: 'Prioridade máxima e pesquisas ilimitadas.',
    itens: [
      'Tudo do plano Médio',
      'Requisições de pesquisa ilimitadas',
      'Prioridade máxima na fila',
      'Suporte dedicado',
    ],
  },
};

// Ordem de exibição / iteração
export const TIERS = ['basico', 'medio', 'maximo'];

// Lista de ids válidos (validação de entrada)
export const TIER_IDS = TIERS;

// Nível numérico do tier (para comparação de acesso). 0 = sem plano.
export function nivelDoTier(tier) {
  return PLANOS[tier]?.nivel ?? 0;
}

// Duração em dias concedida por uma compra do tier.
export function duracaoDias(tier) {
  return PLANOS[tier]?.duracaoDias ?? 30;
}

// Retorna a config do tier ou null se inválido.
export function getPlano(tier) {
  return PLANOS[tier] ?? null;
}
