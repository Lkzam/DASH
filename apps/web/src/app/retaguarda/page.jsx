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
  Ticket,
  Coins,
  Newspaper,
  ExternalLink,
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
  const [formMoedas, setFormMoedas] = useState(0);
  const [perguntas, setPerguntas] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Estados para cupons da loja do app
  const [cupons, setCupons] = useState([]);
  const [loadingCupons, setLoadingCupons] = useState(false);
  const [editingCupom, setEditingCupom] = useState(null); // null = fechado, {} = novo
  const [cupomForm, setCupomForm] = useState({
    titulo: '', descricao: '', parceiro: 'ifood',
    custoMoedas: '', quantidade: '', validade: '',
  });

  // Estados para pesquisas externas (números de terceiros lançados à mão)
  const [pesquisasExternas, setPesquisasExternas] = useState([]);
  const [loadingExternas, setLoadingExternas] = useState(false);
  const [editingExterna, setEditingExterna] = useState(null); // null = fechado, {} = nova
  const [salvandoExterna, setSalvandoExterna] = useState(false);
  const [erroExterna, setErroExterna] = useState('');
  const [externaForm, setExternaForm] = useState({
    titulo: '', descricao: '', instituto: '', fonte_url: '',
    data_pesquisa: '', entrevistados: '', margem_erro: '', abrangencia: '',
  });
  // Cada bloco vira um gráfico: { titulo, opcoes: [{ rotulo, votos, percentual }] }
  const [externaBlocos, setExternaBlocos] = useState([]);

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

  // ── Cupons da loja do app ─────────────────────────────────────────────────
  const carregarCupons = async () => {
    setLoadingCupons(true);
    try {
      const token = await getToken();
      const res = await fetch('/api/retaguarda/cupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'list' }),
      });
      setCupons(res.ok ? await res.json() : []);
    } catch (err) {
      console.error('[cupons] erro:', err);
    } finally {
      setLoadingCupons(false);
    }
  };

  useEffect(() => {
    if (currentScreen === 'cupons') carregarCupons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentScreen]);

  // ── Pesquisas externas ────────────────────────────────────────────────────
  const chamarExternas = async (payload) => {
    const token = await getToken();
    const res = await fetch('/api/retaguarda/pesquisas-externas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    const dados = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(dados?.error || 'Erro na operação.');
    return dados;
  };

  const carregarPesquisasExternas = async () => {
    setLoadingExternas(true);
    try {
      setPesquisasExternas(await chamarExternas({ action: 'list' }));
    } catch (err) {
      console.error('[pesquisas-externas] erro:', err);
      setPesquisasExternas([]);
    } finally {
      setLoadingExternas(false);
    }
  };

  useEffect(() => {
    if (currentScreen === 'externas') carregarPesquisasExternas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentScreen]);

  const abrirEditorExterna = (p = null) => {
    setErroExterna('');
    setEditingExterna(p ?? {});
    setExternaForm({
      titulo: p?.titulo || '',
      descricao: p?.descricao || '',
      instituto: p?.instituto || '',
      fonte_url: p?.fonte_url || '',
      data_pesquisa: p?.data_pesquisa || '',
      entrevistados: p?.entrevistados ?? '',
      margem_erro: p?.margem_erro ?? '',
      abrangencia: p?.abrangencia || '',
    });
    setExternaBlocos(
      p?.blocos?.length
        ? p.blocos.map(b => ({
            titulo: b.titulo,
            // Só reenvia o que foi digitado: o que o servidor derivou volta vazio,
            // senão o valor calculado viraria valor "publicado" na próxima gravação.
            opcoes: b.opcoes.map(o => ({
              rotulo: o.rotulo,
              votos: o.votos_calculado ? '' : (o.votos ?? ''),
              percentual: o.percentual_calculado ? '' : (o.percentual ?? ''),
            })),
          }))
        : [{ titulo: '', opcoes: [{ rotulo: '', votos: '', percentual: '' }] }]
    );
  };

  const alterarBloco = (i, campo, valor) =>
    setExternaBlocos(bs => bs.map((b, idx) => (idx === i ? { ...b, [campo]: valor } : b)));

  const alterarOpcao = (i, j, campo, valor) =>
    setExternaBlocos(bs => bs.map((b, idx) => idx !== i ? b : {
      ...b,
      opcoes: b.opcoes.map((o, jdx) => (jdx === j ? { ...o, [campo]: valor } : o)),
    }));

  const addBloco = () =>
    setExternaBlocos(bs => [...bs, { titulo: '', opcoes: [{ rotulo: '', votos: '', percentual: '' }] }]);

  const removerBloco = (i) => setExternaBlocos(bs => bs.filter((_, idx) => idx !== i));

  const addOpcao = (i) =>
    setExternaBlocos(bs => bs.map((b, idx) => idx !== i ? b : {
      ...b, opcoes: [...b.opcoes, { rotulo: '', votos: '', percentual: '' }],
    }));

  const removerOpcao = (i, j) =>
    setExternaBlocos(bs => bs.map((b, idx) => idx !== i ? b : {
      ...b, opcoes: b.opcoes.filter((_, jdx) => jdx !== j),
    }));

  /** Soma dos percentuais do bloco — ajuda a flagrar erro de digitação. */
  const somaPercentual = (bloco) =>
    bloco.opcoes.reduce((s, o) => s + (parseFloat(o.percentual) || 0), 0);

  const salvarExterna = async () => {
    setErroExterna('');
    if (!externaForm.titulo.trim()) { setErroExterna('Informe o título da pesquisa.'); return; }

    const blocosValidos = externaBlocos
      .map(b => ({
        titulo: b.titulo,
        opcoes: b.opcoes.filter(o => o.rotulo.trim() && (o.votos !== '' || o.percentual !== '')),
      }))
      .filter(b => b.opcoes.length > 0);

    if (blocosValidos.length === 0) {
      setErroExterna('Adicione ao menos um bloco com uma opção que tenha votos ou percentual.');
      return;
    }

    setSalvandoExterna(true);
    try {
      await chamarExternas({
        action: editingExterna?.id ? 'update' : 'create',
        id: editingExterna?.id,
        ...externaForm,
        blocos: blocosValidos,
      });
      setEditingExterna(null);
      carregarPesquisasExternas();
    } catch (err) {
      setErroExterna(err.message);
    } finally {
      setSalvandoExterna(false);
    }
  };

  const alternarAtivoExterna = async (p) => {
    try {
      await chamarExternas({ action: 'toggle_ativo', id: p.id, ativo: !p.ativo });
      carregarPesquisasExternas();
    } catch (err) { console.error(err); }
  };

  const excluirExterna = async (p) => {
    if (!window.confirm(`Excluir "${p.titulo}"? Os blocos e números serão perdidos.`)) return;
    try {
      await chamarExternas({ action: 'delete', id: p.id });
      carregarPesquisasExternas();
    } catch (err) { console.error(err); }
  };

  const abrirEditorCupom = (cupom = null) => {
    setEditingCupom(cupom ?? {});
    setCupomForm(cupom ? {
      titulo: cupom.titulo || '',
      descricao: cupom.descricao || '',
      parceiro: cupom.parceiro || 'ifood',
      custoMoedas: String(cupom.custo_moedas ?? ''),
      quantidade: String(cupom.quantidade ?? ''),
      validade: cupom.validade || '',
    } : { titulo: '', descricao: '', parceiro: 'ifood', custoMoedas: '', quantidade: '', validade: '' });
  };

  const salvarCupom = async () => {
    if (!cupomForm.titulo.trim()) {
      showMessage('error', 'O título do cupom é obrigatório');
      return;
    }
    if (!parseInt(cupomForm.custoMoedas, 10) || parseInt(cupomForm.custoMoedas, 10) <= 0) {
      showMessage('error', 'Informe o custo em moedas (maior que zero)');
      return;
    }
    try {
      const token = await getToken();
      const isEdit = editingCupom?.id;
      const res = await fetch('/api/retaguarda/cupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: isEdit ? 'update' : 'create',
          id: editingCupom?.id,
          titulo: cupomForm.titulo,
          descricao: cupomForm.descricao,
          parceiro: cupomForm.parceiro,
          custoMoedas: cupomForm.custoMoedas,
          quantidade: cupomForm.quantidade,
          validade: cupomForm.validade || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Erro ao salvar cupom');
      }
      showMessage('success', isEdit ? 'Cupom atualizado!' : 'Cupom criado!');
      setEditingCupom(null);
      carregarCupons();
    } catch (err) {
      showMessage('error', err.message);
    }
  };

  const alternarAtivoCupom = async (cupom) => {
    try {
      const token = await getToken();
      const res = await fetch('/api/retaguarda/cupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'toggle_ativo', id: cupom.id, ativo: !cupom.ativo }),
      });
      if (!res.ok) throw new Error('Erro ao atualizar cupom');
      carregarCupons();
    } catch (err) {
      showMessage('error', err.message);
    }
  };

  const excluirCupom = async (cupomId) => {
    if (!confirm('Excluir este cupom? Ele sairá da loja do app.')) return;
    try {
      const token = await getToken();
      const res = await fetch('/api/retaguarda/cupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'delete', id: cupomId }),
      });
      if (!res.ok) throw new Error('Erro ao excluir cupom');
      showMessage('success', 'Cupom excluído!');
      carregarCupons();
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
      id: "externas",
      icon: Newspaper,
      label: "Pesquisas externas",
      active: currentScreen === "externas",
    },
    {
      id: "cupons",
      icon: Ticket,
      label: "Cupons",
      active: currentScreen === "cupons",
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
    setEditingCupom(null);
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
            moedasRecompensa: formMoedas,
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
            moedasRecompensa: formMoedas,
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
      setFormMoedas(0);
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
      setFormMoedas(form.moedas_recompensa ?? 0);
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
                setFormMoedas(0);
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

            <div>
              <label className={`flex items-center gap-2 text-sm font-medium mb-2 ${
                isDarkMode ? 'text-[#B0B5C9]' : 'text-[#2A2E45]'
              }`}>
                <Coins className="w-4 h-4 text-amber-400" />
                Moedas por resposta (app)
              </label>
              <input
                type="number"
                min={0}
                value={formMoedas}
                onChange={(e) => setFormMoedas(Math.max(0, parseInt(e.target.value, 10) || 0))}
                placeholder="0"
                className={`w-full sm:w-48 px-4 py-2 border rounded-lg outline-none ${
                  isDarkMode
                    ? 'bg-[#1A1D21] border-[#3A3E55] text-white'
                    : 'bg-white border-[#E4E9F2] text-[#2A2E45]'
                }`}
              />
              <p className={`text-xs mt-1 ${isDarkMode ? 'text-[#8A8FA6]' : 'text-[#8A8FA6]'}`}>
                Quantas moedas o usuário do aplicativo ganha ao responder esta pesquisa. 0 = sem recompensa.
              </p>
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
                setFormMoedas(0);
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

  const renderExternasScreen = () => {
    const card = isDarkMode ? 'bg-[#2A2E45] border-[#3A3E55]' : 'bg-white border-[#E4E9F2]';
    const txt = isDarkMode ? 'text-white' : 'text-[#2A2E45]';
    const sub = isDarkMode ? 'text-[#B0B5C9]' : 'text-[#6F7689]';
    const input = `w-full px-3 py-2 rounded border text-sm ${
      isDarkMode ? 'bg-[#1A1D21] border-[#3A3E55] text-white' : 'bg-white border-[#E4E9F2] text-[#2A2E45]'
    }`;
    const label = `block text-xs font-medium mb-1 ${sub}`;

    return (
      <div className="flex flex-col h-full p-6 space-y-6 overflow-auto">
        <div className="flex items-start justify-between">
          <div>
            <h1 className={`text-2xl font-semibold ${txt}`}>Pesquisas externas</h1>
            <p className={`text-sm mt-1 ${sub}`}>
              Lance à mão os números de uma pesquisa publicada por terceiros. Elas aparecem
              na tela de Pesquisa do usuário, identificadas pela fonte.
            </p>
          </div>
          <button
            onClick={() => abrirEditorExterna()}
            className="flex items-center gap-2 px-4 py-2 rounded bg-[#4A6CF7] text-white text-sm font-medium hover:bg-[#3A5BE7]"
          >
            <Plus className="w-4 h-4" /> Nova pesquisa
          </button>
        </div>

        {/* ── Editor ─────────────────────────────────────────────── */}
        {editingExterna && (
          <div className={`rounded-lg border p-5 space-y-5 ${card}`}>
            <div className="flex items-center justify-between">
              <h2 className={`text-lg font-semibold ${txt}`}>
                {editingExterna.id ? 'Editar pesquisa' : 'Nova pesquisa externa'}
              </h2>
              <button onClick={() => setEditingExterna(null)} className={sub}>
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Identificação */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className={label}>Título *</label>
                <input
                  className={input}
                  value={externaForm.titulo}
                  onChange={e => setExternaForm(f => ({ ...f, titulo: e.target.value }))}
                  placeholder="Ex: Intenção de voto para presidente — agosto"
                />
              </div>
              <div className="md:col-span-2">
                <label className={label}>Descrição</label>
                <input
                  className={input}
                  value={externaForm.descricao}
                  onChange={e => setExternaForm(f => ({ ...f, descricao: e.target.value }))}
                  placeholder="Observações sobre o recorte, cenário etc."
                />
              </div>
            </div>

            {/* Procedência — é o que torna o dado auditável */}
            <div>
              <p className={`text-xs font-semibold mb-2 ${sub}`}>PROCEDÊNCIA</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={label}>Instituto</label>
                  <input
                    className={input}
                    value={externaForm.instituto}
                    onChange={e => setExternaForm(f => ({ ...f, instituto: e.target.value }))}
                    placeholder="Datafolha, Quaest, G1..."
                  />
                </div>
                <div className="md:col-span-2">
                  <label className={label}>Link da matéria</label>
                  <input
                    className={input}
                    value={externaForm.fonte_url}
                    onChange={e => setExternaForm(f => ({ ...f, fonte_url: e.target.value }))}
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <label className={label}>Data da pesquisa</label>
                  <input
                    type="date"
                    className={input}
                    value={externaForm.data_pesquisa}
                    onChange={e => setExternaForm(f => ({ ...f, data_pesquisa: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={label}>Entrevistados (N)</label>
                  <input
                    type="number" min="1"
                    className={input}
                    value={externaForm.entrevistados}
                    onChange={e => setExternaForm(f => ({ ...f, entrevistados: e.target.value }))}
                    placeholder="2000"
                  />
                </div>
                <div>
                  <label className={label}>Margem de erro (p.p.)</label>
                  <input
                    type="number" step="0.1" min="0"
                    className={input}
                    value={externaForm.margem_erro}
                    onChange={e => setExternaForm(f => ({ ...f, margem_erro: e.target.value }))}
                    placeholder="2"
                  />
                </div>
                <div className="md:col-span-3">
                  <label className={label}>Abrangência</label>
                  <input
                    className={input}
                    value={externaForm.abrangencia}
                    onChange={e => setExternaForm(f => ({ ...f, abrangencia: e.target.value }))}
                    placeholder="Nacional, São Paulo (SP), Campinas/SP..."
                  />
                </div>
              </div>
              <p className={`text-xs mt-2 ${sub}`}>
                Informando o N, o sistema calcula quantas pessoas cada percentual representa.
              </p>
            </div>

            {/* Blocos */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className={`text-xs font-semibold ${sub}`}>BLOCOS DE DADOS</p>
                <button onClick={addBloco} className="text-xs font-medium text-[#4A6CF7] flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Adicionar bloco
                </button>
              </div>
              <p className={`text-xs mb-3 ${sub}`}>
                Cada bloco vira um gráfico. Ex: um bloco &quot;Intenção de voto&quot; com os candidatos
                e outro &quot;Espectro político&quot; com esquerda/direita.
              </p>

              <div className="space-y-4">
                {externaBlocos.map((bloco, i) => {
                  const soma = somaPercentual(bloco);
                  const somaSuspeita = soma > 0 && (soma < 95 || soma > 105);
                  return (
                    <div key={i} className={`rounded border p-4 ${isDarkMode ? 'border-[#3A3E55]' : 'border-[#E4E9F2]'}`}>
                      <div className="flex items-center gap-3 mb-3">
                        <input
                          className={input}
                          value={bloco.titulo}
                          onChange={e => alterarBloco(i, 'titulo', e.target.value)}
                          placeholder={`Título do bloco ${i + 1} — ex: Intenção de voto`}
                        />
                        {externaBlocos.length > 1 && (
                          <button onClick={() => removerBloco(i)} className="text-[#EF4444] shrink-0">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className={`grid grid-cols-12 gap-2 text-xs font-medium mb-1 ${sub}`}>
                        <div className="col-span-6">Opção</div>
                        <div className="col-span-2">Votos</div>
                        <div className="col-span-3">%</div>
                        <div className="col-span-1" />
                      </div>

                      {bloco.opcoes.map((op, j) => (
                        <div key={j} className="grid grid-cols-12 gap-2 mb-2">
                          <input
                            className={`${input} col-span-6`}
                            value={op.rotulo}
                            onChange={e => alterarOpcao(i, j, 'rotulo', e.target.value)}
                            placeholder="Ex: Lula"
                          />
                          <input
                            type="number" min="0"
                            className={`${input} col-span-2`}
                            value={op.votos}
                            onChange={e => alterarOpcao(i, j, 'votos', e.target.value)}
                          />
                          <input
                            type="number" step="0.01" min="0" max="100"
                            className={`${input} col-span-3`}
                            value={op.percentual}
                            onChange={e => alterarOpcao(i, j, 'percentual', e.target.value)}
                          />
                          <button
                            onClick={() => removerOpcao(i, j)}
                            disabled={bloco.opcoes.length === 1}
                            className={`col-span-1 flex items-center justify-center ${
                              bloco.opcoes.length === 1 ? 'opacity-30' : 'text-[#EF4444]'
                            }`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}

                      <div className="flex items-center justify-between mt-2">
                        <button onClick={() => addOpcao(i)} className="text-xs font-medium text-[#4A6CF7] flex items-center gap-1">
                          <Plus className="w-3 h-3" /> Adicionar opção
                        </button>
                        {soma > 0 && (
                          <span className={`text-xs ${somaSuspeita ? 'text-[#F59E0B]' : sub}`}>
                            Soma: {soma.toFixed(2)}%
                            {somaSuspeita && ' — confira, não fecha 100%'}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className={`text-xs mt-3 ${sub}`}>
                Preencha votos, percentual, ou os dois. O que faltar é calculado — e aparece
                marcado como estimativa para o usuário.
              </p>
            </div>

            {erroExterna && <p className="text-sm text-[#EF4444]">{erroExterna}</p>}

            <div className="flex gap-3">
              <button
                onClick={salvarExterna}
                disabled={salvandoExterna}
                className="flex items-center gap-2 px-4 py-2 rounded bg-[#4A6CF7] text-white text-sm font-medium disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                {salvandoExterna ? 'Salvando...' : 'Salvar pesquisa'}
              </button>
              <button
                onClick={() => setEditingExterna(null)}
                className={`px-4 py-2 rounded border text-sm ${isDarkMode ? 'border-[#3A3E55] text-white' : 'border-[#E4E9F2]'}`}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* ── Listagem ───────────────────────────────────────────── */}
        {loadingExternas ? (
          <p className={sub}>Carregando...</p>
        ) : pesquisasExternas.length === 0 ? (
          <div className={`rounded-lg border p-10 text-center ${card}`}>
            <Newspaper className={`w-12 h-12 mx-auto mb-3 ${sub}`} />
            <p className={`font-medium ${txt}`}>Nenhuma pesquisa externa cadastrada</p>
            <p className={`text-sm mt-1 ${sub}`}>
              Clique em &quot;Nova pesquisa&quot; para lançar os números de uma pesquisa publicada.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {pesquisasExternas.map(p => (
              <div key={p.id} className={`rounded-lg border p-4 ${card} ${p.ativo ? '' : 'opacity-60'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className={`font-semibold ${txt}`}>{p.titulo}</h3>
                      {!p.ativo && (
                        <span className={`text-xs px-2 py-0.5 rounded ${isDarkMode ? 'bg-[#3A3E55] text-[#B0B5C9]' : 'bg-[#E4E9F2] text-[#6F7689]'}`}>
                          oculta
                        </span>
                      )}
                    </div>
                    <p className={`text-sm mt-1 ${sub}`}>
                      {[
                        p.instituto,
                        p.data_pesquisa && new Date(p.data_pesquisa + 'T00:00:00').toLocaleDateString('pt-BR'),
                        p.entrevistados && `${p.entrevistados} entrevistados`,
                        p.margem_erro && `±${p.margem_erro} p.p.`,
                        p.abrangencia,
                      ].filter(Boolean).join(' · ') || 'Sem dados de procedência'}
                    </p>
                    <p className={`text-xs mt-1 ${sub}`}>
                      {p.blocos.length} {p.blocos.length === 1 ? 'bloco' : 'blocos'}
                      {' · '}
                      {p.blocos.map(b => b.titulo).join(', ')}
                    </p>
                    {p.fonte_url && (
                      <a
                        href={p.fonte_url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-[#4A6CF7] inline-flex items-center gap-1 mt-1"
                      >
                        <ExternalLink className="w-3 h-3" /> ver matéria
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => alternarAtivoExterna(p)} title={p.ativo ? 'Ocultar' : 'Exibir'} className={sub}>
                      <Eye className="w-4 h-4" />
                    </button>
                    <button onClick={() => abrirEditorExterna(p)} title="Editar" className={sub}>
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => excluirExterna(p)} title="Excluir" className="text-[#EF4444]">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderCuponsScreen = () => {
    const card = isDarkMode ? 'bg-[#2A2E45] border-[#3A3E55]' : 'bg-white border-[#E4E9F2]';
    const txt = isDarkMode ? 'text-white' : 'text-[#2A2E45]';
    const sub = isDarkMode ? 'text-[#B0B5C9]' : 'text-[#8A8FA6]';
    const input = `w-full px-4 py-2 border rounded-lg outline-none ${
      isDarkMode ? 'bg-[#1A1D21] border-[#3A3E55] text-white' : 'bg-white border-[#E4E9F2] text-[#2A2E45]'
    }`;
    const label = `block text-sm font-medium mb-2 ${isDarkMode ? 'text-[#B0B5C9]' : 'text-[#2A2E45]'}`;

    const PARCEIRO_LABEL = { ifood: 'iFood', uber: 'Uber', '99': '99', outro: 'Outro' };

    // ── Editor (criar/editar) ──
    if (editingCupom !== null) {
      return (
        <div className="max-w-2xl mx-auto py-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className={`text-2xl font-bold ${txt}`}>
              {editingCupom.id ? 'Editar Cupom' : 'Novo Cupom'}
            </h2>
            <button
              onClick={() => setEditingCupom(null)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                isDarkMode ? 'bg-[#3A3E55] hover:bg-[#4A4E65] text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className={`rounded-xl border p-6 space-y-4 ${card}`}>
            <div>
              <label className={label}>Título do cupom *</label>
              <input
                type="text"
                value={cupomForm.titulo}
                onChange={(e) => setCupomForm({ ...cupomForm, titulo: e.target.value })}
                placeholder="Ex: R$ 20 OFF no iFood"
                className={input}
              />
            </div>

            <div>
              <label className={label}>Descrição</label>
              <textarea
                rows={2}
                value={cupomForm.descricao}
                onChange={(e) => setCupomForm({ ...cupomForm, descricao: e.target.value })}
                placeholder="Regras de uso, valor mínimo do pedido, etc."
                className={`${input} resize-none`}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={label}>Parceiro</label>
                <select
                  value={cupomForm.parceiro}
                  onChange={(e) => setCupomForm({ ...cupomForm, parceiro: e.target.value })}
                  className={input}
                >
                  <option value="ifood">iFood</option>
                  <option value="uber">Uber</option>
                  <option value="99">99</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
              <div>
                <label className={label}>Custo em moedas *</label>
                <input
                  type="number"
                  min={1}
                  value={cupomForm.custoMoedas}
                  onChange={(e) => setCupomForm({ ...cupomForm, custoMoedas: e.target.value })}
                  placeholder="Ex: 500"
                  className={input}
                />
              </div>
              <div>
                <label className={label}>Estoque (quantidade)</label>
                <input
                  type="number"
                  min={0}
                  value={cupomForm.quantidade}
                  onChange={(e) => setCupomForm({ ...cupomForm, quantidade: e.target.value })}
                  placeholder="Ex: 100"
                  className={input}
                />
              </div>
              <div>
                <label className={label}>Validade (opcional)</label>
                <input
                  type="date"
                  value={cupomForm.validade}
                  onChange={(e) => setCupomForm({ ...cupomForm, validade: e.target.value })}
                  className={input}
                />
              </div>
            </div>

            <button
              onClick={salvarCupom}
              className="flex items-center gap-2 bg-[#1570FF] text-white px-6 py-2.5 rounded-lg hover:bg-[#0D4FB8] transition-colors font-medium"
            >
              <Save className="w-4 h-4" />
              {editingCupom.id ? 'Salvar alterações' : 'Criar cupom'}
            </button>
          </div>
        </div>
      );
    }

    // ── Listagem ──
    return (
      <div className="max-w-4xl mx-auto py-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className={`text-2xl font-bold ${txt}`}>Cupons da loja do app</h2>
          <button
            onClick={() => abrirEditorCupom()}
            className="flex items-center gap-2 bg-[#1570FF] text-white px-4 py-2 rounded-lg hover:bg-[#0D4FB8] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo cupom
          </button>
        </div>
        <p className={`text-sm mb-5 ${sub}`}>
          Estes cupons aparecem na loja do aplicativo, onde os usuários trocam moedas ganhas respondendo pesquisas.
        </p>

        {loadingCupons ? (
          <p className={sub}>Carregando cupons...</p>
        ) : cupons.length === 0 ? (
          <div className={`rounded-xl border p-8 text-center ${card}`}>
            <Ticket className={`w-10 h-10 mx-auto mb-3 ${sub}`} />
            <p className={sub}>Nenhum cupom cadastrado ainda. Crie o primeiro!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {cupons.map((cp) => (
              <div key={cp.id} className={`rounded-xl border p-4 ${card} ${!cp.ativo ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`font-semibold ${txt}`}>{cp.titulo}</p>
                      <span className="text-xs font-medium px-2 py-0.5 rounded bg-[#1570FF]/20 text-[#5B9BFF]">
                        {PARCEIRO_LABEL[cp.parceiro] || cp.parceiro}
                      </span>
                      {!cp.ativo && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded bg-gray-500/20 text-gray-400">
                          Inativo
                        </span>
                      )}
                    </div>
                    {cp.descricao && <p className={`text-sm mt-1 ${sub}`}>{cp.descricao}</p>}
                    <div className={`flex items-center gap-4 text-sm mt-2 ${sub}`}>
                      <span className="flex items-center gap-1">
                        <Coins className="w-4 h-4 text-amber-400" />
                        <b className={txt}>{cp.custo_moedas}</b> moedas
                      </span>
                      <span>Estoque: <b className={txt}>{cp.quantidade - (cp.resgatados || 0)}</b> / {cp.quantidade}</span>
                      {cp.validade && (
                        <span>Válido até {new Date(cp.validade + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => abrirEditorCupom(cp)}
                      className={`p-2 rounded-lg transition-colors ${
                        isDarkMode ? 'hover:bg-[#3A3E55] text-[#B0B5C9]' : 'hover:bg-gray-100 text-gray-500'
                      }`}
                      title="Editar"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => alternarAtivoCupom(cp)}
                      className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                        cp.ativo
                          ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                          : 'bg-green-500/20 text-green-300 hover:bg-green-500/30'
                      }`}
                    >
                      {cp.ativo ? 'Desativar' : 'Ativar'}
                    </button>
                    <button
                      onClick={() => excluirCupom(cp.id)}
                      className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
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
      case "externas":
        return renderExternasScreen();
      case "cupons":
        return renderCuponsScreen();
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