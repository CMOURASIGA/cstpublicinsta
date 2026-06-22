import React, { useEffect, useState } from 'react';
import { Save, Shield, UserCog, Users } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { PerfilPublicacao, Usuario } from '../types';

interface UsersManagementProps {
  onUsersChanged?: () => Promise<void> | void;
}

type EditableUser = Usuario & {
  saving?: boolean;
};

const roleOptions: Array<{ value: PerfilPublicacao; label: string }> = [
  { value: 'ADMIN', label: 'Administrador' },
  { value: 'APROVADOR', label: 'Aprovador' },
  { value: 'CRIADOR', label: 'Criador' },
];

export default function UsersManagement({ onUsersChanged }: UsersManagementProps) {
  const [users, setUsers] = useState<EditableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadUsers = async () => {
    setLoading(true);
    setError('');

    try {
      const res = await apiFetch('/api/users');
      const data = await res.json();

      if (!res.ok || !data.users) {
        throw new Error(data.error || 'Falha ao carregar os usuários.');
      }

      setUsers(data.users as EditableUser[]);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Falha ao carregar os usuários.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const updateLocalUser = (id: string, patch: Partial<EditableUser>) => {
    setUsers((current) => current.map((user) => (user.id === id ? { ...user, ...patch } : user)));
  };

  const saveUser = async (user: EditableUser) => {
    updateLocalUser(user.id, { saving: true });

    try {
      const res = await apiFetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: user.nome.trim(),
          email: user.email.trim(),
          perfil_publicacao: user.perfil_publicacao,
          ativo: user.ativo,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.user) {
        throw new Error(data.error || 'Falha ao salvar o usuário.');
      }

      updateLocalUser(user.id, { ...(data.user as Usuario), saving: false });
      await onUsersChanged?.();
    } catch (err) {
      console.error(err);
      updateLocalUser(user.id, { saving: false });
      alert(err instanceof Error ? err.message : 'Falha ao salvar o usuário.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-xl font-bold font-sans text-slate-800">Usuários e Perfis</h2>
          <p className="mt-1 text-xs text-slate-500">
            Gerencie o nome exibido, o status e o perfil operacional que controla criação, aprovação e administração de publicações.
          </p>
        </div>
        <Users className="h-5 w-5 text-brand-secondary" />
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="grid grid-cols-12 gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">
          <div className="col-span-12 md:col-span-3">Usuário</div>
          <div className="col-span-12 md:col-span-3">E-mail</div>
          <div className="col-span-6 md:col-span-2">Perfil</div>
          <div className="col-span-6 md:col-span-2">Status</div>
          <div className="col-span-12 md:col-span-2">Ação</div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Carregando usuários...</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {users.map((user) => (
              <div key={user.id} className="grid grid-cols-12 gap-3 px-4 py-4 items-center">
                <div className="col-span-12 md:col-span-3">
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400 md:hidden">
                    Usuário
                  </label>
                  <div className="relative">
                    <UserCog className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={user.nome}
                      onChange={(event) => updateLocalUser(user.id, { nome: event.target.value })}
                      className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-700 outline-none focus:border-brand-primary"
                    />
                  </div>
                </div>

                <div className="col-span-12 md:col-span-3">
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400 md:hidden">
                    E-mail
                  </label>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    {user.email}
                  </div>
                </div>

                <div className="col-span-6 md:col-span-2">
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400 md:hidden">
                    Perfil
                  </label>
                  <div className="relative">
                    <Shield className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <select
                      value={user.perfil_publicacao || 'CRIADOR'}
                      onChange={(event) => updateLocalUser(user.id, { perfil_publicacao: event.target.value as PerfilPublicacao })}
                      className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-700 outline-none focus:border-brand-primary"
                    >
                      {roleOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="col-span-6 md:col-span-2">
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400 md:hidden">
                    Status
                  </label>
                  <select
                    value={user.ativo ? 'ATIVO' : 'INATIVO'}
                    onChange={(event) => updateLocalUser(user.id, { ativo: event.target.value === 'ATIVO' })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-brand-primary"
                  >
                    <option value="ATIVO">Ativo</option>
                    <option value="INATIVO">Inativo</option>
                  </select>
                </div>

                <div className="col-span-12 md:col-span-2">
                  <button
                    type="button"
                    disabled={user.saving}
                    onClick={() => void saveUser(user)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-secondary px-3 py-2 text-xs font-bold text-brand-darker transition-colors hover:bg-brand-primary disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Save className="h-4 w-4" />
                    {user.saving ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
