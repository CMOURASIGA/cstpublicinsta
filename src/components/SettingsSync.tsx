import React, { useEffect, useState } from 'react';
import { SettingsConfig } from '../types';
import { apiFetch } from '../lib/api';
import { CheckCircle2, FolderOpen, Info, KeyRound, RefreshCw, Settings, ShieldAlert, Sparkles } from 'lucide-react';

interface SettingsSyncProps {
  onSettingsSaved?: () => void;
}

const defaultSettings: SettingsConfig = {
  mode: 'SIMULATOR',
  operationalMode: 'SIMULATOR',
  appUrl: '',
  supabaseUrl: '',
  supabaseConfigured: false,
  supabaseSchemaReady: false,
  missingSupabaseTables: [],
  googleDriveFolderId: '',
  googleConfigured: false,
  instagramBusinessId: '',
  instagramGraphBaseUrl: 'https://graph.facebook.com',
  facebookPageId: '',
  instagramConfigured: false,
  geminiModel: 'gemini-3.5-flash',
  geminiConfigured: false,
  graphApiVersion: 'v23.0',
  secretsStoredInBackend: true,
  readOnly: true,
  missingEnv: [],
};

function StatusBadge({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
        active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
      }`}
    >
      {active ? <CheckCircle2 className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
      {label}
    </span>
  );
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">{label}</label>
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-700">
        {value || 'Não configurado'}
      </div>
    </div>
  );
}

export default function SettingsSync({ onSettingsSaved }: SettingsSyncProps) {
  const [settings, setSettings] = useState<SettingsConfig>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSettings = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/api/settings');
      const data = await res.json();
      if (!res.ok || !data.settings) {
        throw new Error(data.error || 'Falha ao carregar as integrações.');
      }
      setSettings(data.settings);
      onSettingsSaved?.();
    } catch (err) {
      console.error(err);
      setError('Não foi possível carregar o estado das integrações do backend.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSettings();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold font-sans text-slate-800">Parâmetros e Integrações</h2>
          <p className="mt-1 text-xs text-slate-500">
            As credenciais agora são lidas apenas no backend via variáveis de ambiente. Esta tela reflete o estado efetivo da aplicação.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadSettings()}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
          <Settings className="h-5 w-5 text-brand-secondary" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <div className="space-y-4 rounded-xl bg-gradient-to-br from-brand-secondary to-brand-primary p-5 font-semibold text-brand-darker shadow-md">
            <div>
              <h3 className="flex items-center gap-1.5 text-sm font-bold tracking-tight">
                <Sparkles className="h-4 w-4 text-brand-darker" />
                Estado Operacional
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-brand-darker/90">
                Modo solicitado: <strong>{settings.mode}</strong>. Modo efetivo: <strong>{settings.operationalMode}</strong>.
              </p>
            </div>
            <div className="space-y-2 border-t border-brand-primary/20 pt-3 text-xs text-brand-darker/90">
              <p>• Segredos permanecem no backend</p>
              <p>• Upload real usa Google Drive quando o ambiente está completo</p>
              <p>• Publicação real usa Meta Graph API quando habilitada</p>
            </div>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
            <div className="flex gap-2">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div className="space-y-1">
                <p className="font-semibold text-amber-900">Configuração manual</p>
                <p>
                  Os documentos pedem configuração por `process.env`. Para alterar tokens, IDs e chaves, atualize o ambiente do servidor ou da Vercel e depois use “Atualizar”.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm lg:col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge active={settings.supabaseConfigured && settings.supabaseSchemaReady} label={settings.supabaseConfigured && settings.supabaseSchemaReady ? 'Supabase ativo' : 'Supabase pendente'} />
            <StatusBadge active={settings.googleConfigured} label={settings.googleConfigured ? 'Google Drive ativo' : 'Google Drive pendente'} />
            <StatusBadge active={settings.instagramConfigured} label={settings.instagramConfigured ? 'Meta/Instagram ativo' : 'Meta/Instagram pendente'} />
            <StatusBadge active={settings.geminiConfigured} label={settings.geminiConfigured ? 'Gemini ativo' : 'Gemini pendente'} />
          </div>

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
            </div>
          )}

          {settings.missingEnv.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
              <p className="font-semibold text-amber-900">Variáveis ausentes para operação real</p>
              <p className="mt-1 leading-relaxed">{settings.missingEnv.join(', ')}</p>
            </div>
          )}

          {settings.missingSupabaseTables.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
              <p className="font-semibold text-amber-900">Tabelas ausentes no Supabase</p>
              <p className="mt-1 leading-relaxed">{settings.missingSupabaseTables.join(', ')}</p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ReadonlyField label="APP_URL" value={settings.appUrl} />
            <ReadonlyField label="Graph API Version" value={settings.graphApiVersion} />
            <ReadonlyField label="Supabase URL" value={settings.supabaseUrl} />
            <ReadonlyField label="Pasta raiz Google Drive" value={settings.googleDriveFolderId} />
            <ReadonlyField label="Instagram Actor ID" value={settings.instagramBusinessId} />
            <ReadonlyField label="Instagram Graph Base URL" value={settings.instagramGraphBaseUrl || ''} />
            <ReadonlyField label="Facebook Page ID" value={settings.facebookPageId} />
            <ReadonlyField label="Gemini Model" value={settings.geminiModel} />
            <ReadonlyField label="Armazenamento de segredos" value={settings.secretsStoredInBackend ? 'Somente backend' : 'Indefinido'} />
          </div>

          <div className="grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 md:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="mb-2 flex items-center gap-2 text-slate-800">
                <FolderOpen className="h-4 w-4 text-yellow-500" />
                <h3 className="text-sm font-semibold">Google Drive</h3>
              </div>
              <p className="text-xs leading-relaxed text-slate-600">
                O backend cria e usa as pastas `Imagens`, `Videos` e `Publicados` dentro da pasta raiz configurada.
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="mb-2 flex items-center gap-2 text-slate-800">
                <KeyRound className="h-4 w-4 text-pink-500" />
                <h3 className="text-sm font-semibold">Meta Graph API</h3>
              </div>
              <p className="text-xs leading-relaxed text-slate-600">
                A publicação usa `/{'{INSTAGRAM_BUSINESS_ID}'}/media` e `/{'{INSTAGRAM_BUSINESS_ID}'}/media_publish`, conforme o documento técnico.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            {loading
              ? 'Lendo configuração efetiva do backend...'
              : settings.operationalMode === 'REAL'
                ? 'Ambiente apto para persistência em Supabase, upload no Google Drive e publicação real na Meta.'
                : 'Ambiente em fallback operacional. O backend só ativa o modo real quando as variáveis obrigatórias estão presentes e o schema do Supabase está íntegro.'}
          </div>
        </div>
      </div>
    </div>
  );
}
