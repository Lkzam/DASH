import { useState, useEffect } from "react";
import {
  ChevronDown,
  Home,
  Map,
  Search,
  Settings,
  Bell,
  Moon,
  Sun,
  Globe,
  HelpCircle,
  BookOpen,
  Wrench,
  BarChart3,
  LogOut,
  Plus,
  X,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import ElectionChart from "../components/ElectionChart";
import { useDarkMode } from "../contexts/DarkModeContext";
import { useAuth } from "../contexts/AuthContext";
import ProtectedRoute from "../components/ProtectedRoute";
import { supabase } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";

function DashboardContent() {
  const [currentScreen, setCurrentScreen] = useState("home");
  const [selectedRound, setSelectedRound] = useState(1);
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const { user, signOut } = useAuth();

  // Estados para a tela de configurações
  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    phone: '',
  });
  const [message, setMessage] = useState({ type: '', text: '' });
  const [isSaving, setIsSaving] = useState(false);

  // Estado para saldo de moedas
  const [saldoMoedas, setSaldoMoedas] = useState(null);
  const [loadingSaldo, setLoadingSaldo] = useState(true);

  // Estado para favoritos
  const [favoritos, setFavoritos] = useState([]);
  const [loadingFavoritos, setLoadingFavoritos] = useState(true);
  const [showAddFavorito, setShowAddFavorito] = useState(false);

  // Estados para visualização de resultados de formulários
  const [formulariosComRespostas, setFormulariosComRespostas] = useState([]);
  const [loadingFormularios, setLoadingFormularios] = useState(false);
  const [formularioSelecionado, setFormularioSelecionado] = useState(null);
  const [respostasFormulario, setRespostasFormulario] = useState([]);
  const [perguntasFormulario, setPerguntasFormulario] = useState([]);
  const [loadingRespostas, setLoadingRespostas] = useState(false);

  // Extrair dados do usuário
  const userEmail = user?.email || 'usuario@email.com';
  const displayName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Usuário';

  // Atualizar formData quando o usuário mudar
  useEffect(() => {
    setFormData({
      displayName: displayName,
      email: userEmail,
      phone: user?.phone || '',
    });
  }, [user, displayName, userEmail]);

  // Buscar saldo de moedas do usuário
  useEffect(() => {
    const fetchSaldoMoedas = async () => {
      if (!user?.id) return;
      
      try {
        setLoadingSaldo(true);
        const { data, error } = await supabase
          .from('moedas_usuario')
          .select('saldo')
          .eq('user_id', user.id)
          .single();

        if (error) {
          console.error('Erro ao buscar saldo:', error);
          setSaldoMoedas(0);
        } else {
          setSaldoMoedas(data?.saldo || 0);
        }
      } catch (err) {
        console.error('Erro ao buscar saldo:', err);
        setSaldoMoedas(0);
      } finally {
        setLoadingSaldo(false);
      }
    };

    fetchSaldoMoedas();
  }, [user?.id]);

  // Buscar favoritos do usuário
  useEffect(() => {
    const fetchFavoritos = async () => {
      if (!user?.id) return;
      
      try {
        setLoadingFavoritos(true);
        const { data, error } = await supabase
          .from('favoritos_usuario')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true });

        if (error) {
          console.error('Erro ao buscar favoritos:', error);
          setFavoritos([]);
        } else {
          setFavoritos(data || []);
        }
      } catch (err) {
        console.error('Erro ao buscar favoritos:', err);
        setFavoritos([]);
      } finally {
        setLoadingFavoritos(false);
      }
    };

    fetchFavoritos();
  }, [user?.id]);

  // Buscar formulários com respostas para a tela de pesquisa
  useEffect(() => {
    const fetchFormulariosComRespostas = async () => {
      if (currentScreen !== 'search' || !user?.id) return;

      try {
        setLoadingFormularios(true);

        // Buscar TODOS os formulários (não apenas do usuário)
        const { data: formularios, error: formError } = await supabase
          .from('formularios')
          .select('*')
          .order('created_at', { ascending: false });

        if (formError) throw formError;

        // Para cada formulário, contar quantas respostas tem
        const formulariosComContagem = await Promise.all(
          (formularios || []).map(async (form) => {
            const { count, error: countError } = await supabase
              .from('respostas_formulario')
              .select('*', { count: 'exact', head: true })
              .eq('formulario_id', form.id);

            return {
              ...form,
              total_respostas: countError ? 0 : count || 0,
            };
          })
        );

        setFormulariosComRespostas(formulariosComContagem);
      } catch (err) {
        console.error('Erro ao buscar formulários:', err);
        showMessage('error', 'Erro ao carregar formulários');
      } finally {
        setLoadingFormularios(false);
      }
    };

    fetchFormulariosComRespostas();
  }, [currentScreen, user?.id]);

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { 
          display_name: formData.displayName 
        }
      });

      if (error) throw error;
      showMessage('success', 'Nome atualizado com sucesso!');
    } catch (error) {
      showMessage('error', error.message || 'Erro ao atualizar nome');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveEmail = async () => {
    if (!formData.email || formData.email === userEmail) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        email: formData.email
      });

      if (error) throw error;
      showMessage('success', 'Email atualizado! Verifique seu email para confirmar.');
    } catch (error) {
      showMessage('error', error.message || 'Erro ao atualizar email');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePhone = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        phone: formData.phone
      });

      if (error) throw error;
      showMessage('success', 'Telefone atualizado com sucesso!');
    } catch (error) {
      showMessage('error', error.message || 'Erro ao atualizar telefone');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddFavorito = async (screenId) => {
    try {
      const navItem = navItems.find(item => item.id === screenId);
      if (!navItem) return;

      // Verifica se já existe
      const jaExiste = favoritos.some(fav => fav.screen_id === screenId);
      if (jaExiste) {
        showMessage('error', 'Este item já está nos favoritos!');
        return;
      }

      const { error } = await supabase
        .from('favoritos_usuario')
        .insert({
          user_id: user.id,
          screen_id: screenId,
          screen_label: navItem.label,
        });

      if (error) throw error;

      // Atualiza a lista local
      const { data } = await supabase
        .from('favoritos_usuario')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      setFavoritos(data || []);
      setShowAddFavorito(false);
      showMessage('success', `"${navItem.label}" adicionado aos favoritos!`);
    } catch (error) {
      console.error('Erro ao adicionar favorito:', error);
      showMessage('error', 'Erro ao adicionar favorito');
    }
  };

  const handleRemoveFavorito = async (favoritoId) => {
    try {
      const { error } = await supabase
        .from('favoritos_usuario')
        .delete()
        .eq('id', favoritoId);

      if (error) throw error;

      // Atualiza a lista local
      setFavoritos(favoritos.filter(fav => fav.id !== favoritoId));
      showMessage('success', 'Favorito removido!');
    } catch (error) {
      console.error('Erro ao remover favorito:', error);
      showMessage('error', 'Erro ao remover favorito');
    }
  };

  const handleVisualizarResultados = async (formulario) => {
    try {
      setLoadingRespostas(true);
      setFormularioSelecionado(formulario);

      console.log('🔍 Carregando resultados do formulário:', formulario.id);

      // Buscar perguntas do formulário
      const { data: perguntas, error: perguntasError } = await supabase
        .from('perguntas_formulario')
        .select('*')
        .eq('formulario_id', formulario.id)
        .order('ordem', { ascending: true });

      if (perguntasError) {
        console.error('❌ Erro ao buscar perguntas:', perguntasError);
        throw perguntasError;
      }

      console.log('✅ Perguntas encontradas:', perguntas?.length || 0);

      // Parsear opções das perguntas
      const perguntasParseadas = (perguntas || []).map(p => ({
        ...p,
        opcoes: p.opcoes ? JSON.parse(p.opcoes) : [],
      }));

      setPerguntasFormulario(perguntasParseadas);

      // Buscar todas as respostas do formulário
      const { data: respostas, error: respostasError } = await supabase
        .from('respostas_formulario')
        .select('*')
        .eq('formulario_id', formulario.id);

      if (respostasError) {
        console.error('❌ Erro ao buscar respostas:', respostasError);
        throw respostasError;
      }

      console.log('✅ Respostas brutas encontradas:', respostas);

      // Buscar emails dos usuários que responderam
      const userIds = [...new Set(respostas.map(r => r.respondido_por))];
      
      console.log('📧 Buscando emails de', userIds.length, 'usuários');

      // Tentar usar RPC primeiro
      const { data: usersData, error: usersError } = await supabase
        .rpc('get_users_by_ids', { user_ids: userIds });

      // Criar mapa de emails
      const userEmailMap = {};
      
      if (usersData && !usersError) {
        console.log('✅ Emails obtidos via RPC:', usersData.length);
        usersData.forEach(u => {
          userEmailMap[u.id] = u.email;
        });
      } else {
        console.log('⚠️ RPC não disponível, tentando buscar via auth.admin');
        
        // Fallback: tentar buscar individualmente (pode não funcionar sem permissões)
        for (const userId of userIds) {
          try {
            // Tentar através de uma query na tabela moedas_usuario para inferir o user
            // (não é o ideal, mas funciona como último recurso)
            const { data: userData } = await supabase
              .from('moedas_usuario')
              .select('user_id')
              .eq('user_id', userId)
              .single();
            
            if (userData) {
              // Usar o ID parcial como fallback
              userEmailMap[userId] = `user_${userId.slice(0, 8)}@sistema.local`;
            }
          } catch (err) {
            console.log('⚠️ Não foi possível buscar dados do usuário:', userId);
            userEmailMap[userId] = `user_${userId.slice(0, 8)}@sistema.local`;
          }
        }
      }

      console.log('📧 Mapa de emails final:', userEmailMap);

      // Processar respostas
      const respostasProcessadas = (respostas || []).map(r => {
        let respostasArray = [];
        try {
          respostasArray = typeof r.respostas === 'string' 
            ? JSON.parse(r.respostas) 
            : r.respostas;
        } catch (parseError) {
          console.error('❌ Erro ao parsear resposta:', parseError, r.respostas);
        }

        // Tentar pegar o email do mapa de usuários
        const userEmail = userEmailMap[r.respondido_por] || `user_${r.respondido_por.slice(0, 8)}@sistema.local`;
        const userName = userEmail.split('@')[0] || userEmail;

        return {
          ...r,
          respostas_array: respostasArray,
          user_email: userEmail,
          user_name: userName,
        };
      });

      console.log('✅ Respostas processadas:', respostasProcessadas);
      setRespostasFormulario(respostasProcessadas);
    } catch (err) {
      console.error('❌ Erro ao carregar resultados:', err);
      showMessage('error', 'Erro ao carregar resultados do formulário: ' + err.message);
    } finally {
      setLoadingRespostas(false);
    }
  };

  const handleFecharResultados = () => {
    setFormularioSelecionado(null);
    setRespostasFormulario([]);
    setPerguntasFormulario([]);
  };

  // Função auxiliar para processar dados de gráfico de pizza
  const processarDadosGraficoPizza = (pergunta) => {
    console.log('🍕 Processando dados do gráfico para pergunta:', pergunta.id);
    console.log('📊 Total de respostas disponíveis:', respostasFormulario.length);
    
    const contagemOpcoes = {};

    // Inicializar todas as opções com 0
    pergunta.opcoes.forEach(opcao => {
      contagemOpcoes[opcao] = 0;
    });

    console.log('📋 Opções inicializadas:', contagemOpcoes);

    // Contar respostas
    respostasFormulario.forEach((resposta, idx) => {
      console.log(`📝 Processando resposta ${idx + 1}:`, resposta.respostas_array);
      
      const respostaItem = resposta.respostas_array.find(
        r => r.pergunta_id === pergunta.id
      );

      console.log(`  ➡️ Resposta para pergunta ${pergunta.id}:`, respostaItem);

      if (respostaItem && respostaItem.resposta) {
        if (Array.isArray(respostaItem.resposta)) {
          // Checkbox - múltiplas seleções
          console.log('  ✅ Array detectado (checkbox):', respostaItem.resposta);
          respostaItem.resposta.forEach(opcao => {
            if (contagemOpcoes.hasOwnProperty(opcao)) {
              contagemOpcoes[opcao]++;
              console.log(`    ➕ Incrementando "${opcao}": ${contagemOpcoes[opcao]}`);
            }
          });
        } else {
          // Múltipla escolha - única seleção
          console.log('  ✅ String detectada (múltipla escolha):', respostaItem.resposta);
          if (contagemOpcoes.hasOwnProperty(respostaItem.resposta)) {
            contagemOpcoes[respostaItem.resposta]++;
            console.log(`    ➕ Incrementando "${respostaItem.resposta}": ${contagemOpcoes[respostaItem.resposta]}`);
          }
        }
      } else {
        console.log('  ⚠️ Resposta vazia ou não encontrada para esta pergunta');
      }
    });

    console.log('📊 Contagem final:', contagemOpcoes);

    // Converter para formato do Recharts e adicionar cores
    const cores = [
      '#1570FF', '#E74C3C', '#2ECC71', '#F39C12', '#9B59B6',
      '#3498DB', '#E67E22', '#1ABC9C', '#34495E', '#95A5A6'
    ];

    const resultado = Object.entries(contagemOpcoes)
      .map(([nome, valor], index) => ({
        name: nome,
        value: valor,
        fill: cores[index % cores.length],
      }))
      .filter(item => item.value > 0); // Mostrar apenas opções com votos

    console.log('🎨 Dados formatados para o gráfico:', resultado);
    
    return resultado;
  };
  
  // Pegar iniciais para o avatar
  const getInitials = (name) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const navItems = [
    {
      id: "home",
      icon: Home,
      label: "Home",
      active: currentScreen === "home",
    },
    {
      id: "elections",
      icon: BarChart3,
      label: "Eleições 2022",
      active: currentScreen === "elections",
    },
    {
      id: "map",
      icon: Map,
      label: "Mapa",
      active: currentScreen === "map",
    },
    {
      id: "search",
      icon: Search,
      label: "Pesquisa",
      active: currentScreen === "search",
    },
    {
      id: "settings",
      icon: Settings,
      label: "Configuração",
      active: currentScreen === "settings",
    },
  ];

  const navigate = useNavigate();

  const moreItems = [
    { icon: Globe, label: "Idioma" },
    { 
      icon: isDarkMode ? Sun : Moon, 
      label: isDarkMode ? "Modo Claro" : "Modo Escuro",
      onClick: toggleDarkMode 
    },
    { icon: BookOpen, label: "Aprender" },
    { icon: HelpCircle, label: "Centro de Ajuda" },
    { 
      icon: Wrench, 
      label: "Retaguarda",
      onClick: () => navigate('/retaguarda')
    },
    { 
      icon: LogOut, 
      label: "Sair",
      onClick: async () => {
        if (confirm('Deseja realmente sair?')) {
          await signOut();
        }
      }
    },
  ];

  const handleNavigation = (screenId) => {
    setCurrentScreen(screenId);
  };

  const renderEmptyScreen = (title, description) => {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4 ${
            isDarkMode ? 'bg-[#2A2E45]' : 'bg-[#EDF3FF]'
          }`}>
            <div className={`w-12 h-12 rounded-full opacity-20 ${
              isDarkMode ? 'bg-[#4A90E2]' : 'bg-[#1570FF]'
            }`}></div>
          </div>
          <h2 className={`text-2xl font-semibold mb-2 ${
            isDarkMode ? 'text-white' : 'text-[#2A2E45]'
          }`}>
            {title}
          </h2>
          <p className={isDarkMode ? 'text-[#B0B5C9]' : 'text-[#8A8FA6]'}>
            {description}
          </p>
        </div>
      </div>
    );
  };

  const renderHomeScreen = () => {
    return (
      <div className="flex flex-col h-full p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className={`text-2xl font-semibold ${
            isDarkMode ? 'text-white' : 'text-[#2A2E45]'
          }`}>
            Bem-vindo, {displayName}!
          </h1>
          <p className={`text-sm mt-1 ${
            isDarkMode ? 'text-[#B0B5C9]' : 'text-[#8A8FA6]'
          }`}>
            Esta é a tela inicial da sua dashboard
          </p>
        </div>

        {/* Card de Saldo de Moedas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className={`rounded-lg border shadow-sm ${
            isDarkMode 
              ? 'bg-[#2A2E45] border-[#3A3E55]' 
              : 'bg-white border-[#E4E9F2]'
          }`}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`text-sm font-medium ${
                  isDarkMode ? 'text-[#B0B5C9]' : 'text-[#8A8FA6]'
                }`}>
                  Saldo de Moedas
                </div>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  isDarkMode ? 'bg-[#3A3E55]' : 'bg-[#EDF3FF]'
                }`}>
                  <span className="text-xl">💰</span>
                </div>
              </div>
              
              {loadingSaldo ? (
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 border-2 border-[#1570FF] border-t-transparent rounded-full animate-spin"></div>
                  <span className={`text-sm ${
                    isDarkMode ? 'text-[#B0B5C9]' : 'text-[#8A8FA6]'
                  }`}>
                    Carregando...
                  </span>
                </div>
              ) : (
                <>
                  <div className={`text-3xl font-bold mb-2 ${
                    isDarkMode ? 'text-white' : 'text-[#2A2E45]'
                  }`}>
                    {saldoMoedas?.toLocaleString('pt-BR') || '0'}
                  </div>
                  <div className={`text-xs ${
                    isDarkMode ? 'text-[#8A8FA6]' : 'text-[#6F7689]'
                  }`}>
                    moedas disponíveis
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Card de Informações do Usuário */}
          <div className={`rounded-lg border shadow-sm ${
            isDarkMode 
              ? 'bg-[#2A2E45] border-[#3A3E55]' 
              : 'bg-white border-[#E4E9F2]'
          }`}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`text-sm font-medium ${
                  isDarkMode ? 'text-[#B0B5C9]' : 'text-[#8A8FA6]'
                }`}>
                  Informações da Conta
                </div>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  isDarkMode ? 'bg-[#3A3E55]' : 'bg-[#EDF3FF]'
                }`}>
                  <span className="text-xl">👤</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <div>
                  <div className={`text-xs ${
                    isDarkMode ? 'text-[#8A8FA6]' : 'text-[#6F7689]'
                  }`}>
                    Nome
                  </div>
                  <div className={`text-sm font-medium ${
                    isDarkMode ? 'text-white' : 'text-[#2A2E45]'
                  }`}>
                    {displayName}
                  </div>
                </div>
                <div>
                  <div className={`text-xs ${
                    isDarkMode ? 'text-[#8A8FA6]' : 'text-[#6F7689]'
                  }`}>
                    Email
                  </div>
                  <div className={`text-sm font-medium truncate ${
                    isDarkMode ? 'text-white' : 'text-[#2A2E45]'
                  }`}>
                    {userEmail}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card de Favoritos */}
          <div className={`rounded-lg border shadow-sm ${
            isDarkMode 
              ? 'bg-[#2A2E45] border-[#3A3E55]' 
              : 'bg-white border-[#E4E9F2]'
          }`}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`text-sm font-medium ${
                  isDarkMode ? 'text-[#B0B5C9]' : 'text-[#8A8FA6]'
                }`}>
                  ⭐ Favoritos
                </div>
                <button
                  onClick={() => setShowAddFavorito(!showAddFavorito)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                    isDarkMode 
                      ? 'bg-[#3A3E55] hover:bg-[#4A4E65] text-[#B0B5C9]' 
                      : 'bg-[#EDF3FF] hover:bg-[#DDE7FF] text-[#1570FF]'
                  }`}
                  title="Adicionar favorito"
                >
                  {showAddFavorito ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                </button>
              </div>
              
              {/* Modal para adicionar favorito */}
              {showAddFavorito && (
                <div className={`mb-4 p-3 rounded-lg border ${
                  isDarkMode 
                    ? 'bg-[#1A1D21] border-[#3A3E55]' 
                    : 'bg-[#F7F9FC] border-[#E4E9F2]'
                }`}>
                  <div className={`text-xs font-medium mb-2 ${
                    isDarkMode ? 'text-[#B0B5C9]' : 'text-[#8A8FA6]'
                  }`}>
                    Selecione uma aba:
                  </div>
                  <div className="space-y-1">
                    {navItems
                      .filter(item => !favoritos.some(fav => fav.screen_id === item.id))
                      .map((item) => (
                        <button
                          key={item.id}
                          onClick={() => handleAddFavorito(item.id)}
                          className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors flex items-center gap-2 ${
                            isDarkMode
                              ? 'hover:bg-[#2A2E45] text-[#B0B5C9]'
                              : 'hover:bg-white text-[#2A2E45]'
                          }`}
                        >
                          <item.icon className="w-3 h-3" />
                          {item.label}
                        </button>
                      ))}
                    {favoritos.length === navItems.length && (
                      <div className={`text-xs text-center py-2 ${
                        isDarkMode ? 'text-[#8A8FA6]' : 'text-[#6F7689]'
                      }`}>
                        Todos os itens já estão nos favoritos
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Lista de favoritos */}
              {loadingFavoritos ? (
                <div className="flex items-center gap-2 py-2">
                  <div className="w-4 h-4 border-2 border-[#1570FF] border-t-transparent rounded-full animate-spin"></div>
                  <span className={`text-xs ${
                    isDarkMode ? 'text-[#B0B5C9]' : 'text-[#8A8FA6]'
                  }`}>
                    Carregando...
                  </span>
                </div>
              ) : favoritos.length === 0 ? (
                <div className={`text-center py-4 ${
                  isDarkMode ? 'text-[#8A8FA6]' : 'text-[#6F7689]'
                }`}>
                  <div className="text-2xl mb-2">⭐</div>
                  <div className="text-xs">
                    Adicione suas abas favoritas
                  </div>
                </div>
              ) : (
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {favoritos.map((favorito) => {
                    const navItem = navItems.find(item => item.id === favorito.screen_id);
                    return (
                      <div
                        key={favorito.id}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg transition-colors group ${
                          isDarkMode
                            ? 'hover:bg-[#3A3E55]'
                            : 'hover:bg-[#EDF3FF]'
                        }`}
                      >
                        <button
                          onClick={() => handleNavigation(favorito.screen_id)}
                          className="flex items-center gap-2 flex-1 text-left"
                        >
                          {navItem && <navItem.icon className={`w-4 h-4 ${
                            isDarkMode ? 'text-[#B0B5C9]' : 'text-[#6F7689]'
                          }`} />}
                          <span className={`text-sm font-medium ${
                            isDarkMode ? 'text-white' : 'text-[#2A2E45]'
                          }`}>
                            {favorito.screen_label}
                          </span>
                        </button>
                        <button
                          onClick={() => handleRemoveFavorito(favorito.id)}
                          className={`opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded ${
                            isDarkMode
                              ? 'hover:bg-[#4A4E65] text-red-400'
                              : 'hover:bg-red-50 text-red-500'
                          }`}
                          title="Remover dos favoritos"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderElectionsScreen = () => {
    return (
      <div className="flex flex-col h-full p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className={`text-2xl font-semibold ${
              isDarkMode ? 'text-white' : 'text-[#2A2E45]'
            }`}>
              Eleição Presidencial 2022
            </h1>
            <p className={`text-sm mt-1 ${
              isDarkMode ? 'text-[#B0B5C9]' : 'text-[#8A8FA6]'
            }`}>
              Visualize os resultados dos turnos da eleição presidencial
            </p>
          </div>

          {/* Toggle de Turnos */}
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedRound(1)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                selectedRound === 1
                  ? "bg-[#1570FF] text-white shadow-md"
                  : isDarkMode
                  ? "bg-[#2A2E45] text-[#B0B5C9] border border-[#3A3E55] hover:border-[#1570FF]"
                  : "bg-white text-[#6F7689] border border-[#E4E9F2] hover:border-[#1570FF]"
              }`}
            >
              1º Turno
            </button>
            <button
              onClick={() => setSelectedRound(2)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                selectedRound === 2
                  ? "bg-[#1570FF] text-white shadow-md"
                  : isDarkMode
                  ? "bg-[#2A2E45] text-[#B0B5C9] border border-[#3A3E55] hover:border-[#1570FF]"
                  : "bg-white text-[#6F7689] border border-[#E4E9F2] hover:border-[#1570FF]"
              }`}
            >
              2º Turno
            </button>
          </div>
        </div>

        {/* Gráfico */}
        <div className={`flex-1 rounded-lg border shadow-sm min-h-[400px] ${
          isDarkMode 
            ? 'bg-[#2A2E45] border-[#3A3E55]' 
            : 'bg-white border-[#E4E9F2]'
        }`}>
          <ElectionChart round={selectedRound} />
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className={`rounded-lg border p-4 ${
            isDarkMode 
              ? 'bg-[#2A2E45] border-[#3A3E55]' 
              : 'bg-white border-[#E4E9F2]'
          }`}>
            <div className={`text-sm mb-1 ${
              isDarkMode ? 'text-[#B0B5C9]' : 'text-[#8A8FA6]'
            }`}>
              Total de Votos
            </div>
            <div className={`text-2xl font-semibold ${
              isDarkMode ? 'text-white' : 'text-[#2A2E45]'
            }`}>
              {selectedRound === 1 ? "156M" : "121M"}
            </div>
          </div>
          <div className={`rounded-lg border p-4 ${
            isDarkMode 
              ? 'bg-[#2A2E45] border-[#3A3E55]' 
              : 'bg-white border-[#E4E9F2]'
          }`}>
            <div className={`text-sm mb-1 ${
              isDarkMode ? 'text-[#B0B5C9]' : 'text-[#8A8FA6]'
            }`}>
              Turno
            </div>
            <div className={`text-2xl font-semibold ${
              isDarkMode ? 'text-white' : 'text-[#2A2E45]'
            }`}>
              {selectedRound === 1 ? "Primeiro" : "Segundo"}
            </div>
          </div>
          <div className={`rounded-lg border p-4 ${
            isDarkMode 
              ? 'bg-[#2A2E45] border-[#3A3E55]' 
              : 'bg-white border-[#E4E9F2]'
          }`}>
            <div className={`text-sm mb-1 ${
              isDarkMode ? 'text-[#B0B5C9]' : 'text-[#8A8FA6]'
            }`}>
              Ano
            </div>
            <div className={`text-2xl font-semibold ${
              isDarkMode ? 'text-white' : 'text-[#2A2E45]'
            }`}>
              2022
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSearchScreen = () => {
    return (
      <div className="flex flex-col h-full p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className={`text-2xl font-semibold ${
            isDarkMode ? 'text-white' : 'text-[#2A2E45]'
          }`}>
            Resultados dos Formulários
          </h1>
          <p className={`text-sm mt-1 ${
            isDarkMode ? 'text-[#B0B5C9]' : 'text-[#8A8FA6]'
          }`}>
            Visualize e analise as respostas dos seus formulários
          </p>
        </div>

        {/* Loading */}
        {loadingFormularios ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 border-4 border-[#1570FF] border-t-transparent rounded-full animate-spin"></div>
              <div className={isDarkMode ? 'text-[#B0B5C9]' : 'text-[#8A8FA6]'}>
                Carregando formulários...
              </div>
            </div>
          </div>
        ) : formulariosComRespostas.length === 0 ? (
          <div className={`text-center py-16 ${
            isDarkMode ? 'text-[#8A8FA6]' : 'text-[#6F7689]'
          }`}>
            <Search className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">Nenhum formulário encontrado</p>
            <p className="text-sm">
              Crie formulários na Retaguarda para visualizar os resultados aqui
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {formulariosComRespostas.map((form) => (
              <div
                key={form.id}
                className={`rounded-lg border shadow-sm p-6 transition-all hover:shadow-md cursor-pointer ${
                  isDarkMode
                    ? 'bg-[#2A2E45] border-[#3A3E55] hover:border-[#1570FF]'
                    : 'bg-white border-[#E4E9F2] hover:border-[#1570FF]'
                }`}
                onClick={() => handleVisualizarResultados(form)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className={`font-semibold text-lg mb-1 ${
                      isDarkMode ? 'text-white' : 'text-[#2A2E45]'
                    }`}>
                      {form.titulo}
                    </h3>
                    {form.descricao && (
                      <p className={`text-sm line-clamp-2 ${
                        isDarkMode ? 'text-[#B0B5C9]' : 'text-[#8A8FA6]'
                      }`}>
                        {form.descricao}
                      </p>
                    )}
                  </div>
                </div>

                <div className={`flex items-center justify-between pt-4 border-t ${
                  isDarkMode ? 'border-[#3A3E55]' : 'border-[#E4E9F2]'
                }`}>
                  <div className="flex items-center gap-2">
                    <BarChart3 className={`w-4 h-4 ${
                      isDarkMode ? 'text-[#4A90E2]' : 'text-[#1570FF]'
                    }`} />
                    <span className={`text-sm font-medium ${
                      isDarkMode ? 'text-[#B0B5C9]' : 'text-[#6F7689]'
                    }`}>
                      {form.total_respostas} {form.total_respostas === 1 ? 'resposta' : 'respostas'}
                    </span>
                  </div>
                  <button
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      isDarkMode
                        ? 'bg-[#1570FF]/20 text-[#4A90E2] hover:bg-[#1570FF]/30'
                        : 'bg-[#EDF3FF] text-[#1570FF] hover:bg-[#DDE7FF]'
                    }`}
                  >
                    Ver Resultados
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal de Resultados */}
        {formularioSelecionado && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
            onClick={(e) => {
              if (e.target === e.currentTarget) handleFecharResultados();
            }}
          >
            <div
              className={`w-full max-w-6xl max-h-[90vh] overflow-auto rounded-lg shadow-2xl ${
                isDarkMode ? 'bg-[#1A1D21]' : 'bg-white'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header do Modal */}
              <div className={`sticky top-0 z-10 flex items-center justify-between p-6 border-b ${
                isDarkMode 
                  ? 'bg-[#1A1D21] border-[#3A3E55]' 
                  : 'bg-white border-[#E4E9F2]'
              }`}>
                <div>
                  <h2 className={`text-2xl font-semibold ${
                    isDarkMode ? 'text-white' : 'text-[#2A2E45]'
                  }`}>
                    {formularioSelecionado.titulo}
                  </h2>
                  <p className={`text-sm mt-1 ${
                    isDarkMode ? 'text-[#B0B5C9]' : 'text-[#8A8FA6]'
                  }`}>
                    {respostasFormulario.length} {respostasFormulario.length === 1 ? 'resposta recebida' : 'respostas recebidas'}
                  </p>
                </div>
                <button
                  onClick={handleFecharResultados}
                  className={`p-2 rounded-lg transition-colors ${
                    isDarkMode
                      ? 'hover:bg-[#2A2E45] text-[#B0B5C9]'
                      : 'hover:bg-[#EDF3FF] text-[#6F7689]'
                  }`}
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Conteúdo do Modal */}
              <div className="p-6 space-y-8">
                {loadingRespostas ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-12 h-12 border-4 border-[#1570FF] border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : respostasFormulario.length === 0 ? (
                  <div className={`text-center py-12 ${
                    isDarkMode ? 'text-[#8A8FA6]' : 'text-[#6F7689]'
                  }`}>
                    <p className="text-lg font-medium mb-2">Nenhuma resposta ainda</p>
                    <p className="text-sm">Este formulário ainda não recebeu respostas</p>
                  </div>
                ) : (
                  perguntasFormulario.map((pergunta, index) => (
                    <div
                      key={pergunta.id}
                      className={`rounded-lg border p-6 ${
                        isDarkMode
                          ? 'bg-[#2A2E45] border-[#3A3E55]'
                          : 'bg-white border-[#E4E9F2]'
                      }`}
                    >
                      <h3 className={`text-lg font-semibold mb-4 ${
                        isDarkMode ? 'text-white' : 'text-[#2A2E45]'
                      }`}>
                        {index + 1}. {pergunta.texto}
                      </h3>

                      {/* Renderizar baseado no tipo de pergunta */}
                      {(pergunta.tipo === 'multipla_escolha' || pergunta.tipo === 'checkbox') ? (
                        <div className="space-y-4">
                          {(() => {
                            const dadosGrafico = processarDadosGraficoPizza(pergunta);
                            const totalRespostas = dadosGrafico.reduce((sum, item) => sum + item.value, 0);

                            return dadosGrafico.length > 0 ? (
                              <>
                                {/* Gráfico de Pizza */}
                                <div className="flex items-center justify-center">
                                  <ResponsiveContainer width="100%" height={300}>
                                    <PieChart>
                                      <Pie
                                        data={dadosGrafico}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        label={({ name, value, percent }) => 
                                          `${name}: ${value} (${(percent * 100).toFixed(1)}%)`
                                        }
                                        outerRadius={100}
                                        dataKey="value"
                                      >
                                        {dadosGrafico.map((entry, index) => (
                                          <Cell key={`cell-${index}`} fill={entry.fill} />
                                        ))}
                                      </Pie>
                                      <Tooltip 
                                        formatter={(value) => [value, 'Respostas']}
                                        contentStyle={{
                                          backgroundColor: isDarkMode ? '#2A2E45' : '#fff',
                                          border: `1px solid ${isDarkMode ? '#3A3E55' : '#E4E9F2'}`,
                                          borderRadius: '8px',
                                          padding: '8px 12px'
                                        }}
                                      />
                                    </PieChart>
                                  </ResponsiveContainer>
                                </div>

                                {/* Legenda com estatísticas */}
                                <div className="grid grid-cols-2 gap-3">
                                  {dadosGrafico.map((item, index) => (
                                    <div
                                      key={index}
                                      className={`flex items-center gap-3 p-3 rounded-lg ${
                                        isDarkMode ? 'bg-[#1A1D21]' : 'bg-[#F7F9FC]'
                                      }`}
                                    >
                                      <div
                                        className="w-4 h-4 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: item.fill }}
                                      />
                                      <div className="flex-1 min-w-0">
                                        <div className={`text-sm font-medium truncate ${
                                          isDarkMode ? 'text-white' : 'text-[#2A2E45]'
                                        }`}>
                                          {item.name}
                                        </div>
                                        <div className={`text-xs ${
                                          isDarkMode ? 'text-[#8A8FA6]' : 'text-[#6F7689]'
                                        }`}>
                                          {item.value} {item.value === 1 ? 'voto' : 'votos'} 
                                          {' '}({((item.value / totalRespostas) * 100).toFixed(1)}%)
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>

                                {/* Total */}
                                <div className={`text-center pt-4 border-t ${
                                  isDarkMode ? 'border-[#3A3E55]' : 'border-[#E4E9F2]'
                                }`}>
                                  <span className={`text-sm font-medium ${
                                    isDarkMode ? 'text-[#B0B5C9]' : 'text-[#6F7689]'
                                  }`}>
                                    Total de respostas: {totalRespostas}
                                  </span>
                                </div>
                              </>
                            ) : (
                              <div className={`text-center py-8 ${
                                isDarkMode ? 'text-[#8A8FA6]' : 'text-[#6F7689]'
                              }`}>
                                <p>Nenhuma resposta para esta pergunta ainda</p>
                              </div>
                            );
                          })()}
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className={`border-b ${
                                isDarkMode ? 'border-[#3A3E55]' : 'border-[#E4E9F2]'
                              }`}>
                                <th className={`text-left py-3 px-4 font-medium ${
                                  isDarkMode ? 'text-[#B0B5C9]' : 'text-[#6F7689]'
                                }`}>
                                  Usuário
                                </th>
                                <th className={`text-left py-3 px-4 font-medium ${
                                  isDarkMode ? 'text-[#B0B5C9]' : 'text-[#6F7689]'
                                }`}>
                                  Resposta
                                </th>
                                <th className={`text-left py-3 px-4 font-medium ${
                                  isDarkMode ? 'text-[#B0B5C9]' : 'text-[#6F7689]'
                                }`}>
                                  Data
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {respostasFormulario.map((resposta) => {
                                const respostaItem = resposta.respostas_array.find(
                                  r => r.pergunta_id === pergunta.id
                                );
                                
                                if (!respostaItem || !respostaItem.resposta) return null;

                                return (
                                  <tr
                                    key={resposta.id}
                                    className={`border-b ${
                                      isDarkMode
                                        ? 'border-[#3A3E55] hover:bg-[#1A1D21]'
                                        : 'border-[#E4E9F2] hover:bg-[#F7F9FC]'
                                    }`}
                                  >
                                    <td className={`py-3 px-4 ${
                                      isDarkMode ? 'text-white' : 'text-[#2A2E45]'
                                    }`}>
                                      {resposta.user_name}
                                    </td>
                                    <td className={`py-3 px-4 ${
                                      isDarkMode ? 'text-[#B0B5C9]' : 'text-[#6F7689]'
                                    }`}>
                                      {Array.isArray(respostaItem.resposta) 
                                        ? respostaItem.resposta.join(', ')
                                        : respostaItem.resposta}
                                    </td>
                                    <td className={`py-3 px-4 text-sm ${
                                      isDarkMode ? 'text-[#8A8FA6]' : 'text-[#6F7689]'
                                    }`}>
                                      {new Date(resposta.created_at).toLocaleDateString('pt-BR', {
                                        day: '2-digit',
                                        month: '2-digit',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderSettingsScreen = () => {
    return (
      <div className="flex flex-col h-full p-6 space-y-6 overflow-auto">
        {/* Header */}
        <div>
          <h1 className={`text-2xl font-semibold ${
            isDarkMode ? 'text-white' : 'text-[#2A2E45]'
          }`}>
            Configurações da Conta
          </h1>
          <p className={`text-sm mt-1 ${
            isDarkMode ? 'text-[#B0B5C9]' : 'text-[#8A8FA6]'
          }`}>
            Gerencie suas informações pessoais
          </p>
        </div>

        {/* Mensagem de Feedback */}
        {message.text && (
          <div className={`px-4 py-3 rounded-lg ${
            message.type === 'success' 
              ? 'bg-green-50 text-green-600 border border-green-200' 
              : 'bg-red-50 text-red-600 border border-red-200'
          }`}>
            {message.text}
          </div>
        )}

        {/* Card de Nome */}
        <div className={`rounded-lg border shadow-sm ${
          isDarkMode 
            ? 'bg-[#2A2E45] border-[#3A3E55]' 
            : 'bg-white border-[#E4E9F2]'
        }`}>
          <div className={`p-4 border-b ${
            isDarkMode ? 'border-[#3A3E55]' : 'border-[#E4E9F2]'
          }`}>
            <h2 className={`text-lg font-semibold ${
              isDarkMode ? 'text-white' : 'text-[#2A2E45]'
            }`}>
              Nome de Exibição
            </h2>
          </div>
          
          <div className="p-4 space-y-4">
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                isDarkMode ? 'text-[#B0B5C9]' : 'text-[#2A2E45]'
              }`}>
                Nome
              </label>
              <input
                type="text"
                value={formData.displayName}
                onChange={(e) => setFormData({...formData, displayName: e.target.value})}
                className={`w-full px-4 py-2 border rounded-lg outline-none transition-all ${
                  isDarkMode
                    ? 'bg-[#1A1D21] border-[#3A3E55] text-white focus:border-[#1570FF]'
                    : 'bg-white border-[#E4E9F2] text-[#2A2E45] focus:ring-2 focus:ring-[#1570FF] focus:border-transparent'
                }`}
                placeholder="Seu nome"
              />
            </div>

            <button
              onClick={handleSaveProfile}
              disabled={isSaving}
              className="flex items-center gap-2 bg-[#1570FF] text-white px-6 py-2 rounded-lg hover:bg-[#0D4FB8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Settings className="w-4 h-4" />
              {isSaving ? 'Salvando...' : 'Salvar Nome'}
            </button>
          </div>
        </div>

        {/* Card de Email */}
        <div className={`rounded-lg border shadow-sm ${
          isDarkMode 
            ? 'bg-[#2A2E45] border-[#3A3E55]' 
            : 'bg-white border-[#E4E9F2]'
        }`}>
          <div className={`p-4 border-b ${
            isDarkMode ? 'border-[#3A3E55]' : 'border-[#E4E9F2]'
          }`}>
            <h2 className={`text-lg font-semibold ${
              isDarkMode ? 'text-white' : 'text-[#2A2E45]'
            }`}>
              Email
            </h2>
          </div>
          
          <div className="p-4 space-y-4">
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                isDarkMode ? 'text-[#B0B5C9]' : 'text-[#2A2E45]'
              }`}>
                Endereço de Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className={`w-full px-4 py-2 border rounded-lg outline-none transition-all ${
                  isDarkMode
                    ? 'bg-[#1A1D21] border-[#3A3E55] text-white focus:border-[#1570FF]'
                    : 'bg-white border-[#E4E9F2] text-[#2A2E45] focus:ring-2 focus:ring-[#1570FF] focus:border-transparent'
                }`}
                placeholder="seu@email.com"
              />
              <p className={`text-xs mt-1 ${
                isDarkMode ? 'text-[#8A8FA6]' : 'text-[#6F7689]'
              }`}>
                Um email de confirmação será enviado para o novo endereço
              </p>
            </div>

            <button
              onClick={handleSaveEmail}
              disabled={isSaving || formData.email === userEmail}
              className="flex items-center gap-2 bg-[#1570FF] text-white px-6 py-2 rounded-lg hover:bg-[#0D4FB8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Settings className="w-4 h-4" />
              {isSaving ? 'Salvando...' : 'Salvar Email'}
            </button>
          </div>
        </div>

        {/* Card de Telefone */}
        <div className={`rounded-lg border shadow-sm ${
          isDarkMode 
            ? 'bg-[#2A2E45] border-[#3A3E55]' 
            : 'bg-white border-[#E4E9F2]'
        }`}>
          <div className={`p-4 border-b ${
            isDarkMode ? 'border-[#3A3E55]' : 'border-[#E4E9F2]'
          }`}>
            <h2 className={`text-lg font-semibold ${
              isDarkMode ? 'text-white' : 'text-[#2A2E45]'
            }`}>
              Telefone
            </h2>
          </div>
          
          <div className="p-4 space-y-4">
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                isDarkMode ? 'text-[#B0B5C9]' : 'text-[#2A2E45]'
              }`}>
                Número de Telefone
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                className={`w-full px-4 py-2 border rounded-lg outline-none transition-all ${
                  isDarkMode
                    ? 'bg-[#1A1D21] border-[#3A3E55] text-white focus:border-[#1570FF]'
                    : 'bg-white border-[#E4E9F2] text-[#2A2E45] focus:ring-2 focus:ring-[#1570FF] focus:border-transparent'
                }`}
                placeholder="+55 (11) 98765-4321"
              />
              <p className={`text-xs mt-1 ${
                isDarkMode ? 'text-[#8A8FA6]' : 'text-[#6F7689]'
              }`}>
                Formato: +55 DDD NÚMERO
              </p>
            </div>

            <button
              onClick={handleSavePhone}
              disabled={isSaving}
              className="flex items-center gap-2 bg-[#1570FF] text-white px-6 py-2 rounded-lg hover:bg-[#0D4FB8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Settings className="w-4 h-4" />
              {isSaving ? 'Salvando...' : 'Salvar Telefone'}
            </button>
          </div>
        </div>

        {/* Informações da Conta */}
        <div className={`rounded-lg border shadow-sm ${
          isDarkMode 
            ? 'bg-[#2A2E45] border-[#3A3E55]' 
            : 'bg-white border-[#E4E9F2]'
        }`}>
          <div className="p-4">
            <h3 className={`text-lg font-semibold mb-4 ${
              isDarkMode ? 'text-white' : 'text-[#2A2E45]'
            }`}>
              Informações da Conta
            </h3>
            <div className="space-y-3 text-sm">
              <div className={`flex justify-between py-2 border-b ${
                isDarkMode ? 'border-[#3A3E55]' : 'border-[#E4E9F2]'
              }`}>
                <span className={isDarkMode ? 'text-[#B0B5C9]' : 'text-[#8A8FA6]'}>
                  ID do Usuário:
                </span>
                <span className={`font-mono ${isDarkMode ? 'text-white' : 'text-[#2A2E45]'}`}>
                  {user?.id?.slice(0, 8)}...
                </span>
              </div>
              <div className={`flex justify-between py-2 border-b ${
                isDarkMode ? 'border-[#3A3E55]' : 'border-[#E4E9F2]'
              }`}>
                <span className={isDarkMode ? 'text-[#B0B5C9]' : 'text-[#8A8FA6]'}>
                  Email:
                </span>
                <span className={isDarkMode ? 'text-white' : 'text-[#2A2E45]'}>
                  {userEmail}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className={isDarkMode ? 'text-[#B0B5C9]' : 'text-[#8A8FA6]'}>
                  Nome:
                </span>
                <span className={isDarkMode ? 'text-white' : 'text-[#2A2E45]'}>
                  {displayName}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    switch (currentScreen) {
      case "home":
        return renderHomeScreen();
      case "elections":
        return renderElectionsScreen();
      case "map":
        return renderEmptyScreen(
          "Tela do Mapa",
          "Aqui você pode adicionar seu componente de mapa e funcionalidades relacionadas.",
        );
      case "search":
        return renderSearchScreen();
      case "settings":
        return renderSettingsScreen();
      default:
        return renderEmptyScreen(
          "Dashboard",
          "Selecione uma opção no menu lateral",
        );
    }
  };

  return (
    <div className={`flex h-screen font-inter ${
      isDarkMode ? 'bg-[#212529]' : 'bg-white'
    }`}>
      {/* Left Sidebar */}
      <div className={`w-60 flex flex-col ${
        isDarkMode ? 'bg-[#1A1D21]' : 'bg-[#F7F9FC]'
      }`}>
        {/* User Card */}
        <div className="m-4 mb-6">
          <div className={`rounded border h-[72px] flex items-center px-4 ${
            isDarkMode 
              ? 'bg-[#2A2E45] border-[#3A3E55]' 
              : 'bg-white border-[#E4E9F2]'
          }`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm ${
              isDarkMode 
                ? 'bg-[#3A3E55] text-[#4A90E2]' 
                : 'bg-[#EDF3FF] text-[#1570FF]'
            }`}>
              {getInitials(displayName)}
            </div>
            <div className="ml-3 flex-1 min-w-0">
              <div className={`font-semibold text-sm truncate ${
                isDarkMode ? 'text-white' : 'text-[#2A2E45]'
              }`} title={displayName}>
                {displayName}
              </div>
              <div className={`text-[11px] truncate ${
                isDarkMode ? 'text-[#B0B5C9]' : 'text-[#8A8FA6]'
              }`} title={userEmail}>
                {userEmail}
              </div>
            </div>
            <ChevronDown className={`w-3 h-3 flex-shrink-0 ${
              isDarkMode ? 'text-[#B0B5C9]' : 'text-[#8A8FA6]'
            }`} />
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 px-4">
          <div className={`text-[11px] font-semibold uppercase tracking-wider py-2 ${
            isDarkMode ? 'text-[#8A8FA6]' : 'text-[#8A8FA6]'
          }`}>
            Navegação
          </div>

          <div className="space-y-1">
            {navItems.map((item) => (
              <div
                key={item.id}
                onClick={() => handleNavigation(item.id)}
                className={`h-9 flex items-center px-3 rounded cursor-pointer transition-colors ${
                  item.active
                    ? "bg-[#1570FF] text-white"
                    : isDarkMode
                    ? "text-[#B0B5C9] hover:bg-[#2A2E45]"
                    : "text-[#2A2E45] hover:bg-[#EDF3FF]"
                }`}
              >
                <item.icon className="w-4 h-4 mr-3" />
                <span className="text-sm">{item.label}</span>
              </div>
            ))}
          </div>

          {/* More Section */}
          <div className="mt-6">
            <div className={`text-[11px] font-semibold uppercase tracking-wider py-2 ${
              isDarkMode ? 'text-[#8A8FA6]' : 'text-[#8A8FA6]'
            }`}>
              Mais
            </div>

            <div className="space-y-1">
              {moreItems.map((item, index) => (
                <div
                  key={index}
                  onClick={item.onClick}
                  className={`h-9 flex items-center px-3 rounded cursor-pointer transition-colors ${
                    isDarkMode
                      ? "text-[#B0B5C9] hover:bg-[#2A2E45]"
                      : "text-[#2A2E45] hover:bg-[#EDF3FF]"
                  }`}
                >
                  <item.icon className={`w-4 h-4 mr-3 ${
                    isDarkMode ? 'text-[#8A8FA6]' : 'text-[#6F7689]'
                  }`} />
                  <span className="text-sm">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4">
          <div className={`text-[11px] text-center ${
            isDarkMode ? 'text-[#8A8FA6]' : 'text-[#8A8FA6]'
          }`}>
            © 2024 Minha Dashboard
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div className={`h-14 border-b flex items-center px-6 ${
          isDarkMode 
            ? 'bg-[#1A1D21] border-[#3A3E55]' 
            : 'bg-white border-[#E4E9F2]'
        }`}>
          {/* Brand */}
          <div className={`font-bold text-base mr-8 ${
            isDarkMode ? 'text-white' : 'text-[#2A2E45]'
          }`}>
            Dashboard
          </div>

          {/* Current Screen Title */}
          <div className="flex-1">
            <h1 className={`text-sm capitalize ${
              isDarkMode ? 'text-[#B0B5C9]' : 'text-[#6F7689]'
            }`}>
              {navItems.find((item) => item.id === currentScreen)?.label ||
                "Dashboard"}
            </h1>
          </div>

          {/* Right Controls */}
          <div className="flex items-center space-x-3">
            <button className={`w-8 h-8 border rounded-full flex items-center justify-center transition-colors ${
              isDarkMode 
                ? 'bg-[#2A2E45] border-[#3A3E55] hover:bg-[#3A3E55]' 
                : 'bg-white border-[#E4E9F2] hover:bg-[#EDF3FF]'
            }`}>
              <Bell className={`w-4 h-4 ${
                isDarkMode ? 'text-[#B0B5C9]' : 'text-[#6F7689]'
              }`} />
            </button>
            <button 
              onClick={toggleDarkMode}
              className={`w-8 h-8 border rounded-full flex items-center justify-center transition-colors ${
                isDarkMode 
                  ? 'bg-[#2A2E45] border-[#3A3E55] hover:bg-[#3A3E55]' 
                  : 'bg-white border-[#E4E9F2] hover:bg-[#EDF3FF]'
              }`}
            >
              {isDarkMode ? (
                <Sun className="w-4 h-4 text-[#B0B5C9]" />
              ) : (
                <Moon className="w-4 h-4 text-[#6F7689]" />
              )}
            </button>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm ${
              isDarkMode 
                ? 'bg-[#3A3E55] text-[#4A90E2]' 
                : 'bg-[#EDF3FF] text-[#1570FF]'
            }`}>
              {getInitials(displayName)}
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className={`flex-1 overflow-auto ${
          isDarkMode ? 'bg-[#212529]' : 'bg-[#FAFBFD]'
        }`}>
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}