import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, PlusCircle, Shield, Trash2, Users } from 'lucide-react';
import { apiFetch } from '../lib/api';
import type { Cliente, ClienteUsuario, PerfilPublicacao } from '../types';

type Props = {
  activeClient: Cliente | null;
};

type ClientUserRow = {
  usuario_id: string;
  nome: string;
  email: string;
  perfil: string;
  status: string;
  ultima_atividade: string;
};

const roleOptions: Array<{ value: PerfilPublicacao; label: string }> = [
  { value: 'ADMIN_CLIENTE', label: 'Admin do Cliente' },
  { value: 'APROVADOR', label: 'Aprovador' },
  { value: 'CRIADOR', label: 'Criador' },
  { value: 'VISUALIZADOR', label: 'Visualizador' },
];

export default function ClientUsersManagement({ activeClient }: Props) {
  const [items, setItems] = useState<ClientUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ nome: '', email: '', perfil: 'CRIADOR' as PerfilPublicacao });

  const clientId = activeClient?.id || '';

  const load = async () => {
    if (!clientId) return;
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(`/api/clientes/${clientId}/usuarios`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao listar usuários.');
      setItems((data.items || []) as ClientUserRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao listar usuários.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [clientId]);

  const stats = useMemo(() => {
    const total = items.length;
    const admins = items.filter((item) => item.perfil === 'ADMIN_CLIENTE').length;
    const aprovadores = items.filter((item) => item.perfil === 'APROVADOR').length;
    const criadores = items.filter((item) => item.perfil === 'CRIADOR').length;
    return { total, admins, aprovadores, criadores };
  }, [items]);

  const invite = async () => {
    if (!clientId) return;
    if (!form.nome.trim() || !form.email.trim()) {
      setError('Nome e e-mail são obrigatórios.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await apiFetch(`/api/clientes/${clientId}/usuarios/convites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Falha ao convidar usuário.');
      setForm({ nome: '', email: '', perfil: 'CRIADOR' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao convidar usuário.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (usuarioId: string) => {
    if (!clientId) return;
    if (!window.confirm('Remover vínculo deste usuário do cliente?')) return;
    try {
      const res = await apiFetch(`/api/clientes/${clientId}/usuarios/${usuarioId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Falha ao remover usuário.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao remover usuário.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold font-sans text-slate-800">Client Users</h2>
          <p className="mt-1 text-xs text-slate-500">Usuários do cliente ativo e convites.</p>
        </div>
        <Users className="h-5 w-5 text-brand-secondary" />
      </div>

      {!activeClient && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Selecione um cliente para ver os usuários.
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {activeClient && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Total</p>
              <p className="mt-2 text-2xl font-bold text-slate-800">{stats.total}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Administradores</p>
              <p className="mt-2 text-2xl font-bold text-slate-800">{stats.admins}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Aprovadores</p>
              <p className="mt-2 text-2xl font-bold text-slate-800">{stats.aprovadores}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Criadores</p>
              <p className="mt-2 text-2xl font-bold text-slate-800">{stats.criadores}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-1">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Convidar usuário</h3>
                  <p className="mt-1 text-xs text-slate-500">Cria o vínculo do cliente.</p>
                </div>
                <PlusCircle className="h-4 w-4 text-brand-secondary" />
              </div>
              <div className="mt-4 space-y-3">
                <input value={form.nome} onChange={(e) => setForm((curr) => ({ ...curr, nome: e.target.value }))} placeholder="Nome" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none" />
                <input value={form.email} onChange={(e) => setForm((curr) => ({ ...curr, email: e.target.value }))} placeholder="E-mail" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none" />
                <select value={form.perfil} onChange={(e) => setForm((curr) => ({ ...curr, perfil: e.target.value as PerfilPublicacao }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none">
                  {roleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={() => void invite()} disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-secondary px-4 py-2 text-xs font-bold text-brand-darker disabled:opacity-60">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
                  Convidar
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Usuários do cliente</h3>
                  <p className="mt-1 text-xs text-slate-500">{activeClient.nome}</p>
                </div>
                <Shield className="h-4 w-4 text-brand-secondary" />
              </div>
              <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                <div className="grid grid-cols-12 gap-2 bg-slate-50 px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  <div className="col-span-4">Identidade</div>
                  <div className="col-span-3">Perfil</div>
                  <div className="col-span-2">Status</div>
                  <div className="col-span-3">Ações</div>
                </div>
                {loading ? (
                  <div className="p-8 text-center text-sm text-slate-500">Carregando usuários...</div>
                ) : items.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500">Nenhum usuário vinculado.</div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {items.map((item) => (
                      <div key={item.usuario_id} className="grid grid-cols-1 gap-3 px-4 py-4 md:grid-cols-12 md:items-center">
                        <div className="md:col-span-4">
                          <p className="text-sm font-bold text-slate-800">{item.nome}</p>
                          <p className="text-[11px] text-slate-500">{item.email}</p>
                        </div>
                        <div className="md:col-span-3 text-xs text-slate-600">{item.perfil}</div>
                        <div className="md:col-span-2 text-xs text-slate-600">{item.status}</div>
                        <div className="md:col-span-3 flex flex-wrap gap-2">
                          <button type="button" className="rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-700">
                            Editar
                          </button>
                          <button type="button" onClick={() => void remove(item.usuario_id)} className="rounded-lg border border-rose-200 px-3 py-2 text-[11px] font-semibold text-rose-700">
                            <Trash2 className="mr-1 inline h-3.5 w-3.5" />
                            Remover
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
