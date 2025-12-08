import { useState } from "react";
import {
  ChevronDown,
  Home,
  Map,
  Search,
  Settings,
  Bell,
  Moon,
  Globe,
  HelpCircle,
  BookOpen,
  Wrench,
  BarChart3,
} from "lucide-react";
import ElectionChart from "../components/ElectionChart";

export default function Dashboard() {
  const [currentScreen, setCurrentScreen] = useState("home");
  const [selectedRound, setSelectedRound] = useState(1);

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

  const moreItems = [
    { icon: Globe, label: "Idioma" },
    { icon: Moon, label: "Modo Escuro" },
    { icon: BookOpen, label: "Aprender" },
    { icon: HelpCircle, label: "Centro de Ajuda" },
    { icon: Wrench, label: "Suporte" },
  ];

  const handleNavigation = (screenId) => {
    setCurrentScreen(screenId);
  };

  const renderEmptyScreen = (title, description) => {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-24 h-24 bg-[#EDF3FF] rounded-full flex items-center justify-center mx-auto mb-4">
            <div className="w-12 h-12 bg-[#1570FF] rounded-full opacity-20"></div>
          </div>
          <h2 className="text-2xl font-semibold text-[#2A2E45] mb-2">
            {title}
          </h2>
          <p className="text-[#8A8FA6] max-w-md">{description}</p>
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
            <h1 className="text-2xl font-semibold text-[#2A2E45]">
              Eleição Presidencial 2022
            </h1>
            <p className="text-sm text-[#8A8FA6] mt-1">
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
                  : "bg-white text-[#6F7689] border border-[#E4E9F2] hover:border-[#1570FF]"
              }`}
            >
              2º Turno
            </button>
          </div>
        </div>

        {/* Gráfico */}
        <div className="flex-1 bg-white rounded-lg border border-[#E4E9F2] shadow-sm min-h-[400px]">
          <ElectionChart round={selectedRound} />
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border border-[#E4E9F2] p-4">
            <div className="text-[#8A8FA6] text-sm mb-1">Total de Votos</div>
            <div className="text-2xl font-semibold text-[#2A2E45]">
              {selectedRound === 1 ? "156M" : "121M"}
            </div>
          </div>
          <div className="bg-white rounded-lg border border-[#E4E9F2] p-4">
            <div className="text-[#8A8FA6] text-sm mb-1">Turno</div>
            <div className="text-2xl font-semibold text-[#2A2E45]">
              {selectedRound === 1 ? "Primeiro" : "Segundo"}
            </div>
          </div>
          <div className="bg-white rounded-lg border border-[#E4E9F2] p-4">
            <div className="text-[#8A8FA6] text-sm mb-1">Ano</div>
            <div className="text-2xl font-semibold text-[#2A2E45]">2022</div>
          </div>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    switch (currentScreen) {
      case "home":
        return renderEmptyScreen(
          "Bem-vindo ao Home",
          "Esta é a tela inicial da sua dashboard. Adicione aqui o conteúdo que desejar.",
        );
      case "elections":
        return renderElectionsScreen();
      case "map":
        return renderEmptyScreen(
          "Tela do Mapa",
          "Aqui você pode adicionar seu componente de mapa e funcionalidades relacionadas.",
        );
      case "search":
        return renderEmptyScreen(
          "Tela de Pesquisa",
          "Configure aqui suas funcionalidades de busca e filtros.",
        );
      case "settings":
        return renderEmptyScreen(
          "Configurações",
          "Adicione aqui as opções de configuração do seu sistema.",
        );
      default:
        return renderEmptyScreen(
          "Dashboard",
          "Selecione uma opção no menu lateral",
        );
    }
  };

  return (
    <div className="flex h-screen bg-white font-inter">
      {/* Left Sidebar */}
      <div className="w-60 bg-[#F7F9FC] flex flex-col">
        {/* User Card */}
        <div className="m-4 mb-6">
          <div className="bg-white rounded border border-[#E4E9F2] h-[72px] flex items-center px-4">
            <div className="w-8 h-8 bg-[#EDF3FF] rounded-full flex items-center justify-center text-[#1570FF] font-semibold text-sm">
              U
            </div>
            <div className="ml-3 flex-1">
              <div className="font-semibold text-sm text-[#2A2E45]">
                Usuário
              </div>
              <div className="text-[11px] text-[#8A8FA6]">
                usuario@email.com
              </div>
            </div>
            <ChevronDown className="w-3 h-3 text-[#8A8FA6]" />
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 px-4">
          <div className="text-[11px] font-semibold text-[#8A8FA6] uppercase tracking-wider py-2">
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
            <div className="text-[11px] font-semibold text-[#8A8FA6] uppercase tracking-wider py-2">
              Mais
            </div>

            <div className="space-y-1">
              {moreItems.map((item, index) => (
                <div
                  key={index}
                  className="h-9 flex items-center px-3 rounded cursor-pointer text-[#2A2E45] hover:bg-[#EDF3FF] transition-colors"
                >
                  <item.icon className="w-4 h-4 mr-3 text-[#6F7689]" />
                  <span className="text-sm">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4">
          <div className="text-[11px] text-[#8A8FA6] text-center">
            © 2024 Minha Dashboard
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div className="h-14 bg-white border-b border-[#E4E9F2] flex items-center px-6">
          {/* Brand */}
          <div className="font-bold text-base text-[#2A2E45] mr-8">
            Dashboard
          </div>

          {/* Current Screen Title */}
          <div className="flex-1">
            <h1 className="text-sm text-[#6F7689] capitalize">
              {navItems.find((item) => item.id === currentScreen)?.label ||
                "Dashboard"}
            </h1>
          </div>

          {/* Right Controls */}
          <div className="flex items-center space-x-3">
            <button className="w-8 h-8 bg-white border border-[#E4E9F2] rounded-full flex items-center justify-center hover:bg-[#EDF3FF] transition-colors">
              <Bell className="w-4 h-4 text-[#6F7689]" />
            </button>
            <button className="w-8 h-8 bg-white border border-[#E4E9F2] rounded-full flex items-center justify-center hover:bg-[#EDF3FF] transition-colors">
              <Settings className="w-4 h-4 text-[#6F7689]" />
            </button>
            <div className="w-8 h-8 bg-[#EDF3FF] rounded-full flex items-center justify-center text-[#1570FF] font-semibold text-sm">
              U
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-[#FAFBFD] overflow-auto">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}