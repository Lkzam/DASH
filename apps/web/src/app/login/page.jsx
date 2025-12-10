import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        // LOGIN
        const { data, error } = await signIn(email, password);
        
        if (error) {
          setError(error);
          setLoading(false);
          return;
        }

        if (data) {
          navigate('/');
        }
      } else {
        // REGISTRO
        if (!displayName.trim()) {
          setError('Por favor, insira seu nome');
          setLoading(false);
          return;
        }

        const { data, error } = await signUp(email, password, displayName);
        
        if (error) {
          setError(error);
          setLoading(false);
          return;
        }

        if (data) {
          setError('');
          alert('Conta criada com sucesso! Verifique seu email para confirmar.');
          setIsLogin(true);
        }
      }
    } catch (err) {
      setError('Ocorreu um erro. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1570FF] to-[#0D4FB8] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Título */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Dashboard</h1>
          <p className="text-blue-100">
            {isLogin ? 'Faça login para continuar' : 'Crie sua conta'}
          </p>
        </div>

        {/* Card de Login/Registro */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Tabs */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => {
                setIsLogin(true);
                setError('');
              }}
              className={`flex-1 py-3 rounded-lg font-medium transition-all ${
                isLogin
                  ? 'bg-[#1570FF] text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Login
            </button>
            <button
              onClick={() => {
                setIsLogin(false);
                setError('');
              }}
              className={`flex-1 py-3 rounded-lg font-medium transition-all ${
                !isLogin
                  ? 'bg-[#1570FF] text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Registrar
            </button>
          </div>

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Nome (apenas no registro) */}
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome Completo
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Seu nome"
                    className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1570FF] focus:border-transparent outline-none transition-all"
                    required={!isLogin}
                  />
                </div>
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1570FF] focus:border-transparent outline-none transition-all"
                  required
                />
              </div>
            </div>

            {/* Senha */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1570FF] focus:border-transparent outline-none transition-all"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {!isLogin && (
                <p className="text-xs text-gray-500 mt-1">
                  Mínimo de 6 caracteres
                </p>
              )}
            </div>

            {/* Mensagem de Erro */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Botão de Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1570FF] text-white py-3 rounded-lg font-medium hover:bg-[#0D4FB8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Processando...</span>
                </div>
              ) : isLogin ? (
                'Entrar'
              ) : (
                'Criar Conta'
              )}
            </button>
          </form>

          {/* Link para alternar entre Login/Registro */}
          <div className="mt-6 text-center text-sm text-gray-600">
            {isLogin ? (
              <p>
                Não tem uma conta?{' '}
                <button
                  onClick={() => {
                    setIsLogin(false);
                    setError('');
                  }}
                  className="text-[#1570FF] font-medium hover:underline"
                >
                  Registre-se
                </button>
              </p>
            ) : (
              <p>
                Já tem uma conta?{' '}
                <button
                  onClick={() => {
                    setIsLogin(true);
                    setError('');
                  }}
                  className="text-[#1570FF] font-medium hover:underline"
                >
                  Faça login
                </button>
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-blue-100 text-sm">
          © 2024 Dashboard - Todos os direitos reservados
        </div>
      </div>
    </div>
  );
}