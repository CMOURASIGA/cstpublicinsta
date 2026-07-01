import React, { useEffect, useState } from 'react';
import { AlertTriangle, Building2, CheckCircle2, Clock3, Loader2, RefreshCw, Sparkles, TrendingUp } from 'lucide-react';
import { apiFetch } from '../lib/api';
import type { Cliente } from '../types';

type DashboardResponse = {
  clientes_ativos: number;
  posts_pendentes: number;
  publicacoes_mes: number;
  taxa_sucesso: number;
  erros_24h: number;
  integracoes_com_problema: number;
  atividade_recente: Array<{
    cliente_id?: string | null;
    cliente_nome: string;
    conteudo: string;
    status: string;
    data: string;
  }>;
};

function MetricCard({
  title,
  value,
  status = 'neutral',
}: {
  title: string;
  value: string | number;
  status?: 'neutral' | 'success' | 'warning' | 'error';
}) {
  const tone =
    status === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : status === 'warning'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : status === 'error'
          ? 'border-rose-200 bg-rose-50 text-rose-700'
          : 'border-slate-200 bg-white text-slate-700';
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${tone}`}>
      <p className="text-[11px] font-bold uppercase tracking-wide opacity-80">{title}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

export default function AdminDashboard({ onNavigate }: { onNavigate?: (screen: string) => void }) {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/api/admin/dashboard');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Falha ao carregar dashboard global.');
      setData(json as DashboardResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar dashboard global.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
        <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin text-brand-secondary" />
        Carregando visão global...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold font-sans text-slate-800">Visão Global</h2>
          <p className="mt-1 text-xs text-slate-500">Monitoramento executivo da operação multi-cliente.</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Recarregar
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard title="Clientes ativos" value={data?.clientes_ativos ?? 0} status="success" />
        <MetricCard title="Posts pendentes" value={data?.posts_pendentes ?? 0} status="warning" />
        <MetricCard title="Publicações do mês" value={data?.publicacoes_mes ?? 0} />
        <MetricCard title="Taxa de sucesso" value={`${data?.taxa_sucesso ?? 0}%`} status="success" />
        <MetricCard title="Erros 24h" value={data?.erros_24h ?? 0} status="error" />
        <MetricCard title="Integrações com problema" value={data?.integracoes_com_problema ?? 0} status="warning" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Atividade recente</h3>
              <p className="mt-1 text-xs text-slate-500">Eventos operacionais dos clientes.</p>
            </div>
            <Sparkles className="h-4 w-4 text-brand-secondary" />
          </div>
          <div className="mt-4 space-y-3">
            {(data?.atividade_recente || []).map((item) => (
              <button
                key={`${item.cliente_id}-${item.data}-${item.conteudo}`}
                type="button"
                onClick={() => onNavigate?.('clientes')}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-left hover:bg-slate-100"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-bold text-slate-800">{item.cliente_nome}</p>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500">{item.status}</span>
                </div>
                <p className="mt-1 text-xs text-slate-600">{item.conteudo}</p>
                <p className="mt-2 text-[11px] text-slate-400">{new Date(item.data).toLocaleString('pt-BR')}</p>
              </button>
            ))}
            {(!data?.atividade_recente || data.atividade_recente.length === 0) && (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                Nenhuma atividade recente encontrada.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Acesso rápido</h3>
              <p className="mt-1 text-xs text-slate-500">Ações mais usadas na operação.</p>
            </div>
            <Building2 className="h-4 w-4 text-brand-secondary" />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => onNavigate?.('clientes')} className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-left hover:bg-slate-100">
              <p className="text-xs font-bold text-slate-800">Gerenciar clientes</p>
              <p className="mt-1 text-[11px] text-slate-500">Lista, cadastro e status.</p>
            </button>
            <button type="button" onClick={() => onNavigate?.('criar')} className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-left hover:bg-slate-100">
              <p className="text-xs font-bold text-slate-800">Nova postagem</p>
              <p className="mt-1 text-[11px] text-slate-500">Criar e aprovar conteúdo.</p>
            </button>
            <button type="button" onClick={() => onNavigate?.('usuarios')} className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-left hover:bg-slate-100">
              <p className="text-xs font-bold text-slate-800">Usuários do cliente</p>
              <p className="mt-1 text-[11px] text-slate-500">Perfis e vínculos.</p>
            </button>
            <button type="button" onClick={() => onNavigate?.('logs')} className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-left hover:bg-slate-100">
              <p className="text-xs font-bold text-slate-800">Logs globais</p>
              <p className="mt-1 text-[11px] text-slate-500">Auditoria e suporte.</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
