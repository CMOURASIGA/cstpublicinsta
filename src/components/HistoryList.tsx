import React, { useEffect, useState } from 'react';
import { HistoricoPost, PostStatus } from '../types';
import { apiFetch } from '../lib/api';
import { Search, History, Calendar, User, Filter, AlertCircle } from 'lucide-react';

export default function HistoryList() {
  const [history, setHistory] = useState<HistoricoPost[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<HistoricoPost[]>([]);
  
  // Filter states
  const [filterUser, setFilterUser] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPeriod, setFilterPeriod] = useState('all'); // 'all', 'today', 'week', 'month'

  const fetchHistory = async () => {
    try {
      const res = await apiFetch('/api/history');
      const data = await res.json();
      if (data.history) {
        setHistory(data.history);
        setFilteredHistory(data.history);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    let result = [...history];

    // Filter by user
    if (filterUser) {
      result = result.filter(h => 
        h.usuario.toLowerCase().includes(filterUser.toLowerCase())
      );
    }

    // Filter by action/status
    if (filterStatus) {
      result = result.filter(h => {
        const textToMatch = (h.acao + ' ' + (h.observacao || '')).toLowerCase();
        return textToMatch.includes(filterStatus.toLowerCase());
      });
    }

    // Filter by period
    if (filterPeriod !== 'all') {
      const now = new Date();
      result = result.filter(h => {
        const logDate = new Date(h.criado_em);
        const differenceInMs = now.getTime() - logDate.getTime();
        const differenceInDays = differenceInMs / (1000 * 60 * 60 * 24);

        if (filterPeriod === 'today') {
          return logDate.toDateString() === now.toDateString();
        } else if (filterPeriod === 'week') {
          return differenceInDays <= 7;
        } else if (filterPeriod === 'month') {
          return differenceInDays <= 30;
        }
        return true;
      });
    }

    setFilteredHistory(result);
  }, [filterUser, filterStatus, filterPeriod, history]);

  const getActionColor = (action: string) => {
    const act = action.toLowerCase();
    if (act.includes('aprov')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (act.includes('rejeit') || act.includes('recus')) return 'bg-rose-50 text-rose-700 border-rose-200';
    if (act.includes('publi')) return 'bg-purple-50 text-purple-700 border-purple-200';
    if (act.includes('envio') || act.includes('pend')) return 'bg-amber-50 text-amber-700 border-amber-200';
    if (act.includes('agend')) return 'bg-sky-50 text-sky-700 border-sky-200';
    return 'bg-slate-50 text-slate-700 border-slate-200';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-xl font-bold font-sans text-slate-800">Histórico e Auditoria</h2>
          <p className="text-xs text-slate-500 mt-1">
            Veja a linha do tempo de aprovações, edições, reversões e publicações automáticas executadas no sistema.
          </p>
        </div>
        <History className="w-5 h-5 text-brand-secondary" />
      </div>

      {/* Filter panel */}
      <div className="bg-white p-4 border border-slate-200 rounded-xl shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1">
            <User className="w-3 h-3 text-slate-400" /> Colaborador (Usuário)
          </label>
          <input
            type="text"
            placeholder="Filtrar por nome..."
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            className="w-full text-xs border border-slate-200 rounded-lg p-2.5 outline-none focus:border-brand-primary"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1">
            <Filter className="w-3 h-3 text-slate-400" /> Ação ou Palavra-chave
          </label>
          <input
            type="text"
            placeholder="Ex: Rejeitado, Criado, Publicado"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full text-xs border border-slate-200 rounded-lg p-2.5 outline-none focus:border-brand-primary"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1">
            <Calendar className="w-3 h-3 text-slate-400" /> Período
          </label>
          <select
            value={filterPeriod}
            onChange={(e) => setFilterPeriod(e.target.value)}
            className="w-full text-xs border border-slate-200 rounded-lg p-2.5 outline-none focus:border-brand-primary bg-white"
          >
            <option value="all">Sempre (Histórico Completo)</option>
            <option value="today">Apenas Hoje</option>
            <option value="week">Últimos 7 dias</option>
            <option value="month">Últimos 30 dias</option>
          </select>
        </div>

        <div>
          <button 
            type="button"
            onClick={() => {
              setFilterUser('');
              setFilterStatus('');
              setFilterPeriod('all');
            }}
            className="w-full text-xs text-brand-secondary hover:text-brand-primary bg-brand-light hover:bg-brand-primary/15 rounded-lg py-2.5 font-bold transition-colors"
          >
            Limpar Filtros
          </button>
        </div>
      </div>

      {/* History table list */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
            Logs Oficiais de Auditoria ({filteredHistory.length})
          </span>
        </div>

        {filteredHistory.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <AlertCircle className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm font-medium">Nenhum registro encontrado</p>
            <p className="text-xs">Experimente limpar ou reposicionar filtros ativos acima.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredHistory.map((item) => (
              <div 
                key={item.id} 
                className="p-4 sm:px-6 hover:bg-slate-50/50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 md:max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${getActionColor(item.acao)}`}>
                      {item.acao}
                    </span>
                    <h4 className="text-xs font-semibold text-slate-800">
                      {item.post_titulo || "Postagem Excluída"}
                    </h4>
                    <span className="text-[10px] text-slate-400">
                      ID: {item.post_id?.substring(0, 8)}...
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {item.observacao}
                  </p>
                </div>

                <div className="flex md:flex-col items-center md:items-end justify-between text-[10px] text-slate-400 shrink-0 border-t md:border-t-0 pt-2 md:pt-0 border-slate-100">
                  <div className="flex items-center gap-1">
                    <User className="w-3 h-3 text-slate-400" />
                    <span className="text-slate-600 font-medium">{item.usuario}</span>
                  </div>
                  <div className="flex items-center gap-1 md:mt-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    <span>
                      {new Date(item.criado_em).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </span>
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
