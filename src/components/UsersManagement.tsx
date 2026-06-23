import React, { useEffect, useState } from 'react';
import { Save, Shield, Trash2, UserCog, Users } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { PerfilPublicacao, Usuario } from '../types';

interface UsersManagementProps {
  onUsersChanged?: () => Promise<void> | void;
}

type EditableUser = Usuario & { saving?: boolean };

const roleOptions: Array<{ value: PerfilPublicacao; label: string }> = [
  { value: 'ADMIN', label: 'Administrador' },
  { value: 'APROVADOR', label: 'Aprovador' },
  { value: 'CRIADOR', label: 'Criador' },
];

export default function UsersManagement({ onUsersChanged }: UsersManagementProps) {
  const [users, setUsers] = useState<EditableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<PerfilPublicacao>('CRIADOR');
  const [creating, setCreating] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/api/users');
      const data = await res.json();
      if (!res.ok || !data.users) throw new Error(data.error || 'Falha ao carregar os usuários.');
      setUsers(data.users as EditableUser[]);
    } catch (err) {
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
      if (!res.ok || !data.user) throw new Error(data.error || 'Falha ao salvar o usuário.');
      updateLocalUser(user.id, { ...(data.user as Usuario), saving: false });
      await onUsersChanged?.();
    } catch (err) {
      updateLocalUser(user.id, { saving: false });
      alert(err instanceof Error ? err.message : 'Falha ao salvar o usuário.');
    }
  };

  const deleteUser = async (user: EditableUser) => {
    if (!window.confirm(`Confirma a exclusão do usuário ${user.nome}?`)) return;
    updateLocalUser(user.id, { saving: true });
    try {
      const res = await apiFetch(`/api/users/${user.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Falha ao excluir o usuário.');
      await loadUsers();
      await onUsersChanged?.();
    } catch (err) {
      updateLocalUser(user.id, { saving: false });
      alert(err instanceof Error ? err.message : 'Falha ao excluir o usuário.');
    }
  };

  const resetPassword = async (user: EditableUser) => {
    const password = window.prompt(`Informe a nova senha para ${user.nome}:`);
    if (password === null) {
      return;
    }

    if (password.trim().length < 6) {
      alert('A nova senha deve ter ao menos 6 caracteres.');
      return;
    }

    updateLocalUser(user.id, { saving: true });
    try {
      const res = await apiFetch(`/api/users/${user.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Falha ao redefinir a senha.');
      updateLocalUser(user.id, { saving: false });
      alert('Senha redefinida com sucesso.');
    } catch (err) {
      updateLocalUser(user.id, { saving: false });
      alert(err instanceof Error ? err.message : 'Falha ao redefinir a senha.');
    }
  };

  const createUser = async () => {
    if (!newUserName.trim() || !newUserEmail.trim() || !newUserPassword.trim()) {
      alert('Preencha nome, e-mail e senha provisória.');
      return;
    }
    setCreating(true);
    try {
      const res = await apiFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: newUserName.trim(),
          email: newUserEmail.trim(),
          password: newUserPassword,
          perfil_publicacao: newUserRole,
          ativo: true,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.user) throw new Error(data.error || 'Falha ao criar o usuário.');
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserRole('CRIADOR');
      await loadUsers();
      await onUsersChanged?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Falha ao criar o usuário.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-xl font-bold font-sans text-slate-800">Usuários e Perfis</h2>
          <p className="mt-1 text-xs text-slate-500">CRUD completo do cadastro operacional: criar, listar, editar e excluir usuários do sistema.</p>
        </div>
        <Users className="h-5 w-5 text-brand-secondary" />
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">{error}</div>}

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h3 className="text-sm font-bold text-slate-800">Novo usuário</h3>
          <p className="mt-1 text-xs text-slate-500">Este fluxo cria a conta no Supabase Auth e também o cadastro operacional do sistema.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <input type="text" value={newUserName} onChange={(event) => setNewUserName(event.target.value)} placeholder="Nome completo" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 outline-none focus:border-brand-primary" />
          <input type="email" value={newUserEmail} onChange={(event) => setNewUserEmail(event.target.value)} placeholder="email@empresa.com" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 outline-none focus:border-brand-primary" />
          <input type="text" value={newUserPassword} onChange={(event) => setNewUserPassword(event.target.value)} placeholder="Senha provisória" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 outline-none focus:border-brand-primary" />
          <select value={newUserRole} onChange={(event) => setNewUserRole(event.target.value as PerfilPublicacao)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 outline-none focus:border-brand-primary">
            {roleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div className="mt-4 flex justify-end">
          <button type="button" disabled={creating} onClick={() => void createUser()} className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-secondary px-4 py-2 text-xs font-bold text-brand-darker transition-colors hover:bg-brand-primary disabled:cursor-not-allowed disabled:opacity-60">
            <Users className="h-4 w-4" />
            {creating ? 'Criando...' : 'Criar usuário'}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="grid grid-cols-12 gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">
          <div className="col-span-12 md:col-span-3">Usuário</div>
          <div className="col-span-12 md:col-span-3">E-mail</div>
          <div className="col-span-6 md:col-span-2">Perfil</div>
          <div className="col-span-6 md:col-span-2">Status</div>
          <div className="col-span-12 md:col-span-2">Ações</div>
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Carregando usuários...</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {users.map((user) => (
              <div key={user.id} className="grid grid-cols-12 gap-3 px-4 py-4 items-center">
                <div className="col-span-12 md:col-span-3">
                  <div className="relative">
                    <UserCog className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input type="text" value={user.nome} onChange={(event) => updateLocalUser(user.id, { nome: event.target.value })} className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-700 outline-none focus:border-brand-primary" />
                  </div>
                </div>
                <div className="col-span-12 md:col-span-3">
                  <input
                    type="email"
                    value={user.email}
                    onChange={(event) => updateLocalUser(user.id, { email: event.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-brand-primary"
                  />
                </div>
                <div className="col-span-6 md:col-span-2">
                  <div className="relative">
                    <Shield className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <select value={user.perfil_publicacao || 'CRIADOR'} onChange={(event) => updateLocalUser(user.id, { perfil_publicacao: event.target.value as PerfilPublicacao })} className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-700 outline-none focus:border-brand-primary">
                      {roleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="col-span-6 md:col-span-2">
                  <select value={user.ativo ? 'ATIVO' : 'INATIVO'} onChange={(event) => updateLocalUser(user.id, { ativo: event.target.value === 'ATIVO' })} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-brand-primary">
                    <option value="ATIVO">Ativo</option>
                    <option value="INATIVO">Inativo</option>
                  </select>
                </div>
                <div className="col-span-12 md:col-span-2">
                  <div className="flex gap-2">
                    <button type="button" disabled={user.saving} onClick={() => void saveUser(user)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand-secondary px-3 py-2 text-xs font-bold text-brand-darker transition-colors hover:bg-brand-primary disabled:cursor-not-allowed disabled:opacity-60">
                      <Save className="h-4 w-4" />
                      {user.saving ? 'Salvando...' : 'Salvar'}
                    </button>
                    <button
                      type="button"
                      disabled={user.saving}
                      onClick={() => void resetPassword(user)}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700 transition-colors hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Senha
                    </button>
                    <button type="button" disabled={user.saving} onClick={() => void deleteUser(user)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60">
                      <Trash2 className="h-4 w-4" />
                      Excluir
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
