import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { ShieldX } from 'lucide-react';

export default function ProtectedRetaguardaRoute({ children }) {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [hasPermission, setHasPermission] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkPermission() {
      if (authLoading) return;

      if (!user) {
        navigate('/login');
        return;
      }

      try {
        setChecking(true);

        // Obtém o access_token da sessão Supabase atual
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.access_token) {
          navigate('/login');
          return;
        }

        // Verifica permissão no servidor (service_role, ignora RLS)
        const res = await fetch('/api/check-retaguarda', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (!res.ok) {
          setHasPermission(false);
          return;
        }

        const { hasPermission: perm } = await res.json();
        setHasPermission(perm);
      } catch (err) {
        console.error('❌ Erro ao verificar permissão:', err);
        setHasPermission(false);
      } finally {
        setChecking(false);
      }
    }

    checkPermission();
  }, [user, authLoading, navigate]);

  // Mostra loading enquanto verifica autenticação e permissão
  if (authLoading || checking) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#212529]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#1570FF] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  // Se não tem usuário, não renderiza nada (vai redirecionar)
  if (!user) {
    return null;
  }

  // Se não tem permissão, mostra tela de acesso negado
  if (!hasPermission) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-[#212529] to-[#1A1D21]">
        <div className="max-w-md w-full mx-4">
          <div className="bg-[#2A2E45] border border-[#3A3E55] rounded-2xl shadow-2xl p-8 text-center">
            {/* Ícone de Acesso Negado */}
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <ShieldX className="w-10 h-10 text-red-400" />
            </div>

            {/* Título */}
            <h1 className="text-2xl font-bold text-white mb-3">
              Acesso Restrito
            </h1>

            {/* Descrição */}
            <p className="text-[#B0B5C9] mb-2">
              Você não tem permissão para acessar a <span className="font-semibold text-white">Retaguarda</span>.
            </p>
            <p className="text-[#8A8FA6] text-sm mb-8">
              Apenas usuários autorizados podem visualizar esta área. Entre em contato com um administrador para solicitar acesso.
            </p>

            {/* Informações do Usuário */}
            <div className="bg-[#1A1D21] border border-[#3A3E55] rounded-lg p-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-[#1570FF] to-[#0D4FB8] rounded-full flex items-center justify-center text-white font-semibold">
                  {(user.user_metadata?.display_name || user.email)
                    .split(' ')
                    .map(word => word[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)}
                </div>
                <div className="flex-1 text-left">
                  <div className="text-sm font-medium text-white">
                    {user.user_metadata?.display_name || 'Usuário'}
                  </div>
                  <div className="text-xs text-[#8A8FA6]">
                    {user.email}
                  </div>
                </div>
              </div>
            </div>

            {/* Botões */}
            <div className="space-y-3">
              <button
                onClick={() => navigate('/dashboard')}
                className="w-full bg-[#1570FF] hover:bg-[#0D4FB8] text-white font-medium py-3 px-4 rounded-lg transition-colors"
              >
                Voltar ao Dashboard
              </button>
              
              <button
                onClick={() => {
                  navigate('/dashboard');
                  setTimeout(() => {
                    alert('Para solicitar acesso à Retaguarda, entre em contato com um administrador através do sistema de suporte.');
                  }, 500);
                }}
                className="w-full bg-[#3A3E55] hover:bg-[#4A4E65] text-[#B0B5C9] font-medium py-3 px-4 rounded-lg transition-colors"
              >
                Solicitar Acesso
              </button>
            </div>

            {/* Footer */}
            <div className="mt-8 pt-6 border-t border-[#3A3E55]">
              <p className="text-xs text-[#6F7689]">
                ID do Usuário: <span className="font-mono text-[#8A8FA6]">{user.id.slice(0, 8)}...</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Se tem permissão, renderiza o conteúdo protegido
  return children;
}