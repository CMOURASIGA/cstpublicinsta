import React, { useEffect, useMemo, useState } from 'react';
import { Post, PostStatus, Usuario } from '../types';
import { apiFetch } from '../lib/api';
import {
  CheckCircle,
  FileText,
  Film,
  Image as ImageIcon,
  Loader2,
  Pencil,
  PlusCircle,
  Save,
  Send,
  Sparkles,
  Trash,
  UploadCloud,
  XCircle,
} from 'lucide-react';

interface CreatePostProps {
  onPostCreated?: () => void;
  currentUser: Usuario;
}

function getCurrentRole(user: Usuario): 'CRIADOR' | 'APROVADOR' | 'ADMIN' {
  return user.perfil_publicacao || (user.perfil === 'ADMINISTRADOR' ? 'ADMIN' : 'CRIADOR');
}

export default function CreatePost({ onPostCreated, currentUser }: CreatePostProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState('');
  const [legenda, setLegenda] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [tipo, setTipo] = useState<'IMAGEM' | 'VIDEO'>('IMAGEM');
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [fileId, setFileId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiTagsCount, setAiTagsCount] = useState(5);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingDrafts, setLoadingDrafts] = useState(true);
  const [successMsg, setSuccessMsg] = useState('');

  const currentRole = getCurrentRole(currentUser);
  const canSeeAllDrafts = currentRole === 'ADMIN';

  const editablePosts = useMemo(
    () =>
      posts.filter((post) => {
        const isEditableStatus = post.status === 'RASCUNHO' || post.status === 'REJEITADA';
        if (!isEditableStatus) return false;
        if (canSeeAllDrafts) return true;
        return (post.criado_por_nome || '').trim().toLowerCase() === currentUser.nome.trim().toLowerCase();
      }),
    [posts, canSeeAllDrafts, currentUser.nome],
  );

  const editingPost = useMemo(
    () => editablePosts.find((post) => post.id === editingPostId) || null,
    [editablePosts, editingPostId],
  );

  const resetForm = () => {
    setEditingPostId(null);
    setTitulo('');
    setLegenda('');
    setHashtags('');
    setTipo('IMAGEM');
    setFileName('');
    setFileUrl('');
    setFileId('');
    setUploaded(false);
    setAiPrompt('');
  };

  const loadPostIntoForm = (post: Post) => {
    setEditingPostId(post.id);
    setTitulo(post.titulo || '');
    setLegenda(post.legenda || '');
    setHashtags(post.hashtags || '');
    setTipo(post.tipo === 'VIDEO' ? 'VIDEO' : 'IMAGEM');
    setFileUrl(post.drive_url || '');
    setFileId(post.drive_file_id || '');
    setFileName(post.drive_file_id || post.titulo || '');
    setUploaded(Boolean(post.drive_url || post.drive_file_id));
    setSuccessMsg('');
  };

  const fetchDrafts = async () => {
    setLoadingDrafts(true);

    try {
      const res = await apiFetch('/api/posts');
      const data = await res.json();
      if (data.posts) {
        setPosts(data.posts);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDrafts(false);
    }
  };

  useEffect(() => {
    void fetchDrafts();
  }, []);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await handleFileUpload(e.target.files[0]);
    }
  };

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Falha ao ler o arquivo selecionado.'));
      reader.readAsDataURL(file);
    });

  const handleFileUpload = async (file: File) => {
    setTipo(file.type.startsWith('video/') ? 'VIDEO' : 'IMAGEM');
    setUploading(true);
    setFileName(file.name);

    try {
      const base64Data = await readFileAsDataUrl(file);
      const res = await apiFetch('/api/google/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          type: file.type,
          sizeBytes: file.size,
          base64Data,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Falha ao enviar o arquivo para o backend.');
      }

      setFileId(data.fileId);
      setFileUrl(data.url);
      setUploaded(true);
    } catch (err) {
      console.error(err);
      alert('Não foi possível enviar a mídia. Verifique a configuração do backend e tente novamente.');
      setFileName('');
      setFileUrl('');
      setFileId('');
      setUploaded(false);
    } finally {
      setUploading(false);
    }
  };

  const handleAiGeneration = async () => {
    if (!titulo.trim()) {
      alert('Informe ao menos o título antes de acionar a IA.');
      return;
    }

    setAiGenerating(true);

    try {
      const res = await apiFetch('/api/gemini/generate-caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: titulo,
          prompt: aiPrompt,
          type: tipo,
          hashtagsCount: aiTagsCount,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setLegenda(data.legenda);
        setHashtags(data.hashtags);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAiGenerating(false);
    }
  };

  const persistPost = async (targetStatus: PostStatus) => {
    if (!titulo.trim()) {
      alert('O título da publicação é obrigatório.');
      return;
    }

    if (targetStatus === 'PENDENTE' && !fileUrl) {
      alert('Para enviar para aprovação, anexe uma imagem ou vídeo.');
      return;
    }

    setSaving(true);

    try {
      const payload = {
        titulo,
        legenda,
        tipo,
        drive_url: fileUrl,
        drive_file_id: fileId,
        hashtags,
        status: targetStatus,
      };

      const endpoint = editingPostId ? `/api/posts/${editingPostId}` : '/api/posts';
      const method = editingPostId ? 'PUT' : 'POST';
      const res = await apiFetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.post) {
        throw new Error(data.error || 'Falha ao salvar a publicação.');
      }

      setSuccessMsg(
        targetStatus === 'PENDENTE'
          ? editingPostId
            ? 'Rascunho atualizado e enviado para aprovação.'
            : 'Publicação criada e enviada para aprovação.'
          : editingPostId
            ? 'Rascunho atualizado com sucesso.'
            : 'Rascunho salvo com sucesso.',
      );

      resetForm();
      await fetchDrafts();
      onPostCreated?.();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Falha ao salvar a publicação.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDraft = async () => {
    if (!editingPostId) return;
    if (!window.confirm('Confirma a exclusão deste rascunho?')) return;

    setSaving(true);

    try {
      const res = await apiFetch(`/api/posts/${editingPostId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Falha ao excluir o rascunho.');
      }

      setSuccessMsg('Rascunho excluído com sucesso.');
      resetForm();
      await fetchDrafts();
      onPostCreated?.();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Falha ao excluir o rascunho.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold font-sans text-slate-800">
            {editingPost ? 'Editar Rascunho' : 'Criar Nova Publicação'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Salve rascunhos, recupere publicações devolvidas, edite conteúdo e envie para aprovação quando estiver pronto.
          </p>
        </div>
        <PlusCircle className="w-5 h-5 text-brand-secondary" />
      </div>

      {successMsg && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Rascunhos e Devolvidos</h3>
            <p className="mt-1 text-xs text-slate-500">
              Clique em um item para editar ou excluir. Posts rejeitados também voltam para cá.
            </p>
          </div>
          {editingPost && (
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <FileText className="h-4 w-4" />
              Novo rascunho
            </button>
          )}
        </div>

        {loadingDrafts ? (
          <div className="py-6 text-center text-xs text-slate-500">Carregando rascunhos...</div>
        ) : editablePosts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">
            Nenhum rascunho disponível para este usuário no momento.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {editablePosts.map((post) => (
              <button
                key={post.id}
                type="button"
                onClick={() => loadPostIntoForm(post)}
                className={`rounded-xl border p-4 text-left transition-all ${
                  editingPostId === post.id
                    ? 'border-brand-secondary bg-brand-light shadow-sm'
                    : post.status === 'REJEITADA'
                      ? 'border-rose-200 bg-rose-50/40 hover:bg-rose-50'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      post.status === 'REJEITADA' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {post.status}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {new Date(post.atualizado_em || post.criado_em).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                <p className="mt-3 line-clamp-1 text-sm font-bold text-slate-800">{post.titulo}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{post.legenda || 'Sem legenda.'}</p>
                <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400">
                  <span>{post.criado_por_nome || 'Equipe'}</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-slate-600">
                    <Pencil className="h-3 w-3" />
                    Editar
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7 bg-white border border-slate-200 p-4 sm:p-6 rounded-xl shadow-sm space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                Título do Post
              </label>
              <input
                type="text"
                value={titulo}
                onChange={(event) => setTitulo(event.target.value)}
                placeholder="Ex: Campanha de julho para Instagram"
                className="w-full rounded-lg border border-slate-200 p-2.5 text-xs outline-none focus:border-brand-primary"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                Tipo do Post
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTipo('IMAGEM')}
                  className={`flex-1 rounded-lg border py-2 text-xs font-semibold ${
                    tipo === 'IMAGEM' ? 'border-brand-secondary bg-brand-light text-brand-secondary' : 'border-slate-200 text-slate-700'
                  }`}
                >
                  <span className="inline-flex items-center gap-1">
                    <ImageIcon className="h-4 w-4" />
                    Imagem
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setTipo('VIDEO')}
                  className={`flex-1 rounded-lg border py-2 text-xs font-semibold ${
                    tipo === 'VIDEO' ? 'border-brand-secondary bg-brand-light text-brand-secondary' : 'border-slate-200 text-slate-700'
                  }`}
                >
                  <span className="inline-flex items-center gap-1">
                    <Film className="h-4 w-4" />
                    Vídeo
                  </span>
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                Criado por
              </label>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-700">
                {currentUser.nome}
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
              Mídia Anexa
            </label>
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`rounded-xl border-2 border-dashed p-6 text-center transition-all ${
                dragActive ? 'border-brand-secondary bg-brand-light' : 'border-slate-300 bg-slate-50/50'
              }`}
            >
              <input
                id="file-upload-input"
                type="file"
                accept="image/*,video/mp4"
                onChange={handleFileInputChange}
                className="hidden"
              />

              {uploading ? (
                <div className="space-y-2 text-slate-500">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-brand-secondary" />
                  <p className="text-xs font-medium">Enviando mídia...</p>
                </div>
              ) : uploaded ? (
                <div className="space-y-2">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-emerald-200 bg-emerald-100 text-emerald-700">
                    <CheckCircle className="h-6 w-6" />
                  </div>
                  <p className="text-xs font-semibold text-slate-800">{fileName || 'Mídia vinculada'}</p>
                  {fileId && (
                    <p className="text-[10px] text-slate-500">
                      ID: <code className="rounded bg-slate-200 px-1 py-0.5 text-amber-800">{fileId}</code>
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setFileName('');
                      setFileUrl('');
                      setFileId('');
                      setUploaded(false);
                    }}
                    className="mx-auto inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:underline"
                  >
                    <Trash className="h-3.5 w-3.5" />
                    Remover anexo
                  </button>
                </div>
              ) : (
                <label htmlFor="file-upload-input" className="cursor-pointer space-y-2">
                  <UploadCloud className="mx-auto h-10 w-10 text-brand-secondary" />
                  <div>
                    <span className="text-xs font-bold text-brand-secondary hover:underline">Arraste mídia ou selecione um arquivo</span>
                    <p className="mt-1 text-[10px] text-slate-400">PNG, JPG, JPEG, MP4, MOV ou WEBM</p>
                  </div>
                </label>
              )}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
              Legenda
            </label>
            <textarea
              rows={4}
              value={legenda}
              onChange={(event) => setLegenda(event.target.value)}
              placeholder="Digite a legenda da publicação..."
              className="w-full rounded-lg border border-slate-200 p-2.5 text-xs outline-none focus:border-brand-primary"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
              Hashtags
            </label>
            <input
              type="text"
              value={hashtags}
              onChange={(event) => setHashtags(event.target.value)}
              placeholder="#marca #campanha"
              className="w-full rounded-lg border border-slate-200 p-2.5 text-xs outline-none focus:border-brand-primary"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              disabled={saving}
              onClick={() => void persistPost('RASCUNHO')}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Save className="h-4 w-4" />
              {editingPost ? 'Atualizar rascunho' : 'Salvar rascunho'}
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() => void persistPost('PENDENTE')}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand-secondary px-4 py-2.5 text-xs font-bold text-brand-darker hover:bg-brand-primary"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar para aprovação
            </button>

            {editingPost && (
              <>
                <button
                  type="button"
                  disabled={saving}
                  onClick={resetForm}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <XCircle className="h-4 w-4" />
                  Cancelar edição
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleDeleteDraft()}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                >
                  <Trash className="h-4 w-4" />
                  Excluir
                </button>
              </>
            )}
          </div>
        </div>

        <div className="lg:col-span-5 bg-gradient-to-br from-slate-50 to-brand-light/30 border border-slate-200 p-4 sm:p-6 rounded-xl shadow-sm self-start space-y-4">
          <div className="flex items-center gap-1.5">
            <div className="rounded-lg bg-brand-secondary p-1 px-1.5 text-brand-darker">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Redação com IA</h3>
              <p className="text-[11px] text-slate-500">Use o Gemini para rascunhar legenda e hashtags.</p>
            </div>
          </div>

          <div className="space-y-3.5 rounded-xl border border-brand-primary/20 bg-white p-4 shadow-sm">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                Instruções de tom
              </label>
              <textarea
                rows={3}
                value={aiPrompt}
                onChange={(event) => setAiPrompt(event.target.value)}
                placeholder="Ex: tom corporativo, objetivo e com CTA claro."
                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 p-2 text-xs outline-none focus:border-brand-primary"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                Quantidade de hashtags
              </label>
              <select
                value={aiTagsCount}
                onChange={(event) => setAiTagsCount(Number(event.target.value))}
                className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs outline-none focus:border-brand-primary"
              >
                <option value={3}>3 hashtags</option>
                <option value={5}>5 hashtags</option>
                <option value={8}>8 hashtags</option>
                <option value={12}>12 hashtags</option>
              </select>
            </div>

            <button
              type="button"
              disabled={aiGenerating}
              onClick={() => void handleAiGeneration()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 py-2.5 text-xs font-semibold text-white hover:bg-slate-950"
            >
              {aiGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-amber-300" />}
              {aiGenerating ? 'Gerando legenda...' : 'Sugerir legenda com IA'}
            </button>
          </div>

          {titulo && (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm pt-3">
              <span className="block px-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Preview</span>
              <div className="space-y-3 p-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-brand-primary/10 bg-brand-light text-xs font-bold text-brand-secondary">
                    IG
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-800">suamarca_oficial</span>
                    <span className="text-[9px] text-slate-400">Simulador de feed</span>
                  </div>
                </div>

                {fileUrl ? (
                  tipo === 'VIDEO' ? (
                    <video src={fileUrl} className="aspect-video w-full rounded-lg border border-slate-100 bg-slate-900 object-cover" muted controls />
                  ) : (
                    <img src={fileUrl} alt="preview" className="aspect-video w-full rounded-lg border border-slate-100 bg-slate-50 object-cover" referrerPolicy="no-referrer" />
                  )
                ) : (
                  <div className="flex aspect-video w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-slate-150 bg-slate-50 text-slate-400">
                    <ImageIcon className="h-6 w-6 text-slate-300" />
                    <span className="text-[10px]">Mídia não vinculada</span>
                  </div>
                )}

                <div className="space-y-1">
                  <p className="line-clamp-1 text-xs font-semibold text-slate-800">{titulo}</p>
                  <p className="line-clamp-3 whitespace-pre-wrap text-[11px] leading-normal text-slate-600">
                    {legenda || 'Preencha a legenda para visualizar o conteúdo final.'}
                  </p>
                  <p className="text-[11px] font-semibold text-brand-secondary">{hashtags}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
