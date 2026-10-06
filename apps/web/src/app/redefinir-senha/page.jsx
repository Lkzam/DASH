import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle2, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Destino do link enviado por e-mail: aqui o usuário escolhe a senha nova.
 *
 * O link do Supabase chega de duas formas, dependendo da configuração do
 * projeto: com os tokens no fragmento (#access_token=…&type=recovery) ou com
 * um código na query (?code=…). O cliente tem `detectSessionInUrl`, que resolve
 * a primeira; a segunda trocamos aqui por uma sessão. Sem sessão não dá para
 * trocar a senha — é isso que impede alguém de abrir esta página direto.
 */
export default function RedefinirSenhaPage() {
  const [estado, setEstado] = useState('verificando'); // verificando | pronto | invalido | salvo
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [mostrar, setMostrar] = useState(false);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const { updatePassword } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    let vivo = true;

    // O link expirado volta com o motivo na URL — melhor avisar do que deixar
    // o usuário digitar uma senha nova para só então falhar.
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const query = new URLSearchParams(window.location.search);
    if (hash.get('error') || query.get('error')) {
      setEstado('invalido');
      return;
    }

    (async () => {
      const code = query.get('code');
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!vivo) return;
        if (error) { setEstado('invalido'); return; }
      }
      const { data } = await supabase.auth.getSession();
      if (!vivo) return;
      setEstado(data?.session ? 'pronto' : 'invalido');
      // Tira os tokens da barra de endereço: não precisam ficar no histórico.
      if (data?.session && (window.location.hash || code)) {
        window.history.replaceState(null, '', window.location.pathname);
      }
    })();

    // Em alguns casos a sessão só é montada depois do primeiro getSession.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((evento, sessao) => {
      if (!vivo) return;
      if (sessao && (evento === 'PASSWORD_RECOVERY' || evento === 'SIGNED_IN')) setEstado('pronto');
    });

    return () => { vivo = false; subscription.unsubscribe(); };
  }, []);

  const salvar = async (e) => {
    e.preventDefault();
    setErro('');
    if (senha.length < 6) { setErro('A senha precisa ter pelo menos 6 caracteres.'); return; }
    if (senha !== confirmacao) { setErro('As duas senhas não são iguais.'); return; }

    setSalvando(true);
    const { error } = await updatePassword(senha);
    setSalvando(false);
    if (error) {
      setErro(/same|igual/i.test(error)
        ? 'A senha nova precisa ser diferente da anterior.'
        : 'Não foi possível salvar. Peça um link novo e tente de novo.');
      return;
    }
    setEstado('salvo');
    setTimeout(() => navigate('/dashboard'), 2500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1570FF] to-[#0D4FB8] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/logo-branco.png" alt="Opina Ai" className="w-20 h-20 mx-auto mb-3" />
          <h1 className="text-4xl font-bold text-white mb-2">Opina Ai</h1>
          <p className="text-blue-100">Criar uma senha nova</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {estado === 'verificando' && (
            <div className="text-center py-6">
              <div className="w-8 h-8 border-2 border-[#1570FF] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-600">Validando seu link…</p>
            </div>
          )}

          {estado === 'invalido' && (
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-7 h-7 text-amber-500" />
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">Link expirado ou já usado</h2>
              <p className="text-sm text-gray-600">
                Cada link vale por 1 hora e só pode ser usado uma vez. Peça um novo na tela de login.
              </p>
              <button
                onClick={() => navigate('/login')}
                className="mt-6 w-full bg-[#1570FF] text-white py-3 rounded-lg font-medium hover:bg-[#0D4FB8] transition-colors"
              >
                Pedir um link novo
              </button>
            </div>
          )}

          {estado === 'salvo' && (
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-7 h-7 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">Senha alterada</h2>
              <p className="text-sm text-gray-600">Você já está conectado. Levando para o painel…</p>
            </div>
          )}

          {estado === 'pronto' && (
            <form onSubmit={salvar} className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-gray-800">Escolha a senha nova</h2>
                <p className="text-sm text-gray-600 mt-1">Use ao menos 6 caracteres.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Senha nova</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={mostrar ? 'text' : 'password'}
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="••••••••"
                    autoFocus
                    autoComplete="new-password"
                    className="w-full pl-11 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1570FF] focus:border-transparent outline-none transition-all"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setMostrar(!mostrar)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label={mostrar ? 'Esconder senha' : 'Mostrar senha'}
                  >
                    {mostrar ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Repita a senha</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={mostrar ? 'text' : 'password'}
                    value={confirmacao}
                    onChange={(e) => setConfirmacao(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1570FF] focus:border-transparent outline-none transition-all"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              {erro && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                  {erro}
                </div>
              )}

              <button
                type="submit"
                disabled={salvando}
                className="w-full bg-[#1570FF] text-white py-3 rounded-lg font-medium hover:bg-[#0D4FB8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {salvando ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Salvando...</span>
                  </div>
                ) : (
                  'Salvar nova senha'
                )}
              </button>
            </form>
          )}
        </div>

        <div className="text-center mt-6 text-blue-100 text-sm">
          © 2025 Opina Ai - Todos os direitos reservados
        </div>
      </div>
    </div>
  );
}
