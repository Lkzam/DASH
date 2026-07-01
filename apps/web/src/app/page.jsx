import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Map,
  Users,
  TrendingUp,
  CheckCircle,
  ArrowRight,
  Shield,
  Zap,
  Search,
  ChevronRight,
  Star,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import FloatingLines from '../components/FloatingLines';
import { PLANOS, TIERS } from '../config/planos.js';

const features = [
  {
    icon: BarChart3,
    title: 'Análise de Eleições',
    description:
      'Visualize resultados eleitorais históricos com gráficos interativos por estado, município e zona eleitoral.',
    color: '#1570FF',
    bg: '#EDF3FF',
  },
  {
    icon: Map,
    title: 'Mapa Eleitoral',
    description:
      'Explore a distribuição de votos no mapa do Brasil. Identifique regiões estratégicas para campanhas.',
    color: '#10B981',
    bg: '#ECFDF5',
  },
  {
    icon: Search,
    title: 'Pesquisas de Campo',
    description:
      'Crie formulários de pesquisa eleitoral, distribua para entrevistadores e analise os resultados em tempo real.',
    color: '#F59E0B',
    bg: '#FFFBEB',
  },
  {
    icon: TrendingUp,
    title: 'Intenção de Voto',
    description:
      'Monitore tendências de intenção de voto com dashboards atualizados e relatórios comparativos.',
    color: '#8B5CF6',
    bg: '#F5F3FF',
  },
];

const steps = [
  {
    num: '01',
    title: 'Escolha seu plano',
    desc: 'Selecione o plano (Básico, Médio ou Máximo) e efetue o pagamento via PIX ou cartão.',
  },
  {
    num: '02',
    title: 'Crie sua conta',
    desc: 'Após o pagamento, crie sua conta com o mesmo e-mail usado no cadastro.',
  },
  {
    num: '03',
    title: 'Acesse a plataforma',
    desc: 'Entre no dashboard e tenha acesso completo a todos os recursos do OpinAI.',
  },
];

// Planos derivados da fonte única (src/config/planos.js). O Médio é destacado.
const plans = TIERS.map((t) => {
  const p = PLANOS[t];
  return {
    id: p.id,
    name: p.nome,
    price: p.precoLabel,
    period: `/${p.periodo.replace('por ', '')}`,
    desc: p.descricao,
    items: p.itens,
    highlight: t === 'medio',
    badge: t === 'medio' ? 'Mais popular' : undefined,
  };
});

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const scrollToPlanos = () => {
    document.getElementById('planos-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-white font-inter">
      {/* ── NAVBAR ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#1570FF] rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl text-[#2A2E45]">OpinAI</span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-[#6F7689]">
            <button onClick={scrollToPlanos} className="hover:text-[#2A2E45] transition-colors">
              Planos
            </button>
            <button
              onClick={() => document.getElementById('features-section')?.scrollIntoView({ behavior: 'smooth' })}
              className="hover:text-[#2A2E45] transition-colors"
            >
              Funcionalidades
            </button>
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2 bg-[#1570FF] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#0D4FB8] transition-colors"
              >
                <BarChart3 className="w-4 h-4" />
                Dashboard
              </button>
            ) : (
              <>
                <button
                  onClick={() => navigate('/login')}
                  className="text-[#6F7689] hover:text-[#2A2E45] transition-colors text-sm font-medium"
                >
                  Entrar
                </button>
                <button
                  onClick={scrollToPlanos}
                  className="bg-[#1570FF] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#0D4FB8] transition-colors"
                >
                  Começar Agora
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative pt-16 min-h-screen bg-gradient-to-br from-[#050D1A] via-[#0A1A35] to-[#0D2F5E] flex items-center overflow-hidden">
        <FloatingLines />

        {/* Glow effects */}
        <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-[#1570FF]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-[#1570FF]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-6 py-32">
          <div className="max-w-3xl">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-[#1570FF]/15 text-[#60A5FA] px-4 py-2 rounded-full text-sm font-medium mb-8 border border-[#1570FF]/25">
              <Zap className="w-4 h-4" />
              Plataforma de Inteligência Eleitoral
            </div>

            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
              Dados Eleitorais{' '}
              <span className="text-[#1570FF]">Inteligentes</span>{' '}
              para Vencer
            </h1>

            <p className="text-xl text-gray-300 mb-10 leading-relaxed max-w-2xl">
              Análise completa de resultados eleitorais, pesquisas de campo e monitoramento
              de intenção de voto. Tome decisões estratégicas baseadas em dados reais.
            </p>

            <div className="flex flex-wrap gap-4">
              <button
                onClick={() => navigate('/planos')}
                className="flex items-center gap-2 bg-[#1570FF] text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-[#0D4FB8] transition-all hover:scale-105 shadow-lg shadow-[#1570FF]/30"
              >
                Ver Planos
                <ArrowRight className="w-5 h-5" />
              </button>
              <button
                onClick={() => navigate('/login')}
                className="flex items-center gap-2 bg-white/10 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-white/15 transition-all border border-white/20"
              >
                Já tenho conta
              </button>
            </div>

            {/* Trust indicators */}
            <div className="flex flex-wrap items-center gap-6 mt-12 text-gray-400 text-sm">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-green-400" />
                Dados seguros
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400" />
                Pagamento via PIX ou cartão
              </div>
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-400" />
                Acesso imediato após pagamento
              </div>
            </div>
          </div>
        </div>

        {/* Wave divider */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 80" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 80L1440 80L1440 40C1200 80 960 0 720 20C480 40 240 80 0 40L0 80Z" fill="white" />
          </svg>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: '5.570+', label: 'Municípios mapeados' },
              { value: '26', label: 'Estados analisados' },
              { value: '156M', label: 'Votos processados' },
              { value: '2022', label: 'Dados das últimas eleições' },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-4xl font-bold text-[#1570FF] mb-2">{stat.value}</div>
                <div className="text-[#8A8FA6] text-sm">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features-section" className="bg-[#FAFBFD] py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-[#2A2E45] mb-4">
              Tudo que você precisa para analisar eleições
            </h2>
            <p className="text-[#8A8FA6] text-lg max-w-2xl mx-auto">
              Uma plataforma completa para gestores de campanha, pesquisadores e analistas políticos.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feat) => (
              <div
                key={feat.title}
                className="bg-white rounded-2xl p-6 border border-[#E4E9F2] hover:border-[#1570FF] hover:shadow-lg transition-all group"
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                  style={{ backgroundColor: feat.bg }}
                >
                  <feat.icon className="w-6 h-6" style={{ color: feat.color }} />
                </div>
                <h3 className="font-semibold text-[#2A2E45] mb-2 group-hover:text-[#1570FF] transition-colors">
                  {feat.title}
                </h3>
                <p className="text-sm text-[#8A8FA6] leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMO FUNCIONA ── */}
      <section className="bg-white py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-[#2A2E45] mb-4">Como funciona</h2>
            <p className="text-[#8A8FA6] text-lg">Em 3 passos simples você já está analisando dados eleitorais</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((step, i) => (
              <div key={step.num} className="relative flex flex-col items-center text-center">
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-2/3 w-1/2 border-t-2 border-dashed border-[#E4E9F2]" />
                )}
                <div className="w-16 h-16 rounded-2xl bg-[#EDF3FF] flex items-center justify-center mb-4 relative z-10">
                  <span className="text-2xl font-bold text-[#1570FF]">{step.num}</span>
                </div>
                <h3 className="font-semibold text-[#2A2E45] text-lg mb-2">{step.title}</h3>
                <p className="text-[#8A8FA6] text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PLANOS ── */}
      <section id="planos-section" className="bg-[#FAFBFD] py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-[#2A2E45] mb-4">Planos e Preços</h2>
            <p className="text-[#8A8FA6] text-lg">Escolha o plano que melhor se adapta às suas necessidades</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`relative rounded-2xl p-8 border-2 transition-all ${
                  plan.highlight
                    ? 'bg-[#1570FF] border-[#1570FF] shadow-2xl shadow-[#1570FF]/25 scale-105'
                    : 'bg-white border-[#E4E9F2] hover:border-[#1570FF] hover:shadow-lg'
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#F59E0B] text-white text-xs font-bold px-4 py-1 rounded-full">
                    {plan.badge}
                  </div>
                )}

                <div className="mb-6">
                  <h3 className={`font-bold text-xl mb-1 ${plan.highlight ? 'text-white' : 'text-[#2A2E45]'}`}>
                    {plan.name}
                  </h3>
                  <p className={`text-sm mb-4 ${plan.highlight ? 'text-blue-100' : 'text-[#8A8FA6]'}`}>
                    {plan.desc}
                  </p>
                  <div className="flex items-end gap-1">
                    <span className={`text-4xl font-bold ${plan.highlight ? 'text-white' : 'text-[#2A2E45]'}`}>
                      {plan.price}
                    </span>
                    <span className={`mb-1 ${plan.highlight ? 'text-blue-100' : 'text-[#8A8FA6]'}`}>
                      {plan.period}
                    </span>
                  </div>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.items.map((item) => (
                    <li key={item} className="flex items-center gap-3">
                      <CheckCircle
                        className="w-5 h-5 flex-shrink-0"
                        style={{ color: plan.highlight ? 'rgba(255,255,255,0.9)' : '#10B981' }}
                      />
                      <span className={`text-sm ${plan.highlight ? 'text-blue-50' : 'text-[#6F7689]'}`}>
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => navigate(`/planos?tipo=${plan.id}`)}
                  className={`w-full py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                    plan.highlight
                      ? 'bg-white text-[#1570FF] hover:bg-blue-50'
                      : 'bg-[#1570FF] text-white hover:bg-[#0D4FB8]'
                  }`}
                >
                  Assinar {plan.name}
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <p className="text-center text-[#8A8FA6] text-sm mt-8">
            Pagamento seguro via PIX ou cartão de crédito. Acesso imediato após confirmação.
          </p>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section className="bg-gradient-to-r from-[#0A1A35] to-[#1570FF] py-24">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold text-white mb-4">
            Pronto para tomar decisões mais inteligentes?
          </h2>
          <p className="text-blue-100 text-lg mb-10">
            Junte-se a analistas e gestores de campanha que já utilizam o OpinAI.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <button
              onClick={() => navigate('/planos')}
              className="flex items-center gap-2 bg-white text-[#1570FF] px-8 py-4 rounded-xl font-semibold text-lg hover:bg-blue-50 transition-all hover:scale-105"
            >
              Começar Agora
              <ArrowRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => navigate('/login')}
              className="flex items-center gap-2 bg-transparent text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-white/10 transition-all border border-white/30"
            >
              Já tenho uma conta
            </button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-[#050D1A] py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-[#1570FF] rounded-md flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-white">OpinAI</span>
            </div>
            <div className="flex gap-6 text-sm text-gray-500">
              <button onClick={scrollToPlanos} className="hover:text-gray-300 transition-colors">Planos</button>
              <button onClick={() => navigate('/login')} className="hover:text-gray-300 transition-colors">Entrar</button>
            </div>
            <p className="text-gray-600 text-sm">© 2025 OpinAI · Todos os direitos reservados</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
