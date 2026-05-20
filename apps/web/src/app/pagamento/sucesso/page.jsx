import { useNavigate } from 'react-router-dom';
import { CheckCircle, BarChart3, ArrowRight, Mail } from 'lucide-react';

export default function PagamentoSucessoPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#050D1A] via-[#0A1A35] to-[#0D2F5E] flex items-center justify-center p-6 font-inter">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-[#1570FF] rounded-xl flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl text-white">OpinAI</span>
          </div>
        </div>

        {/* Card de sucesso */}
        <div className="bg-white rounded-3xl shadow-2xl p-10 text-center">
          {/* Ícone */}
          <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-12 h-12 text-green-500" />
          </div>

          <h1 className="text-2xl font-bold text-[#2A2E45] mb-3">
            Pagamento Confirmado!
          </h1>
          <p className="text-[#8A8FA6] mb-8 leading-relaxed">
            Seu plano foi ativado com sucesso. Agora você pode criar sua conta ou fazer login
            para acessar o dashboard do OpinAI.
          </p>

          {/* Próximos passos */}
          <div className="bg-[#FAFBFD] rounded-xl p-5 mb-8 text-left space-y-3">
            <p className="font-semibold text-[#2A2E45] text-sm mb-3">Próximos passos:</p>
            {[
              {
                icon: Mail,
                text: 'Você receberá um e-mail de confirmação com os detalhes do seu plano.',
              },
              {
                icon: BarChart3,
                text: 'Acesse a tela de login e crie sua conta com o e-mail usado no pagamento.',
              },
              {
                icon: CheckCircle,
                text: 'Após criar a conta, o acesso ao dashboard será liberado automaticamente.',
              },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-7 h-7 bg-[#EDF3FF] rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                  <item.icon className="w-4 h-4 text-[#1570FF]" />
                </div>
                <p className="text-sm text-[#6F7689]">{item.text}</p>
              </div>
            ))}
          </div>

          {/* Botões */}
          <div className="space-y-3">
            <button
              onClick={() => navigate('/login')}
              className="w-full flex items-center justify-center gap-2 bg-[#1570FF] text-white py-4 rounded-xl font-semibold hover:bg-[#0D4FB8] transition-colors"
            >
              Acessar minha conta
              <ArrowRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => navigate('/')}
              className="w-full text-[#6F7689] hover:text-[#2A2E45] py-2 text-sm transition-colors"
            >
              Voltar para a página inicial
            </button>
          </div>
        </div>

        <p className="text-center text-gray-500 text-sm mt-6">
          Problemas? Entre em contato com nosso suporte.
        </p>
      </div>
    </div>
  );
}
