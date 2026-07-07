import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, CheckCircle, Image as ImageIcon, Loader2, PlusCircle, Send, Trash2, Video } from 'lucide-react';
import type { PostCarouselItem, PostStatus, Usuario } from '../types';
import { apiFetch } from '../lib/api';
import { MAX_INLINE_VIDEO_UPLOAD_BYTES } from '../lib/videoFormat';
import { validateVideoFile } from '../lib/videoValidator';
import { useUiFeedback } from '../context/UiFeedbackContext';

interface Props {
  currentUser: Usuario;
  onPostCreated?: () => void;
}

type DraftItem = PostCarouselItem;

function buildImageItem(file: File, upload: { fileId: string; url: string }): DraftItem {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    order: 0,
    tipo: 'IMAGEM',
    drive_file_id: upload.fileId,
    drive_url: upload.url,
    filename: file.name,
    mime_type: file.type,
    media_validation_status: 'VALID',
    media_validation_errors: [],
    media_validation_warnings: [],
    media_metadata: {
      filename: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      source: 'browser',
    },
  };
}

export default function CreatePostCarousel({ currentUser, onPostCreated }: Props) {
  const [titulo, setTitulo] = useState('');
  const [legenda, setLegenda] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [items, setItems] = useState<DraftItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const { showNotice } = useUiFeedback();

  const normalizedItems = useMemo(
    () => items.map((item, index) => ({ ...item, order: index })),
    [items],
  );

  const uploadMediaFile = async (file: File) => {
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Falha ao ler o arquivo selecionado.'));
      reader.readAsDataURL(file);
    });

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

    return data as { fileId: string; url: string };
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList?.length) return;
    const nextFiles = Array.from(fileList);
    if (items.length + nextFiles.length > 10) {
      showNotice('O carrossel suporta no maximo 10 midias.', 'error');
      return;
    }

    setUploading(true);
    try {
      const uploadedItems: DraftItem[] = [];
      for (const file of nextFiles) {
        if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
          throw new Error(`O arquivo ${file.name} nao e imagem nem video valido.`);
        }

        if (file.type.startsWith('video/')) {
          if (file.size > MAX_INLINE_VIDEO_UPLOAD_BYTES) {
            throw new Error(`O video ${file.name} ultrapassa o limite de 45 MB.`);
          }
          const validation = await validateVideoFile(file);
          if (validation.status === 'INVALID') {
            throw new Error(`O video ${file.name} falhou na validacao tecnica.`);
          }
          const upload = await uploadMediaFile(file);
          uploadedItems.push({
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            order: 0,
            tipo: 'VIDEO',
            drive_file_id: upload.fileId,
            drive_url: upload.url,
            filename: file.name,
            mime_type: file.type,
            media_validation_status: validation.status,
            media_validation_errors: validation.errors,
            media_validation_warnings: validation.warnings,
            media_metadata: validation.metadata,
          });
          continue;
        }

        const upload = await uploadMediaFile(file);
        uploadedItems.push(buildImageItem(file, upload));
      }

      setItems((current) => [...current, ...uploadedItems].map((item, index) => ({ ...item, order: index })));
      setSuccessMsg(`${uploadedItems.length} midia(s) adicionada(s) ao carrossel.`);
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'Falha ao preparar o carrossel.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    setItems(next.map((item, itemIndex) => ({ ...item, order: itemIndex })));
  };

  const removeItem = (index: number) => {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index).map((item, itemIndex) => ({ ...item, order: itemIndex })));
  };

  const saveCarousel = async (status: PostStatus) => {
    if (!titulo.trim()) {
      showNotice('O titulo da publicacao e obrigatorio.', 'error');
      return;
    }
    if (items.length < 2) {
      showNotice('O carrossel precisa ter ao menos 2 midias.', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        titulo,
        legenda,
        hashtags,
        tipo: 'CARROSSEL',
        status,
        drive_url: normalizedItems[0]?.drive_url,
        drive_file_id: normalizedItems[0]?.drive_file_id,
        media_metadata: {
          carousel_items: normalizedItems,
        },
      };
      const res = await apiFetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.post) {
        throw new Error(data.error || 'Falha ao salvar o carrossel.');
      }
      setTitulo('');
      setLegenda('');
      setHashtags('');
      setItems([]);
      setSuccessMsg(status === 'PENDENTE' ? 'Carrossel enviado para aprovacao.' : 'Carrossel salvo como rascunho.');
      onPostCreated?.();
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'Falha ao salvar o carrossel.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800 sm:text-xl">Criar carrossel</h2>
          <p className="mt-1 text-sm text-slate-500">Monte um carrossel com 2 a 10 midias, defina a ordem e envie para aprovacao.</p>
        </div>
        <PlusCircle className="h-5 w-5 text-brand-secondary" />
      </div>

      {successMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          <CheckCircle className="h-4 w-4 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-7">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-semibold text-slate-600">Titulo do post</label>
              <input value={titulo} onChange={(event) => setTitulo(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-primary" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-600">Criado por</label>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">{currentUser.nome}</div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-600">Quantidade atual</label>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">{items.length} item(ns)</div>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-600">Midias do carrossel</label>
            <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/60 p-6 text-center">
              <input
                id="carousel-upload-input"
                type="file"
                accept="image/*,video/mp4,video/quicktime,video/x-m4v,video/webm"
                multiple
                onChange={(event) => {
                  void handleFiles(event.target.files);
                  event.currentTarget.value = '';
                }}
                className="hidden"
              />
              <label htmlFor="carousel-upload-input" className="cursor-pointer">
                {uploading ? (
                  <div className="space-y-2 text-slate-500">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-brand-secondary" />
                    <p className="text-sm font-medium">Enviando midias...</p>
                  </div>
                ) : (
                  <>
                    <PlusCircle className="mx-auto h-8 w-8 text-brand-secondary" />
                    <p className="mt-2 text-sm font-semibold text-brand-secondary">Adicionar imagens ou videos</p>
                    <p className="mt-1 text-xs text-slate-400">A ordem de publicacao segue a ordem definida abaixo.</p>
                  </>
                )}
              </label>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-600">Legenda</label>
            <textarea rows={4} value={legenda} onChange={(event) => setLegenda(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-primary" />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-600">Hashtags</label>
            <input value={hashtags} onChange={(event) => setHashtags(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-primary" />
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row">
            <button type="button" disabled={saving} onClick={() => void saveCarousel('RASCUNHO')} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              <PlusCircle className="h-4 w-4" />
              Salvar rascunho
            </button>
            <button type="button" disabled={saving} onClick={() => void saveCarousel('PENDENTE')} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand-secondary px-4 py-2.5 text-sm font-bold text-brand-darker hover:bg-brand-primary">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar para aprovacao
            </button>
          </div>
        </div>

        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-5">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Preview do carrossel</h3>
            <p className="mt-1 text-sm text-slate-500">A interface deixa claro que o post possui multiplos itens.</p>
          </div>

          {normalizedItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              Nenhuma midia adicionada.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="mb-3 flex items-center justify-between text-xs font-semibold text-slate-500">
                  <span>Carrossel</span>
                  <span>{normalizedItems.length} itens</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {normalizedItems.map((item, index) => (
                    <div key={item.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
                        <span>{index + 1}/{normalizedItems.length}</span>
                        <span className="inline-flex items-center gap-1">
                          {item.tipo === 'VIDEO' ? <Video className="h-3.5 w-3.5" /> : <ImageIcon className="h-3.5 w-3.5" />}
                          {item.tipo}
                        </span>
                      </div>
                      <div className="aspect-square bg-slate-100">
                        {item.tipo === 'VIDEO' ? (
                          <video src={item.drive_url} className="h-full w-full object-cover" muted />
                        ) : (
                          <img src={item.drive_url} alt={item.filename || `Item ${index + 1}`} className="h-full w-full object-cover" />
                        )}
                      </div>
                      <div className="space-y-2 px-3 py-3">
                        <p className="truncate text-xs text-slate-500">{item.filename}</p>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => moveItem(index, -1)} disabled={index === 0} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-40">
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={() => moveItem(index, 1)} disabled={index === normalizedItems.length - 1} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-40">
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={() => removeItem(index)} className="rounded-lg border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-700">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <p className="text-xs text-slate-500">
                          Status tecnico: {item.media_validation_status || 'VALID'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
