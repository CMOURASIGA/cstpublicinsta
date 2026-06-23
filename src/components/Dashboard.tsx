import React, { useEffect, useState } from 'react';
import { Post, HistoricoPost, PostStatus } from '../types';
import { apiFetch } from '../lib/api';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, Cell, PieChart, Pie
} from 'recharts';
import { 
  Clock, CheckCircle, AlertOctagon, Calendar, Send, Activity, User, Eye, 
  ExternalLink, Sparkles, Heart, MessageCircle, Tablet, RefreshCw, Layers
} from 'lucide-react';

interface DashboardProps {
  onNavigate?: (screen: string) => void;
  onSimulateTick?: () => Promise<number>;
}

export default function Dashboard({ onNavigate, onSimulateTick }: DashboardProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [history, setHistory] = useState<HistoricoPost[]>([]);
  const [tickProcessing, setTickProcessing] = useState(false);
  const [tickResult, setTickResult] = useState<string | null>(null);

  // Stats
  const [stats, setStats] = useState({
    pending: 0,
    published: 0,
    rejectedCurrent: 0,
    rejectedEvents: 0,
    scheduled: 0,
    total: 0
  });

  const fetchData = async () => {
    try {
      const resPosts = await apiFetch('/api/posts');
      const dataPosts = await resPosts.json();
      if (dataPosts.posts) {
        setPosts(dataPosts.posts);
        
        // Calculate counters
        const p = dataPosts.posts;
        setStats({
          pending: p.filter((item: Post) => item.status === 'PENDENTE').length,
          published: p.filter((item: Post) => item.status === 'PUBLICADA').length,
          rejectedCurrent: p.filter((item: Post) => item.status === 'REJEITADA').length,
          rejectedEvents: 0,
          scheduled: p.filter((item: Post) => item.status === 'AGENDADA').length,
          total: p.length
        });
      }

      const resHist = await apiFetch('/api/history');
      const dataHist = await resHist.json();
      if (dataHist.history) {
        const historyItems = dataHist.history as HistoricoPost[];
        setHistory(historyItems.slice(0, 5)); // Last 5 activities
        setStats((current) => ({
          ...current,
          rejectedEvents: historyItems.filter((item) => {
            const action = (item.acao || '').toLowerCase();
            return action.includes('rejeit') || action.includes('recus');
          }).length,
        }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5050);
    return () => clearInterval(interval);
  }, []);

  const triggerTick = async () => {
    if (!onSimulateTick) return;
    setTickProcessing(true);
    setTickResult(null);
    try {
      const count = await onSimulateTick();
      if (count > 0) {
        setTickResult(`Sucesso! ${count} post(s) agendado(s) liberado(s) para publicação.`);
        fetchData();
      } else {
        setTickResult("Nenhum post agendado atingiu o horário ainda.");
      }
      setTimeout(() => setTickResult(null), 4000);
    } catch (err) {
      console.error(err);
    } finally {
      setTickProcessing(false);
    }
  };

  // Chart data preparing
  const chartData = [
    { name: 'Rascunho', valor: posts.filter(p => p.status === 'RASCUNHO').length, fill: '#94a3b8' },
    { name: 'Pendentes', valor: stats.pending, fill: '#f59e0b' },
    { name: 'Agendadas', valor: stats.scheduled, fill: '#0096DB' },
    { name: 'Publicadas', valor: stats.published, fill: '#00A1E0' },
    { name: 'Devolvidas', valor: stats.rejectedCurrent, fill: '#f43f5e' },
  ];

  // Simulated Published posts filter
  const publishedFeed = posts.filter(p => p.status === 'PUBLICADA');

  return (
    <div className="space-y-6">
      
      {/* Intro section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold font-sans text-slate-800 tracking-tight">Painel de Monitoramento Geral</h2>
          <p className="text-xs text-slate-500 mt-0.5">Visão unificada das postagens do Instagram, arquivos no Drive e logs do integrador.</p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {onSimulateTick && (
            <button
              onClick={triggerTick}
              disabled={tickProcessing}
              className="w-full sm:w-auto justify-center py-2 px-3 text-xs font-semibold bg-brand-light text-brand-secondary hover:bg-brand-primary/15 rounded-lg border border-brand-primary/20 flex items-center gap-1.5 transition-all shadow-sm shrink-0"
              title="Varre postagens agendadas de forma síncrona"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${tickProcessing ? 'animate-spin' : ''}`} />
              Sincronizar Relógio (Scheduler)
            </button>
          )}
        </div>
      </div>

      {tickResult && (
        <div className="bg-brand-light border border-brand-primary/20 text-brand-secondary text-xs py-2.5 px-4 rounded-lg flex items-center gap-2 animate-pulse">
          <Clock className="w-4 h-4 text-brand-secondary shrink-0" />
          <span className="font-semibold">{tickResult}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 min-[440px]:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Pending */}
        <div 
          onClick={() => onNavigate?.('aprovacao')} 
          className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm hover:shadow-md hover:border-amber-400 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Aguardando Avaliação</span>
            <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-850 font-sans">{stats.pending}</span>
            <span className="text-[10px] text-amber-600 font-semibold">Pendentes</span>
          </div>
        </div>

        {/* Scheduled */}
        <div 
          onClick={() => onNavigate?.('historico')} 
          className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm hover:shadow-md hover:border-sky-400 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Programadas</span>
            <div className="p-1.5 bg-sky-50 text-sky-600 rounded-lg">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-850 font-sans">{stats.scheduled}</span>
            <span className="text-[10px] text-sky-600 font-semibold">Agendadas</span>
          </div>
        </div>

        {/* Published */}
        <div 
          onClick={() => onNavigate?.('historico')} 
          className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm hover:shadow-md hover:border-brand-primary transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Postadas Feed</span>
            <div className="p-1.5 bg-brand-light text-brand-secondary rounded-lg">
              <Send className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-850 font-sans">{stats.published}</span>
            <span className="text-[10px] text-brand-secondary font-bold">No Instagram</span>
          </div>
        </div>

        {/* Rejected */}
        <div 
          onClick={() => onNavigate?.('historico')} 
          className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm hover:shadow-md hover:border-rose-400 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Necessitam Ajuste</span>
            <div className="p-1.5 bg-rose-50 text-rose-500 rounded-lg">
              <AlertOctagon className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-850 font-sans">{stats.rejectedEvents}</span>
            <span className="text-[10px] text-rose-500 font-semibold font-sans">Recusas registradas</span>
          </div>
          <p className="mt-2 text-[10px] text-slate-400">Em ajuste agora: {stats.rejectedCurrent}</p>
        </div>

      </div>

      {/* Main Charts & Feed simulator block */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Analytics status bar design */}
        <div className="lg:col-span-4 bg-white p-4 sm:p-5 border border-slate-200 rounded-xl shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-brand-secondary" /> Distribuição de Conteúdo
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Indicador acumulado por estado dos posts.</p>
          </div>

          <div className="h-[180px] sm:h-[200px] w-full my-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ left: -24, right: 10, top: 10 }}>
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={10} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip 
                  contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
                />
                <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, idx) => (
                    <Cell key={`cell-${idx}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="divide-y divide-slate-100/80 text-[11px]">
            <div className="flex justify-between py-1.5">
              <span className="text-slate-500 flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-[#f59e0b]"></span> Pendentes</span>
              <strong className="text-slate-700">{stats.pending}</strong>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-500 flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-[#0096DB]"></span> Agendadas</span>
              <strong className="text-slate-700">{stats.scheduled}</strong>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-500 flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-[#00A1E0]"></span> Publicadas</span>
              <strong className="text-slate-700">{stats.published}</strong>
            </div>
          </div>
        </div>

        {/* Simulated Live Instagram Feed Widget */}
        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 text-white p-4 sm:p-5 rounded-xl flex flex-col justify-between shadow-lg">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 min-w-0">
              <Tablet className="w-4 h-4 text-pink-400" />
              <div className="min-w-0">
                <h3 className="font-bold text-sm text-slate-100">Live Feed Simulador (Aparência Canal)</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Posts com status PUBLICADA aparecem ao público neste grid.</p>
              </div>
            </div>
            <span className="w-fit text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
              Online Feed Sandbox
            </span>
          </div>

          {publishedFeed.length === 0 ? (
            <div className="py-12 text-center text-slate-500 italic text-xs space-y-2 my-auto">
              <p>Nenhuma publicação ativa no momento.</p>
              <p className="text-[10px] text-slate-600">Aprove posts na aba "Moderação" para ver a grade se alimentar ao vivo.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 my-4 overflow-y-auto max-h-[260px] p-0.5">
              {publishedFeed.map((post) => (
                <div 
                  key={post.id} 
                  className="bg-slate-950 border border-slate-850 rounded-lg overflow-hidden group relative flex flex-col justify-between"
                >
                  <div className="relative aspect-square w-full">
                    {post.drive_url ? (
                      post.tipo === 'VIDEO' ? (
                        <video src={post.drive_url} className="w-full h-full object-cover bg-slate-900" muted />
                      ) : (
                        <img src={post.drive_url} alt="feed post" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      )
                    ) : (
                      <div className="w-full h-full bg-slate-800 flex items-center justify-center">No Media</div>
                    )}

                    {/* Hover detail info */}
                    <div className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3">
                      <div className="flex items-center justify-between text-[10px] font-bold">
                        <span className="text-brand-primary uppercase text-[9px]">{post.tipo}</span>
                        <span className="text-slate-400">{new Date(post.data_publicacao || post.criado_em).toLocaleDateString()}</span>
                      </div>
                      <p className="text-[9.5px] leading-relaxed text-slate-200 line-clamp-4 font-sans italic my-2">
                        "{post.legenda}"
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-800 pt-1.5">
                        <span className="flex items-center gap-0.5 text-pink-400"><Heart className="w-3 h-3 fill-pink-400 text-pink-400" /> {Math.floor(15 + Math.random() * 250)}</span>
                        <span className="flex items-center gap-0.5"><MessageCircle className="w-3 h-3" /> {Math.floor(2 + Math.random() * 30)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-2 text-[10px] text-slate-400 bg-slate-950/90 truncate border-t border-slate-900">
                    <span className="font-semibold text-slate-300 block truncate">{post.titulo}</span>
                    <span className="text-[9px] text-brand-primary mt-0.5 block truncate">{post.hashtags}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="text-[11px] text-slate-400 bg-slate-950/40 p-3 rounded-lg border border-slate-800/60 leading-normal flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>
              Ao contrário de integrações rudimentares, nosso sistema sincroniza o post de destino usando buffers diretos da nuvem Google Drive, blindando a compressão nativa do Instagram.
            </span>
          </div>
        </div>

      </div>

      {/* Grid: Recent activities from history */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 sm:px-5 py-4 bg-slate-50 border-b border-slate-200 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="font-bold text-xs text-slate-600 uppercase tracking-wide flex items-center gap-2">
            <Activity className="w-4 h-4 text-brand-secondary" /> Atividades Recentes de Auditoria (Últimas 5)
          </h3>
          <button 
            type="button" 
            onClick={() => onNavigate?.('historico')} 
            className="text-xs text-brand-secondary hover:text-brand-primary font-bold"
          >
            Ver Histórico Completo
          </button>
        </div>

        {history.length === 0 ? (
          <div className="p-8 text-center text-slate-400 italic text-xs">
            Nenhuma atividade foi auditada no banco de dados ainda.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {history.map((log) => (
              <div key={log.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800">{log.post_titulo || 'Sistema'}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 font-medium">
                      {log.acao}
                    </span>
                  </div>
                  <p className="text-slate-500 leading-normal">{log.observacao}</p>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between shrink-0 text-[10px] text-slate-400 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 gap-3 sm:gap-0">
                  <span className="font-medium text-slate-700 flex items-center gap-0.5">👤 {log.usuario}</span>
                  <span className="sm:mt-0.5">{new Date(log.criado_em).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
