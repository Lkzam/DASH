import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // 'checking' | 'active' | 'inactive'
  const [planStatus, setPlanStatus] = useState('checking');

  useEffect(() => {
    if (loading) return;

    if (!user) {
      navigate('/login');
      setPlanStatus('inactive');
      return;
    }

    checkPlan();
  }, [user, loading]);

  useEffect(() => {
    if (planStatus === 'inactive' && !loading && user) {
      navigate('/planos');
    }
  }, [planStatus]);

  const checkPlan = async () => {
    try {
      // Obtém o access_token da sessão Supabase atual
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        console.warn('[ProtectedRoute] Sem sessão ativa — redirecionando para login');
        navigate('/login');
        return;
      }

      // Verifica o plano no servidor (usa service_role, ignora RLS)
      const res = await fetch('/api/check-plan', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        console.error('[ProtectedRoute] /api/check-plan retornou', res.status);
        setPlanStatus('inactive');
        return;
      }

      const { hasAccess, email, error } = await res.json();
      if (error) console.error('[ProtectedRoute] Erro do servidor:', error);

      setPlanStatus(hasAccess ? 'active' : 'inactive');
    } catch (err) {
      console.error('[ProtectedRoute] Erro ao verificar plano:', err);
      setPlanStatus('inactive');
    }
  };

  // Mostrar spinner enquanto verifica auth ou plano
  if (loading || (user && planStatus === 'checking')) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#1570FF] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#8A8FA6] text-sm">Verificando acesso...</p>
        </div>
      </div>
    );
  }

  // Sem usuário ou plano inativo → null (redirect já disparado)
  if (!user || planStatus !== 'active') {
    return null;
  }

  return children;
}
