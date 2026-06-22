import React, { useState } from 'react';
import { Post, PostStatus, Usuario } from '../types';
import { 
  FileText, Sparkles, UploadCloud, Film, Image as ImageIcon, PlusCircle, CheckCircle, 
  HelpCircle, Trash, Loader2, RefreshCw 
} from 'lucide-react';

interface CreatePostProps {
  onPostCreated?: () => void;
  currentUser: Usuario;
}

export default function CreatePost({ onPostCreated, currentUser }: CreatePostProps) {
  // Post states
  const [titulo, setTitulo] = useState('');
  const [legenda, setLegenda] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [tipo, setTipo] = useState<'IMAGEM' | 'VIDEO'>('IMAGEM');
  
  // File upload states
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [fileId, setFileId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);

  // Gemini states
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiTagsCount, setAiTagsCount] = useState(5);
  const [aiGenerating, setAiGenerating] = useState(false);

  // General submission
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      await handleFileUpload(file);
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      await handleFileUpload(file);
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
    if (file.type.startsWith('video/')) {
      setTipo('VIDEO');
    } else {
      setTipo('IMAGEM');
    }

    setUploading(true);
    setFileName(file.name);

    try {
      const base64Data = await readFileAsDataUrl(file);
      const res = await fetch('/api/google/upload', {
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

  // Generate captions using Gemini LLM
  const handleAiGeneration = async () => {
    if (!titulo) {
      alert('Por favor, informe ao menos o Título antes de acionar o auxílio de IA do Gemini.');
      return;
    }
    setAiGenerating(true);
    try {
      const res = await fetch('/api/gemini/generate-caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: titulo,
          prompt: aiPrompt,
          type: tipo,
          hashtagsCount: aiTagsCount
        })
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

  // Save/Submit Post to Database
  const savePost = async (targetStatus: PostStatus) => {
    if (!titulo.trim()) {
      alert('O título da publicação é obrigatório.');
      return;
    }
    if (targetStatus === 'PENDENTE' && !fileUrl) {
      alert('Para enviar a postagem para homologação de Carlos Moura, anexe uma imagem ou um vídeo de mídia.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-User-Name': currentUser.nome,
          'X-User-Email': currentUser.email,
        },
        body: JSON.stringify({
          titulo,
          legenda,
          tipo,
          drive_url: fileUrl,
          drive_file_id: fileId,
          hashtags,
          status: targetStatus
        })
      });

      if (res.ok) {
        setSuccessMsg(targetStatus === 'PENDENTE' 
          ? 'Enviado! Sua publicação foi salva com sucesso e enviada ao Admin Carlos Moura.'
          : 'Sucesso! Rascunho salvo com sucesso.'
        );
        
        // Reset states
        setTitulo('');
        setLegenda('');
        setHashtags('');
        setFileName('');
        setFileUrl('');
        setFileId('');
        setUploaded(false);
        setAiPrompt('');

        setTimeout(() => {
          setSuccessMsg('');
          if (onPostCreated) onPostCreated();
        }, 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-xl font-bold font-sans text-slate-800">Criar Nova Publicação</h2>
          <p className="text-xs text-slate-500 mt-1">
            Preencha os dados abaixo do post, anexe a mídia e conte com auxílio do Gemini AI para suas legendas.
          </p>
        </div>
        <PlusCircle className="w-5 h-5 text-brand-secondary" />
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg p-4 text-xs font-semibold flex items-center gap-2 animate-bounce">
          <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Creation Fields Pane */}
        <div className="lg:col-span-7 bg-white border border-slate-200 p-6 rounded-xl shadow-sm space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
              Título do Post
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Infográfico Tendências UI/UX 2027"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-lg p-2.5 outline-none focus:border-brand-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                Tipo do Post
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTipo('IMAGEM')}
                  className={`w-full py-2 border rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                    tipo === 'IMAGEM'
                      ? 'border-brand-secondary bg-brand-light text-brand-secondary'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <ImageIcon className="w-4 h-4" />
                  Imagem (PNG/JPG)
                </button>
                <button
                  type="button"
                  onClick={() => setTipo('VIDEO')}
                  className={`w-full py-2 border rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                    tipo === 'VIDEO'
                      ? 'border-brand-secondary bg-brand-light text-brand-secondary'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <Film className="w-4 h-4" />
                  Vídeo (MP4)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                Criado Por (Perfil Ativo)
              </label>
              <div className="bg-slate-50 px-3 py-2 border border-slate-100 rounded-lg text-xs font-semibold text-slate-700">
                👤 {currentUser.nome}
              </div>
            </div>
          </div>

          {/* Drag & Drop Upload Zone */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
              Mídia Anexa (Upload para Google Drive)
            </label>
            
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center transition-all ${
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
                <div className="space-y-2 text-slate-500 py-3">
                   <Loader2 className="w-8 h-8 text-brand-secondary animate-spin mx-auto" />
                  <p className="text-xs font-medium">Enviando mídia ao backend...</p>
                  <p className="text-[10px] text-slate-400">Persistindo arquivo e metadados...</p>
                </div>
              ) : uploaded ? (
                <div className="space-y-2 py-2">
                  <div className="bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-full p-2.5 w-12 h-12 flex items-center justify-center mx-auto mb-1">
                    <CheckCircle className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-800 truncate max-w-xs mx-auto">{fileName}</p>
                    <p className="text-[10px] text-slate-500 mt-1">Arquivo vinculado. ID: <code className="bg-slate-200 px-1 py-0.5 rounded text-amber-800">{fileId}</code></p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setFileName('');
                      setFileUrl('');
                      setFileId('');
                      setUploaded(false);
                    }}
                    className="text-xs font-medium text-rose-500 hover:text-rose-600 underline flex items-center gap-1 mx-auto mt-2"
                  >
                    <Trash className="w-3.5 h-3.5" /> Remover anexo
                  </button>
                </div>
              ) : (
                <label htmlFor="file-upload-input" className="cursor-pointer space-y-2 py-3">
                  <UploadCloud className="w-10 h-10 text-brand-secondary mx-auto" />
                  <div>
                    <span className="text-xs font-bold text-brand-secondary hover:underline">Arraste mídia ou procure arquivos</span>
                    <p className="text-[10px] text-slate-400 mt-1">PNG, JPG, JPEG, MP4, MOV ou WEBM</p>
                  </div>
                </label>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
              Legenda do Post
            </label>
            <textarea
              rows={4}
              placeholder="Digite a legenda da publicação..."
              value={legenda}
              onChange={(e) => setLegenda(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-lg p-2.5 outline-none focus:border-brand-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
              Hashtags Associadas
            </label>
            <input
              type="text"
              placeholder="#hashtag1 #hashtag2 #hashtag3..."
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-lg p-2.5 outline-none focus:border-brand-primary"
            />
          </div>

          <div className="border-t border-slate-100 pt-4 flex gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={() => savePost('RASCUNHO')}
              className="w-1/2 py-2.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Salvar como Rascunho
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => savePost('PENDENTE')}
              className="w-1/2 py-2.5 bg-brand-secondary hover:bg-brand-primary text-brand-darker rounded-lg text-xs font-bold shadow hover:shadow-brand-secondary/20 transition-all flex items-center justify-center gap-2 border border-brand-primary/10"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enviar para Aprovação'}
            </button>
          </div>
        </div>

        {/* AI Caption Assistant Pane */}
        <div className="lg:col-span-5 bg-gradient-to-br from-slate-50 to-brand-light/30 border border-slate-200 p-6 rounded-xl shadow-sm self-start space-y-4">
          <div className="flex items-center gap-1.5">
            <div className="p-1 px-1.5 bg-brand-secondary text-brand-darker rounded-lg font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-slate-800">Redação Criativa Gemini AI</h3>
              <p className="text-[11px] text-slate-500">Desenvolvido com o modelo Inteligente do Google.</p>
            </div>
          </div>

          <div className="bg-white p-4 border border-brand-primary/20 rounded-xl space-y-3.5 shadow-sm">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1 uppercase tracking-wide">
                Diretrizes de Tom da Marca e Instruções
              </label>
              <textarea
                rows={3}
                placeholder="Ex de tom: Despojado, focado em vendas, inovador, persuasivo contendo piadas leves."
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-lg p-2 outline-none focus:border-brand-primary bg-slate-50/50"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1 uppercase tracking-wide">
                Número de Hashtags Desejado
              </label>
              <select
                value={aiTagsCount}
                onChange={(e) => setAiTagsCount(Number(e.target.value))}
                className="w-full text-xs border border-slate-200 rounded-lg p-2 outline-none focus:border-brand-primary bg-white"
              >
                <option value={3}>3 Hashtags Selecionadas</option>
                <option value={5}>5 Hashtags Direcionadas (Normal)</option>
                <option value={8}>8 Hashtags Amplas</option>
                <option value={12}>12 Hashtags Máximas</option>
              </select>
            </div>

            <button
              type="button"
              disabled={aiGenerating}
              onClick={handleAiGeneration}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-950 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors duration-150"
            >
              {aiGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Gerando Legenda...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Sugerir Legenda com IA</span>
                </>
              )}
            </button>
          </div>

          <div className="text-[11px] text-slate-500 bg-slate-100/50 p-3 rounded-lg border border-slate-200/50 leading-relaxed space-y-1">
            <span className="font-semibold block text-slate-600">💡 Como usar o assistente de legenda?</span>
            <p>1. Insira um título descritivo no formulário principal.</p>
            <p>2. Preencha acima instruções de foco (se houver).</p>
            <p>3. Clique em Sugerir para o Gemini analisar e substituir os campos finais.</p>
          </div>

          {/* Real-time Post Preview Sandbox */}
          {titulo && (
            <div className="border border-slate-200 bg-white rounded-xl overflow-hidden shadow-sm pt-3">
              <span className="text-[10px] font-bold text-slate-400 px-4 uppercase block tracking-wider">Preview Instantâneo do Post</span>
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-brand-light flex items-center justify-center text-xs font-bold text-brand-secondary border border-brand-primary/10">
                    IG
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">suamarca_oficial</span>
                    <span className="text-[9px] text-slate-400">Simulador de Feed</span>
                  </div>
                </div>

                {/* Media frame */}
                {fileUrl ? (
                  tipo === 'VIDEO' ? (
                    <video src={fileUrl} className="w-full aspect-video rounded-lg object-cover bg-slate-900 border border-slate-100" muted loops controls />
                  ) : (
                    <img src={fileUrl} alt="post preview" className="w-full aspect-video rounded-lg object-cover bg-slate-50 border border-slate-100" referrerPolicy="no-referrer" />
                  )
                ) : (
                  <div className="w-full aspect-video bg-slate-50 border border-slate-150 rounded-lg flex flex-col items-center justify-center text-slate-400 gap-1.5">
                    <ImageIcon className="w-6 h-6 text-slate-300" />
                    <span className="text-[10px]">Mídia não vinculada ainda</span>
                  </div>
                )}

                <div className="space-y-1">
                  <p className="text-xs text-slate-800 font-semibold line-clamp-1">{titulo}</p>
                  <p className="text-[11px] text-slate-600 leading-normal line-clamp-3 white-space-pre-wrap">{legenda || 'Preencha a legenda para as visualizações de feed...'}</p>
                  <p className="text-[11px] text-brand-secondary font-semibold">{hashtags}</p>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
