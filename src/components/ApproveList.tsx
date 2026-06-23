import React, { useEffect, useMemo, useState } from 'react';
import { Post, Usuario } from '../types';
import { apiFetch } from '../lib/api';
import { AlertTriangle, ArrowRight, Calendar, ClipboardCheck, Clock, Edit3, Eye, Loader2, Scissors, Send, UploadCloud, User, X } from 'lucide-react';

interface ApproveListProps { onWorkflowComplete?: () => void; currentUser: Usuario; }
interface MediaValidation { state:'idle'|'loading'|'ready'|'error'; width:number; height:number; aspectRatio:number; displayAspectRatio:number; isFeedCompatible:boolean; blockingIssues:string[]; warnings:string[]; recommendedLabel:string; previewLabel:string; }
type CropPresetId = 'original'|'vertical'|'square'|'horizontal';
const DEFAULT_MEDIA_VALIDATION: MediaValidation = { state:'idle', width:0, height:0, aspectRatio:1, displayAspectRatio:1, isFeedCompatible:false, blockingIssues:[], warnings:[], recommendedLabel:'', previewLabel:'Prévia do feed' };
const CROP_PRESETS = [
  { id:'original' as CropPresetId, label:'Original', description:'Mantém a proporção atual', aspectRatio:1, width:0, height:0 },
  { id:'vertical' as CropPresetId, label:'Vertical Feed', description:'4:5 recomendado', aspectRatio:4/5, width:1080, height:1350 },
  { id:'square' as CropPresetId, label:'Quadrado', description:'1:1', aspectRatio:1, width:1080, height:1080 },
  { id:'horizontal' as CropPresetId, label:'Horizontal', description:'1.91:1', aspectRatio:1.91, width:1080, height:566 },
];

const roundAspectRatio = (v:number) => Math.round(v * 100) / 100;

async function getMediaMetadata(url:string, tipo:Post['tipo']) {
  if (tipo === 'VIDEO' || tipo === 'REELS') {
    return await new Promise<{width:number;height:number}>((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => resolve({ width: video.videoWidth, height: video.videoHeight });
      video.onerror = () => reject(new Error('Falha ao ler metadados do vídeo.'));
      video.src = url;
    });
  }
  return await new Promise<{width:number;height:number}>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error('Falha ao ler metadados da imagem.'));
    image.src = url;
  });
}

function validateMedia(post:Post, width:number, height:number): MediaValidation {
  const ratio = width / height;
  const blockingIssues:string[] = [];
  const warnings:string[] = [];
  if (post.tipo === 'REELS') {
    if (ratio < 0.56 || ratio > 0.8) blockingIssues.push('Reels devem usar formato vertical entre 9:16 e 4:5.');
    if (Math.abs(ratio - 9 / 16) > 0.03) warnings.push('O formato ideal para reel é 1080 x 1920 (9:16).');
  } else {
    if (ratio < 0.8 || ratio > 1.91) blockingIssues.push('Posts de feed devem ficar entre 4:5 e 1.91:1.');
    if (width < 1080) warnings.push('A largura está abaixo de 1080 px.');
  }
  return {
    state:'ready', width, height, aspectRatio:ratio, displayAspectRatio: post.tipo === 'REELS' ? 9 / 16 : Math.min(1.91, Math.max(0.8, ratio)),
    isFeedCompatible:blockingIssues.length === 0, blockingIssues, warnings,
    recommendedLabel: post.tipo === 'REELS' ? '1080 x 1920 (9:16)' : '1080 x 1350 (4:5), 1080 x 1080 (1:1) ou 1080 x 566 (1.91:1)',
    previewLabel: post.tipo === 'REELS' ? 'Prévia de reel com área segura no feed' : 'Prévia realista do feed',
  };
}

function PhonePreview({ post, legenda, hashtags, validation }: { post:Post; legenda:string; hashtags:string; validation:MediaValidation }) {
  return (
    <div className="w-full max-w-[316px] mx-auto rounded-[2.8rem] border-[10px] border-slate-950 bg-slate-950 shadow-[0_24px_80px_rgba(15,23,42,0.22)] overflow-hidden">
      <div className="mx-auto mt-0 h-6 w-28 rounded-b-[1.1rem] bg-slate-950" />
      <div className="px-3.5 py-2 flex items-center justify-between border-b border-slate-100 bg-white"><div className="flex items-center gap-2"><div className="w-6 h-6 rounded-full bg-gradient-to-tr from-pink-500 via-red-500 to-yellow-500 flex items-center justify-center text-[8px] font-bold text-white uppercase">IG</div><div className="leading-none text-left"><span className="text-[10px] font-bold text-slate-800 block">suamarca_oficial</span><span className="text-[8px] text-slate-400">Patrocinado</span></div></div><div className="flex gap-0.5"><span className="w-1 h-1 rounded-full bg-slate-400"></span><span className="w-1 h-1 rounded-full bg-slate-400"></span><span className="w-1 h-1 rounded-full bg-slate-400"></span></div></div>
      <div className="relative bg-slate-950" style={{ aspectRatio: `${validation.displayAspectRatio || 1}` }}>{post.drive_url ? post.tipo === 'VIDEO' || post.tipo === 'REELS' ? <video src={post.drive_url} className="h-full w-full object-cover" muted loop autoPlay playsInline controls /> : <img src={post.drive_url} alt="Preview" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-[11px] text-slate-400">Mídia não vinculada</div>}</div>
      <div className="px-3 py-2 flex items-center justify-between bg-white text-slate-700"><div className="flex gap-3"><span>♡</span><span>◌</span><span>↗</span></div><span>⌑</span></div>
      <div className="px-3.5 pb-4 pt-1 bg-white text-left text-[10px] leading-relaxed max-h-[90px] overflow-y-auto"><p className="text-slate-800"><span className="font-bold mr-1">suamarca_oficial</span><span className="text-slate-600">{legenda || 'Legenda em aprovação'}</span></p><span className="text-brand-secondary block font-bold mt-1 truncate">{hashtags}</span></div>
      <div className="mx-auto my-2 h-1.5 w-24 rounded-full bg-slate-300"></div>
    </div>
  );
}

export default function ApproveList({ onWorkflowComplete, currentUser }: ApproveListProps) {
  const [pendingPosts, setPendingPosts] = useState<Post[]>([]);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedLegenda, setEditedLegenda] = useState('');
  const [editedHashtags, setEditedHashtags] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduleDateTime, setScheduleDateTime] = useState('');
  const [mediaValidation, setMediaValidation] = useState<MediaValidation>(DEFAULT_MEDIA_VALIDATION);
  const [showEditor, setShowEditor] = useState(false);
  const [presetId, setPresetId] = useState<CropPresetId>('original');
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [sourceSize, setSourceSize] = useState({ width: 0, height: 0 });

  const preset = useMemo(() => {
    if (presetId === 'original' && sourceSize.width && sourceSize.height) return { ...CROP_PRESETS[0], aspectRatio: sourceSize.width / sourceSize.height };
    return CROP_PRESETS.find((item) => item.id === presetId) || CROP_PRESETS[0];
  }, [presetId, sourceSize]);

  const fetchPending = async () => {
    const res = await apiFetch('/api/posts');
    const data = await res.json();
    const pending = (data.posts || []).filter((p: Post) => p.status === 'PENDENTE');
    setPendingPosts(pending);
    if (!pending.length) return setSelectedPost(null);
    const current = pending.find((post: Post) => post.id === selectedPost?.id) || pending[0];
    setSelectedPost(current);
    setEditedLegenda(current.legenda || '');
    setEditedHashtags(current.hashtags || '');
  };

  useEffect(() => { void fetchPending(); }, []);
  useEffect(() => {
    let active = true;
    if (!selectedPost?.drive_url) return void setMediaValidation({ ...DEFAULT_MEDIA_VALIDATION, state: selectedPost ? 'error' : 'idle', blockingIssues: selectedPost ? ['A postagem precisa ter mídia vinculada para ser validada.'] : [] });
    setMediaValidation({ ...DEFAULT_MEDIA_VALIDATION, state:'loading', previewLabel: selectedPost.tipo === 'REELS' ? 'Prévia de reel com área segura no feed' : 'Prévia realista do feed' });
    getMediaMetadata(selectedPost.drive_url, selectedPost.tipo).then(({ width, height }) => active && setMediaValidation(validateMedia(selectedPost, width, height))).catch(() => active && setMediaValidation({ ...DEFAULT_MEDIA_VALIDATION, state:'error', blockingIssues:['Não foi possível ler a largura e a altura da mídia.'] }));
    return () => { active = false; };
  }, [selectedPost]);

  const canProceed = mediaValidation.state === 'ready' && mediaValidation.isFeedCompatible && !loading && !uploadingMedia;
  const canEditImage = Boolean(selectedPost?.tipo === 'IMAGEM' && selectedPost.drive_url && !uploadingMedia);

  const readFileAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo selecionado.'));
    reader.readAsDataURL(file);
  });

  const updatePostMedia = async (payload: { drive_url:string; drive_file_id:string; tipo:'IMAGEM'|'VIDEO'; filename:string }) => {
    if (!selectedPost) return;
    const res = await apiFetch(`/api/posts/${selectedPost.id}/media`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok || !data.post) throw new Error(data.error || 'Falha ao atualizar a mídia do post.');
    setSelectedPost(data.post);
    await fetchPending();
  };

  const replaceMedia = async (file: File) => {
    setUploadingMedia(true);
    try {
      const base64Data = await readFileAsDataUrl(file);
      const uploadRes = await apiFetch('/api/google/upload', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ filename:file.name, type:file.type, sizeBytes:file.size, base64Data }) });
      const upload = await uploadRes.json();
      if (!uploadRes.ok || !upload.success) throw new Error(upload.error || 'Falha ao enviar a mídia.');
      await updatePostMedia({ drive_url: upload.url, drive_file_id: upload.fileId, tipo: file.type.startsWith('video/') ? 'VIDEO' : 'IMAGEM', filename: file.name });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Falha ao atualizar a mídia.');
    } finally { setUploadingMedia(false); }
  };

  const openEditor = async () => {
    if (!selectedPost?.drive_url || selectedPost.tipo !== 'IMAGEM') return;
    const meta = await getMediaMetadata(selectedPost.drive_url, 'IMAGEM');
    setSourceSize(meta); setPresetId('original'); setZoom(1); setOffsetX(0); setOffsetY(0); setShowEditor(true);
  };

  const saveEditedImage = async () => {
    if (!selectedPost?.drive_url) return;
    setUploadingMedia(true);
    try {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.src = selectedPost.drive_url;
      await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Não foi possível carregar a imagem para edição.')); });
      const sw = image.naturalWidth; const sh = image.naturalHeight; const ar = preset.aspectRatio || sw / sh;
      const baseW = Math.min(sw, sh * ar); const baseH = baseW / ar; const cropW = baseW / zoom; const cropH = baseH / zoom;
      const maxX = Math.max(0, (sw - cropW) / 2); const maxY = Math.max(0, (sh - cropH) / 2);
      const sx = (sw - cropW) / 2 + maxX * offsetX; const sy = (sh - cropH) / 2 + maxY * offsetY;
      const outW = preset.id === 'original' ? Math.max(1080, Math.round(cropW)) : preset.width;
      const outH = preset.id === 'original' ? Math.max(1080, Math.round(cropH)) : preset.height;
      const canvas = document.createElement('canvas'); canvas.width = outW; canvas.height = outH;
      const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Não foi possível preparar a imagem ajustada.');
      ctx.drawImage(image, sx, sy, cropW, cropH, 0, 0, outW, outH);
      const filename = `${selectedPost.titulo || 'post'}-${preset.id}.jpg`;
      const base64Data = canvas.toDataURL('image/jpeg', 0.92);
      const uploadRes = await apiFetch('/api/google/upload', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ filename, type:'image/jpeg', sizeBytes:Math.round((base64Data.length * 3) / 4), base64Data }) });
      const upload = await uploadRes.json();
      if (!uploadRes.ok || !upload.success) throw new Error(upload.error || 'Falha ao enviar a imagem ajustada.');
      await updatePostMedia({ drive_url: upload.url, drive_file_id: upload.fileId, tipo: 'IMAGEM', filename });
      setShowEditor(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Falha ao salvar a imagem ajustada.');
    } finally { setUploadingMedia(false); }
  };

  const saveCaption = async () => {
    if (!selectedPost) return;
    const res = await apiFetch(`/api/posts/${selectedPost.id}`, { method:'PUT', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ legenda: editedLegenda, hashtags: editedHashtags }) });
    if (res.ok) { const data = await res.json(); setSelectedPost(data.post); setIsEditing(false); await fetchPending(); }
  };

  const publish = async () => {
    if (!selectedPost || !canProceed) return alert('A mídia ainda não passou na validação para feed do Instagram.');
    setLoading(true);
    try {
      const res = await apiFetch(`/api/posts/${selectedPost.id}/approve`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ action:'instant', mediaValidation:{ width: mediaValidation.width, height: mediaValidation.height, aspectRatio: mediaValidation.aspectRatio, isFeedCompatible: mediaValidation.isFeedCompatible } }) });
      if (res.ok) { await fetchPending(); onWorkflowComplete?.(); }
    } finally { setLoading(false); }
  };

  const schedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPost || !canProceed) return alert('A mídia ainda não passou na validação para feed do Instagram.');
    setLoading(true);
    try {
      const res = await apiFetch(`/api/posts/${selectedPost.id}/approve`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ action:'schedule', appointmentTime:new Date(scheduleDateTime).toISOString(), mediaValidation:{ width: mediaValidation.width, height: mediaValidation.height, aspectRatio: mediaValidation.aspectRatio, isFeedCompatible: mediaValidation.isFeedCompatible } }) });
      if (res.ok) { setShowScheduleForm(false); await fetchPending(); onWorkflowComplete?.(); }
    } finally { setLoading(false); }
  };

  const reject = async () => {
    if (!selectedPost || !rejectReason.trim()) return alert('Favor informar o motivo da reprovação.');
    setLoading(true);
    try {
      const res = await apiFetch(`/api/posts/${selectedPost.id}/reject`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ feedback: rejectReason }) });
      if (res.ok) { setShowRejectModal(false); setRejectReason(''); await fetchPending(); onWorkflowComplete?.(); }
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3"><div><h2 className="text-lg sm:text-xl font-bold text-slate-800">Moderação e Aprovação de Posts</h2><p className="text-xs text-slate-500 mt-1">A tela valida tamanho e proporção reais antes de permitir publicação.</p></div><ClipboardCheck className="w-5 h-5 text-brand-secondary" /></div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-3">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Fila de Espera ({pendingPosts.length})</h3>
          {pendingPosts.length === 0 ? <div className="bg-white border border-slate-205 p-8 text-center rounded-xl space-y-2"><ClipboardCheck className="w-8 h-8 text-slate-300 mx-auto" /><p className="text-sm font-semibold text-slate-700">Tudo em dia</p></div> : <div className="space-y-2.5 max-h-[580px] overflow-y-auto pr-1">{pendingPosts.map((post) => <button key={post.id} onClick={() => { setSelectedPost(post); setEditedLegenda(post.legenda || ''); setEditedHashtags(post.hashtags || ''); setIsEditing(false); setShowRejectModal(false); setShowScheduleForm(false); }} className={`w-full text-left p-4 rounded-xl border transition-all flex flex-col gap-2 ${selectedPost?.id === post.id ? 'border-brand-secondary bg-brand-light shadow-sm ring-2 ring-brand-primary/10' : 'border-slate-250 bg-white hover:bg-slate-50'}`}><div className="flex items-center justify-between gap-2 w-full"><span className="text-[10px] font-bold text-brand-secondary uppercase bg-brand-light border border-brand-primary/20 px-2 py-0.5 rounded">{post.tipo === 'VIDEO' ? 'Vídeo' : post.tipo === 'REELS' ? 'Reel' : 'Imagem'}</span><span className="text-[10px] text-slate-400">{new Date(post.criado_em).toLocaleDateString('pt-BR')}</span></div><div><h4 className="text-xs font-bold text-slate-800 line-clamp-1">{post.titulo}</h4><p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-relaxed">{post.legenda}</p></div><div className="border-t border-slate-100/80 pt-2 flex items-center justify-between w-full text-[10px] text-slate-400"><span className="truncate max-w-[120px] flex items-center gap-1"><User className="w-3 h-3" /> {post.criado_por_nome || 'Equipe'}</span><span className="font-semibold text-slate-600 flex items-center gap-0.5">Revisar <ArrowRight className="w-3 h-3" /></span></div></button>)}</div>}
        </div>
        <div className="lg:col-span-8" id="detalhes-moderar">{selectedPost ? <div className="bg-white border border-slate-200 p-4 sm:p-6 rounded-xl shadow-sm space-y-6"><div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4"><div><div className="flex flex-wrap items-center gap-2"><span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">Pendente Homologação</span><span className="text-[10px] text-slate-400 font-mono break-all">ID: {selectedPost.id}</span></div><h3 className="text-lg font-bold text-slate-800 mt-1.5">{selectedPost.titulo}</h3><div className="mt-1 flex flex-wrap gap-2 text-[10.5px] text-slate-500"><span className="flex items-center gap-1"><User className="w-3 h-3 text-slate-400" /> Cadastrado por: <strong className="text-slate-700 font-medium">{selectedPost.criado_por_nome || currentUser.nome}</strong></span><span className="text-slate-300">•</span><span>Criado em: {new Date(selectedPost.criado_em).toLocaleString('pt-BR')}</span></div></div><div className="grid grid-cols-3 gap-2 w-full sm:w-auto"><input id="replace-post-media-input" type="file" accept="image/*,video/mp4,video/quicktime,video/webm" onChange={(e) => { const file = e.target.files?.[0]; if (file) void replaceMedia(file); e.currentTarget.value = ''; }} className="hidden" /><label htmlFor="replace-post-media-input" className="p-2 sm:px-3 text-xs font-semibold text-slate-700 bg-slate-55 border border-slate-200 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer">{uploadingMedia ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}<span className="hidden sm:inline">{uploadingMedia ? 'Enviando Mídia' : 'Trocar Mídia'}</span></label><button onClick={() => void openEditor()} disabled={!canEditImage} className="p-2 sm:px-3 text-xs font-semibold text-slate-700 bg-slate-55 border border-slate-200 rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"><Scissors className="w-4 h-4" /><span className="hidden sm:inline">Editar Imagem</span></button><button onClick={() => setIsEditing(!isEditing)} className="p-2 sm:px-3 text-xs font-semibold text-slate-700 bg-slate-55 border border-slate-200 rounded-lg flex items-center justify-center gap-1.5"><Edit3 className="w-4 h-4" /><span className="hidden sm:inline">{isEditing ? 'Cancelar Edição' : 'Editar Legenda'}</span></button></div></div>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5"><div className="md:col-span-5 space-y-3"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{mediaValidation.previewLabel}</span><PhonePreview post={selectedPost} legenda={isEditing ? editedLegenda : selectedPost.legenda} hashtags={isEditing ? editedHashtags : selectedPost.hashtags || ''} validation={mediaValidation} /><p className="text-[11px] text-slate-500">Use <strong>Editar Imagem</strong> para cortar a peça no padrão do Instagram e salvar a nova arte direto no post.</p><div className={`rounded-xl border p-3 text-xs ${mediaValidation.isFeedCompatible && mediaValidation.state === 'ready' ? 'border-emerald-200 bg-emerald-50/80' : 'border-amber-200 bg-amber-50/80'}`}><div className="flex items-center justify-between gap-2"><span className="font-bold uppercase tracking-wide text-[10px] text-slate-500">Validação Instagram</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${mediaValidation.isFeedCompatible && mediaValidation.state === 'ready' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{mediaValidation.state === 'loading' || uploadingMedia ? 'Lendo mídia' : mediaValidation.isFeedCompatible && mediaValidation.state === 'ready' ? 'Apta para publicar' : 'Ajuste necessário'}</span></div>{mediaValidation.state === 'ready' && <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-700"><div className="rounded-lg bg-white/80 px-2.5 py-2 border border-slate-200"><span className="block text-[10px] uppercase tracking-wide text-slate-400">Tamanho real</span><strong>{mediaValidation.width} x {mediaValidation.height}px</strong></div><div className="rounded-lg bg-white/80 px-2.5 py-2 border border-slate-200"><span className="block text-[10px] uppercase tracking-wide text-slate-400">Proporção</span><strong>{roundAspectRatio(mediaValidation.aspectRatio)}:1</strong></div></div>}<p className="mt-2 text-[11px] text-slate-600">Formatos recomendados: <strong>{mediaValidation.recommendedLabel || '1080 x 1350, 1080 x 1080 ou 1080 x 566'}</strong></p>{mediaValidation.blockingIssues.map((issue) => <p key={issue} className="mt-1 text-[11px] text-rose-700">• {issue}</p>)}{mediaValidation.warnings.map((warning) => <p key={warning} className="mt-1 text-[11px] text-amber-700">• {warning}</p>)}</div></div><div className="md:col-span-7 space-y-4">{isEditing ? <div className="space-y-3 bg-slate-50 p-4 border border-slate-150 rounded-xl"><span className="text-[10px] font-bold text-brand-secondary uppercase block tracking-wider">Editor de Legenda / Hashtags</span><textarea rows={4} value={editedLegenda} onChange={(e) => setEditedLegenda(e.target.value)} className="w-full text-xs p-2.5 border border-slate-200 rounded-lg bg-white leading-normal" /><input type="text" value={editedHashtags} onChange={(e) => setEditedHashtags(e.target.value)} className="w-full text-xs p-2.5 border border-slate-200 rounded-lg bg-white" /><button type="button" onClick={() => void saveCaption()} className="px-3 py-1.5 bg-brand-secondary text-brand-darker rounded text-xs font-bold">Salvar Alterações</button></div> : <div className="space-y-4"><div><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Texto de Legenda</span><div className="bg-slate-50/50 p-4 border border-slate-100 rounded-xl text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{selectedPost.legenda || <span className="italic text-slate-400">Nenhuma legenda cadastrada.</span>}</div></div>{selectedPost.hashtags && <div><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Hashtags Estratégicas</span><p className="text-xs text-indigo-600 font-semibold tracking-wide bg-indigo-50/30 p-2.5 rounded-lg border border-indigo-100/30">{selectedPost.hashtags}</p></div>}</div>}</div></div>
          {!showRejectModal && !showScheduleForm && <div className="border-t border-slate-100 pt-5 flex flex-col sm:flex-row sm:flex-wrap gap-3"><button onClick={() => setShowRejectModal(true)} className="flex-1 min-w-[130px] py-2.5 border border-rose-200 bg-rose-50 text-rose-700 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5"><X className="w-4 h-4" /> Reprovar / Solicitar Ajustes</button><button onClick={() => { if (!canProceed) return; setShowScheduleForm(true); const d = new Date(Date.now() + 60 * 60 * 1000); setScheduleDateTime(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`); }} disabled={!canProceed} className="flex-1 min-w-[130px] py-2.5 border border-slate-200 bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5"><Calendar className="w-4 h-4" /> Agendar Publicação</button><button onClick={() => void publish()} disabled={!canProceed} className="flex-1 min-w-[150px] py-2.5 bg-brand-secondary disabled:opacity-50 disabled:cursor-not-allowed text-brand-darker text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 border border-brand-primary/15">{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 text-amber-300" />} Aprovar e Publicar Agora</button></div>}
          {showRejectModal && <div className="border-t-2 border-rose-100 bg-rose-50/20 p-4 sm:p-5 rounded-xl space-y-3.5"><div className="flex items-center gap-1.5"><AlertTriangle className="w-5 h-5 text-rose-600" /><span className="text-xs font-semibold text-rose-850">Informação de Ajustes ao Redator</span></div><textarea rows={3} required placeholder="Explique o que precisa ser ajustado antes da publicação." value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className="w-full text-xs p-2.5 border border-rose-200 rounded-lg bg-white" /><div className="flex gap-2 justify-end"><button type="button" onClick={() => setShowRejectModal(false)} className="px-3.5 py-1.5 bg-slate-100 text-slate-700 rounded text-xs font-semibold">Cancelar</button><button type="button" onClick={() => void reject()} className="px-3.5 py-1.5 bg-rose-600 text-white rounded text-xs font-semibold">Enviar Rejeição</button></div></div>}
          {showScheduleForm && <form onSubmit={schedule} className="border-t-2 border-brand-primary/30 bg-brand-light/30 p-4 sm:p-5 rounded-xl space-y-4"><div className="flex items-center gap-1.5"><Clock className="w-5 h-5 text-brand-secondary" /><span className="text-xs font-bold text-brand-darker">Agendar Data e Hora de Disparo</span></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end"><div><label className="block text-[10px] font-semibold text-slate-600 mb-1">Escolha Data e Hora</label><input type="datetime-local" required value={scheduleDateTime} onChange={(e) => setScheduleDateTime(e.target.value)} className="w-full text-xs p-2.5 border border-slate-200 rounded-lg bg-white" /></div><div className="flex gap-2"><button type="button" onClick={() => setShowScheduleForm(false)} className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold">Cancelar</button><button type="submit" disabled={!canProceed} className="flex-1 py-2.5 bg-brand-secondary disabled:opacity-50 disabled:cursor-not-allowed text-brand-darker rounded-lg text-xs font-bold">Confirmar Agenda</button></div></div></form>}
        </div> : <div className="bg-slate-50 border border-slate-200 h-[480px] rounded-xl flex flex-col items-center justify-center text-center p-6 text-slate-400"><Eye className="w-12 h-12 text-slate-300 mb-2" /><p className="text-sm font-semibold text-slate-700">Selecione uma publicação à esquerda</p></div>}</div>
      </div>
      {showEditor && selectedPost?.drive_url && <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm p-4 flex items-center justify-center"><div className="w-full max-w-6xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden"><div className="flex items-center justify-between border-b border-slate-200 px-6 py-4"><div><h3 className="text-lg font-bold text-slate-800">Editar Imagem</h3><p className="text-xs text-slate-500">Corte em tempo real e salve a nova arte no post.</p></div><button onClick={() => setShowEditor(false)} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"><X className="w-4 h-4" /></button></div><div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] min-h-[620px]"><div className="border-r border-slate-200 bg-slate-50 p-5 space-y-5"><div><h4 className="text-sm font-semibold text-slate-800">Ferramentas de corte</h4><div className="mt-3 space-y-2">{CROP_PRESETS.map((item) => <button key={item.id} type="button" onClick={() => setPresetId(item.id)} className={`w-full rounded-xl border px-4 py-3 text-left ${preset.id === item.id ? 'border-brand-secondary bg-brand-light' : 'border-slate-200 bg-white hover:bg-slate-50'}`}><span className="block text-sm font-semibold text-slate-800">{item.label}</span><span className="block text-xs text-slate-500">{item.id === 'original' && sourceSize.width ? `${roundAspectRatio(sourceSize.width / sourceSize.height)}:1` : item.description}</span></button>)}</div></div><div className="space-y-4"><div><label className="block text-xs font-semibold text-slate-700 mb-1">Zoom</label><input type="range" min="1" max="2.4" step="0.01" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-full" /></div><div><label className="block text-xs font-semibold text-slate-700 mb-1">Mover horizontal</label><input type="range" min="-1" max="1" step="0.01" value={offsetX} onChange={(e) => setOffsetX(Number(e.target.value))} className="w-full" /></div><div><label className="block text-xs font-semibold text-slate-700 mb-1">Mover vertical</label><input type="range" min="-1" max="1" step="0.01" value={offsetY} onChange={(e) => setOffsetY(Number(e.target.value))} className="w-full" /></div></div></div><div className="p-6 flex flex-col"><div className="flex-1 rounded-2xl bg-slate-100 border border-slate-200 p-6 flex items-center justify-center"><div className="w-full max-w-[700px]"><div className="mx-auto overflow-hidden rounded-2xl bg-white shadow-inner border border-slate-200 relative" style={{ aspectRatio: `${preset.aspectRatio || 1}` }}><img src={selectedPost.drive_url} alt="Editor" className="absolute inset-0 h-full w-full object-cover select-none" style={{ transform: `scale(${zoom}) translate(${offsetX * 18}%, ${offsetY * 18}%)`, transformOrigin:'center center' }} draggable={false} /></div></div></div><div className="mt-4 flex items-center justify-between"><p className="text-xs text-slate-500">Saída estimada: <strong>{preset.id === 'original' ? `${Math.max(1080, Math.round(sourceSize.width || 1080))} x ${Math.max(1080, Math.round(sourceSize.height || 1080))}` : `${preset.width} x ${preset.height}`}</strong></p><div className="flex gap-2"><button type="button" onClick={() => setShowEditor(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Cancelar</button><button type="button" onClick={() => void saveEditedImage()} disabled={uploadingMedia} className="rounded-lg bg-brand-secondary px-4 py-2 text-sm font-bold text-brand-darker disabled:opacity-50 disabled:cursor-not-allowed">{uploadingMedia ? 'Salvando...' : 'Aplicar'}</button></div></div></div></div></div></div>}
    </div>
  );
}
