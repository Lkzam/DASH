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
      const now = new Date().toISOString();
      const email = user.email?.toLowerCase();

      // Buscar plano ativo para este e-mail
      const { data, error } = await supabase
        .from('planos_usuario')
        .select('id, status, data_fim, user_id')
        .eq('email', email)
        .eq('status', 'ativo')
        .gte('data_fim', now)
        .maybeSingle();

      if (error) {
        console.error('Erro ao verificar plano:', error);
        setPlanStatus('inactive');
        return;
      }

      if (data) {
        // Vincular user_id caso ainda não esteja linkado
        if (!data.user_id && user.id) {
          supabase
            .from('planos_usuario')
            .update({ user_id: user.id, updated_at: new Date().toISOString() })
            .eq('id', data.id)
            .then();
        }
        setPlanStatus('active');
      } else {
        setPlanStatus('inactive');
      }
    } catch (err) {
      console.error('Erro ao verificar plano:', err);
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
