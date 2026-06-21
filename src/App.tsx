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
      <aside className="hidden md:flex w-64 bg-brand-dark text-slate-300 flex-col shrink-0 border-r border-brand-darker/60 h-screen sticky top-0 z-30">
        {/* Branding */}
        <div className="p-6 flex items-center gap-3 border-b border-brand-darker/40 shrink-0">
          <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center bg-brand-primary shadow-md shrink-0 border border-brand-primary/30">
            <img src="https://i.imgur.com/c5XQ7TW.jpeg" className="w-full h-full object-cover" alt="Logo" referrerPolicy="no-referrer" />
          </div>
          <div className="overflow-hidden">
            <span className="text-white font-bold text-base tracking-tight block">InstaFlow</span>
            <span className="text-[10px] text-brand-primary font-medium block truncate">Instagram Control Center</span>
          </div>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          <button
            onClick={() => setCurrentScreen('dashboard')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide text-left transition-all ${
              currentScreen === 'dashboard'
                ? 'bg-brand-secondary text-brand-darker shadow-md shadow-brand-secondary/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 shrink-0" />
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => setCurrentScreen('criar')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide text-left transition-all ${
              currentScreen === 'criar'
                ? 'bg-brand-secondary text-brand-darker shadow-md shadow-brand-secondary/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <PlusCircle className="w-4 h-4 shrink-0" />
            <span>Criar Postagem</span>
          </button>

          <button
            onClick={() => setCurrentScreen('aprovacao')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
              currentScreen === 'aprovacao'
                ? 'bg-brand-secondary text-brand-darker shadow-md shadow-brand-secondary/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span className="flex items-center gap-3 min-w-0">
              <ClipboardCheck className="w-4 h-4 shrink-0" />
              <span className="truncate">Moderação</span>
            </span>
            {pendingBadge > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold shrink-0 ${
                currentScreen === 'aprovacao' ? 'bg-brand-darker text-brand-primary' : 'bg-amber-500 text-white'
              }`}>
                {pendingBadge}
              </span>
            )}
          </button>

          <button
            onClick={() => setCurrentScreen('historico')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide text-left transition-all ${
              currentScreen === 'historico'
                ? 'bg-brand-secondary text-brand-darker shadow-md shadow-brand-secondary/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <History className="w-4 h-4 shrink-0" />
            <span>Histórico</span>
          </button>

          <button
            onClick={() => setCurrentScreen('config')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide text-left transition-all ${
              currentScreen === 'config'
                ? 'bg-brand-secondary text-brand-darker shadow-md shadow-brand-secondary/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Settings className="w-4 h-4 shrink-0" />
            <span>Parâmetros</span>
          </button>

          <button
            onClick={() => setCurrentScreen('logs')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide text-left transition-all ${
              currentScreen === 'logs'
                ? 'bg-brand-secondary text-brand-darker shadow-md shadow-brand-secondary/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Terminal className="w-4 h-4 shrink-0" />
            <span>Fila Logs</span>
          </button>
        </nav>

        {/* User Card at the Bottom of Sidebar */}
        <div className="p-4 border-t border-brand-darker/40 relative bg-brand-darker/60 shrink-0">
          <button
            onClick={() => setProfileDropdown(!profileDropdown)}
            className="w-full flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg text-left transition-colors outline-none cursor-pointer"
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white uppercase shrink-0 ${
              currentProfile === 'ADMINISTRADOR' ? 'bg-brand-secondary' : 'bg-amber-600'
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
              <div className="w-8 h-8 rounded-lg overflow-hidden bg-brand-primary flex items-center justify-center shadow-sm shrink-0">
                <img src="https://i.imgur.com/c5XQ7TW.jpeg" className="w-full h-full object-cover" alt="Logo" referrerPolicy="no-referrer" />
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
            <div className="flex items-center gap-2 bg-brand-light text-brand-secondary px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold border border-brand-primary/20 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-brand-secondary animate-pulse"></span>
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

        {/* MAIN BODY WORKSPACE */}
        <main className="flex-1 p-4 sm:p-8 pb-24 md:pb-8 overflow-y-auto">
          {renderActiveScreen()}
        </main>

        {/* MOBILE BOTTOM NAVIGATION BAR */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-200/80 px-2 flex items-center justify-around z-40 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] pb-safe">
          <button
            onClick={() => setCurrentScreen('dashboard')}
            className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] font-bold focus:outline-none transition-colors ${
              currentScreen === 'dashboard' ? 'text-brand-secondary' : 'text-slate-450'
            }`}
            style={{ minHeight: '48px' }}
          >
            <LayoutDashboard className="w-5 h-5 mb-0.5" />
            <span>Painel</span>
          </button>
          
          <button
            onClick={() => setCurrentScreen('criar')}
            className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] font-bold focus:outline-none transition-colors ${
              currentScreen === 'criar' ? 'text-brand-secondary' : 'text-slate-450'
            }`}
            style={{ minHeight: '48px' }}
          >
            <PlusCircle className="w-5 h-5 mb-0.5" />
            <span>Criar</span>
          </button>
          
          <button
            onClick={() => setCurrentScreen('aprovacao')}
            className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] font-bold focus:outline-none transition-colors relative ${
              currentScreen === 'aprovacao' ? 'text-brand-secondary' : 'text-slate-450'
            }`}
            style={{ minHeight: '48px' }}
          >
            <ClipboardCheck className="w-5 h-5 mb-0.5" />
            <span>Moderar</span>
            {pendingBadge > 0 && (
              <span className="absolute top-2.5 right-3 w-4 h-4 bg-amber-500 text-white rounded-full text-[9px] flex items-center justify-center font-bold border border-white">
                {pendingBadge}
              </span>
            )}
          </button>
          
          <button
            onClick={() => setCurrentScreen('historico')}
            className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] font-bold focus:outline-none transition-colors ${
              currentScreen === 'historico' ? 'text-brand-secondary' : 'text-slate-450'
            }`}
            style={{ minHeight: '48px' }}
          >
            <History className="w-5 h-5 mb-0.5" />
            <span>Histórico</span>
          </button>
          
          <button
            onClick={() => setCurrentScreen('config')}
            className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] font-bold focus:outline-none transition-colors ${
              currentScreen === 'config' ? 'text-brand-secondary' : 'text-slate-450'
            }`}
            style={{ minHeight: '48px' }}
          >
            <Settings className="w-5 h-5 mb-0.5" />
            <span>Params</span>
          </button>
          
          <button
            onClick={() => setCurrentScreen('logs')}
            className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] font-bold focus:outline-none transition-colors ${
              currentScreen === 'logs' ? 'text-brand-secondary' : 'text-slate-450'
            }`}
            style={{ minHeight: '48px' }}
          >
            <Terminal className="w-5 h-5 mb-0.5" />
            <span>Logs</span>
          </button>
        </div>

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
