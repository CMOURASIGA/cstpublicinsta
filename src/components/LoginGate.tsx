import React, { useMemo, useState } from 'react';
import { ShieldCheck, User, LogIn, Search } from 'lucide-react';
import { Usuario, PerfilPublicacao } from '../types';

interface LoginGateProps {
  loading: boolean;
  users: Usuario[];
  onLogin: (userId: string) => void;
}

function getRoleLabel(role: PerfilPublicacao) {
  if (role === 'ADMIN') return 'Administrador';
  if (role === 'APROVADOR') return 'Aprovador';
  return 'Criador';
}

export default function LoginGate({ loading, users, onLogin }: LoginGateProps) {
  const [selectedUserId, setSelectedUserId] = useState('');
  const [search, setSearch] = useState('');

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users;
    return users.filter((user) =>
      user.nome.toLowerCase().includes(term) || user.email.toLowerCase().includes(term),
    );
  }, [search, users]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#123b5a_0%,#0b1f33_55%,#08131f_100%)] px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[28px] border border-white/10 bg-white/6 p-8 shadow-2xl shadow-black/20 backdrop-blur">
            <div className="mb-8 flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20">
                <ShieldCheck className="h-7 w-7" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Consult Flow</p>
                <h1 className="text-3xl font-bold tracking-tight text-white">Acesso ao Sistema</h1>
              </div>
            </div>

            <p className="max-w-xl text-sm leading-relaxed text-slate-300">
              Selecione um usuário ativo da base do Supabase para iniciar a sessão operacional do sistema de publicação.
              Os perfis definem quem cria, quem aprova e quem atua como administrador.
            </p>

            <div className="mt-8 rounded-2xl border border-white/10 bg-slate-950/20 p-4">
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                Buscar usuário
              </label>
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Digite nome ou e-mail"
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                />
              </div>
            </div>

            <div className="mt-6 grid gap-3">
              {loading ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-6 text-sm text-slate-300">
                  Carregando usuários do Supabase...
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-5 py-6 text-sm text-amber-100">
                  Nenhum usuário ativo encontrado para esse filtro.
                </div>
              ) : (
                filteredUsers.map((user) => {
                  const role = user.perfil_publicacao || (user.perfil === 'ADMINISTRADOR' ? 'ADMIN' : 'CRIADOR');
                  const selected = selectedUserId === user.id;

                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => setSelectedUserId(user.id)}
                      className={`rounded-2xl border px-5 py-4 text-left transition-all ${
                        selected
                          ? 'border-amber-300 bg-amber-300/12 shadow-lg shadow-amber-500/10'
                          : 'border-white/10 bg-white/5 hover:border-cyan-300/40 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-300/15 text-cyan-100">
                              <User className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-white">{user.nome}</p>
                              <p className="truncate text-xs text-slate-400">{user.email}</p>
                            </div>
                          </div>
                        </div>
                        <span className="shrink-0 rounded-full border border-white/10 bg-slate-950/30 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-cyan-100">
                          {getRoleLabel(role)}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-slate-950/35 p-8 shadow-2xl shadow-black/20 backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-200/80">Sessão</p>
            <h2 className="mt-2 text-2xl font-bold text-white">Entrar com usuário operacional</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              Depois do login, o sistema usa esse usuário para registrar criação, aprovação, rejeição e publicação no histórico.
            </p>

            <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Usuário selecionado</p>
              <p className="mt-3 text-base font-bold text-white">
                {users.find((user) => user.id === selectedUserId)?.nome || 'Nenhum usuário selecionado'}
              </p>
              <p className="mt-1 text-sm text-slate-400">
                {users.find((user) => user.id === selectedUserId)?.email || 'Escolha um usuário ativo para continuar'}
              </p>
            </div>

            <button
              type="button"
              disabled={!selectedUserId}
              onClick={() => onLogin(selectedUserId)}
              className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 px-5 py-3.5 text-sm font-bold text-slate-950 transition-colors hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
            >
              <LogIn className="h-4 w-4" />
              Entrar no sistema
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
