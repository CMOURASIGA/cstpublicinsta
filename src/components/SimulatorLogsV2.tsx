import React, { useEffect, useState } from 'react';
import type { Cliente, LogMessage } from '../types';
import { apiFetch } from '../lib/api';
import { Terminal, Trash2, RefreshCw, AlertCircle, CheckCircle2, Info, ArrowUpRight } from 'lucide-react';

interface SimulatorLogsProps {
  onSimulateTick?: () => void;
  activeClient?: Cliente | null;
  isGlobalView?: boolean;
}

export default function SimulatorLogsV2({ onSimulateTick, activeClient, isGlobalView = false }: SimulatorLogsProps) {
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [serviceFilter, setServiceFilter] = useState<'TODOS' | LogMessage['service']>('TODOS');
  const [periodFilter, setPeriodFilter] = useState<'TODOS' | 'HOJE' | '7_DIAS' | '30_DIAS'>('TODOS');

  const logsEndpoint = isGlobalView
    ? '/api/admin/logs'
    : activeClient?.id
      ? `/api/clientes/${activeClient.id}/logs`
      : '/api/logs';

  const fetchLogs = async () => {
    try {
      setError('');
      const res = await apiFetch(logsEndpoint);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao carregar logs.');
      setLogs((data.logs || []) as LogMessage[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar logs.');
    }
  };

  const handleClear = async () => {
    try {
      await apiFetch('/api/logs/clear', { method: 'POST' });
      await fetchLogs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao limpar logs.');
    }
  };

  useEffect(() => {
    void fetchLogs();
    const interval = setInterval(() => {
      void fetchLogs();
    }, 4000);
    return () => clearInterval(interval);
  }, [logsEndpoint]);

  const filteredLogs = logs.filter((log) => {
    if (serviceFilter !== 'TODOS' && log.service !== serviceFilter) return false;
    if (periodFilter === 'TODOS') return true;
    const now = new Date();
    const createdAt = new Date(log.timestamp);
    const diffDays = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
    if (periodFilter === 'HOJE') return createdAt.toDateString() === now.toDateString();
    if (periodFilter === '7_DIAS') return diffDays <= 7;
    return diffDays <= 30;
  });

  const getServiceColor = (service: LogMessage['service']) => {
    switch (service) {
      case 'Database': return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
      case 'Google Drive': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
      case 'Instagram API': return 'text-pink-400 bg-pink-500/10 border-pink-500/20';
      case 'Scheduler': return 'text-sky-400 bg-sky-500/10 border-sky-500/20';
      case 'Gemini AI': return 'text-teal-400 bg-teal-500/10 border-teal-500/20';
      case 'Clientes': return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20';
      default: return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
    }
  };

  const getTypeIcon = (type: LogMessage['type']) => {
    switch (type) {
      case 'success': return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />;
      case 'warn': return <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />;
      case 'error': return <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />;
      default: return <Info className="h-4 w-4 shrink-0 text-blue-400" />;
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900 font-mono shadow-2xl">
      <div className="border-b border-slate-800 bg-slate-950/80 px-4 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-brand-secondary" />
            <span className="text-sm font-semibold text-slate-300">
              {isGlobalView ? 'Logs Globais da Plataforma' : `Logs do Cliente${activeClient ? `: ${activeClient.nome}` : ''}`}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={serviceFilter}
              onChange={(event) => setServiceFilter(event.target.value as typeof serviceFilter)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
              aria-label="Filtrar por servico"
            >
              <option value="TODOS">Todos os servicos</option>
              <option value="Clientes">Clientes</option>
              <option value="Database">Database</option>
              <option value="Google Drive">Google Drive</option>
              <option value="Instagram API">Instagram API</option>
              <option value="Scheduler">Scheduler</option>
              <option value="Gemini AI">Gemini AI</option>
            </select>
            <select
              value={periodFilter}
              onChange={(event) => setPeriodFilter(event.target.value as typeof periodFilter)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
              aria-label="Filtrar por periodo"
            >
              <option value="TODOS">Todo periodo</option>
              <option value="HOJE">Hoje</option>
              <option value="7_DIAS">Ultimos 7 dias</option>
              <option value="30_DIAS">Ultimos 30 dias</option>
            </select>
            {onSimulateTick && (
              <button
                onClick={async () => {
                  setLoading(true);
                  await onSimulateTick();
                  await fetchLogs();
                  setLoading(false);
                }}
                className="flex items-center gap-1 rounded border border-slate-700/80 bg-slate-800 px-3 py-1 text-xs text-brand-primary transition-all hover:bg-slate-700"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                Verificar Agendados
              </button>
            )}
            <button
              onClick={() => void handleClear()}
              className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
              title="Limpar logs"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-h-[340px] space-y-2 overflow-y-auto p-4 text-xs">
        {error ? (
          <div className="rounded-lg border border-rose-800 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-10 text-center italic text-slate-500">
            Nenhuma atividade encontrada para o filtro atual.
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div key={log.id} className="rounded-lg border border-slate-800/80 bg-slate-950/40 p-2.5 transition-all hover:bg-slate-950/60">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2.5">
                  {getTypeIcon(log.type)}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] text-slate-500">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${getServiceColor(log.service)}`}>
                        {log.service}
                      </span>
                    </div>
                    <p className="mt-1 break-words leading-relaxed text-slate-300">{log.message}</p>
                  </div>
                </div>

                {log.payload && (
                  <button
                    onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                    className="flex shrink-0 items-center gap-0.5 text-xs font-bold text-brand-secondary hover:text-brand-primary"
                  >
                    Payload <ArrowUpRight className="h-3 w-3" />
                  </button>
                )}
              </div>

              {log.payload && expandedLogId === log.id && (
                <pre className="mt-2.5 overflow-x-auto whitespace-pre-wrap rounded border border-slate-800/80 bg-slate-950 p-2 text-[10px] leading-tight text-emerald-300/90">
                  {log.payload}
                </pre>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
