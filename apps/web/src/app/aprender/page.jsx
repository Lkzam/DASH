
import { useState } from 'react';
import { useDarkMode } from '../../contexts/DarkModeContext';
import { useNavigate } from 'react-router-dom';
import FloatingLines from '../../components/FloatingLines';
import {
  BookOpen,
  Home,
  BarChart3,
  Map,
  Search,
  Settings,
  FileText,
  ChevronRight,
  Database,
  ArrowLeft,
  Play,
  CheckCircle2,
  Info,
} from 'lucide-react';

export default function AprenderPage() {
  const { isDarkMode } = useDarkMode();
  const navigate = useNavigate();
  const [moduloSelecionado, setModuloSelecionado] = useState(null);

  // Estrutura dos módulos de aprendizado
  const modulos = [
    {
      id: 'home',
      titulo: 'Dashboard Principal',
      icon: Home,
      cor: '#1570FF',
      descricao: 'Aprenda a navegar pela tela inicial e visualizar suas estatísticas',
      topicos: [
        {
          titulo: 'Visão Geral',
          conteudo: 'A tela inicial mostra um resumo das principais informações do sistema. Você encontra cards com estatísticas importantes e acesso rápido às funcionalidades.',
          passos: [
            'Acesse o Dashboard clicando em "Home" no menu lateral',
            'Visualize seu saldo de moedas no primeiro card',
            'Confira suas informações de conta no segundo card',
            'Gerencie seus favoritos no terceiro card',
          ],
        },
        {
          titulo: 'Saldo de Moedas',
          conteudo: 'O sistema de moedas permite que você participe de pesquisas e acumule pontos.',
          passos: [
            'Seu saldo atual é exibido no card "Saldo de Moedas"',
            'Cada resposta a formulários pode gerar moedas',
            'O saldo é atualizado em tempo real',
          ],
          fonteDados: {
            fonte: 'Sistema OpinAI',
            descricao: 'Saldo de moedas acumulado por participação em pesquisas e formulários',
            atualizacao: 'Atualizado a cada participação',
          },
        },
        {
          titulo: 'Favoritos',
          conteudo: 'Personalize seu acesso rápido adicionando abas favoritas.',
          passos: [
            'Clique no botão "+" no card de Favoritos',
            'Selecione as abas que deseja adicionar',
            'Clique em uma aba favorita para navegar rapidamente',
            'Remova favoritos clicando no "X" ao passar o mouse',
          ],
          fonteDados: {
            fonte: 'Sistema OpinAI',
            descricao: 'Preferências de navegação e atalhos personalizados do usuário',
          },
        },
      ],
    },
    {
      id: 'elections',
      titulo: 'Eleições 2022',
      icon: BarChart3,
      cor: '#E74C3C',
      descricao: 'Explore os resultados das eleições presidenciais brasileiras de 2022',
      topicos: [
        {
          titulo: 'Visualização dos Resultados',
          conteudo: 'Visualize os dados oficiais das eleições de 2022 em gráficos interativos.',
          passos: [
            'Acesse "Eleições 2022" no menu lateral',
            'Escolha entre 1º ou 2º turno usando os botões superiores',
            'Analise o gráfico de barras com os votos de cada candidato',
            'Passe o mouse sobre as barras para ver detalhes',
          ],
        },
        {
          titulo: 'Dados do Primeiro Turno',
          conteudo: 'Os dados do primeiro turno mostram todos os candidatos que concorreram.',
          fonteDados: {
            fonte: 'TSE — Tribunal Superior Eleitoral',
            conjunto: 'Eleições Gerais 2022 — 1º Turno (Presidente)',
            disponibilidade: 'Dados históricos oficiais — repositorio.tse.jus.br',
          },
        },
        {
          titulo: 'Dados do Segundo Turno',
          conteudo: 'O segundo turno apresenta apenas os dois candidatos mais votados.',
          fonteDados: {
            fonte: 'TSE — Tribunal Superior Eleitoral',
            conjunto: 'Eleições Gerais 2022 — 2º Turno (Presidente)',
            disponibilidade: 'Dados históricos oficiais — repositorio.tse.jus.br',
          },
        },
      ],
    },
    {
      id: 'map',
      titulo: 'Mapa Eleitoral',
      icon: Map,
      cor: '#2ECC71',
      descricao: 'Análise detalhada de resultados eleitorais por município',
      topicos: [
        {
          titulo: 'Como Usar os Filtros',
          conteudo: 'Selecione Estado, Município e Cargo para ver análises detalhadas.',
          passos: [
            'Escolha um Estado brasileiro no primeiro filtro',
            'Aguarde o carregamento da lista de municípios',
            'Selecione o Município desejado',
            'Escolha o Cargo (Deputado Federal, Estadual, etc.)',
            'Clique em "Buscar" para carregar os dados',
          ],
        },
        {
          titulo: 'Gráficos e Estatísticas',
          conteudo: 'Após buscar, você verá diversos gráficos e análises.',
          passos: [
            'Card de Total de Votos: soma de todos os votos válidos',
            'Card de Candidatos: quantidade de candidatos votados',
            'Card de Mais Votado: candidato com maior votação',
            'Gráfico de Barras: Top 10 candidatos mais votados',
            'Gráfico de Pizza: Distribuição de votos por partido',
            'Tabela Completa: Ranking detalhado de todos os candidatos',
          ],
        },
        {
          titulo: 'Fonte dos Dados',
          conteudo: 'Os dados eleitorais são provenientes diretamente do TSE — Tribunal Superior Eleitoral.',
          fonteDados: {
            fonte: 'TSE — Repositório de Dados Eleitorais',
            conjunto: 'Votação por candidato, município e zona — Eleições 2022',
            cobertura: 'Todos os 26 estados + Distrito Federal',
            disponibilidade: 'repositorio.tse.jus.br e dados.gov.br',
          },
        },
      ],
    },
    {
      id: 'search',
      titulo: 'Pesquisa de Formulários',
      icon: Search,
      cor: '#F39C12',
      descricao: 'Visualize resultados de formulários respondidos',
      topicos: [
        {
          titulo: 'Visualizar Formulários',
          conteudo: 'Acesse os resultados de todos os formulários do sistema.',
          passos: [
            'Acesse "Pesquisa" no menu lateral',
            'Veja a lista de todos os formulários criados',
            'Cada card mostra o título, descrição e número de respostas',
            'Clique em "Ver Resultados" para abrir o modal de análise',
          ],
        },
        {
          titulo: 'Análise de Resultados',
          conteudo: 'O modal mostra gráficos e tabelas com as respostas.',
          passos: [
            'Perguntas de múltipla escolha: gráfico de pizza + estatísticas',
            'Perguntas de checkbox: gráfico de pizza (múltiplas seleções)',
            'Perguntas abertas: tabela com todas as respostas',
            'Veja o email/nome de quem respondeu e a data',
          ],
        },
        {
          titulo: 'Dados das Respostas',
          conteudo: 'As respostas são armazenadas de forma segura e associadas ao usuário que respondeu.',
          fonteDados: {
            fonte: 'Sistema OpinAI',
            descricao: 'Respostas coletadas de pesquisas e formulários internos da plataforma',
            formato: 'Estruturado por pergunta e resposta com data e hora',
            acesso: 'Visível apenas para gerentes na Retaguarda',
          },
        },
      ],
    },
    {
      id: 'settings',
      titulo: 'Configurações',
      icon: Settings,
      cor: '#9B59B6',
      descricao: 'Gerencie suas informações pessoais e preferências',
      topicos: [
        {
          titulo: 'Atualizar Informações',
          conteudo: 'Mantenha seus dados sempre atualizados.',
          passos: [
            'Acesse "Configuração" no menu lateral',
            'Edite seu Nome de Exibição no primeiro card',
            'Atualize seu Email no segundo card (requer confirmação)',
            'Adicione ou altere seu Telefone no terceiro card',
            'Clique em "Salvar" em cada seção',
          ],
        },
        {
          titulo: 'Dados do Usuário',
          conteudo: 'Suas informações são armazenadas de forma segura com acesso exclusivo à sua conta.',
          fonteDados: {
            fonte: 'Conta OpinAI',
            descricao: 'Nome, email e preferências pessoais do usuário',
            segurança: 'Acesso restrito — somente você pode ver e alterar seus dados',
          },
        },
      ],
    },
    {
      id: 'retaguarda',
      titulo: 'Retaguarda (Gerência)',
      icon: FileText,
      cor: '#E67E22',
      descricao: 'Área administrativa para gerentes e administradores',
      topicos: [
        {
          titulo: 'Estatísticas de Usuários',
          conteudo: 'A tela inicial da Retaguarda mostra métricas importantes.',
          passos: [
            'Total de usuários cadastrados no sistema',
            'Novos usuários de hoje',
            'Usuários cadastrados nos últimos 7 dias',
            'Usuários cadastrados nos últimos 30 dias',
          ],
          fonteDados: {
            fonte: 'Sistema OpinAI',
            descricao: 'Métricas de crescimento e uso da plataforma em tempo real',
            acesso: 'Exclusivo para gerentes com permissão de Retaguarda',
          },
        },
        {
          titulo: 'Criar Formulários',
          conteudo: 'Gerencie formulários personalizados para pesquisas.',
          passos: [
            'Clique em "Novo Formulário"',
            'Preencha título e descrição',
            'Adicione perguntas de diferentes tipos',
            'Configure opções para múltipla escolha/checkbox',
            'Marque perguntas como obrigatórias se necessário',
            'Clique em "Salvar Formulário"',
          ],
          fonteDados: {
            fonte: 'Sistema OpinAI',
            descricao: 'Formulários criados pela equipe de gerência para coleta de dados internos',
            tipos_de_pergunta: 'Texto, número, email, telefone, texto longo, múltipla escolha, checkbox, data, hora',
          },
        },
        {
          titulo: 'Responder Formulários',
          conteudo: 'Até gerentes podem responder os formulários criados.',
          passos: [
            'Acesse a aba "Responder"',
            'Escolha um formulário ativo',
            'Preencha todas as perguntas',
            'Perguntas obrigatórias devem ser respondidas',
            'Clique em "Enviar Respostas"',
          ],
        },
        {
          titulo: 'Gerenciar Permissões',
          conteudo: 'Controle quem pode acessar a Retaguarda.',
          passos: [
            'Acesse "Configuração" na Retaguarda',
            'Veja lista de usuários com e sem permissão',
            'Clique em "Conceder Permissão" para dar acesso',
            'Clique em "Revogar" para remover acesso',
            'Você não pode revogar sua própria permissão',
          ],
          fonteDados: {
            fonte: 'Sistema OpinAI',
            descricao: 'Controle de acesso e permissões administrativas da plataforma',
            segurança: 'Acesso restrito — somente administradores autorizados podem gerenciar permissões',
          },
        },
      ],
    },
  ];

  // Função para renderizar a lista de módulos
  const renderListaModulos = () => {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className={`text-2xl font-semibold ${
              isDarkMode ? 'text-white' : 'text-[#2A2E45]'
            }`}>
              Central de Aprendizado
            </h1>
            <p className={`text-sm mt-1 ${
              isDarkMode ? 'text-[#B0B5C9]' : 'text-[#8A8FA6]'
            }`}>
              Aprenda a usar todas as funcionalidades do OpinaAI
            </p>
          </div>
          <button
            onClick={() => navigate(-1)}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
              isDarkMode
                ? 'bg-[#3A3E55] hover:bg-[#4A4E65] text-white'
                : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {modulos.map((modulo) => {
            const Icon = modulo.icon;
            return (
              <button
                key={modulo.id}
                onClick={() => setModuloSelecionado(modulo)}
                className={`text-left p-6 rounded-lg border transition-all hover:shadow-lg ${
                  isDarkMode
                    ? 'bg-[#2A2E45] border-[#3A3E55] hover:border-[#1570FF]'
                    : 'bg-white border-[#E4E9F2] hover:border-[#1570FF]'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${modulo.cor}20` }}
                  >
                    <Icon className="w-6 h-6" style={{ color: modulo.cor }} />
                  </div>
                  <ChevronRight className={`w-5 h-5 ${
                    isDarkMode ? 'text-[#8A8FA6]' : 'text-[#6F7689]'
                  }`} />
                </div>

                <h3 className={`text-lg font-semibold mb-2 ${
                  isDarkMode ? 'text-white' : 'text-[#2A2E45]'
                }`}>
                  {modulo.titulo}
                </h3>

                <p className={`text-sm ${
                  isDarkMode ? 'text-[#B0B5C9]' : 'text-[#8A8FA6]'
                }`}>
                  {modulo.descricao}
                </p>

                <div className={`mt-4 pt-4 border-t ${
                  isDarkMode ? 'border-[#3A3E55]' : 'border-[#E4E9F2]'
                }`}>
                  <div className="flex items-center gap-2">
                    <BookOpen className={`w-4 h-4 ${
                      isDarkMode ? 'text-[#4A90E2]' : 'text-[#1570FF]'
                    }`} />
                    <span className={`text-sm font-medium ${
                      isDarkMode ? 'text-[#B0B5C9]' : 'text-[#6F7689]'
                    }`}>
                      {modulo.topicos.length} {modulo.topicos.length === 1 ? 'tópico' : 'tópicos'}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // Função para renderizar o conteúdo de um módulo
  const renderConteudoModulo = () => {
    if (!moduloSelecionado) return null;

    const Icon = moduloSelecionado.icon;

    return (
      <div className="space-y-6">
        {/* Header do módulo */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setModuloSelecionado(null)}
              className={`p-2 rounded-lg transition-colors ${
                isDarkMode
                  ? 'hover:bg-[#3A3E55] text-[#B0B5C9]'
                  : 'hover:bg-gray-100 text-[#6F7689]'
              }`}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${moduloSelecionado.cor}20` }}
            >
              <Icon className="w-6 h-6" style={{ color: moduloSelecionado.cor }} />
            </div>
            <div>
              <h1 className={`text-2xl font-semibold ${
                isDarkMode ? 'text-white' : 'text-[#2A2E45]'
              }`}>
                {moduloSelecionado.titulo}
              </h1>
              <p className={`text-sm mt-1 ${
                isDarkMode ? 'text-[#B0B5C9]' : 'text-[#8A8FA6]'
              }`}>
                {moduloSelecionado.descricao}
              </p>
            </div>
          </div>
        </div>

        {/* Tópicos */}
        <div className="space-y-6">
          {moduloSelecionado.topicos.map((topico, index) => (
            <div
              key={index}
              className={`rounded-lg border p-6 ${
                isDarkMode
                  ? 'bg-[#2A2E45] border-[#3A3E55]'
                  : 'bg-white border-[#E4E9F2]'
              }`}
            >
              {/* Título do tópico */}
              <div className="flex items-start gap-3 mb-4">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1"
                  style={{ backgroundColor: `${moduloSelecionado.cor}20` }}
                >
                  <span className="font-bold text-sm" style={{ color: moduloSelecionado.cor }}>
                    {index + 1}
                  </span>
                </div>
                <div className="flex-1">
                  <h2 className={`text-xl font-semibold ${
                    isDarkMode ? 'text-white' : 'text-[#2A2E45]'
                  }`}>
                    {topico.titulo}
                  </h2>
                </div>
              </div>

              {/* Conteúdo */}
              {topico.conteudo && (
                <p className={`mb-4 ${
                  isDarkMode ? 'text-[#B0B5C9]' : 'text-[#6F7689]'
                }`}>
                  {topico.conteudo}
                </p>
              )}

              {/* Passos */}
              {topico.passos && topico.passos.length > 0 && (
                <div className="space-y-3 mb-4">
                  {topico.passos.map((passo, passoIndex) => (
                    <div key={passoIndex} className="flex items-start gap-3">
                      <CheckCircle2 className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                        isDarkMode ? 'text-[#4A90E2]' : 'text-[#1570FF]'
                      }`} />
                      <span className={`text-sm ${
                        isDarkMode ? 'text-[#B0B5C9]' : 'text-[#2A2E45]'
                      }`}>
                        {passo}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Fonte de Dados */}
              {topico.fonteDados && (
                <div className={`mt-6 pt-6 border-t ${
                  isDarkMode ? 'border-[#3A3E55]' : 'border-[#E4E9F2]'
                }`}>
                  <div className="flex items-center gap-2 mb-4">
                    <Database className={`w-5 h-5 ${
                      isDarkMode ? 'text-[#4A90E2]' : 'text-[#1570FF]'
                    }`} />
                    <h3 className={`font-semibold ${
                      isDarkMode ? 'text-white' : 'text-[#2A2E45]'
                    }`}>
                      Fonte dos Dados
                    </h3>
                  </div>

                  <div className={`rounded-lg p-4 space-y-2 ${
                    isDarkMode ? 'bg-[#1A1D21]' : 'bg-[#F7F9FC]'
                  }`}>
                    {Object.entries(topico.fonteDados).map(([chave, valor]) => (
                      <div key={chave} className="flex">
                        <span className={`text-sm font-medium min-w-[140px] ${
                          isDarkMode ? 'text-[#8A8FA6]' : 'text-[#6F7689]'
                        }`}>
                          {chave.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())}:
                        </span>
                        <span className={`text-sm font-mono ${
                          isDarkMode ? 'text-[#B0B5C9]' : 'text-[#2A2E45]'
                        }`}>
                          {Array.isArray(valor) ? valor.join(', ') : valor}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Botão de Ação */}
        <div className={`rounded-lg border p-6 ${
          isDarkMode
            ? 'bg-[#2A2E45] border-[#3A3E55]'
            : 'bg-white border-[#E4E9F2]'
        }`}>
          <div className="flex items-start gap-4">
            <Info className={`w-6 h-6 flex-shrink-0 ${
              isDarkMode ? 'text-[#4A90E2]' : 'text-[#1570FF]'
            }`} />
            <div className="flex-1">
              <h3 className={`font-semibold mb-2 ${
                isDarkMode ? 'text-white' : 'text-[#2A2E45]'
              }`}>
                Pronto para experimentar?
              </h3>
              <p className={`text-sm mb-4 ${
                isDarkMode ? 'text-[#B0B5C9]' : 'text-[#8A8FA6]'
              }`}>
                Agora que você aprendeu como funciona esta seção, que tal experimentar na prática?
              </p>
              <button
                onClick={() => {
                  setModuloSelecionado(null);
                  navigate('/');
                }}
                className="flex items-center gap-2 bg-[#1570FF] text-white px-4 py-2 rounded-lg hover:bg-[#0D4FB8] transition-colors"
              >
                <Play className="w-4 h-4" />
                Ir para o Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`min-h-screen relative overflow-hidden ${
      isDarkMode ? 'bg-[#212529]' : 'bg-[#FAFBFD]'
    }`}>
      {/* Background Animado */}
      <div className="fixed inset-0 z-0 opacity-30">
        <FloatingLines
          linesGradient={
            isDarkMode
              ? ['#1570FF', '#4A90E2', '#6BA3E8']
              : ['#1570FF', '#3B82F6', '#60A5FA']
          }
          enabledWaves={['bottom', 'middle', 'top']}
          lineCount={[5, 4, 5]}
          lineDistance={[41.5, 45, 38]}
          topWavePosition={{ x: 10.0, y: 0.5, rotate: -0.4 }}
          middleWavePosition={{ x: 5.0, y: 0.0, rotate: 0.2 }}
          bottomWavePosition={{ x: 2.0, y: -0.7, rotate: 0.4 }}
          animationSpeed={0.8}
          interactive={true}
          bendRadius={5.0}
          bendStrength={-0.5}
          mouseDamping={0.08}
          parallax={true}
          parallaxStrength={0.15}
          mixBlendMode="screen"
        />
      </div>

      {/* Conteúdo */}
      <div className="relative z-10 max-w-7xl mx-auto p-6">
        {moduloSelecionado ? renderConteudoModulo() : renderListaModulos()}
      </div>
    </div>
  );
}