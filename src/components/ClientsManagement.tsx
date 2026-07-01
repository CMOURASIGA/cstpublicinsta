import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Building2, Loader2, PlusCircle, Search, Settings, Users } from 'lucide-react';
import { apiFetch } from '../lib/api';
import type { Cliente } from '../types';

type Props = {
  onSelectClient?: (client: Cliente) => void;
};

function StatusPill({ status }: { status: Cliente['status'] }) {
  const tone =
    status === 'ATIVO'
      ? 'bg-emerald-100 text-emerald-700'
      : status === 'SUSPENSO'
        ? 'bg-amber-100 text-amber-700'
        : 'bg-slate-100 text-slate-600';
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone}`}>{status}</span>;
}

export default function ClientsManagement({ onSelectClient }: Props) {
  const [clients, setClients] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'TODOS' | Cliente['status']>('TODOS');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nome: '',
    slug: '',
    status: 'ATIVO' as Cliente['status'],
    logo_url: '',
    cor_primaria: '#002d5b',
    cor_secundaria: '#0060ac',
  });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/api/admin/clientes');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao listar clientes.');
      setClients((data.clientes || []) as Cliente[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao listar clientes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(
    () =>
      clients.filter((client) => {
        const matchesSearch =
          !search.trim() ||
          client.nome.toLowerCase().includes(search.toLowerCase()) ||
          client.slug.toLowerCase().includes(search.toLowerCase());
        const matchesStatus = statusFilter === 'TODOS' || client.status === statusFilter;
        return matchesSearch && matchesStatus;
      }),
    [clients, search, statusFilter],
  );

  const createClient = async () => {
    if (!form.nome.trim() || !form.slug.trim()) {
      setError('Nome e slug são obrigatórios.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await apiFetch('/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Falha ao criar cliente.');
      setForm({ nome: '', slug: '', status: 'ATIVO', logo_url: '', cor_primaria: '#002d5b', cor_secundaria: '#0060ac' });
      await load();
      if (data.cliente) onSelectClient?.(data.cliente as Cliente);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar cliente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold font-sans text-slate-800">Clientes</h2>
          <p className="mt-1 text-xs text-slate-500">Cadastro, filtros e acesso direto aos clientes da plataforma.</p>
        </div>
        <Building2 className="h-5 w-5 text-brand-secondary" />
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-2">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
              <Search className="h-4 w-4 text-slate-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar cliente" className="w-full bg-transparent text-xs outline-none" />
            </label>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
              <option value="TODOS">Todos</option>
              <option value="ATIVO">Ativo</option>
              <option value="INATIVO">Inativo</option>
              <option value="SUSPENSO">Suspenso</option>
            </select>
            <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
              <Loader2 className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
            <div className="grid grid-cols-12 gap-2 bg-slate-50 px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              <div className="col-span-4">Cliente</div>
              <div className="col-span-2">Slug</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Integrações</div>
              <div className="col-span-2">Ações</div>
            </div>
            {loading ? (
              <div className="p-8 text-center text-sm text-slate-500">Carregando clientes...</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">Nenhum cliente encontrado.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filtered.map((client) => (
                  <div key={client.id} className="grid grid-cols-1 gap-3 px-4 py-4 md:grid-cols-12 md:items-center">
                    <div className="md:col-span-4">
                      <p className="text-sm font-bold text-slate-800">{client.nome}</p>
                      <p className="text-[11px] text-slate-500">{client.id}</p>
                    </div>
                    <div className="md:col-span-2 text-xs text-slate-600">{client.slug}</div>
                    <div className="md:col-span-2"><StatusPill status={client.status} /></div>
                    <div className="md:col-span-2 text-xs text-slate-600">OK</div>
                    <div className="md:col-span-2 flex flex-wrap gap-2">
                      <button type="button" onClick={() => onSelectClient?.(client)} className="rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-700">
                        Acessar
                      </button>
                      <button type="button" onClick={() => onSelectClient?.(client)} className="rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-700">
                        Integr. / Usuários
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Novo cliente</h3>
              <p className="mt-1 text-xs text-slate-500">Cadastro direto no Supabase.</p>
            </div>
            <PlusCircle className="h-4 w-4 text-brand-secondary" />
          </div>
          <div className="mt-4 space-y-3">
            <input value={form.nome} onChange={(e) => setForm((curr) => ({ ...curr, nome: e.target.value }))} placeholder="Nome do cliente" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none" />
            <input value={form.slug} onChange={(e) => setForm((curr) => ({ ...curr, slug: e.target.value }))} placeholder="Slug" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none" />
            <select value={form.status} onChange={(e) => setForm((curr) => ({ ...curr, status: e.target.value as Cliente['status'] }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none">
              <option value="ATIVO">ATIVO</option>
              <option value="INATIVO">INATIVO</option>
              <option value="SUSPENSO">SUSPENSO</option>
            </select>
            <input value={form.logo_url} onChange={(e) => setForm((curr) => ({ ...curr, logo_url: e.target.value }))} placeholder="Logo URL" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none" />
            <input value={form.cor_primaria} onChange={(e) => setForm((curr) => ({ ...curr, cor_primaria: e.target.value }))} placeholder="Cor primária" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none" />
            <input value={form.cor_secundaria} onChange={(e) => setForm((curr) => ({ ...curr, cor_secundaria: e.target.value }))} placeholder="Cor secundária" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none" />
            <button type="button" onClick={() => void createClient()} disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-secondary px-4 py-2 text-xs font-bold text-brand-darker disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
              Criar cliente
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
