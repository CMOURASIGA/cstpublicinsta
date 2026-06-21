import React, { useEffect, useState } from 'react';
import { Post, PostStatus } from '../types';
import { 
  Check, X, Edit3, Calendar, Send, AlertTriangle, Play, FileText, Image as ImageIcon, 
  Film, Loader2, ClipboardCheck, ArrowRight, Eye, Clock, User 
} from 'lucide-react';

interface ApproveListProps {
  onWorkflowComplete?: () => void;
  currentUser: string;
}

export default function ApproveList({ onWorkflowComplete, currentUser }: ApproveListProps) {
  const [pendingPosts, setPendingPosts] = useState<Post[]>([]);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(false);

  // Edit states for caption/hashtags
  const [isEditing, setIsEditing] = useState(false);
  const [editedLegenda, setEditedLegenda] = useState('');
  const [editedHashtags, setEditedHashtags] = useState('');

  // Rejection reason modal states
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // Scheduling states
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduleDateTime, setScheduleDateTime] = useState('');

  const fetchPending = async () => {
    try {
      const res = await fetch('/api/posts');
      const data = await res.json();
      if (data.posts) {
        const pending = data.posts.filter((p: Post) => p.status === 'PENDENTE');
        setPendingPosts(pending);
        
        // Auto select first post if none selected or the previous is gone
        if (pending.length > 0) {
          // Keep selection if it is still inside the pending array, else set first
          const stillPending = pending.find(p => p.id === selectedPost?.id);
          if (!stillPending) {
            setSelectedPost(pending[0]);
            setEditedLegenda(pending[0].legenda || '');
            setEditedHashtags(pending[0].hashtags || '');
          }
        } else {
          setSelectedPost(null);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const handlePostSelection = (post: Post) => {
    setSelectedPost(post);
    setEditedLegenda(post.legenda || '');
    setEditedHashtags(post.hashtags || '');
    setIsEditing(false);
    setShowRejectModal(false);
    setShowScheduleForm(false);
    
    // Smooth scroll to details on mobile devices
    setTimeout(() => {
      const element = document.getElementById('detalhes-moderar');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 80);
  };

  const handleUpdateCaption = async () => {
    if (!selectedPost) return;
    try {
      const res = await fetch(`/api/posts/${selectedPost.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'X-User-Name': currentUser
        },
        body: JSON.stringify({
          legenda: editedLegenda,
          hashtags: editedHashtags
        })
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedPost(data.post);
        setIsEditing(false);
        fetchPending();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePublishNow = async () => {
    if (!selectedPost) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/posts/${selectedPost.id}/approve`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-User-Name': currentUser
        },
        body: JSON.stringify({
          action: 'instant'
        })
      });
      if (res.ok) {
        setShowScheduleForm(false);
        fetchPending();
        if (onWorkflowComplete) onWorkflowComplete();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSchedulePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPost || !scheduleDateTime) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/posts/${selectedPost.id}/approve`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-User-Name': currentUser
        },
        body: JSON.stringify({
          action: 'schedule',
          appointmentTime: new Date(scheduleDateTime).toISOString()
        })
      });
      if (res.ok) {
        setShowScheduleForm(false);
        fetchPending();
        if (onWorkflowComplete) onWorkflowComplete();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRejectPost = async () => {
    if (!selectedPost) return;
    if (!rejectReason.trim()) {
      alert('Favor informar o motivo da reprovação ou os ajustes necessários.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/posts/${selectedPost.id}/reject`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-User-Name': currentUser
        },
        body: JSON.stringify({
          feedback: rejectReason
        })
      });
      if (res.ok) {
        setShowRejectModal(false);
        setRejectReason('');
        fetchPending();
        if (onWorkflowComplete) onWorkflowComplete();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-xl font-bold font-sans text-slate-800">Moderação e Aprovação de Posts</h2>
          <p className="text-xs text-slate-500 mt-1 font-sans">
            Revise as legendas sugeridas por usuários, faça uploads finais de mídias, agende datas no fuso horário local ou publique instantaneamente via Instagram Container API.
          </p>
        </div>
        <ClipboardCheck className="w-5 h-5 text-brand-secondary" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left pane: post list pending review */}
        <div className="lg:col-span-4 space-y-3">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">
            Fila de Espera ({pendingPosts.length})
          </h3>

          {pendingPosts.length === 0 ? (
            <div className="bg-white border border-slate-205 p-8 text-center rounded-xl space-y-2">
              <ClipboardCheck className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-700">Tudo em dia!</p>
              <p className="text-xs text-slate-400">Nenhum post pendente na fila neste instante.</p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[580px] overflow-y-auto pr-1">
              {pendingPosts.map((post) => (
                <button
                  key={post.id}
                  onClick={() => handlePostSelection(post)}
                  className={`w-full text-left p-4 rounded-xl border transition-all flex flex-col gap-2 ${
                    selectedPost?.id === post.id
                      ? 'border-brand-secondary bg-brand-light shadow-sm ring-2 ring-brand-primary/10'
                      : 'border-slate-250 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 w-full">
                    <span className="text-[10px] font-bold text-brand-secondary uppercase bg-brand-light border border-brand-primary/20 px-2 py-0.5 rounded">
                      {post.tipo === 'VIDEO' ? '🎥 Vídeo' : '🖼️ Imagem'}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(post.criado_em).toLocaleDateString('pt-BR')}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-800 line-clamp-1">{post.titulo}</h4>
                    <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-relaxed">{post.legenda}</p>
                  </div>

                  <div className="border-t border-slate-100/80 pt-2 flex items-center justify-between w-full text-[10px] text-slate-400">
                    <span className="truncate max-w-[120px] flex items-center gap-1">
                      👤 {post.criado_por_nome || 'Equipe'}
                    </span>
                    <span className="font-semibold text-slate-600 flex items-center gap-0.5">
                      Revisar <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right pane: detailed post audit & edit panel */}
        <div className="lg:col-span-8" id="detalhes-moderar">
          {selectedPost ? (
            <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm space-y-6">
              
              {/* Header block info */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                      Pendente Homologação
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">ID: {selectedPost.id}</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 mt-1.5">{selectedPost.titulo}</h3>
                  <div className="mt-1 flex flex-wrap gap-2 text-[10.5px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3 text-slate-400" /> Cadastrado por: <strong className="text-slate-700 font-medium">{selectedPost.criado_por_nome || 'Marketing Team'}</strong>
                    </span>
                    <span className="text-slate-300">•</span>
                    <span>Criado em: {new Date(selectedPost.criado_em).toLocaleString('pt-BR')}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    className="p-2 sm:px-3 text-xs font-semibold text-slate-700 hover:text-brand-secondary bg-slate-55 border border-slate-200 hover:border-brand-secondary rounded-lg flex items-center gap-1.5 transition-colors shrink-0"
                  >
                    <Edit3 className="w-4 h-4" />
                    <span className="hidden sm:inline">{isEditing ? 'Cancelar Edição' : 'Editar Legenda'}</span>
                  </button>
                </div>
              </div>

              {/* Media viewer and main captions contents */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                <div className="md:col-span-5 space-y-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Preview da Mídia</span>
                  
                  {/* Smartphone Mockup */}
                  <div className="w-full max-w-[270px] mx-auto bg-slate-50 rounded-[2.5rem] border-8 border-slate-900 shadow-lg overflow-hidden relative flex flex-col font-sans mb-3 select-none">
                    {/* Speaker notch */}
                    <div className="h-4 bg-slate-900 w-1/3 mx-auto rounded-b-xl mb-1 shrink-0"></div>
                    
                    {/* Profile Header */}
                    <div className="px-3.5 py-2 flex items-center justify-between border-b border-slate-100 shrink-0 bg-white">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-pink-500 via-red-500 to-yellow-500 flex items-center justify-center text-[8px] font-bold text-white uppercase">
                          IG
                        </div>
                        <div className="leading-none text-left">
                          <span className="text-[10px] font-bold text-slate-800 block leading-tight">suamarca_oficial</span>
                          <span className="text-[8px] text-slate-400">Patrocinado</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5">
                        <span className="w-1 h-1 rounded-full bg-slate-400"></span>
                        <span className="w-1 h-1 rounded-full bg-slate-400"></span>
                        <span className="w-1 h-1 rounded-full bg-slate-400"></span>
                      </div>
                    </div>

                    {/* Media Body Frame */}
                    <div className="aspect-square w-full bg-slate-950 flex items-center justify-center overflow-hidden shrink-0 relative">
                      {selectedPost.drive_url ? (
                        selectedPost.tipo === 'VIDEO' ? (
                          <>
                            <video src={selectedPost.drive_url} className="w-full h-full object-cover" muted loops autoPlay playsInline controls />
                            <div className="absolute top-2 right-2 p-1 bg-black/60 text-white rounded text-[8px] pointer-events-none uppercase font-semibold">
                              MP4 Video
                            </div>
                          </>
                        ) : (
                          <>
                            <img src={selectedPost.drive_url} alt="mockup content preview" className="w-full h-full object-cover" />
                            <div className="absolute top-2 right-2 p-1 bg-black/60 text-white rounded text-[8px] pointer-events-none uppercase font-semibold">
                              PNG Image
                            </div>
                          </>
                        )
                      ) : (
                        <div className="flex flex-col items-center justify-center text-slate-500 text-[10px] p-4 text-center">
                          <svg className="w-8 h-8 text-slate-700 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          <span>Mídia não vinculada</span>
                        </div>
                      )}
                    </div>

                    {/* Meta interaction bar */}
                    <div className="px-3 py-2 flex items-center justify-between bg-white border-t border-slate-50 shrink-0 text-slate-700">
                      <div className="flex items-center gap-3">
                        <svg className="w-4 h-4 text-slate-700 hover:text-red-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318z" /></svg>
                        <svg className="w-4 h-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                        <svg className="w-4 h-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                      </div>
                      <svg className="w-4 h-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                    </div>

                    {/* Feed Captions mockup rendering */}
                    <div className="px-3.5 pb-4 pt-1 bg-white text-left text-[10px] leading-relaxed max-h-[90px] overflow-y-auto">
                      <p className="text-slate-800">
                        <span className="font-bold mr-1">suamarca_oficial</span>
                        <span className="text-slate-600 truncate">{isEditing ? editedLegenda : (selectedPost.legenda || 'Preenchimento em aprovação...')}</span>
                      </p>
                      <span className="text-brand-secondary block font-bold mt-1 truncate">
                        {isEditing ? editedHashtags : selectedPost.hashtags}
                      </span>
                    </div>
                  </div>

                  {selectedPost.drive_file_id && (
                    <div className="bg-slate-50 px-3 py-2 border border-slate-100 rounded-lg text-[10px] font-mono text-slate-500 break-all leading-normal text-center">
                      📂 FileID Drive: <code className="text-amber-800 font-semibold">{selectedPost.drive_file_id}</code>
                    </div>
                  )}
                </div>

                <div className="md:col-span-7 space-y-4">
                  {isEditing ? (
                    <div className="space-y-3 bg-slate-50 p-4 border border-slate-150 rounded-xl">
                      <span className="text-[10px] font-bold text-brand-secondary uppercase block tracking-wider">Editor Legenda / Hashtags</span>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-1">Legenda Principal</label>
                        <textarea
                          rows={4}
                          value={editedLegenda}
                          onChange={(e) => setEditedLegenda(e.target.value)}
                          className="w-full text-xs p-2.5 border border-slate-200 outline-none focus:border-brand-primary rounded-lg bg-white leading-normal"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-1">Hashtags</label>
                        <input
                          type="text"
                          value={editedHashtags}
                          onChange={(e) => setEditedHashtags(e.target.value)}
                          className="w-full text-xs p-2.5 border border-slate-200 outline-none focus:border-brand-primary rounded-lg bg-white"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleUpdateCaption}
                        className="px-3 py-1.5 bg-brand-secondary hover:bg-brand-primary text-brand-darker rounded text-xs font-bold flex items-center gap-1 shadow-sm transition-all border border-brand-primary/10"
                      >
                        Salvar Alterações
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Texto de Legenda</span>
                        <div className="bg-slate-50/50 p-4 border border-slate-100 rounded-xl text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                          {selectedPost.legenda || <span className="italic text-slate-400">Nenhuma legenda cadastrada.</span>}
                        </div>
                      </div>

                      {selectedPost.hashtags && (
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Hashtags Estratégicas</span>
                          <p className="text-xs text-indigo-600 font-semibold tracking-wide bg-indigo-50/30 p-2.5 rounded-lg border border-indigo-100/30">
                            {selectedPost.hashtags}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons trigger forms */}
              {!showRejectModal && !showScheduleForm && (
                <div className="border-t border-slate-100 pt-5 flex flex-wrap gap-3">
                  <button
                    onClick={() => setShowRejectModal(true)}
                    className="flex-1 min-w-[130px] py-2.5 border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all"
                  >
                    <X className="w-4 h-4" /> Reprovar / Solicitar Ajustes
                  </button>

                  <button
                    onClick={() => {
                      setShowScheduleForm(true);
                      // Default schedule default: 1 hour from now
                      const inOneHour = new Date(Date.now() + 60 * 60 * 1000);
                      // Formats into local datetime-local input string: YYYY-MM-DDTHH:MM
                      const year = inOneHour.getFullYear();
                      const month = String(inOneHour.getMonth() + 1).padStart(2, '0');
                      const day = String(inOneHour.getDate()).padStart(2, '0');
                      const hours = String(inOneHour.getHours()).padStart(2, '0');
                      const minutes = String(inOneHour.getMinutes()).padStart(2, '0');
                      setScheduleDateTime(`${year}-${month}-${day}T${hours}:${minutes}`);
                    }}
                    className="flex-1 min-w-[130px] py-2.5 border border-slate-200 bg-slate-50 hover:bg-slate-150 text-slate-700 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Calendar className="w-4 h-4" /> Agendar Publicação
                  </button>

                  <button
                    onClick={handlePublishNow}
                    disabled={loading}
                    className="flex-1 min-w-[150px] py-2.5 bg-brand-secondary hover:bg-brand-primary text-brand-darker text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 shadow-md transition-all hover:shadow-brand-secondary/20 border border-brand-primary/15"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 text-amber-300" />
                    )}
                    Aprovar e Publicar Agora
                  </button>
                </div>
              )}

              {/* Reject Feedback input screen */}
              {showRejectModal && (
                <div className="border-t-2 border-rose-100 bg-rose-50/20 p-4 sm:p-5 rounded-xl space-y-3.5">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="w-5 h-5 text-rose-600" />
                    <span className="text-xs font-semibold text-rose-850">Informação de Ajustes ao Redator</span>
                  </div>
                  <p className="text-[11px] text-slate-500">Escreva as indicações/rejeição. O autor receberá uma notificação do ajuste e o post retornará para o estado REJEITADA para retrabalho.</p>
                  <div>
                    <textarea
                      rows={3}
                      required
                      placeholder="e.g. Por favor, adicione 3 hashtags brasileiras estratégicas do ramo corporativo e aumente a cordialidade do parágrafo final."
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      className="w-full text-xs p-2.5 border border-rose-200 outline-none focus:border-rose-500 rounded-lg bg-white"
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => setShowRejectModal(false)}
                      className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleRejectPost}
                      className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-semibold"
                    >
                      Enviar Rejeição
                    </button>
                  </div>
                </div>
              )}

              {/* Schedule time configuration screen */}
              {showScheduleForm && (
                <form onSubmit={handleSchedulePost} className="border-t-2 border-brand-primary/30 bg-brand-light/30 p-4 sm:p-5 rounded-xl space-y-4">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-5 h-5 text-brand-secondary" />
                    <span className="text-xs font-bold text-brand-darker">Agendar Data e Hora de Disparo</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Insira o dia e horário que a automação executará a publicação no feed do Instagram. O scheduler consultará essa meta e publicará no momento configurado.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 mb-1">Escolha Data e Hora</label>
                      <input
                        type="datetime-local"
                        required
                        value={scheduleDateTime}
                        onChange={(e) => setScheduleDateTime(e.target.value)}
                        className="w-full text-xs p-2.5 border border-slate-200 outline-none focus:border-brand-primary rounded-lg bg-white"
                      />
                    </div>
                    <div className="flex gap-2">
                       <button
                        type="button"
                        onClick={() => setShowScheduleForm(false)}
                        className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="flex-1 py-2.5 bg-brand-secondary hover:bg-brand-primary text-brand-darker rounded-lg text-xs font-bold flex items-center justify-center gap-1 shadow-md border border-brand-primary/10"
                      >
                        Confirmar Agenda
                      </button>
                    </div>
                  </div>
                </form>
              )}

            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 h-[480px] rounded-xl flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <Eye className="w-12 h-12 text-slate-300 mb-2" />
              <p className="text-sm font-semibold text-slate-700">Selecione uma publicação à esquerda</p>
              <p className="text-xs text-slate-500 mt-1">Carregue ou escolha uma postagem pendente para analisar as legendas e autorizar a postagem.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
