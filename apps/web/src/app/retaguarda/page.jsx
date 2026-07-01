import { useState, useEffect } from "react";
import {
  Home,
  Settings,
  Bell,
  Moon,
  Sun,
  HelpCircle,
  BookOpen,
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
  Inbox,
} from "lucide-react";
import { useDarkMode } from "../../contexts/DarkModeContext";
import { useAuth } from "../../contexts/AuthContext";
import ProtectedRoute from "../../components/ProtectedRoute";
import ProtectedRetaguardaRoute from "../../components/ProtectedRetaguardaRoute";
import SupportChat from "../../components/SupportChat";
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

  // Estados para gerenciamento de permissões
  const [usuariosPermitidos, setUsuariosPermitidos] = useState([]);
  const [usuariosNormais, setUsuariosNormais] = useState([]);
  const [loadingPermissoes, setLoadingPermissoes] = useState(true);
  const [showAddPermissaoModal, setShowAddPermissaoModal] = useState(false);
  const [selectedUserForPermission, setSelectedUserForPermission] = useState(null);

  // Estados para a fila de solicitações de pesquisa (Fase 2)
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [loadingSolicitacoes, setLoadingSolicitacoes] = useState(false);

  const [message, setMessage] = useState({ type: "", text: "" });
  const [retaguardaChatOpen, setRetaguardaChatOpen] = useState(false);
  const [chatToken, setChatToken] = useState('');

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

  // Helper: recarrega lista de usuários e permissões (server-side)
  const recarregarUsuarios = async () => {
    const token = await getToken();
    const res = await fetch('/api/retaguarda/users', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const allUsers = await res.json();
    setUsuariosPermitidos((allUsers || []).filter(u => u.tem_permissao));
    setUsuariosNormais((allUsers || []).filter(u => !u.tem_permissao));
  };

  // Funções de gerenciamento de permissões (server-side, ignora RLS)
  const handleConcederPermissao = async (targetUserId) => {
    try {
      const token = await getToken();
      const res = await fetch('/api/retaguarda/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'grant', targetUserId }),
      });
      if (!res.ok) throw new Error(await res.text());
      showMessage('success', 'Permissão concedida com sucesso!');
      await recarregarUsuarios();
      setShowAddPermissaoModal(false);
    } catch (err) {
      console.error('Erro ao conceder permissão:', err);
      showMessage('error', err.message || 'Erro ao conceder permissão');
    }
  };

  const handleRevogarPermissao = async (targetUserId) => {
    if (!confirm('Deseja realmente revogar a permissão deste usuário?')) return;
    try {
      const token = await getToken();
      const res = await fetch('/api/retaguarda/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'revoke', targetUserId }),
      });
      if (!res.ok) throw new Error(await res.text());
      showMessage('success', 'Permissão revogada com sucesso!');
      await recarregarUsuarios();
    } catch (err) {
      console.error('Erro ao revogar permissão:', err);
      showMessage('error', err.message || 'Erro ao revogar permissão');
    }
  };


  // Helper: obtém o token da sessão atual
  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? '';
  };

  // Buscar estatísticas (via servidor, ignora RLS)
  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoadingStats(true);
        const token = await getToken();
        const res = await fetch('/api/retaguarda/stats', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setStats(data);
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
        const token = await getToken();
        const res = await fetch('/api/retaguarda/forms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action: 'list' }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setFormularios(await res.json());
      } catch (err) {
        console.error('Erro ao buscar formulários:', err);
        showMessage('error', 'Erro ao carregar formulários');
      } finally {
        setLoadingForms(false);
      }
    };

    fetchFormularios();
  }, [currentScreen]);

  // Buscar formulários ativos para responder
  useEffect(() => {
    const fetchFormulariosParaResponder = async () => {
      if (currentScreen !== 'map') return;

      try {
        setLoadingFormsParaResponder(true);
        const token = await getToken();
        const res = await fetch('/api/retaguarda/forms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action: 'list', ativo: true }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setFormulariosParaResponder(await res.json());
      } catch (err) {
        console.error('Erro ao buscar formulários:', err);
        showMessage('error', 'Erro ao carregar formulários');
      } finally {
        setLoadingFormsParaResponder(false);
      }
    };

    fetchFormulariosParaResponder();
  }, [currentScreen]);

  // Buscar usuários e permissões para tela de configurações (server-side)
  useEffect(() => {
    const fetchUsuariosEPermissoes = async () => {
      if (currentScreen !== 'settings') return;

      try {
        setLoadingPermissoes(true);
        const token = await getToken();
        const res = await fetch('/api/retaguarda/users', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const allUsers = await res.json();

        setUsuariosPermitidos((allUsers || []).filter(u => u.tem_permissao));
        setUsuariosNormais((allUsers || []).filter(u => !u.tem_permissao));
      } catch (err) {
        console.error('Erro ao buscar usuários:', err);
        showMessage('error', 'Erro ao carregar usuários: ' + err.message);
      } finally {
        setLoadingPermissoes(false);
      }
    };

    fetchUsuariosEPermissoes();
  }, [currentScreen]);

  // ── Solicitações de pesquisa: carregar fila + atualizar status ────────────
  const carregarSolicitacoes = async () => {
    setLoadingSolicitacoes(true);
    try {
      const token = await getToken();
      const res = await fetch('/api/retaguarda/survey-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'list' }),
      });
      setSolicitacoes(res.ok ? await res.json() : []);
    } catch (err) {
      console.error('[solicitacoes] erro:', err);
    } finally {
      setLoadingSolicitacoes(false);
    }
  };

  useEffect(() => {
    if (currentScreen === 'requests') carregarSolicitacoes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentScreen]);

  const atualizarStatusSolicitacao = async (id, status, resposta_admin) => {
    try {
      const token = await getToken();
      const res = await fetch('/api/retaguarda/survey-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'update_status', id, status, resposta_admin }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Erro ao atualizar');
      }
      showMessage('success', 'Solicitação atualizada!');
      carregarSolicitacoes();
    } catch (err) {
      showMessage('error', err.message);
    }
  };

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
      id: "requests",
      icon: Inbox,
      label: "Solicitações",
      active: currentScreen === "requests",
    },
    {
      id: "settings",
      icon: Settings,
      label: "Configuração",
      active: currentScreen === "settings",
    },
  ];

  const moreItems = [
    {
      icon: isDarkMode ? Sun : Moon,
      label: isDarkMode ? "Modo Claro" : "Modo Escuro",
      onClick: toggleDarkMode
    },
    { icon: BookOpen, label: "Aprender", onClick: () => navigate('/aprender') },
    {
      icon: HelpCircle,
      label: "Centro de Ajuda",
      onClick: async () => {
        const token = await getToken();
        setChatToken(token);
        setRetaguardaChatOpen(true);
      },
    },
    {
      icon: ArrowLeft,
      label: "Voltar ao Dashboard",
      onClick: () => navigate('/dashboard')
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
      const token = await getToken();

      if (editingForm) {
        // EDITAR FORMULÁRIO EXISTENTE (via servidor)
        const res = await fetch('/api/retaguarda/forms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            action: 'update',
            formId: editingForm.id,
            titulo: formTitle,
            descricao: formDescription,
            perguntas,
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        showMessage('success', 'Formulário atualizado com sucesso!');
      } else {
        // CRIAR NOVO FORMULÁRIO (via servidor)
        const res = await fetch('/api/retaguarda/forms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            action: 'create',
            titulo: formTitle,
            descricao: formDescription,
            perguntas,
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        showMessage('success', 'Formulário criado com sucesso!');
      }

      setShowCreateForm(false);
      setEditingForm(null);
      setFormTitle('');
      setFormDescription('');
      setPerguntas([]);

      // Recarregar lista
      const tkn = await getToken();
      const listRes = await fetch('/api/retaguarda/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tkn}` },
        body: JSON.stringify({ action: 'list' }),
      });
      if (listRes.ok) setFormularios(await listRes.json());

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
      const token = await getToken();
      const res = await fetch('/api/retaguarda/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'delete', formId }),
      });
      if (!res.ok) throw new Error(await res.text());

      showMessage('success', 'Formulário excluído!');
      setFormularios(formularios.filter(f => f.id !== formId));
    } catch (err) {
      console.error('Erro ao excluir:', err);
      showMessage('error', 'Erro ao excluir formulário');
    }
  };

  const handleEditForm = async (form) => {
    try {
      const token = await getToken();
      const res = await fetch('/api/retaguarda/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'get_questions', formId: form.id }),
      });
      if (!res.ok) throw new Error(await res.text());
      const perguntasData = await res.json();

      const perguntasParseadas = perguntasData.map(p => ({
        ...p,
        opcoes: p.opcoes
          ? (typeof p.opcoes === 'string' ? JSON.parse(p.opcoes) : p.opcoes)
          : [],
        validacao: p.validacao
          ? (typeof p.validacao === 'string' ? JSON.parse(p.validacao) : p.validacao)
          : null,
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
      const token = await getToken();
      const res = await fetch('/api/retaguarda/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'get_questions', formId: form.id }),
      });
      if (!res.ok) throw new Error(await res.text());
      const perguntasData = await res.json();

      const perguntasParseadas = perguntasData.map(p => ({
        ...p,
        opcoes: p.opcoes
          ? (typeof p.opcoes === 'string' ? JSON.parse(p.opcoes) : p.opcoes)
          : [],
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

      const token = await getToken();
      const res = await fetch('/api/retaguarda/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: 'submit_response',
          formId: respondendoForm.id,
          respostas: respostasArray,
        }),
      });
      if (!res.ok) throw new Error(await res.text());

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

  const renderSettingsScreen = () => {
    return (
      <div className="flex flex-col h-full p-6 space-y-6 overflow-auto">
        {/* Header */}
        <div>
          <h1 className={`text-2xl font-semibold ${
            isDarkMode ? 'text-white' : 'text-[#2A2E45]'
          }`}>
            Gerenciamento de Usuários e Permissões
          </h1>
          <p className={`text-sm mt-1 ${
            isDarkMode ? 'text-[#B0B5C9]' : 'text-[#8A8FA6]'
          }`}>
            Gerencie permissões de acesso à Retaguarda
          </p>
        </div>

        {/* Loading */}
        {loadingPermissoes ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 border-4 border-[#1570FF] border-t-transparent rounded-full animate-spin"></div>
              <div className={isDarkMode ? 'text-[#B0B5C9]' : 'text-[#8A8FA6]'}>
                Carregando usuários...
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Seção: Usuários com Permissão */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className={`text-xl font-semibold ${
                    isDarkMode ? 'text-white' : 'text-[#2A2E45]'
                  }`}>
                    👑 Usuários Permitidos
                  </h2>
                  <p className={`text-sm ${
                    isDarkMode ? 'text-[#8A8FA6]' : 'text-[#6F7689]'
                  }`}>
                    {usuariosPermitidos.length} {usuariosPermitidos.length === 1 ? 'usuário' : 'usuários'} com acesso à Retaguarda
                  </p>
                </div>
              </div>

              {usuariosPermitidos.length === 0 ? (
                <div className={`text-center py-8 rounded-lg border ${
                  isDarkMode
                    ? 'bg-[#2A2E45] border-[#3A3E55]'
                    : 'bg-white border-[#E4E9F2]'
                }`}>
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className={`text-sm ${
                    isDarkMode ? 'text-[#8A8FA6]' : 'text-[#6F7689]'
                  }`}>
                    Nenhum usuário com permissão ainda
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className={`w-full rounded-lg overflow-hidden ${
                    isDarkMode ? 'bg-[#2A2E45]' : 'bg-white'
                  }`}>
                    <thead className={isDarkMode ? 'bg-[#1A1D21]' : 'bg-[#F7F9FC]'}>
                      <tr>
                        <th className={`text-left py-3 px-4 font-medium text-sm ${
                          isDarkMode ? 'text-[#B0B5C9]' : 'text-[#6F7689]'
                        }`}>
                          ID
                        </th>
                        <th className={`text-left py-3 px-4 font-medium text-sm ${
                          isDarkMode ? 'text-[#B0B5C9]' : 'text-[#6F7689]'
                        }`}>
                          Email
                        </th>
                        <th className={`text-left py-3 px-4 font-medium text-sm ${
                          isDarkMode ? 'text-[#B0B5C9]' : 'text-[#6F7689]'
                        }`}>
                          Nome
                        </th>
                        <th className={`text-left py-3 px-4 font-medium text-sm ${
                          isDarkMode ? 'text-[#B0B5C9]' : 'text-[#6F7689]'
                        }`}>
                          Concedido em
                        </th>
                        <th className={`text-right py-3 px-4 font-medium text-sm ${
                          isDarkMode ? 'text-[#B0B5C9]' : 'text-[#6F7689]'
                        }`}>
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {usuariosPermitidos.map((usuario, index) => (
                        <tr
                          key={usuario.id}
                          className={`border-t ${
                            isDarkMode
                              ? 'border-[#3A3E55] hover:bg-[#1A1D21]'
                              : 'border-[#E4E9F2] hover:bg-[#F7F9FC]'
                          }`}
                        >
                          <td className={`py-3 px-4 text-sm ${
                            isDarkMode ? 'text-[#B0B5C9]' : 'text-[#2A2E45]'
                          }`}>
                            {usuario.id.slice(0, 8)}...
                          </td>
                          <td className={`py-3 px-4 text-sm ${
                            isDarkMode ? 'text-white' : 'text-[#2A2E45]'
                          }`}>
                            {usuario.email}
                          </td>
                          <td className={`py-3 px-4 text-sm ${
                            isDarkMode ? 'text-[#B0B5C9]' : 'text-[#6F7689]'
                          }`}>
                            {usuario.display_name || '-'}
                          </td>
                          <td className={`py-3 px-4 text-sm ${
                            isDarkMode ? 'text-[#8A8FA6]' : 'text-[#6F7689]'
                          }`}>
                            {usuario.concedido_em 
                              ? new Date(usuario.concedido_em).toLocaleDateString('pt-BR') 
                              : '-'}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleRevogarPermissao(usuario.id)}
                              disabled={usuario.id === user.id}
                              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                                usuario.id === user.id
                                  ? 'opacity-50 cursor-not-allowed'
                                  : isDarkMode
                                  ? 'bg-red-900/30 hover:bg-red-900/50 text-red-400'
                                  : 'bg-red-50 hover:bg-red-100 text-red-600'
                              }`}
                              title={usuario.id === user.id ? 'Você não pode revogar sua própria permissão' : 'Revogar permissão'}
                            >
                              Revogar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Seção: Usuários Normais */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className={`text-xl font-semibold ${
                    isDarkMode ? 'text-white' : 'text-[#2A2E45]'
                  }`}>
                    👤 Usuários Normais
                  </h2>
                  <p className={`text-sm ${
                    isDarkMode ? 'text-[#8A8FA6]' : 'text-[#6F7689]'
                  }`}>
                    {usuariosNormais.length} {usuariosNormais.length === 1 ? 'usuário' : 'usuários'} sem acesso à Retaguarda
                  </p>
                </div>
              </div>

              {usuariosNormais.length === 0 ? (
                <div className={`text-center py-8 rounded-lg border ${
                  isDarkMode
                    ? 'bg-[#2A2E45] border-[#3A3E55]'
                    : 'bg-white border-[#E4E9F2]'
                }`}>
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className={`text-sm ${
                    isDarkMode ? 'text-[#8A8FA6]' : 'text-[#6F7689]'
                  }`}>
                    Todos os usuários têm permissão
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className={`w-full rounded-lg overflow-hidden ${
                    isDarkMode ? 'bg-[#2A2E45]' : 'bg-white'
                  }`}>
                    <thead className={isDarkMode ? 'bg-[#1A1D21]' : 'bg-[#F7F9FC]'}>
                      <tr>
                        <th className={`text-left py-3 px-4 font-medium text-sm ${
                          isDarkMode ? 'text-[#B0B5C9]' : 'text-[#6F7689]'
                        }`}>
                          ID
                        </th>
                        <th className={`text-left py-3 px-4 font-medium text-sm ${
                          isDarkMode ? 'text-[#B0B5C9]' : 'text-[#6F7689]'
                        }`}>
                          Email
                        </th>
                        <th className={`text-left py-3 px-4 font-medium text-sm ${
                          isDarkMode ? 'text-[#B0B5C9]' : 'text-[#6F7689]'
                        }`}>
                          Nome
                        </th>
                        <th className={`text-left py-3 px-4 font-medium text-sm ${
                          isDarkMode ? 'text-[#B0B5C9]' : 'text-[#6F7689]'
                        }`}>
                          Cadastrado em
                        </th>
                        <th className={`text-right py-3 px-4 font-medium text-sm ${
                          isDarkMode ? 'text-[#B0B5C9]' : 'text-[#6F7689]'
                        }`}>
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {usuariosNormais.map((usuario) => (
                        <tr
                          key={usuario.id}
                          className={`border-t ${
                            isDarkMode
                              ? 'border-[#3A3E55] hover:bg-[#1A1D21]'
                              : 'border-[#E4E9F2] hover:bg-[#F7F9FC]'
                          }`}
                        >
                          <td className={`py-3 px-4 text-sm ${
                            isDarkMode ? 'text-[#B0B5C9]' : 'text-[#2A2E45]'
                          }`}>
                            {usuario.id.slice(0, 8)}...
                          </td>
                          <td className={`py-3 px-4 text-sm ${
                            isDarkMode ? 'text-white' : 'text-[#2A2E45]'
                          }`}>
                            {usuario.email}
                          </td>
                          <td className={`py-3 px-4 text-sm ${
                            isDarkMode ? 'text-[#B0B5C9]' : 'text-[#6F7689]'
                          }`}>
                            {usuario.display_name || '-'}
                          </td>
                          <td className={`py-3 px-4 text-sm ${
                            isDarkMode ? 'text-[#8A8FA6]' : 'text-[#6F7689]'
                          }`}>
                            {new Date(usuario.created_at).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleConcederPermissao(usuario.id)}
                              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                                isDarkMode
                                  ? 'bg-green-900/30 hover:bg-green-900/50 text-green-400'
                                  : 'bg-green-50 hover:bg-green-100 text-green-600'
                              }`}
                            >
                              Conceder Permissão
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
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

  const renderRequestsScreen = () => {
    const STATUS = {
      pendente: { label: 'Pendente', cls: 'bg-amber-500/20 text-amber-300' },
      em_andamento: { label: 'Em andamento', cls: 'bg-blue-500/20 text-blue-300' },
      concluida: { label: 'Concluída', cls: 'bg-green-500/20 text-green-300' },
      rejeitada: { label: 'Rejeitada', cls: 'bg-red-500/20 text-red-300' },
    };
    const card = isDarkMode ? 'bg-[#2A2E45] border-[#3A3E55]' : 'bg-white border-[#E4E9F2]';
    const txt = isDarkMode ? 'text-white' : 'text-[#2A2E45]';
    const sub = isDarkMode ? 'text-[#B0B5C9]' : 'text-[#8A8FA6]';

    const btn = 'text-xs font-medium px-3 py-1.5 rounded-lg transition-colors';

    return (
      <div className="max-w-4xl mx-auto py-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className={`text-2xl font-bold ${txt}`}>Solicitações de pesquisa</h2>
          <button
            onClick={carregarSolicitacoes}
            className="text-sm px-4 py-2 rounded-lg bg-[#1570FF] text-white hover:bg-[#0D4FB8] transition-colors"
          >
            Atualizar
          </button>
        </div>

        {loadingSolicitacoes ? (
          <p className={sub}>Carregando fila...</p>
        ) : solicitacoes.length === 0 ? (
          <p className={sub}>Nenhuma solicitação de pesquisa no momento.</p>
        ) : (
          <div className="space-y-3">
            {solicitacoes.map((s) => {
              const st = STATUS[s.status] || STATUS.pendente;
              return (
                <div key={s.id} className={`rounded-xl border p-4 ${card}`}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`font-semibold ${txt}`}>{s.titulo}</p>
                        {s.prioridade === 'alta' && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded bg-red-500/20 text-red-300">
                            PRIORIDADE
                          </span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded capitalize ${sub}`}>{s.tier}</span>
                      </div>
                      <p className={`text-sm mt-1 ${sub}`}>{s.email}</p>
                    </div>
                    <span className={`text-xs font-medium px-3 py-1 rounded-full whitespace-nowrap ${st.cls}`}>
                      {st.label}
                    </span>
                  </div>

                  <div className={`text-sm space-y-1 ${txt}`}>
                    <p><b>Objetivo:</b> {s.objetivo}</p>
                    {s.publico_alvo && <p><b>Público-alvo:</b> {s.publico_alvo}</p>}
                    {s.detalhes && <p><b>Detalhes:</b> {s.detalhes}</p>}
                    {s.resposta_admin && <p className={sub}><b>Retorno enviado:</b> {s.resposta_admin}</p>}
                  </div>

                  <p className={`text-xs mt-2 ${sub}`}>
                    Recebida em {new Date(s.created_at).toLocaleString('pt-BR')}
                  </p>

                  <div className="flex gap-2 mt-3 flex-wrap">
                    <button
                      onClick={() => atualizarStatusSolicitacao(s.id, 'em_andamento')}
                      className={`${btn} bg-blue-500/20 text-blue-300 hover:bg-blue-500/30`}
                    >
                      Iniciar
                    </button>
                    <button
                      onClick={() => {
                        const retorno = window.prompt('Retorno para o cliente (opcional):', s.resposta_admin || '');
                        if (retorno !== null) atualizarStatusSolicitacao(s.id, 'concluida', retorno);
                      }}
                      className={`${btn} bg-green-500/20 text-green-300 hover:bg-green-500/30`}
                    >
                      Concluir
                    </button>
                    <button
                      onClick={() => {
                        const motivo = window.prompt('Motivo da rejeição (opcional):', s.resposta_admin || '');
                        if (motivo !== null) atualizarStatusSolicitacao(s.id, 'rejeitada', motivo);
                      }}
                      className={`${btn} bg-red-500/20 text-red-300 hover:bg-red-500/30`}
                    >
                      Rejeitar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
      case "requests":
        return renderRequestsScreen();
      case "settings":
        return renderSettingsScreen();
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

      {/* Chat de Suporte — Retaguarda */}
      <SupportChat
        isOpen={retaguardaChatOpen}
        onClose={() => setRetaguardaChatOpen(false)}
        isDarkMode={isDarkMode}
        chatEndpoint="/api/retaguarda/chat"
        welcomeMessage="Olá! Sou o assistente de suporte da Retaguarda do OpinAI. Como posso ajudar?"
        authToken={chatToken}
      />
    </div>
  );
}

export default function RetaguardaDashboard() {
  return (
    <ProtectedRoute>
      <ProtectedRetaguardaRoute>
        <RetaguardaDashboardContent />
      </ProtectedRetaguardaRoute>
    </ProtectedRoute>
  );
}