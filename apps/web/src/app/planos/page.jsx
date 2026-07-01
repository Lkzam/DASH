import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  BarChart3,
  CheckCircle,
  ArrowLeft,
  CreditCard,
  QrCode,
  User,
  Mail,
  Phone,
  FileText,
  Loader2,
  Shield,
  Lock,
} from 'lucide-react';
import { PLANOS, TIERS } from '../../config/planos.js';

function formatCPF(value) {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
    .slice(0, 14);
}

function formatPhone(value) {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d{4})$/, '$1-$2')
    .slice(0, 15);
}

export default function PlanosPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tipoParam = searchParams.get('tipo');

  const [selectedPlan, setSelectedPlan] = useState(
    TIERS.includes(tipoParam) ? tipoParam : 'basico'
  );
  const [step, setStep] = useState(1); // 1 = escolher plano, 2 = dados pessoais
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    nome: '',
    email: '',
    cpf: '',
    telefone: '',
  });

  useEffect(() => {
    if (TIERS.includes(tipoParam)) {
      setSelectedPlan(tipoParam);
    }
  }, [tipoParam]);

  const handleFormChange = (field, value) => {
    let formatted = value;
    if (field === 'cpf') formatted = formatCPF(value);
    if (field === 'telefone') formatted = formatPhone(value);
    setForm((prev) => ({ ...prev, [field]: formatted }));
  };

  const validateForm = () => {
    if (!form.nome.trim()) return 'Informe seu nome completo';
    if (!form.email.trim() || !form.email.includes('@')) return 'Informe um e-mail válido';
    const cpfClean = form.cpf.replace(/\D/g, '');
    if (cpfClean.length !== 11) return 'Informe um CPF válido (11 dígitos)';
    if (!form.telefone.trim()) return 'Informe seu telefone';
    return null;
  };

  const handleProceedToPayment = async (e) => {
    e.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/abacatepay/criar-cobranca', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: form.nome.trim(),
          email: form.email.trim().toLowerCase(),
          cpf: form.cpf,
          telefone: form.telefone,
          tier: selectedPlan,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.url) {
        throw new Error(data.error || 'Erro ao gerar cobrança. Tente novamente.');
      }

      // Redirecionar para a página de pagamento da AbacatePay
      window.location.href = data.url;
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const plan = PLANOS[selectedPlan];

  return (
    <div className="min-h-screen bg-[#FAFBFD] font-inter">
      {/* Header */}
      <div className="bg-white border-b border-[#E4E9F2]">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center gap-4">
          <button
            onClick={() => (step === 2 ? setStep(1) : navigate('/'))}
            className="flex items-center gap-2 text-[#6F7689] hover:text-[#2A2E45] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Voltar</span>
          </button>
          <div className="flex items-center gap-2 ml-4">
            <div className="w-7 h-7 bg-[#1570FF] rounded-md flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-[#2A2E45]">OpinAI</span>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-10">
          {['Escolha o Plano', 'Seus Dados'].map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  step === i + 1
                    ? 'bg-[#1570FF] text-white'
                    : step > i + 1
                    ? 'bg-[#EDF3FF] text-[#1570FF]'
                    : 'bg-[#E4E9F2] text-[#8A8FA6]'
                }`}
              >
                <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">
                  {step > i + 1 ? '✓' : i + 1}
                </span>
                {label}
              </div>
              {i < 1 && <div className="w-8 h-px bg-[#E4E9F2]" />}
            </div>
          ))}
        </div>

        {/* STEP 1 — Escolha de plano */}
        {step === 1 && (
          <div>
            <h1 className="text-3xl font-bold text-[#2A2E45] text-center mb-2">
              Escolha seu plano
            </h1>
            <p className="text-[#8A8FA6] text-center mb-10">
              Acesso completo à plataforma OpinAI
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-8">
              {TIERS.map((tierId) => PLANOS[tierId]).map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPlan(p.id)}
                  className={`text-left rounded-2xl p-6 border-2 transition-all ${
                    selectedPlan === p.id
                      ? 'border-[#1570FF] bg-[#EDF3FF] shadow-lg shadow-[#1570FF]/10'
                      : 'border-[#E4E9F2] bg-white hover:border-[#1570FF]/50'
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-[#2A2E45] text-lg">{p.nome}</h3>
                      <p className="text-[#8A8FA6] text-sm">{p.periodo}</p>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                        selectedPlan === p.id ? 'border-[#1570FF] bg-[#1570FF]' : 'border-[#E4E9F2]'
                      }`}
                    >
                      {selectedPlan === p.id && (
                        <div className="w-2 h-2 rounded-full bg-white" />
                      )}
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-[#2A2E45] mb-4">{p.precoLabel}</div>
                  <ul className="space-y-2">
                    {p.itens.map((item) => (
                      <li key={item} className="flex items-center gap-2 text-sm text-[#6F7689]">
                        <CheckCircle className="w-4 h-4 text-[#10B981] flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </button>
              ))}
            </div>

            <div className="flex justify-center">
              <button
                onClick={() => setStep(2)}
                className="bg-[#1570FF] text-white px-10 py-4 rounded-xl font-semibold text-lg hover:bg-[#0D4FB8] transition-colors"
              >
                Continuar com {plan.nome}
              </button>
            </div>
          </div>
        )}

        {/* STEP 2 — Dados pessoais + pagamento */}
        {step === 2 && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            {/* Formulário */}
            <div className="lg:col-span-3">
              <h1 className="text-2xl font-bold text-[#2A2E45] mb-2">Seus dados</h1>
              <p className="text-[#8A8FA6] mb-6 text-sm">
                Necessário para emissão da cobrança e criação da sua conta
              </p>

              <form onSubmit={handleProceedToPayment} className="space-y-4">
                {/* Nome */}
                <div>
                  <label className="block text-sm font-medium text-[#2A2E45] mb-1">
                    Nome completo
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8FA6]" />
                    <input
                      type="text"
                      value={form.nome}
                      onChange={(e) => handleFormChange('nome', e.target.value)}
                      placeholder="João da Silva"
                      className="w-full pl-10 pr-4 py-3 border border-[#E4E9F2] rounded-xl bg-white outline-none focus:ring-2 focus:ring-[#1570FF] focus:border-transparent transition-all text-[#2A2E45] placeholder-[#C0C4D0]"
                      required
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-[#2A2E45] mb-1">E-mail</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8FA6]" />
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => handleFormChange('email', e.target.value)}
                      placeholder="joao@email.com"
                      className="w-full pl-10 pr-4 py-3 border border-[#E4E9F2] rounded-xl bg-white outline-none focus:ring-2 focus:ring-[#1570FF] focus:border-transparent transition-all text-[#2A2E45] placeholder-[#C0C4D0]"
                      required
                    />
                  </div>
                  <p className="text-xs text-[#8A8FA6] mt-1">
                    Use o mesmo e-mail que usará para criar sua conta
                  </p>
                </div>

                {/* CPF */}
                <div>
                  <label className="block text-sm font-medium text-[#2A2E45] mb-1">CPF</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8FA6]" />
                    <input
                      type="text"
                      value={form.cpf}
                      onChange={(e) => handleFormChange('cpf', e.target.value)}
                      placeholder="000.000.000-00"
                      className="w-full pl-10 pr-4 py-3 border border-[#E4E9F2] rounded-xl bg-white outline-none focus:ring-2 focus:ring-[#1570FF] focus:border-transparent transition-all text-[#2A2E45] placeholder-[#C0C4D0]"
                      required
                    />
                  </div>
                </div>

                {/* Telefone */}
                <div>
                  <label className="block text-sm font-medium text-[#2A2E45] mb-1">
                    Telefone / WhatsApp
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8FA6]" />
                    <input
                      type="tel"
                      value={form.telefone}
                      onChange={(e) => handleFormChange('telefone', e.target.value)}
                      placeholder="(11) 99999-9999"
                      className="w-full pl-10 pr-4 py-3 border border-[#E4E9F2] rounded-xl bg-white outline-none focus:ring-2 focus:ring-[#1570FF] focus:border-transparent transition-all text-[#2A2E45] placeholder-[#C0C4D0]"
                      required
                    />
                  </div>
                </div>

                {/* Métodos de pagamento */}
                <div className="bg-[#FAFBFD] border border-[#E4E9F2] rounded-xl p-4">
                  <p className="text-sm font-medium text-[#2A2E45] mb-3">Formas de pagamento aceitas</p>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-2 text-sm text-[#6F7689]">
                      <QrCode className="w-5 h-5 text-[#1570FF]" />
                      PIX
                    </div>
                    <div className="flex items-center gap-2 text-sm text-[#6F7689]">
                      <CreditCard className="w-5 h-5 text-[#1570FF]" />
                      Cartão de crédito
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#1570FF] text-white py-4 rounded-xl font-semibold text-lg hover:bg-[#0D4FB8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Gerando cobrança...
                    </>
                  ) : (
                    <>
                      <Lock className="w-5 h-5" />
                      Ir para Pagamento
                    </>
                  )}
                </button>

                <p className="text-center text-xs text-[#8A8FA6]">
                  <Shield className="w-3 h-3 inline mr-1" />
                  Pagamento 100% seguro processado pela AbacatePay
                </p>
              </form>
            </div>

            {/* Resumo do pedido */}
            <div className="lg:col-span-2">
              <div className="bg-white border border-[#E4E9F2] rounded-2xl p-6 sticky top-6">
                <h3 className="font-semibold text-[#2A2E45] mb-4">Resumo do pedido</h3>

                <div className="bg-[#EDF3FF] rounded-xl p-4 mb-4">
                  <div className="font-bold text-[#2A2E45]">{plan.nome}</div>
                  <div className="text-[#8A8FA6] text-sm">{plan.periodo}</div>
                  <div className="text-2xl font-bold text-[#1570FF] mt-2">{plan.precoLabel}</div>
                </div>

                <ul className="space-y-2 mb-6">
                  {plan.itens.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm text-[#6F7689]">
                      <CheckCircle className="w-4 h-4 text-[#10B981] flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>

                <div className="border-t border-[#E4E9F2] pt-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-[#8A8FA6]">Subtotal</span>
                    <span className="text-[#2A2E45]">{plan.precoLabel}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span className="text-[#2A2E45]">Total</span>
                    <span className="text-[#1570FF]">{plan.precoLabel}</span>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2 text-xs text-[#8A8FA6] bg-[#FAFBFD] rounded-lg p-3">
                  <Shield className="w-4 h-4 text-green-500 flex-shrink-0" />
                  Após o pagamento, acesse a plataforma com o e-mail cadastrado.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
