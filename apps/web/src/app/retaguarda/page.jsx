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
  Users,
  FileText,
  Plus,
  Trash2,
  Edit,
  Eye,
  Save,
  X,
  ArrowLeft,
} from "lucide-react";
import { useDarkMode } from "../../contexts/DarkModeContext";
import { useAuth } from "../../contexts/AuthContext";
import ProtectedRoute from "../../components/ProtectedRoute";
import { supabase } from "../../lib/supabaseClient";
import { useNavigate } from "react-router-dom";

function RetaguardaDashboardContent() {
  const [currentScreen, setCurrentScreen] = useState("home");
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  // Estados para estatísticas
  const [stats, setStats] = useState({
    total_usuarios: 0,
    usuarios_hoje: 0,
    usuarios_semana: 0,
    usuarios_mes: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);

  // Estados para formulários
  const [formularios, setFormularios] = useState([]);
  const [loadingForms, setLoadingForms] = useState(true);
  const [editingForm, setEditingForm] = useState(null);
  const [viewingForm, setViewingForm] = useState(null);

  // Estados para criar/editar form
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [perguntas, setPerguntas] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Estados para responder formulários
  const [formulariosParaResponder, setFormulariosParaResponder] = useState([]);
  const [loadingFormsParaResponder, setLoadingFormsParaResponder] = useState(true);
  const [respondendoForm, setRespondendoForm] = useState(null);
  const [perguntasForm, setPerguntasForm] = useState([]);
  const [respostas, setRespostas] = useState({});

  const [message, setMessage] = useState({ type: "", text: "" });

  const displayName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Gerente';

  const getInitials = (name) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: "", text: "" }), 5000);
  };

  // Buscar estatísticas
  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoadingStats(true);
        const { data, error } = await supabase
          .from('stats_usuarios')
          .select('*')
          .single();

        if (error) throw error;
        setStats(data || {
          total_usuarios: 0,
          usuarios_hoje: 0,
          usuarios_semana: 0,
          usuarios_mes: 0,
        });
      } catch (err) {
        console.error('Erro ao buscar stats:', err);
      } finally {
        setLoadingStats(false);
      }
    };

    if (currentScreen === 'home') {
      fetchStats();
    }
  }, [currentScreen]);

  // Buscar formulários
  useEffect(() => {
    const fetchFormularios = async () => {
      if (currentScreen !== 'forms') return;

      try {
        setLoadingForms(true);
        // Buscar TODOS os formulários (não apenas do usuário)
        const { data, error } = await supabase
          .from('formularios')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setFormularios(data || []);
      } catch (err) {
        console.error('Erro ao buscar formulários:', err);
        showMessage('error', 'Erro ao carregar formulários');
      } finally {
        setLoadingForms(false);
      }
    };

    fetchFormularios();
  }, [currentScreen, user?.id]);

  // Buscar formulários ativos para responder
  useEffect(() => {
    const fetchFormulariosParaResponder = async () => {
      if (currentScreen !== 'map') return;

      try {
        setLoadingFormsParaResponder(true);
        // Buscar TODOS os formulários ativos (não apenas do usuário)
        const { data, error } = await supabase
          .from('formularios')
          .select('*')
          .eq('ativo', true)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setFormulariosParaResponder(data || []);
      } catch (err) {
        console.error('Erro ao buscar formulários:', err);
        showMessage('error', 'Erro ao carregar formulários');
      } finally {
        setLoadingFormsParaResponder(false);
      }
    };

    fetchFormulariosParaResponder();
  }, [currentScreen, user?.id]);

  const navItems = [
    {
      id: "home",
      icon: Home,
      label: "Home",
      active: currentScreen === "home",
    },
    {
      id: "forms",
      icon: FileText,
      label: "Formulários",
      active: currentScreen === "forms",
    },
    {
      id: "map",
      icon: Eye,
      label: "Responder",
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
      icon: ArrowLeft,
      label: "Voltar ao Dashboard",
      onClick: () => navigate('/')
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
    setShowCreateForm(false);
    setEditingForm(null);
    setViewingForm(null);
    setRespondendoForm(null);
  };

  const handleCreateForm = async () => {
    if (!formTitle.trim()) {
      showMessage('error', 'O título é obrigatório');
      return;
    }

    if (perguntas.length === 0) {
      showMessage('error', 'Adicione pelo menos uma pergunta');
      return;
    }

    // Validar perguntas de múltipla escolha
    for (const pergunta of perguntas) {
      if ((pergunta.tipo === 'multipla_escolha' || pergunta.tipo === 'checkbox') && 
          (!pergunta.opcoes || pergunta.opcoes.length === 0)) {
        showMessage('error', `Adicione opções para a pergunta "${pergunta.texto}"`);
        return;
      }
    }

    try {
      if (editingForm) {
        // EDITAR FORMULÁRIO EXISTENTE
        const { error: formError } = await supabase
          .from('formularios')
          .update({
            titulo: formTitle,
            descricao: formDescription,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingForm.id);

        if (formError) throw formError;

        // Deletar perguntas antigas
        await supabase
          .from('perguntas_formulario')
          .delete()
          .eq('formulario_id', editingForm.id);

        // Inserir novas perguntas
        const perguntasComOrdem = perguntas.map((p, index) => ({
          formulario_id: editingForm.id,
          ordem: index + 1,
          texto: p.texto,
          tipo: p.tipo,
          obrigatoria: p.obrigatoria,
          opcoes: (p.tipo === 'multipla_escolha' || p.tipo === 'checkbox') ? JSON.stringify(p.opcoes) : null,
          validacao: p.validacao ? JSON.stringify(p.validacao) : null,
        }));

        const { error: perguntasError } = await supabase
          .from('perguntas_formulario')
          .insert(perguntasComOrdem);

        if (perguntasError) throw perguntasError;

        showMessage('success', 'Formulário atualizado com sucesso!');
      } else {
        // CRIAR NOVO FORMULÁRIO
        const { data: formData, error: formError } = await supabase
          .from('formularios')
          .insert({
            titulo: formTitle,
            descricao: formDescription,
            criado_por: user.id,
            ativo: true,
          })
          .select()
          .single();

        if (formError) throw formError;

        // Criar perguntas
        const perguntasComOrdem = perguntas.map((p, index) => ({
          formulario_id: formData.id,
          ordem: index + 1,
          texto: p.texto,
          tipo: p.tipo,
          obrigatoria: p.obrigatoria,
          opcoes: (p.tipo === 'multipla_escolha' || p.tipo === 'checkbox') ? JSON.stringify(p.opcoes) : null,
          validacao: p.validacao ? JSON.stringify(p.validacao) : null,
        }));

        const { error: perguntasError } = await supabase
          .from('perguntas_formulario')
          .insert(perguntasComOrdem);

        if (perguntasError) throw perguntasError;

        showMessage('success', 'Formulário criado com sucesso!');
      }

      setShowCreateForm(false);
      setEditingForm(null);
      setFormTitle('');
      setFormDescription('');
      setPerguntas([]);

      // Recarregar lista
      const { data: updatedForms } = await supabase
        .from('formularios')
        .select('*')
        .eq('criado_por', user.id)
        .order('created_at', { ascending: false });
      setFormularios(updatedForms || []);

    } catch (err) {
      console.error('Erro ao salvar formulário:', err);
      showMessage('error', 'Erro ao salvar formulário');
    }
  };

  const handleAddPergunta = () => {
    setPerguntas([
      ...perguntas,
      {
        texto: '',
        tipo: 'texto',
        obrigatoria: false,
        opcoes: null,
        validacao: null,
      }
    ]);
  };

  const handleRemovePergunta = (index) => {
    setPerguntas(perguntas.filter((_, i) => i !== index));
  };

  const handleUpdatePergunta = (index, field, value) => {
    const updated = [...perguntas];
    updated[index] = { ...updated[index], [field]: value };
    setPerguntas(updated);
  };

  const handleDeleteForm = async (formId) => {
    if (!confirm('Deseja realmente excluir este formulário?')) return;

    try {
      const { error } = await supabase
        .from('formularios')
        .delete()
        .eq('id', formId);

      if (error) throw error;

      showMessage('success', 'Formulário excluído!');
      setFormularios(formularios.filter(f => f.id !== formId));
    } catch (err) {
      console.error('Erro ao excluir:', err);
      showMessage('error', 'Erro ao excluir formulário');
    }
  };

  const handleEditForm = async (form) => {
    try {
      // Buscar perguntas do formulário
      const { data: perguntasData, error } = await supabase
        .from('perguntas_formulario')
        .select('*')
        .eq('formulario_id', form.id)
        .order('ordem', { ascending: true });

      if (error) throw error;

      // Parsear opcoes de JSON para array
      const perguntasParseadas = perguntasData.map(p => ({
        ...p,
        opcoes: p.opcoes ? JSON.parse(p.opcoes) : [],
        validacao: p.validacao ? JSON.parse(p.validacao) : null,
      }));

      setEditingForm(form);
      setFormTitle(form.titulo);
      setFormDescription(form.descricao || '');
      setPerguntas(perguntasParseadas);
      setShowCreateForm(true);
    } catch (err) {
      console.error('Erro ao carregar formulário:', err);
      showMessage('error', 'Erro ao carregar formulário');
    }
  };

  const handleAddOpcao = (perguntaIndex) => {
    const updated = [...perguntas];
    if (!updated[perguntaIndex].opcoes) {
      updated[perguntaIndex].opcoes = [];
    }
    updated[perguntaIndex].opcoes.push('');
    setPerguntas(updated);
  };

  const handleRemoveOpcao = (perguntaIndex, opcaoIndex) => {
    const updated = [...perguntas];
    updated[perguntaIndex].opcoes.splice(opcaoIndex, 1);
    setPerguntas(updated);
  };

  const handleUpdateOpcao = (perguntaIndex, opcaoIndex, value) => {
    const updated = [...perguntas];
    updated[perguntaIndex].opcoes[opcaoIndex] = value;
    setPerguntas(updated);
  };

  const handleResponderForm = async (form) => {
    try {
      // Buscar perguntas do formulário
      const { data: perguntasData, error } = await supabase
        .from('perguntas_formulario')
        .select('*')
        .eq('formulario_id', form.id)
        .order('ordem', { ascending: true });

      if (error) throw error;

      // Parsear opcoes
      const perguntasParseadas = perguntasData.map(p => ({
        ...p,
        opcoes: p.opcoes ? JSON.parse(p.opcoes) : [],
      }));

      setRespondendoForm(form);
      setPerguntasForm(perguntasParseadas);
      setRespostas({});
    } catch (err) {
      console.error('Erro ao carregar formulário:', err);
      showMessage('error', 'Erro ao carregar formulário');
    }
  };

  const handleEnviarRespostas = async () => {
    try {
      // Validar respostas obrigatórias
      for (const pergunta of perguntasForm) {
        if (pergunta.obrigatoria && !respostas[pergunta.id]) {
          showMessage('error', `A pergunta "${pergunta.texto}" é obrigatória`);
          return;
        }
      }

      // Criar array de respostas
      const respostasArray = perguntasForm.map(p => ({
        pergunta_id: p.id,
        resposta: respostas[p.id] || '',
      }));

      const { error } = await supabase
        .from('respostas_formulario')
        .insert({
          formulario_id: respondendoForm.id,
          respondido_por: user.id,
          respostas: JSON.stringify(respostasArray),
        });

      if (error) throw error;

      showMessage('success', 'Resposta enviada com sucesso!');
      setRespondendoForm(null);
      setPerguntasForm([]);
      setRespostas({});
    } catch (err) {
      console.error('Erro ao enviar respostas:', err);
      showMessage('error', 'Erro ao enviar respostas');
    }
  };

  const renderHomeScreen = () => {
    return (
      <div className="flex flex-col h-full p-6 space-y-6">
        <div>
          <h1 className={`text-2xl font-semibold ${
            isDarkMode ? 'text-white' : 'text-[#2A2E45]'
          }`}>
            Dashboard de Retaguarda
          </h1>
          <p className={`text-sm mt-1 ${
            isDarkMode ? 'text-[#B0B5C9]' : 'text-[#8A8FA6]'
          }`}>
            Estatísticas e gerenciamento do sistema
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total de Usuários */}
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
                  Total de Usuários
                </div>
                <Users className={`w-5 h-5 ${
                  isDarkMode ? 'text-[#4A90E2]' : 'text-[#1570FF]'
                }`} />
              </div>

              {loadingStats ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-[#1570FF] border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : (
                <>
                  <div className={`text-3xl font-bold mb-2 ${
                    isDarkMode ? 'text-white' : 'text-[#2A2E45]'
                  }`}>
                    {stats.total_usuarios}
                  </div>
                  <div className={`text-xs ${
                    isDarkMode ? 'text-[#8A8FA6]' : 'text-[#6F7689]'
                  }`}>
                    usuários cadastrados
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Usuários Hoje */}
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
                  Hoje
                </div>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  isDarkMode ? 'bg-[#3A3E55]' : 'bg-[#EDF3FF]'
                }`}>
                  <span className="text-xl">📅</span>
                </div>
              </div>

              {loadingStats ? (
                <div className="w-5 h-5 border-2 border-[#1570FF] border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <div className={`text-3xl font-bold mb-2 ${
                    isDarkMode ? 'text-white' : 'text-[#2A2E45]'
                  }`}>
                    {stats.usuarios_hoje}
                  </div>
                  <div className={`text-xs ${
                    isDarkMode ? 'text-[#8A8FA6]' : 'text-[#6F7689]'
                  }`}>
                    novos hoje
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Usuários Semana */}
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
                  Esta Semana
                </div>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  isDarkMode ? 'bg-[#3A3E55]' : 'bg-[#EDF3FF]'
                }`}>
                  <span className="text-xl">📊</span>
                </div>
              </div>

              {loadingStats ? (
                <div className="w-5 h-5 border-2 border-[#1570FF] border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <div className={`text-3xl font-bold mb-2 ${
                    isDarkMode ? 'text-white' : 'text-[#2A2E45]'
                  }`}>
                    {stats.usuarios_semana}
                  </div>
                  <div className={`text-xs ${
                    isDarkMode ? 'text-[#8A8FA6]' : 'text-[#6F7689]'
                  }`}>
                    últimos 7 dias
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Usuários Mês */}
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
                  Este Mês
                </div>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  isDarkMode ? 'bg-[#3A3E55]' : 'bg-[#EDF3FF]'
                }`}>
                  <span className="text-xl">📈</span>
                </div>
              </div>

              {loadingStats ? (
                <div className="w-5 h-5 border-2 border-[#1570FF] border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <div className={`text-3xl font-bold mb-2 ${
                    isDarkMode ? 'text-white' : 'text-[#2A2E45]'
                  }`}>
                    {stats.usuarios_mes}
                  </div>
                  <div className={`text-xs ${
                    isDarkMode ? 'text-[#8A8FA6]' : 'text-[#6F7689]'
                  }`}>
                    últimos 30 dias
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderFormsScreen = () => {
    if (showCreateForm) {
      return (
        <div className="flex flex-col h-full p-6 space-y-6 overflow-auto">
          <div className="flex items-center justify-between">
            <h1 className={`text-2xl font-semibold ${
              isDarkMode ? 'text-white' : 'text-[#2A2E45]'
            }`}>
              {editingForm ? 'Editar Formulário' : 'Criar Novo Formulário'}
            </h1>
            <button
              onClick={() => {
                setShowCreateForm(false);
                setEditingForm(null);
                setFormTitle('');
                setFormDescription('');
                setPerguntas([]);
              }}
              className={`px-4 py-2 rounded-lg transition-colors ${
                isDarkMode
                  ? 'bg-[#3A3E55] hover:bg-[#4A4E65] text-white'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Informações do Form */}
          <div className={`rounded-lg border p-6 space-y-4 ${
            isDarkMode
              ? 'bg-[#2A2E45] border-[#3A3E55]'
              : 'bg-white border-[#E4E9F2]'
          }`}>
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                isDarkMode ? 'text-[#B0B5C9]' : 'text-[#2A2E45]'
              }`}>
                Título do Formulário *
              </label>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Ex: Pesquisa de Satisfação"
                className={`w-full px-4 py-2 border rounded-lg outline-none ${
                  isDarkMode
                    ? 'bg-[#1A1D21] border-[#3A3E55] text-white'
                    : 'bg-white border-[#E4E9F2] text-[#2A2E45]'
                }`}
              />
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${
                isDarkMode ? 'text-[#B0B5C9]' : 'text-[#2A2E45]'
              }`}>
                Descrição
              </label>
              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Descreva o objetivo deste formulário..."
                rows={3}
                className={`w-full px-4 py-2 border rounded-lg outline-none resize-none ${
                  isDarkMode
                    ? 'bg-[#1A1D21] border-[#3A3E55] text-white'
                    : 'bg-white border-[#E4E9F2] text-[#2A2E45]'
                }`}
              />
            </div>
          </div>

          {/* Perguntas */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className={`text-lg font-semibold ${
                isDarkMode ? 'text-white' : 'text-[#2A2E45]'
              }`}>
                Perguntas
              </h2>
              <button
                onClick={handleAddPergunta}
                className="flex items-center gap-2 bg-[#1570FF] text-white px-4 py-2 rounded-lg hover:bg-[#0D4FB8] transition-colors"
              >
                <Plus className="w-4 h-4" />
                Adicionar Pergunta
              </button>
            </div>

            {perguntas.map((pergunta, index) => (
              <div
                key={index}
                className={`rounded-lg border p-4 space-y-3 ${
                  isDarkMode
                    ? 'bg-[#2A2E45] border-[#3A3E55]'
                    : 'bg-white border-[#E4E9F2]'
                }`}
              >
                <div className="flex items-start justify-between">
                  <span className={`text-sm font-medium ${
                    isDarkMode ? 'text-[#B0B5C9]' : 'text-[#8A8FA6]'
                  }`}>
                    Pergunta {index + 1}
                  </span>
                  <button
                    onClick={() => handleRemovePergunta(index)}
                    className="text-red-500 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <input
                  type="text"
                  value={pergunta.texto}
                  onChange={(e) => handleUpdatePergunta(index, 'texto', e.target.value)}
                  placeholder="Digite a pergunta..."
                  className={`w-full px-3 py-2 border rounded-lg outline-none ${
                    isDarkMode
                      ? 'bg-[#1A1D21] border-[#3A3E55] text-white'
                      : 'bg-white border-[#E4E9F2] text-[#2A2E45]'
                  }`}
                />

                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={pergunta.tipo}
                    onChange={(e) => {
                      handleUpdatePergunta(index, 'tipo', e.target.value);
                      // Inicializar array de opções se for múltipla escolha
                      if (e.target.value === 'multipla_escolha' || e.target.value === 'checkbox') {
                        if (!pergunta.opcoes || pergunta.opcoes.length === 0) {
                          handleUpdatePergunta(index, 'opcoes', ['']);
                        }
                      }
                    }}
                    className={`px-3 py-2 border rounded-lg outline-none ${
                      isDarkMode
                        ? 'bg-[#1A1D21] border-[#3A3E55] text-white'
                        : 'bg-white border-[#E4E9F2] text-[#2A2E45]'
                    }`}
                  >
                    <option value="texto">Texto</option>
                    <option value="numero">Número</option>
                    <option value="email">Email</option>
                    <option value="telefone">Telefone</option>
                    <option value="textarea">Texto Longo</option>
                    <option value="multipla_escolha">Múltipla Escolha</option>
                    <option value="checkbox">Checkbox</option>
                    <option value="data">Data</option>
                    <option value="hora">Hora</option>
                  </select>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={pergunta.obrigatoria}
                      onChange={(e) => handleUpdatePergunta(index, 'obrigatoria', e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className={`text-sm ${
                      isDarkMode ? 'text-[#B0B5C9]' : 'text-[#2A2E45]'
                    }`}>
                      Obrigatória
                    </span>
                  </label>
                </div>

                {/* Opções para Múltipla Escolha / Checkbox */}
                {(pergunta.tipo === 'multipla_escolha' || pergunta.tipo === 'checkbox') && (
                  <div className={`p-3 rounded-lg space-y-2 ${
                    isDarkMode ? 'bg-[#1A1D21]' : 'bg-[#F7F9FC]'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-sm font-medium ${
                        isDarkMode ? 'text-[#B0B5C9]' : 'text-[#2A2E45]'
                      }`}>
                        Opções de Resposta
                      </span>
                      <button
                        onClick={() => handleAddOpcao(index)}
                        className="flex items-center gap-1 text-[#1570FF] hover:text-[#0D4FB8] text-sm"
                      >
                        <Plus className="w-3 h-3" />
                        Adicionar Opção
                      </button>
                    </div>

                    {pergunta.opcoes && pergunta.opcoes.map((opcao, opcaoIndex) => (
                      <div key={opcaoIndex} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={opcao}
                          onChange={(e) => handleUpdateOpcao(index, opcaoIndex, e.target.value)}
                          placeholder={`Opção ${opcaoIndex + 1}`}
                          className={`flex-1 px-3 py-2 border rounded-lg outline-none text-sm ${
                            isDarkMode
                              ? 'bg-[#2A2E45] border-[#3A3E55] text-white'
                              : 'bg-white border-[#E4E9F2] text-[#2A2E45]'
                          }`}
                        />
                        <button
                          onClick={() => handleRemoveOpcao(index, opcaoIndex)}
                          className="text-red-500 hover:text-red-600 p-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}

                    {(!pergunta.opcoes || pergunta.opcoes.length === 0) && (
                      <div className={`text-center py-2 text-sm ${
                        isDarkMode ? 'text-[#8A8FA6]' : 'text-[#6F7689]'
                      }`}>
                        Clique em "Adicionar Opção" para criar opções de resposta
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {perguntas.length === 0 && (
              <div className={`text-center py-8 ${
                isDarkMode ? 'text-[#8A8FA6]' : 'text-[#6F7689]'
              }`}>
                Nenhuma pergunta adicionada. Clique em "Adicionar Pergunta" para começar.
              </div>
            )}
          </div>

          {/* Botões de Ação */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={handleCreateForm}
              className="flex items-center gap-2 bg-[#1570FF] text-white px-6 py-3 rounded-lg hover:bg-[#0D4FB8] transition-colors"
            >
              <Save className="w-5 h-5" />
              {editingForm ? 'Salvar Alterações' : 'Salvar Formulário'}
            </button>
            <button
              onClick={() => {
                setShowCreateForm(false);
                setEditingForm(null);
                setFormTitle('');
                setFormDescription('');
                setPerguntas([]);
              }}
              className={`px-6 py-3 rounded-lg transition-colors ${
                isDarkMode
                  ? 'bg-[#3A3E55] hover:bg-[#4A4E65] text-white'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
            >
              Cancelar
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className={`text-2xl font-semibold ${
              isDarkMode ? 'text-white' : 'text-[#2A2E45]'
            }`}>
              Formulários
            </h1>
            <p className={`text-sm mt-1 ${
              isDarkMode ? 'text-[#B0B5C9]' : 'text-[#8A8FA6]'
            }`}>
              Crie e gerencie formulários personalizados
            </p>
          </div>

          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 bg-[#1570FF] text-white px-4 py-2 rounded-lg hover:bg-[#0D4FB8] transition-colors"
          >
            <Plus className="w-5 h-5" />
            Novo Formulário
          </button>
        </div>

        {loadingForms ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-12 h-12 border-4 border-[#1570FF] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : formularios.length === 0 ? (
          <div className={`text-center py-16 ${
            isDarkMode ? 'text-[#8A8FA6]' : 'text-[#6F7689]'
          }`}>
            <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">Nenhum formulário criado</p>
            <p className="text-sm">Clique em "Novo Formulário" para começar</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {formularios.map((form) => (
              <div
                key={form.id}
                className={`rounded-lg border shadow-sm p-6 ${
                  isDarkMode
                    ? 'bg-[#2A2E45] border-[#3A3E55]'
                    : 'bg-white border-[#E4E9F2]'
                }`}
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
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    form.ativo
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {form.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </div>

                <div className={`text-xs mb-4 ${
                  isDarkMode ? 'text-[#8A8FA6]' : 'text-[#6F7689]'
                }`}>
                  Criado em {new Date(form.created_at).toLocaleDateString('pt-BR')}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditForm(form)}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                      isDarkMode
                        ? 'bg-blue-900/30 hover:bg-blue-900/50 text-blue-400'
                        : 'bg-blue-50 hover:bg-blue-100 text-blue-600'
                    }`}
                  >
                    <Edit className="w-4 h-4" />
                    Editar
                  </button>
                  <button
                    onClick={() => handleDeleteForm(form.id)}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                      isDarkMode
                        ? 'bg-red-900/30 hover:bg-red-900/50 text-red-400'
                        : 'bg-red-50 hover:bg-red-100 text-red-600'
                    }`}
                  >
                    <Trash2 className="w-4 h-4" />
                    Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderMapScreen = () => {
    // Se está respondendo um formulário
    if (respondendoForm) {
      return (
        <div className="flex flex-col h-full p-6 space-y-6 overflow-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className={`text-2xl font-semibold ${
                isDarkMode ? 'text-white' : 'text-[#2A2E45]'
              }`}>
                {respondendoForm.titulo}
              </h1>
              {respondendoForm.descricao && (
                <p className={`text-sm mt-1 ${
                  isDarkMode ? 'text-[#B0B5C9]' : 'text-[#8A8FA6]'
                }`}>
                  {respondendoForm.descricao}
                </p>
              )}
            </div>
            <button
              onClick={() => {
                setRespondendoForm(null);
                setPerguntasForm([]);
                setRespostas({});
              }}
              className={`px-4 py-2 rounded-lg transition-colors ${
                isDarkMode
                  ? 'bg-[#3A3E55] hover:bg-[#4A4E65] text-white'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Perguntas do Formulário */}
          <div className="space-y-4">
            {perguntasForm.map((pergunta, index) => (
              <div
                key={pergunta.id}
                className={`rounded-lg border p-6 space-y-3 ${
                  isDarkMode
                    ? 'bg-[#2A2E45] border-[#3A3E55]'
                    : 'bg-white border-[#E4E9F2]'
                }`}
              >
                <label className={`block text-sm font-medium ${
                  isDarkMode ? 'text-white' : 'text-[#2A2E45]'
                }`}>
                  {index + 1}. {pergunta.texto}
                  {pergunta.obrigatoria && <span className="text-red-500 ml-1">*</span>}
                </label>

                {/* Renderizar input baseado no tipo */}
                {pergunta.tipo === 'texto' && (
                  <input
                    type="text"
                    value={respostas[pergunta.id] || ''}
                    onChange={(e) => setRespostas({...respostas, [pergunta.id]: e.target.value})}
                    className={`w-full px-4 py-2 border rounded-lg outline-none ${
                      isDarkMode
                        ? 'bg-[#1A1D21] border-[#3A3E55] text-white'
                        : 'bg-white border-[#E4E9F2] text-[#2A2E45]'
                    }`}
                    placeholder="Sua resposta..."
                  />
                )}

                {pergunta.tipo === 'textarea' && (
                  <textarea
                    value={respostas[pergunta.id] || ''}
                    onChange={(e) => setRespostas({...respostas, [pergunta.id]: e.target.value})}
                    rows={4}
                    className={`w-full px-4 py-2 border rounded-lg outline-none resize-none ${
                      isDarkMode
                        ? 'bg-[#1A1D21] border-[#3A3E55] text-white'
                        : 'bg-white border-[#E4E9F2] text-[#2A2E45]'
                    }`}
                    placeholder="Sua resposta..."
                  />
                )}

                {pergunta.tipo === 'numero' && (
                  <input
                    type="number"
                    value={respostas[pergunta.id] || ''}
                    onChange={(e) => setRespostas({...respostas, [pergunta.id]: e.target.value})}
                    className={`w-full px-4 py-2 border rounded-lg outline-none ${
                      isDarkMode
                        ? 'bg-[#1A1D21] border-[#3A3E55] text-white'
                        : 'bg-white border-[#E4E9F2] text-[#2A2E45]'
                    }`}
                    placeholder="Número..."
                  />
                )}

                {pergunta.tipo === 'email' && (
                  <input
                    type="email"
                    value={respostas[pergunta.id] || ''}
                    onChange={(e) => setRespostas({...respostas, [pergunta.id]: e.target.value})}
                    className={`w-full px-4 py-2 border rounded-lg outline-none ${
                      isDarkMode
                        ? 'bg-[#1A1D21] border-[#3A3E55] text-white'
                        : 'bg-white border-[#E4E9F2] text-[#2A2E45]'
                    }`}
                    placeholder="email@exemplo.com"
                  />
                )}

                {pergunta.tipo === 'telefone' && (
                  <input
                    type="tel"
                    value={respostas[pergunta.id] || ''}
                    onChange={(e) => setRespostas({...respostas, [pergunta.id]: e.target.value})}
                    className={`w-full px-4 py-2 border rounded-lg outline-none ${
                      isDarkMode
                        ? 'bg-[#1A1D21] border-[#3A3E55] text-white'
                        : 'bg-white border-[#E4E9F2] text-[#2A2E45]'
                    }`}
                    placeholder="(00) 00000-0000"
                  />
                )}

                {pergunta.tipo === 'data' && (
                  <input
                    type="date"
                    value={respostas[pergunta.id] || ''}
                    onChange={(e) => setRespostas({...respostas, [pergunta.id]: e.target.value})}
                    className={`w-full px-4 py-2 border rounded-lg outline-none ${
                      isDarkMode
                        ? 'bg-[#1A1D21] border-[#3A3E55] text-white'
                        : 'bg-white border-[#E4E9F2] text-[#2A2E45]'
                    }`}
                  />
                )}

                {pergunta.tipo === 'hora' && (
                  <input
                    type="time"
                    value={respostas[pergunta.id] || ''}
                    onChange={(e) => setRespostas({...respostas, [pergunta.id]: e.target.value})}
                    className={`w-full px-4 py-2 border rounded-lg outline-none ${
                      isDarkMode
                        ? 'bg-[#1A1D21] border-[#3A3E55] text-white'
                        : 'bg-white border-[#E4E9F2] text-[#2A2E45]'
                    }`}
                  />
                )}

                {pergunta.tipo === 'multipla_escolha' && (
                  <div className="space-y-2">
                    {pergunta.opcoes && pergunta.opcoes.map((opcao, opcaoIndex) => (
                      <label key={opcaoIndex} className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name={`pergunta-${pergunta.id}`}
                          value={opcao}
                          checked={respostas[pergunta.id] === opcao}
                          onChange={(e) => setRespostas({...respostas, [pergunta.id]: e.target.value})}
                          className="w-4 h-4"
                        />
                        <span className={`text-sm ${
                          isDarkMode ? 'text-[#B0B5C9]' : 'text-[#2A2E45]'
                        }`}>
                          {opcao}
                        </span>
                      </label>
                    ))}
                  </div>
                )}

                {pergunta.tipo === 'checkbox' && (
                  <div className="space-y-2">
                    {pergunta.opcoes && pergunta.opcoes.map((opcao, opcaoIndex) => (
                      <label key={opcaoIndex} className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          value={opcao}
                          checked={(respostas[pergunta.id] || []).includes(opcao)}
                          onChange={(e) => {
                            const currentValues = respostas[pergunta.id] || [];
                            const newValues = e.target.checked
                              ? [...currentValues, opcao]
                              : currentValues.filter(v => v !== opcao);
                            setRespostas({...respostas, [pergunta.id]: newValues});
                          }}
                          className="w-4 h-4"
                        />
                        <span className={`text-sm ${
                          isDarkMode ? 'text-[#B0B5C9]' : 'text-[#2A2E45]'
                        }`}>
                          {opcao}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Botão Enviar */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={handleEnviarRespostas}
              className="flex items-center gap-2 bg-[#1570FF] text-white px-6 py-3 rounded-lg hover:bg-[#0D4FB8] transition-colors"
            >
              <Save className="w-5 h-5" />
              Enviar Respostas
            </button>
            <button
              onClick={() => {
                setRespondendoForm(null);
                setPerguntasForm([]);
                setRespostas({});
              }}
              className={`px-6 py-3 rounded-lg transition-colors ${
                isDarkMode
                  ? 'bg-[#3A3E55] hover:bg-[#4A4E65] text-white'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
            >
              Cancelar
            </button>
          </div>
        </div>
      );
    }

    // Lista de formulários para responder
    return (
      <div className="flex flex-col h-full p-6 space-y-6">
        <div>
          <h1 className={`text-2xl font-semibold ${
            isDarkMode ? 'text-white' : 'text-[#2A2E45]'
          }`}>
            Responder Formulários
          </h1>
          <p className={`text-sm mt-1 ${
            isDarkMode ? 'text-[#B0B5C9]' : 'text-[#8A8FA6]'
          }`}>
            Selecione um formulário para responder
          </p>
        </div>

        {loadingFormsParaResponder ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-12 h-12 border-4 border-[#1570FF] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : formulariosParaResponder.length === 0 ? (
          <div className={`text-center py-16 ${
            isDarkMode ? 'text-[#8A8FA6]' : 'text-[#6F7689]'
          }`}>
            <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">Nenhum formulário disponível</p>
            <p className="text-sm">Crie formulários na aba "Formulários"</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {formulariosParaResponder.map((form) => (
              <div
                key={form.id}
                className={`rounded-lg border shadow-sm p-6 ${
                  isDarkMode
                    ? 'bg-[#2A2E45] border-[#3A3E55]'
                    : 'bg-white border-[#E4E9F2]'
                }`}
              >
                <div className="mb-4">
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

                <button
                  onClick={() => handleResponderForm(form)}
                  className="w-full flex items-center justify-center gap-2 bg-[#1570FF] text-white px-4 py-2 rounded-lg hover:bg-[#0D4FB8] transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  Responder
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
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

  const renderContent = () => {
    switch (currentScreen) {
      case "home":
        return renderHomeScreen();
      case "forms":
        return renderFormsScreen();
      case "map":
        return renderMapScreen();
      case "search":
        return renderEmptyScreen(
          "Pesquisa",
          "Funcionalidade em desenvolvimento"
        );
      case "settings":
        return renderEmptyScreen(
          "Configurações",
          "Funcionalidade em desenvolvimento"
        );
      default:
        return renderHomeScreen();
    }
  };

  return (
    <div className={`flex h-screen font-inter ${
      isDarkMode ? 'bg-[#212529]' : 'bg-white'
    }`}>
      {/* Sidebar */}
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
              }`}>
                {displayName}
              </div>
              <div className={`text-[11px] ${
                isDarkMode ? 'text-[#B0B5C9]' : 'text-[#8A8FA6]'
              }`}>
                Gerência
              </div>
            </div>
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
                  <item.icon className="w-4 h-4 mr-3" />
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
            ©NovaIris - Retaguarda
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
          <div className={`font-bold text-base mr-8 ${
            isDarkMode ? 'text-white' : 'text-[#2A2E45]'
          }`}>
            OpinaAI - Retaguarda
          </div>

          <div className="flex-1">
            <h1 className={`text-sm capitalize ${
              isDarkMode ? 'text-[#B0B5C9]' : 'text-[#6F7689]'
            }`}>
              {navItems.find((item) => item.id === currentScreen)?.label || "Dashboard"}
            </h1>
          </div>

          <div className="flex items-center space-x-3">
            <button className={`w-8 h-8 border rounded-full flex items-center justify-center ${
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
              className={`w-8 h-8 border rounded-full flex items-center justify-center ${
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
          </div>
        </div>

        {/* Messages */}
        {message.text && (
          <div className={`mx-6 mt-4 px-4 py-3 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 text-green-600 border border-green-200'
              : 'bg-red-50 text-red-600 border border-red-200'
          }`}>
            {message.text}
          </div>
        )}

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

export default function RetaguardaDashboard() {
  return (
    <ProtectedRoute>
      <RetaguardaDashboardContent />
    </ProtectedRoute>
  );
}