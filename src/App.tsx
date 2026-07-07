import React, { useEffect, useState } from 'react';
import Dashboard from './components/Dashboard';
import AdminDashboard from './components/AdminDashboard';
import CreatePostEntry from './components/CreatePostEntry';
import ApproveList from './components/ApproveList';
import HistoryList from './components/HistoryList';
import ClientsManagement from './components/ClientsManagement';
import ClientUsersManagement from './components/ClientUsersManagementV2';
import SettingsSync from './components/SettingsSync';
import SimulatorLogs from './components/SimulatorLogsV2';
import LoginScreen from './components/LoginScreen';
import { Cliente, PerfilPublicacao, Usuario } from './types';
import { apiFetch } from './lib/api';
import { getSupabaseClient } from './lib/supabase';
import { LOGOS } from './lib/branding';
import { getStoredActiveClient, getStoredActiveClientId, setStoredActiveClient } from './lib/client-store';
import { ActiveClientProvider } from './context/ActiveClientContext';
import {
  LayoutDashboard,
  PlusCircle,
  ClipboardCheck,
  History,
  Settings,
  Terminal,
  ChevronDown,
  LogOut,
  Users,
  Building2,
} from 'lucide-react';

type AppScreen = 'dashboard' | 'clientes' | 'criar' | 'aprovacao' | 'historico' | 'config' | 'usuarios' | 'logs';

function getScreenFromPath(pathname: string): AppScreen {
  if (pathname.startsWith('/admin/clientes')) return 'clientes';
  if (pathname.startsWith('/app/postagens/nova')) return 'criar';
  if (pathname.startsWith('/app/postagens')) return 'aprovacao';
  if (pathname.startsWith('/app/historico')) return 'historico';
  if (pathname.startsWith('/app/integracoes')) return 'config';
  if (pathname.startsWith('/app/usuarios')) return 'usuarios';
  if (pathname.startsWith('/admin/logs') || pathname.startsWith('/app/logs')) return 'logs';
  return 'dashboard';
}

function getPathForScreen(screen: AppScreen, isSuperAdmin: boolean): string {
  switch (screen) {
    case 'dashboard':
      return isSuperAdmin ? '/admin/dashboard' : '/app/dashboard';
    case 'clientes':
      return '/admin/clientes';
    case 'criar':
      return '/app/postagens/nova';
    case 'aprovacao':
      return '/app/postagens';
    case 'historico':
      return '/app/historico';
    case 'config':
      return '/app/integracoes';
    case 'usuarios':
      return '/app/usuarios';
    case 'logs':
      return isSuperAdmin ? '/admin/logs' : '/app/logs';
    default:
      return '/app/dashboard';
  }
}

function getRole(user: Usuario | null): PerfilPublicacao {
  if (!user) return 'CRIADOR';
  return user.perfil_publicacao || (user.perfil === 'ADMINISTRADOR' ? 'ADMIN' : 'CRIADOR');
}

function getRoleLabel(role: PerfilPublicacao) {
  if (role === 'SUPER_ADMIN') return 'Super Admin';
  if (role === 'ADMIN') return 'Administrador';
  if (role === 'ADMIN_CLIENTE') return 'Admin do Cliente';
  if (role === 'APROVADOR') return 'Aprovador';
  if (role === 'VISUALIZADOR') return 'Visualizador';
  return 'Criador';
}

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>(() =>
    typeof window === 'undefined' ? 'dashboard' : getScreenFromPath(window.location.pathname),
  );
  const [currentUser, setCurrentUser] = useState<Usuario | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileDropdown, setProfileDropdown] = useState(false);
  const [pendingBadge, setPendingBadge] = useState<number>(0);
  const [availableClients, setAvailableClients] = useState<Cliente[]>([]);
  const [activeClient, setActiveClient] = useState<Cliente | null>(getStoredActiveClient());

  const currentRole = getRole(currentUser);
  const canCreate = currentRole === 'CRIADOR' || currentRole === 'ADMIN' || currentRole === 'ADMIN_CLIENTE';
  const canApprove = currentRole === 'APROVADOR' || currentRole === 'ADMIN' || currentRole === 'ADMIN_CLIENTE';
  const canManageUsers = currentRole === 'ADMIN' || currentRole === 'SUPER_ADMIN' || currentRole === 'ADMIN_CLIENTE';
  const canEditSettings = currentRole === 'SUPER_ADMIN' || currentRole === 'ADMIN' || currentRole === 'ADMIN_CLIENTE';
  const isSuperAdmin = currentRole === 'SUPER_ADMIN';
  const canSeeClients = isSuperAdmin;
  const mobileNavColumns = 4 + Number(canSeeClients) + Number(canCreate) + Number(canApprove) + Number(canManageUsers);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const suffix =
      currentScreen === 'dashboard'
        ? isSuperAdmin
          ? 'Visão Global'
          : 'Dashboard'
        : currentScreen === 'criar'
          ? 'Criar Postagem'
          : currentScreen === 'clientes'
            ? 'Clientes'
            : currentScreen === 'aprovacao'
              ? 'Moderação'
              : currentScreen === 'historico'
                ? 'Histórico'
                : currentScreen === 'config'
                  ? 'Parâmetros'
                  : currentScreen === 'usuarios'
                    ? 'Usuários'
                    : 'Logs';
    document.title = `Consult Flow${suffix ? ` | ${suffix}` : ''}`;
  }, [currentScreen, isSuperAdmin]);

  const navigateToScreen = (screen: AppScreen, replace = false) => {
    setCurrentScreen(screen);
    if (typeof window === 'undefined') return;
    const nextPath = getPathForScreen(screen, isSuperAdmin);
    if (window.location.pathname === nextPath) return;
    const method = replace ? 'replaceState' : 'pushState';
    window.history[method]({}, '', nextPath);
  };

  const loadClients = async () => {
    try {
      const res = await apiFetch('/api/clientes');
      const data = await res.json();
      const clients = (data.clientes || []) as Cliente[];
      setAvailableClients(clients);

      if (!clients.length) {
        setActiveClient(null);
        setStoredActiveClient(null);
        return;
      }

      const storedId = getStoredActiveClientId();
      const storedMatch = clients.find((client) => client.id === storedId);
      const fallbackClient = getStoredActiveClient();
      const nextClient = storedMatch || clients.find((client) => client.id === fallbackClient?.id) || clients[0];
      setActiveClient(nextClient);
      setStoredActiveClient(nextClient);
    } catch (err) {
      console.error(err);
    }
  };

  const loadCurrentUser = async () => {
    const res = await apiFetch('/api/auth/me');
    const data = await res.json();

    if (!res.ok || !data.user) {
      throw new Error(data.error || 'Falha ao carregar o usuário autenticado.');
    }

    setCurrentUser(data.user as Usuario);
  };

  const fetchBadgeCount = () => {
    apiFetch('/api/posts')
      .then((res) => res.json())
      .then((data) => {
        if (data.posts) {
          const pending = data.posts.filter((post: { status: string }) => post.status === 'PENDENTE');
          setPendingBadge(pending.length);
        }
      })
      .catch((err) => console.error(err));
  };

  const handleSimulateTick = async (): Promise<number> => {
    try {
      const res = await apiFetch('/api/simulate-tick', { method: 'POST' });
      const data = await res.json();
      fetchBadgeCount();
      return data.processedCount || 0;
    } catch (err) {
      console.error(err);
      return 0;
    }
  };

  const handleClientChange = (clientId: string) => {
    const nextClient = availableClients.find((client) => client.id === clientId) || null;
    setActiveClient(nextClient);
    setStoredActiveClient(nextClient);
    setPendingBadge(0);
  };

  useEffect(() => {
    let active = true;
    let unsubscribe = () => undefined;

    const setupAuth = async () => {
      try {
        const supabase = await getSupabaseClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session) {
          await loadCurrentUser();
          await loadClients();
        }

        const subscription = supabase.auth.onAuthStateChange((_event, nextSession) => {
          if (!active) return;

          if (!nextSession) {
            setCurrentUser(null);
            navigateToScreen('dashboard', true);
            setProfileDropdown(false);
            setPendingBadge(0);
            return;
          }

          void loadCurrentUser().catch((err) => {
            console.error(err);
            setCurrentUser(null);
          });
          void loadClients().catch((err) => console.error(err));
        });

        unsubscribe = () => subscription.data.subscription.unsubscribe();
      } catch (err) {
        console.error(err);
        setCurrentUser(null);
      } finally {
        if (active) {
          setAuthLoading(false);
        }
      }
    };

    void setupAuth();

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handlePopState = () => {
      setCurrentScreen(getScreenFromPath(window.location.pathname));
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (authLoading || !currentUser) return;
    navigateToScreen(currentScreen, true);
  }, [authLoading, currentUser?.id, currentScreen, isSuperAdmin]);

  useEffect(() => {
    if (!currentUser) return;

    fetchBadgeCount();
    const badgeInterval = setInterval(fetchBadgeCount, 5000);
    const tickInterval = setInterval(handleSimulateTick, 15000);

    return () => {
      clearInterval(badgeInterval);
      clearInterval(tickInterval);
    };
  }, [currentUser?.id]);

  const handleLogin = async () => {
    await loadCurrentUser();
    await loadClients();
  };

  const handleLogout = async () => {
    const supabase = await getSupabaseClient();
    await supabase.auth.signOut();
    setCurrentUser(null);
    setProfileDropdown(false);
    navigateToScreen('dashboard', true);
    setActiveClient(null);
    setStoredActiveClient(null);
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-sm text-slate-200">
        Carregando autenticação...
      </div>
    );
  }

  if (!currentUser) {
    return <LoginScreen onLoggedIn={handleLogin} />;
  }

  const renderActiveScreen = () => {
    switch (currentScreen) {
      case 'dashboard':
        return isSuperAdmin ? (
          <AdminDashboard onNavigate={(screen) => navigateToScreen(screen as AppScreen)} />
        ) : (
          <Dashboard onNavigate={(screen) => navigateToScreen(screen as AppScreen)} onSimulateTick={handleSimulateTick} />
        );
      case 'clientes':
        if (!isSuperAdmin) {
          return (
            <div className="my-10 mx-auto max-w-xl rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <h3 className="text-base font-bold text-slate-800">Acesso restrito</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">A lista de clientes é exclusiva do super admin.</p>
            </div>
          );
        }
        return (
          <ClientsManagement
            onSelectClient={(client) => {
              handleClientChange(client.id);
              navigateToScreen('config');
            }}
          />
        );
      case 'criar':
        if (!canCreate) {
          return (
            <div className="my-10 mx-auto max-w-xl rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <h3 className="text-base font-bold text-slate-800">Acesso restrito</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                O usuário atual não possui permissão para criar publicações. Entre com um perfil Criador ou Administrador.
              </p>
            </div>
          );
        }
        return (
          <CreatePostEntry
            currentUser={currentUser}
            onPostCreated={() => {
              fetchBadgeCount();
            }}
          />
        );
      case 'aprovacao':
        if (!canApprove) {
          return (
            <div className="my-10 mx-auto max-w-xl rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <h3 className="text-base font-bold text-slate-800">Acesso restrito</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                O usuário atual não possui permissão para aprovar ou publicar. Entre com um perfil Aprovador ou Administrador.
              </p>
            </div>
          );
        }
        return (
          <ApproveList
            currentUser={currentUser}
            onWorkflowComplete={() => {
              fetchBadgeCount();
              navigateToScreen('dashboard');
            }}
          />
        );
      case 'historico':
        return <HistoryList />;
      case 'config':
        return (
          <SettingsSync
            activeClient={activeClient}
            availableClients={availableClients}
            onSelectClient={(client) => handleClientChange(client.id)}
            onSettingsSaved={fetchBadgeCount}
          />
        );
      case 'usuarios':
        if (!activeClient) {
          return (
            <div className="my-10 mx-auto max-w-xl rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <h3 className="text-base font-bold text-slate-800">Selecione um cliente</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">Os usuários são gerenciados dentro do contexto do cliente ativo.</p>
            </div>
          );
        }
        if (!(canManageUsers || isSuperAdmin)) {
          return (
            <div className="my-10 mx-auto max-w-xl rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <h3 className="text-base font-bold text-slate-800">Acesso restrito</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                Apenas administradores podem alterar usuários e perfis operacionais.
              </p>
            </div>
          );
        }
        return <ClientUsersManagement activeClient={activeClient} />;
      case 'logs':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold font-sans text-slate-800">Terminal do Simulador</h2>
              <p className="mt-1 text-xs text-slate-500">Veja detalhadamente a comunicação de back-end REST e automação de agendamentos.</p>
            </div>
            <SimulatorLogs onSimulateTick={handleSimulateTick} activeClient={activeClient} isGlobalView={isSuperAdmin} />
          </div>
        );
      default:
        return <Dashboard onNavigate={(screen) => navigateToScreen(screen as AppScreen)} onSimulateTick={handleSimulateTick} />;
    }
  };

  const pageTitle =
    currentScreen === 'dashboard'
      ? (isSuperAdmin ? 'Visão Global' : 'Dashboard')
      : currentScreen === 'criar'
        ? 'Criar Postagem'
        : currentScreen === 'clientes'
          ? 'Clientes'
        : currentScreen === 'aprovacao'
          ? 'Moderação'
          : currentScreen === 'historico'
            ? 'Histórico'
            : currentScreen === 'config'
              ? 'Parâmetros'
              : currentScreen === 'usuarios'
                ? 'Usuários'
                : 'Logs';

  return (
    <ActiveClientProvider
      value={{
        activeClient,
        availableClients,
        setActiveClient: (client) => {
          setActiveClient(client);
          setStoredActiveClient(client);
          setPendingBadge(0);
        },
      }}
    >
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-800">
      <aside className="hidden md:flex w-72 bg-brand-dark text-slate-300 flex-col shrink-0 border-r border-brand-darker/60 h-screen sticky top-0 z-30">
        <div className="px-5 pt-5 pb-4 shrink-0 border-b border-brand-darker/40">
          <button
            type="button"
            onClick={() => navigateToScreen('dashboard')}
            className="mx-auto flex w-full max-w-[230px] flex-col items-center rounded-[28px] border border-white/10 bg-white px-5 py-5 text-center shadow-[0_18px_40px_rgba(0,0,0,0.18)] transition-transform hover:-translate-y-0.5"
            aria-label="Ir para o painel inicial"
          >
            <div className="flex h-32 w-32 items-center justify-center rounded-[30px] bg-slate-50 shadow-inner shadow-slate-300/40">
              <img src={LOGOS.squareMark} className="h-24 w-24 object-contain" alt="Consult Flow" referrerPolicy="no-referrer" />
            </div>
            <span className="mt-4 text-[12px] font-semibold uppercase tracking-[0.2em] text-slate-600">Consult Flow</span>
          </button>
        </div>

        <nav className="flex-1 px-4 py-5 space-y-1 overflow-y-auto">
          <button
            onClick={() => navigateToScreen('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold tracking-wide text-left transition-all ${
              currentScreen === 'dashboard' ? 'bg-brand-secondary text-brand-darker shadow-md shadow-brand-secondary/20' : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 shrink-0" />
            <span>{isSuperAdmin ? 'Visão Global' : 'Dashboard'}</span>
          </button>

          {canSeeClients && (
            <button
              onClick={() => navigateToScreen('clientes')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold tracking-wide text-left transition-all ${
                currentScreen === 'clientes' ? 'bg-brand-secondary text-brand-darker shadow-md shadow-brand-secondary/20' : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Building2 className="w-4 h-4 shrink-0" />
              <span>Clientes</span>
            </button>
          )}

          {canCreate && (
            <button
              onClick={() => navigateToScreen('criar')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold tracking-wide text-left transition-all ${
                currentScreen === 'criar' ? 'bg-brand-secondary text-brand-darker shadow-md shadow-brand-secondary/20' : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <PlusCircle className="w-4 h-4 shrink-0" />
              <span>Criar Postagem</span>
            </button>
          )}

          {canApprove && (
            <button
              onClick={() => navigateToScreen('aprovacao')}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                currentScreen === 'aprovacao' ? 'bg-brand-secondary text-brand-darker shadow-md shadow-brand-secondary/20' : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="flex items-center gap-3 min-w-0">
                <ClipboardCheck className="w-4 h-4 shrink-0" />
                <span className="truncate">Moderação</span>
              </span>
              {pendingBadge > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold shrink-0 ${currentScreen === 'aprovacao' ? 'bg-brand-darker text-brand-primary' : 'bg-amber-500 text-white'}`}>
                  {pendingBadge}
                </span>
              )}
            </button>
          )}

          <button
            onClick={() => navigateToScreen('historico')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold tracking-wide text-left transition-all ${
              currentScreen === 'historico' ? 'bg-brand-secondary text-brand-darker shadow-md shadow-brand-secondary/20' : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <History className="w-4 h-4 shrink-0" />
            <span>Histórico</span>
          </button>

          {canEditSettings && (
            <button
              onClick={() => navigateToScreen('config')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold tracking-wide text-left transition-all ${
                currentScreen === 'config' ? 'bg-brand-secondary text-brand-darker shadow-md shadow-brand-secondary/20' : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Settings className="w-4 h-4 shrink-0" />
              <span>Parâmetros</span>
            </button>
          )}

          {canManageUsers && (
            <button
              onClick={() => navigateToScreen('usuarios')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold tracking-wide text-left transition-all ${
                currentScreen === 'usuarios' ? 'bg-brand-secondary text-brand-darker shadow-md shadow-brand-secondary/20' : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Users className="w-4 h-4 shrink-0" />
              <span>Usuários</span>
            </button>
          )}

          <button
            onClick={() => navigateToScreen('logs')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold tracking-wide text-left transition-all ${
              currentScreen === 'logs' ? 'bg-brand-secondary text-brand-darker shadow-md shadow-brand-secondary/20' : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Terminal className="w-4 h-4 shrink-0" />
            <span>Fila Logs</span>
          </button>
        </nav>

        <div className="p-4 border-t border-brand-darker/40 relative bg-brand-darker/60 shrink-0">
          <button
            onClick={() => setProfileDropdown((prev) => !prev)}
            className="w-full flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg text-left transition-colors outline-none cursor-pointer"
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white uppercase shrink-0 ${
              currentRole === 'ADMIN' ? 'bg-brand-secondary' : currentRole === 'APROVADOR' ? 'bg-sky-600' : 'bg-amber-600'
            }`}>
              {currentUser.nome[0]}
            </div>
            <div className="overflow-hidden flex-1">
              <p className="text-xs font-semibold text-white truncate leading-tight">{currentUser.nome}</p>
              <p className="text-[10px] text-slate-450 font-medium uppercase mt-0.5 tracking-wide">{getRoleLabel(currentRole)}</p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          </button>

          {profileDropdown && (
            <div className="absolute left-4 right-4 bottom-16 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-1.5 z-50 text-xs text-slate-300">
              <span className="block px-3 py-1 text-[9px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-800/80 mb-1">
                Sessão atual
              </span>
              <div className="px-3 py-2">
                <p className="font-semibold text-white">{currentUser.nome}</p>
                <p className="text-[10px] text-slate-400">{currentUser.email}</p>
              </div>
              <button
                onClick={() => void handleLogout()}
                className="w-full text-left px-3 py-2 hover:bg-slate-800/60 flex items-center gap-2 text-rose-300"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sair e trocar usuário
              </button>
            </div>
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-h-screen">
        <header className="sticky top-0 z-20 shrink-0 border-b border-slate-200 bg-white shadow-sm md:shadow-none">
          <div className="flex min-h-16 items-center justify-between gap-3 px-4 sm:px-6 md:px-8">
            <div className="min-w-0 flex items-center gap-3">
              <div className="flex min-w-0 md:hidden items-center gap-2.5 cursor-pointer" onClick={() => navigateToScreen('dashboard')}>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-primary shadow-sm shrink-0 border border-brand-primary/20">
                  <img src={LOGOS.squareMark} className="h-7 w-7 object-contain" alt="Consult Flow" referrerPolicy="no-referrer" />
                </div>
                <div className="min-w-0">
                  <span className="block truncate text-[10px] text-slate-400">{pageTitle}</span>
                </div>
              </div>

              <h1 className="hidden md:block text-xl font-bold text-slate-800 font-sans">
                {currentScreen === 'dashboard' && 'Dashboard'}
                {currentScreen === 'criar' && 'Criar Postagem'}
                {currentScreen === 'aprovacao' && 'Moderação e Fluxos'}
                {currentScreen === 'historico' && 'Histórico de Atividade'}
                {currentScreen === 'config' && 'Mapeamento de Integrações'}
                {currentScreen === 'usuarios' && 'Usuários e Perfis'}
                {currentScreen === 'logs' && 'Logs de Auditoria'}
              </h1>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden sm:flex items-center gap-2 bg-brand-light text-brand-secondary px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold border border-brand-primary/20 shadow-sm max-w-[220px]">
                <span className="w-2 h-2 rounded-full bg-brand-secondary animate-pulse shrink-0"></span>
                <span className="truncate">{currentUser.nome}</span>
              </div>

              {availableClients.length > 0 && (
                <div className="hidden lg:flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                  <Building2 className="h-4 w-4 text-brand-secondary" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Cliente ativo</p>
                    <select
                      value={activeClient?.id || ''}
                      onChange={(event) => handleClientChange(event.target.value)}
                      className="min-w-[220px] bg-transparent text-xs font-semibold text-slate-800 outline-none"
                    >
                      {availableClients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="md:hidden relative">
                <button
                  onClick={() => setProfileDropdown((prev) => !prev)}
                  className="flex items-center gap-1 bg-slate-100 border border-slate-200 py-1.5 px-2.5 rounded-lg text-xs font-bold text-slate-700 outline-none"
                >
                  <span>{currentUser.nome.split(' ')[0]}</span>
                  <ChevronDown className="w-3 h-3 text-slate-500" />
                </button>
                {profileDropdown && (
                  <div className="absolute right-0 mt-1 w-56 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-50 text-xs">
                    <div className="px-3 py-2 border-b border-slate-100">
                      <p className="font-semibold text-slate-800">{currentUser.nome}</p>
                      <p className="text-[10px] text-slate-500">{currentUser.email}</p>
                    </div>
                    <button onClick={() => void handleLogout()} className="w-full text-left px-3 py-2 hover:bg-slate-50 font-semibold text-rose-600">
                      Sair e trocar usuário
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-3 py-4 sm:p-6 md:p-8 pb-28 md:pb-8">
          {renderActiveScreen()}
        </main>

        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200/80 z-40 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] pb-safe">
          <div className="grid min-h-16" style={{ gridTemplateColumns: `repeat(${mobileNavColumns}, minmax(0, 1fr))` }}>
          <button
            onClick={() => navigateToScreen('dashboard')}
            className={`flex flex-col items-center justify-center py-1 text-[10px] font-bold focus:outline-none transition-colors ${
              currentScreen === 'dashboard' ? 'text-brand-secondary' : 'text-slate-450'
            }`}
            style={{ minHeight: '48px' }}
          >
              <LayoutDashboard className="w-5 h-5 mb-0.5" />
            <span>{isSuperAdmin ? 'Global' : 'Painel'}</span>
          </button>

          {canSeeClients && (
            <button
              onClick={() => navigateToScreen('clientes')}
              className={`flex flex-col items-center justify-center py-1 text-[10px] font-bold focus:outline-none transition-colors ${
                currentScreen === 'clientes' ? 'text-brand-secondary' : 'text-slate-450'
              }`}
              style={{ minHeight: '48px' }}
            >
              <Building2 className="w-5 h-5 mb-0.5" />
              <span>Clientes</span>
            </button>
          )}

          {canCreate && (
            <button
              onClick={() => navigateToScreen('criar')}
              className={`flex flex-col items-center justify-center py-1 text-[10px] font-bold focus:outline-none transition-colors ${
                currentScreen === 'criar' ? 'text-brand-secondary' : 'text-slate-450'
              }`}
              style={{ minHeight: '48px' }}
            >
              <PlusCircle className="w-5 h-5 mb-0.5" />
              <span>Criar</span>
            </button>
          )}

          {canApprove && (
            <button
              onClick={() => navigateToScreen('aprovacao')}
              className={`flex flex-col items-center justify-center py-1 text-[10px] font-bold focus:outline-none transition-colors relative ${
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
          )}

          <button
            onClick={() => navigateToScreen('historico')}
            className={`flex flex-col items-center justify-center py-1 text-[10px] font-bold focus:outline-none transition-colors ${
              currentScreen === 'historico' ? 'text-brand-secondary' : 'text-slate-450'
            }`}
            style={{ minHeight: '48px' }}
          >
            <History className="w-5 h-5 mb-0.5" />
            <span>Histórico</span>
          </button>

          {canEditSettings && (
            <button
              onClick={() => navigateToScreen('config')}
              className={`flex flex-col items-center justify-center py-1 text-[10px] font-bold focus:outline-none transition-colors ${
                currentScreen === 'config' ? 'text-brand-secondary' : 'text-slate-450'
              }`}
              style={{ minHeight: '48px' }}
            >
              <Settings className="w-5 h-5 mb-0.5" />
              <span>Params</span>
            </button>
          )}

          {canManageUsers && (
            <button
              onClick={() => navigateToScreen('usuarios')}
              className={`flex flex-col items-center justify-center py-1 text-[10px] font-bold focus:outline-none transition-colors ${
                currentScreen === 'usuarios' ? 'text-brand-secondary' : 'text-slate-450'
              }`}
              style={{ minHeight: '48px' }}
            >
              <Users className="w-5 h-5 mb-0.5" />
              <span>Usuários</span>
            </button>
          )}

          <button
            onClick={() => navigateToScreen('logs')}
            className={`flex flex-col items-center justify-center py-1 text-[10px] font-bold focus:outline-none transition-colors ${
              currentScreen === 'logs' ? 'text-brand-secondary' : 'text-slate-450'
            }`}
            style={{ minHeight: '48px' }}
          >
            <Terminal className="w-5 h-5 mb-0.5" />
            <span>Logs</span>
          </button>
          </div>
        </div>

        <footer className="bg-white border-t border-slate-200/80 text-center py-4 text-[10px] text-slate-400 mt-auto shrink-0">
          <div className="px-6 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span>© 2026 Consult Flow — Gestão de Ativos Corporativos.</span>
            <span className="flex items-center gap-1.5">
              Sessão ativa com <strong className="text-slate-600 font-semibold">{currentUser.email}</strong>
            </span>
          </div>
        </footer>
      </div>
    </div>
    </ActiveClientProvider>
  );
}
