import React, { useEffect, useState } from 'react';
import { LogMessage } from '../types';
import { apiFetch } from '../lib/api';
import { Terminal, Trash2, RefreshCw, AlertCircle, CheckCircle2, Info, ArrowUpRight } from 'lucide-react';

interface SimulatorLogsProps {
  onSimulateTick?: () => void;
}

export default function SimulatorLogs({ onSimulateTick }: SimulatorLogsProps) {
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const fetchLogs = async () => {
    try {
      const res = await apiFetch('/api/logs');
      const data = await res.json();
      if (data.logs) {
        setLogs(data.logs);
      }
    } catch (err) {
      console.error('Failure fetching logs', err);
    }
  };

  const handleClear = async () => {
    try {
      await apiFetch('/api/logs/clear', { method: 'POST' });
      fetchLogs();
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 4000);
    return () => clearInterval(interval);
  }, []);

  const getServiceColor = (service: LogMessage['service']) => {
    switch (service) {
      case 'Database': return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
      case 'Google Drive': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
      case 'Instagram API': return 'text-pink-400 bg-pink-500/10 border-pink-500/20';
      case 'Scheduler': return 'text-sky-400 bg-sky-500/10 border-sky-500/20';
      case 'Gemini AI': return 'text-teal-400 bg-teal-500/10 border-teal-500/20';
      default: return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
    }
  };

  const getTypeIcon = (type: LogMessage['type']) => {
    switch (type) {
      case 'success': return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
      case 'warn': return <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />;
      default: return <Info className="w-4 h-4 text-blue-400 shrink-0" />;
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden font-mono shadow-2xl">
      <div className="bg-slate-950/80 px-4 py-3 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Terminal className="w-5 h-5 text-brand-secondary" />
          <span className="text-sm font-semibold text-slate-300">Console do Simulador de Integrações</span>
        </div>
        <div className="flex items-center gap-2">
          {onSimulateTick && (
            <button
              onClick={async () => {
                setLoading(true);
                await onSimulateTick();
                await fetchLogs();
                setLoading(false);
              }}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-xs text-brand-primary rounded border border-slate-700/80 flex items-center gap-1 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Verificar Agendados (Tick)
            </button>
          )}
          <button
            onClick={handleClear}
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
            title="Limpar logs"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="max-h-[340px] overflow-y-auto p-4 space-y-2 text-xs">
        {logs.length === 0 ? (
          <div className="text-center py-10 text-slate-500 italic">
            Nenhuma atividade registrada no console até o momento.
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className="bg-slate-950/40 border border-slate-800/80 rounded-lg p-2.5 transition-all hover:bg-slate-950/60"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  {getTypeIcon(log.type)}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] text-slate-500">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getServiceColor(log.service)}`}>
                        {log.service}
                      </span>
                    </div>
                    <p className="text-slate-300 mt-1 leading-relaxed break-words">
                      {log.message}
                    </p>
                  </div>
                </div>

                {log.payload && (
                  <button
                    onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                    className="text-xs text-brand-secondary hover:text-brand-primary flex items-center gap-0.5 shrink-0 font-bold"
                  >
                    Payload <ArrowUpRight className="w-3 h-3" />
                  </button>
                )}
              </div>

              {log.payload && expandedLogId === log.id && (
                <pre className="mt-2.5 p-2 bg-slate-950 rounded text-[10px] border border-slate-800/80 text-emerald-300/90 overflow-x-auto whitespace-pre-wrap leading-tight font-mono">
                  {log.payload}
                </pre>
              )}
            </div>
          ))
        )}
      </div>

      <div className="bg-slate-950/60 px-4 py-2 border-t border-slate-800 text-[10px] text-slate-500 flex justify-between items-center">
        <span>Monitoramento Ativo (Atualização a cada 4s)</span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Conexão Local Simulada
        </span>
      </div>
    </div>
  );
}
