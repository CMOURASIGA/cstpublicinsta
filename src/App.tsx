import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import CreatePost from './components/CreatePost';
import ApproveList from './components/ApproveList';
import HistoryList from './components/HistoryList';
import SettingsSync from './components/SettingsSync';
import SimulatorLogs from './components/SimulatorLogs';
import { 
  Instagram, LayoutDashboard, PlusCircle, ClipboardCheck, History, 
  Settings, Terminal, User, ShieldCheck, HelpCircle, CheckCircle, ChevronDown, RefreshCw
} from 'lucide-react';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<string>('dashboard');
  
  // Profile simulation switch support
  // 'USUARIO' (Juliana Santos) vs 'ADMINISTRADOR' (Carlos Moura)
  const [currentProfile, setCurrentProfile] = useState<'USUARIO' | 'ADMINISTRADOR'>('ADMINISTRADOR');
  const [profileDropdown, setProfileDropdown] = useState(false);
  const [scheduledCheckTimer, setScheduledCheckTimer] = useState<number | null>(null);

  // Status counters for sidebar/header notifications badge
  const [pendingBadge, setPendingBadge] = useState<number>(0);

  const fetchBadgeCount = () => {
    fetch('/api/posts')
      .then(res => res.json())
      .then(data => {
        if (data.posts) {
          const pending = data.posts.filter((p: any) => p.status === 'PENDENTE');
          setPendingBadge(pending.length);
        }
      })
      .catch(err => console.error(err));
  };

  const handleSimulateTick = async (): Promise<number> => {
    try {
      const res = await fetch('/api/simulate-tick', { method: 'POST' });
      const data = await res.json();
      fetchBadgeCount();
      return data.processedCount || 0;
    } catch (err) {
      console.error(err);
      return 0;
    }
  };

  useEffect(() => {
    fetchBadgeCount();
    // Auto badges check updates
    const badgeInterval = setInterval(fetchBadgeCount, 5000);
    
    // Auto clock tick checking simulation every 15s
    const tickInterval = setInterval(handleSimulateTick, 15000);

    return () => {
      clearInterval(badgeInterval);
      clearInterval(tickInterval);
    };
  }, []);

  const getProfileName = () => {
    return currentProfile === 'ADMINISTRADOR' ? 'Carlos Moura (Admin)' : 'Juliana Santos (User)';
  };

  const renderActiveScreen = () => {
    switch (currentScreen) {
      case 'dashboard':
        return (
          <Dashboard 
            onNavigate={(screen) => setCurrentScreen(screen)} 
            onSimulateTick={handleSimulateTick}
          />
        );
      case 'criar':
        return (
          <CreatePost 
            currentUser={getProfileName()} 
            onPostCreated={() => {
              fetchBadgeCount();
              setCurrentScreen('dashboard');
            }}
          />
        );
      case 'aprovacao':
        if (currentProfile !== 'ADMINISTRADOR') {
          return (
            <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-xl mx-auto shadow-sm text-center space-y-4 my-10">
              <ShieldCheck className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-base font-bold text-slate-800">Acesso Reservado ao Administrador</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                A moderação de conteúdos, ajustes, re-agendamento e publicação via Instagram Graph API é de responsabilidade de <strong>Carlos Moura (Admin)</strong>.
              </p>
              <div className="pt-2">
                <button
                  onClick={() => {
                    setCurrentProfile('ADMINISTRADOR');
                    fetchBadgeCount();
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow transition-colors"
                >
                  Mudar de Perfil (Ser Carlos Moura)
                </button>
              </div>
            </div>
          );
        }
        return (
          <ApproveList 
            currentUser={getProfileName()} 
            onWorkflowComplete={() => {
              fetchBadgeCount();
              setCurrentScreen('dashboard');
            }}
          />
        );
      case 'historico':
        return <HistoryList />;
      case 'config':
        return <SettingsSync onSettingsSaved={fetchBadgeCount} />;
      case 'logs':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold font-sans text-slate-800">Terminal do Simulador</h2>
              <p className="text-xs text-slate-500 mt-1">Veja detalhadamente a comunicação de back-end REST e automação de agendamentos fictícios.</p>
            </div>
            <SimulatorLogs onSimulateTick={handleSimulateTick} />
          </div>
        );
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-800">
      
      {/* LEFT SIDEBAR - Desktop view */}
      <aside className="hidden md:flex w-64 bg-slate-900 text-slate-300 flex-col shrink-0 border-r border-slate-800 h-screen sticky top-0 z-30">
        {/* Branding */}
        <div className="p-6 flex items-center gap-3 border-b border-slate-800 shrink-0">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-sm font-bold shrink-0">
            <Instagram className="w-4 h-4 text-white" />
          </div>
          <div className="overflow-hidden">
            <span className="text-white font-bold text-base tracking-tight block">InstaFlow</span>
            <span className="text-[10px] text-slate-500 block truncate">Instagram Control Center</span>
          </div>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          <button
            onClick={() => setCurrentScreen('dashboard')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide text-left transition-all ${
              currentScreen === 'dashboard'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 shrink-0" />
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => setCurrentScreen('criar')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide text-left transition-all ${
              currentScreen === 'criar'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <PlusCircle className="w-4 h-4 shrink-0" />
            <span>Criar Postagem</span>
          </button>

          <button
            onClick={() => setCurrentScreen('aprovacao')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
              currentScreen === 'aprovacao'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span className="flex items-center gap-3 min-w-0">
              <ClipboardCheck className="w-4 h-4 shrink-0" />
              <span className="truncate">Moderação</span>
            </span>
            {pendingBadge > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold shrink-0 ${
                currentScreen === 'aprovacao' ? 'bg-white text-indigo-700' : 'bg-amber-500 text-white'
              }`}>
                {pendingBadge}
              </span>
            )}
          </button>

          <button
            onClick={() => setCurrentScreen('historico')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide text-left transition-all ${
              currentScreen === 'historico'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <History className="w-4 h-4 shrink-0" />
            <span>Histórico</span>
          </button>

          <button
            onClick={() => setCurrentScreen('config')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide text-left transition-all ${
              currentScreen === 'config'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Settings className="w-4 h-4 shrink-0" />
            <span>Parâmetros</span>
          </button>

          <button
            onClick={() => setCurrentScreen('logs')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide text-left transition-all ${
              currentScreen === 'logs'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Terminal className="w-4 h-4 shrink-0" />
            <span>Fila Logs</span>
          </button>
        </nav>

        {/* User Card at the Bottom of Sidebar */}
        <div className="p-4 border-t border-slate-800 relative bg-slate-950 shrink-0">
          <button
            onClick={() => setProfileDropdown(!profileDropdown)}
            className="w-full flex items-center gap-3 p-2 hover:bg-slate-800/80 rounded-lg text-left transition-colors outline-none cursor-pointer"
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white uppercase shrink-0 ${
              currentProfile === 'ADMINISTRADOR' ? 'bg-indigo-600' : 'bg-amber-600'
            }`}>
              {currentProfile[0]}
            </div>
            <div className="overflow-hidden flex-1">
              <p className="text-xs font-semibold text-white truncate leading-tight">
                {currentProfile === 'ADMINISTRADOR' ? 'Carlos Moura' : 'Juliana Santos'}
              </p>
              <p className="text-[10px] text-slate-450 font-medium uppercase mt-0.5 tracking-wide">
                {currentProfile === 'ADMINISTRADOR' ? 'Administrador' : 'Colaborador'}
              </p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          </button>

          {profileDropdown && (
            <div className="absolute left-4 right-4 bottom-16 bg-slate-905 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-1.5 z-55 z-50 text-xs text-slate-300">
              <span className="block px-3 py-1 text-[9px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-800/80 mb-1">
                Simulador de Perfis
              </span>
              <button
                onClick={() => {
                  setCurrentProfile('USUARIO');
                  setProfileDropdown(false);
                }}
                className={`w-full text-left px-3 py-2 hover:bg-slate-800/60 flex flex-col gap-0.5 ${
                  currentProfile === 'USUARIO' ? 'bg-slate-800 text-white' : ''
                }`}
              >
                <span className="font-semibold text-xs">Juliana Santos (User)</span>
                <span className="text-[10px] text-slate-400 font-normal">Cria mídias e conteúdo</span>
              </button>
              <button
                onClick={() => {
                  setCurrentProfile('ADMINISTRADOR');
                  setProfileDropdown(false);
                }}
                className={`w-full text-left px-3 py-2 hover:bg-slate-800/60 flex flex-col gap-0.5 ${
                  currentProfile === 'ADMINISTRADOR' ? 'bg-slate-800 text-white' : ''
                }`}
              >
                <span className="font-semibold text-xs">Carlos Moura (Admin)</span>
                <span className="text-[10px] text-slate-400 font-normal">Aprova & publica posts</span>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* RIGHT MAIN CONTAINER */}
      <div className="flex-1 flex flex-col min-h-screen">
        
        {/* TOP HEADER */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sm:px-8 shrink-0 sticky top-0 z-20 shadow-sm md:shadow-none">
          <div className="flex items-center gap-3">
            {/* Logo display on mobile */}
            <div className="flex md:hidden items-center gap-2.5 cursor-pointer" onClick={() => setCurrentScreen('dashboard')}>
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold shrink-0">
                <Instagram className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-sm text-slate-850 tracking-tight">InstaFlow</span>
            </div>

            <h1 className="hidden md:block text-xl font-bold text-slate-800 font-sans">
              {currentScreen === 'dashboard' && 'Dashboard'}
              {currentScreen === 'criar' && 'Criar Postagem'}
              {currentScreen === 'aprovacao' && 'Moderação e Fluxos'}
              {currentScreen === 'historico' && 'Histórico de Atividade'}
              {currentScreen === 'config' && 'Mapeamento de Integrações'}
              {currentScreen === 'logs' && 'Logs de Auditoria'}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Instagram status badge */}
            <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-[10px] sm:text-xs font-semibold border border-emerald-100 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Instagram API: Conectado</span>
            </div>

            {/* Profile trigger on mobile only */}
            <div className="md:hidden relative">
              <button
                onClick={() => setProfileDropdown(!profileDropdown)}
                className="flex items-center gap-1 bg-slate-100 border border-slate-200 py-1.5 px-2.5 rounded-lg text-xs font-bold text-slate-700 outline-none"
              >
                <span>{currentProfile === 'ADMINISTRADOR' ? 'Carlos' : 'Juliana'}</span>
                <ChevronDown className="w-3 h-3 text-slate-500" />
              </button>
              {profileDropdown && (
                <div className="absolute right-0 mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-50 text-xs">
                  <button
                    onClick={() => {
                      setCurrentProfile('USUARIO');
                      setProfileDropdown(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 font-semibold"
                  >
                    Juliana Santos (User)
                  </button>
                  <button
                    onClick={() => {
                      setCurrentProfile('ADMINISTRADOR');
                      setProfileDropdown(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 font-semibold"
                  >
                    Carlos Moura (Admin)
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* MOBILE NAVIGATION */}
        <div className="md:hidden bg-slate-900 border-b border-slate-800 px-4 py-2 flex items-center justify-around gap-1 overflow-x-auto text-[10px] font-bold text-slate-400">
          <button
            onClick={() => setCurrentScreen('dashboard')}
            className={`px-2.5 py-1 rounded transition-all shrink-0 ${
              currentScreen === 'dashboard' ? 'bg-indigo-600 text-white font-bold' : ''
            }`}
          >
            Painel
          </button>
          <button
            onClick={() => setCurrentScreen('criar')}
            className={`px-2.5 py-1 rounded transition-all shrink-0 ${
              currentScreen === 'criar' ? 'bg-indigo-600 text-white font-bold' : ''
            }`}
          >
            Criar
          </button>
          <button
            onClick={() => setCurrentScreen('aprovacao')}
            className={`px-2.5 py-1 rounded transition-all shrink-0 relative ${
              currentScreen === 'aprovacao' ? 'bg-indigo-600 text-white font-bold' : ''
            }`}
          >
            Moderar
            {pendingBadge > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-500 text-white rounded-full text-[8px] flex items-center justify-center font-bold">
                {pendingBadge}
              </span>
            )}
          </button>
          <button
            onClick={() => setCurrentScreen('historico')}
            className={`px-2.5 py-1 rounded transition-all shrink-0 ${
              currentScreen === 'historico' ? 'bg-indigo-600 text-white font-bold' : ''
            }`}
          >
            Histórico
          </button>
          <button
            onClick={() => setCurrentScreen('config')}
            className={`px-2.5 py-1 rounded transition-all shrink-0 ${
              currentScreen === 'config' ? 'bg-indigo-600 text-white font-bold' : ''
            }`}
          >
            Params
          </button>
          <button
            onClick={() => setCurrentScreen('logs')}
            className={`px-2.5 py-1 rounded transition-all shrink-0 ${
              currentScreen === 'logs' ? 'bg-indigo-600 text-white font-bold' : ''
            }`}
          >
            Logs
          </button>
        </div>

        {/* MAIN BODY WORKSPACE */}
        <main className="flex-1 p-4 sm:p-8 overflow-y-auto">
          {renderActiveScreen()}
        </main>

        {/* App Footer */}
        <footer className="bg-white border-t border-slate-200/80 text-center py-4 text-[10px] text-slate-400 mt-auto shrink-0">
          <div className="px-6 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span>© 2026 InstaFlow Manager — Gestão de Ativos Corporativos.</span>
            <span className="flex items-center gap-1.5">
              Sincronizado com <strong className="text-slate-600 font-semibold">Instagram API v18.0</strong> e <strong className="text-slate-600 font-semibold">Google Drive Cloud SDK</strong>
            </span>
          </div>
        </footer>

      </div>

    </div>
  );
}
