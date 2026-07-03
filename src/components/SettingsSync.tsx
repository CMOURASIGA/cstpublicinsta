import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  History,
  Loader2,
  Plug,
  RefreshCw,
  Save,
  Shield,
  SlidersHorizontal,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import type { Cliente, ClienteConfiguracao, ClienteIntegracao, ParametroAuditoria, SistemaConfiguracao } from '../types';

type Tab = 'sistema' | 'cliente' | 'integracoes' | 'ia' | 'aprovacao' | 'auditoria';

interface Props {
  onSettingsSaved?: () => Promise<void> | void;
  activeClient?: Cliente | null;
  availableClients?: Cliente[];
  onSelectClient?: (client: Cliente) => void;
  onClientsChanged?: () => Promise<void> | void;
}

type Drafts = Record<string, string>;

type ConfigItem = {
  chave: string;
  valor?: string | null;
  valor_encrypted?: string | null;
  tipo: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON' | 'SECRET';
  categoria: string;
  descricao?: string | null;
  sensivel: boolean;
  editavel?: boolean;
  editavel_por_cliente?: boolean;
  usar_padrao_sistema?: boolean;
};

type AiProviderKey = 'GEMINI' | 'OPENAI' | 'ANTHROPIC' | 'DEEPSEEK' | 'GROK' | 'AZURE_OPENAI';

type AiProviderOption = {
  key: AiProviderKey;
  label: string;
  description: string;
  apiKeyLabel: string;
  models: string[];
};

const AI_PROVIDER_OPTIONS: AiProviderOption[] = [
  {
    key: 'GEMINI',
    label: 'Gemini',
    description: 'Boa opção para geração de texto, resumo e apoio multimodal.',
    apiKeyLabel: 'Google AI Studio / Gemini API key',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-1.5-pro'],
  },
  {
    key: 'OPENAI',
    label: 'OpenAI',
    description: 'Bom equilíbrio entre qualidade de texto, automação e consistência.',
    apiKeyLabel: 'OpenAI API key',
    models: ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4o', 'gpt-4o-mini', 'o3-mini'],
  },
  {
    key: 'ANTHROPIC',
    label: 'Anthropic',
    description: 'Recomendado para textos longos e instruções com mais contexto.',
    apiKeyLabel: 'Anthropic API key',
    models: ['claude-sonnet-4-20250514', 'claude-3-7-sonnet-latest', 'claude-3-5-sonnet-latest'],
  },
  {
    key: 'DEEPSEEK',
    label: 'DeepSeek',
    description: 'Alternativa econômica para geração e análise de texto.',
    apiKeyLabel: 'DeepSeek API key',
    models: ['deepseek-chat', 'deepseek-reasoner'],
  },
  {
    key: 'GROK',
    label: 'Grok',
    description: 'Modelo voltado para respostas mais diretas e geração geral.',
    apiKeyLabel: 'xAI API key',
    models: ['grok-3', 'grok-3-mini', 'grok-2'],
  },
  {
    key: 'AZURE_OPENAI',
    label: 'Azure OpenAI',
    description: 'Útil quando sua conta/modelo está publicada no Azure.',
    apiKeyLabel: 'Azure OpenAI key',
    models: ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4o', 'gpt-4o-mini'],
  },
];

function getProviderModels(provider: string): string[] {
  return AI_PROVIDER_OPTIONS.find((item) => item.key === provider)?.models || [];
}

const SYSTEM_DEFAULTS: ConfigItem[] = [
  { chave: 'APP_URL', categoria: 'GERAL', tipo: 'STRING', descricao: 'Endereco publico da plataforma.', sensivel: false, editavel: true, valor: '' },
  { chave: 'SUPABASE_URL', categoria: 'BANCO', tipo: 'STRING', descricao: 'URL do projeto Supabase.', sensivel: false, editavel: false, valor: '' },
  { chave: 'INSTAGRAM_GRAPH_BASE_URL', categoria: 'META', tipo: 'STRING', descricao: 'Base da Graph API.', sensivel: false, editavel: false, valor: 'https://graph.facebook.com' },
  { chave: 'GRAPH_API_VERSION', categoria: 'META', tipo: 'STRING', descricao: 'Versao padrao da API.', sensivel: false, editavel: true, valor: 'v23.0' },
  { chave: 'DEFAULT_CLIENT_SLUG', categoria: 'CLIENTES', tipo: 'STRING', descricao: 'Cliente inicial.', sensivel: false, editavel: true, valor: 'cliente-inicial' },
  { chave: 'CLIENT_INTEGRATIONS_STORAGE', categoria: 'SEGURANCA', tipo: 'STRING', descricao: 'Onde guardar credenciais.', sensivel: false, editavel: true, valor: 'SUPABASE' },
];

const IA_DEFAULTS: ConfigItem[] = [
  { chave: 'PROVEDOR_IA', categoria: 'IA', tipo: 'STRING', descricao: 'Provedor padrao.', sensivel: false, editavel_por_cliente: true, usar_padrao_sistema: true, valor: 'GEMINI' },
  { chave: 'MODELO_IA', categoria: 'IA', tipo: 'STRING', descricao: 'Modelo do cliente.', sensivel: false, editavel_por_cliente: true, usar_padrao_sistema: true, valor: '' },
  { chave: 'PROMPT_BASE', categoria: 'IA', tipo: 'JSON', descricao: 'Prompt base do cliente.', sensivel: false, editavel_por_cliente: true, usar_padrao_sistema: true, valor: '' },
  { chave: 'TEMPERATURA', categoria: 'IA', tipo: 'NUMBER', descricao: 'Temperatura.', sensivel: false, editavel_por_cliente: true, usar_padrao_sistema: true, valor: '0.4' },
  { chave: 'IA_API_KEY', categoria: 'IA', tipo: 'SECRET', descricao: 'Chave do provedor, quando houver.', sensivel: true, editavel_por_cliente: true, usar_padrao_sistema: true, valor: '' },
];

const APPROVAL_DEFAULTS: ConfigItem[] = [
  { chave: 'EXIGE_APROVACAO', categoria: 'APROVACAO', tipo: 'BOOLEAN', descricao: 'Exige aprovacao antes de publicar.', sensivel: false, editavel_por_cliente: true, usar_padrao_sistema: true, valor: 'true' },
  { chave: 'NUMERO_MINIMO_APROVADORES', categoria: 'APROVACAO', tipo: 'NUMBER', descricao: 'Quantidade minima de aprovadores.', sensivel: false, editavel_por_cliente: true, usar_padrao_sistema: true, valor: '1' },
  { chave: 'PERMITE_PUBLICACAO_DIRETA', categoria: 'APROVACAO', tipo: 'BOOLEAN', descricao: 'Aprovador pode publicar direto.', sensivel: false, editavel_por_cliente: true, usar_padrao_sistema: true, valor: 'true' },
  { chave: 'NOTIFICAR_APROVADORES', categoria: 'APROVACAO', tipo: 'BOOLEAN', descricao: 'Notifica aprovadores.', sensivel: false, editavel_por_cliente: true, usar_padrao_sistema: true, valor: 'true' },
  { chave: 'NOTIFICAR_CRIADOR', categoria: 'APROVACAO', tipo: 'BOOLEAN', descricao: 'Notifica criador.', sensivel: false, editavel_por_cliente: true, usar_padrao_sistema: true, valor: 'true' },
];

function mergeDefaults(base: ConfigItem[], current: Array<SistemaConfiguracao | ClienteConfiguracao>) {
  const map = new Map(current.map((item) => [item.chave, item]));
  const merged = base.map((item) => {
    const existing = map.get(item.chave);
    return {
      ...item,
      valor: existing?.valor ?? existing?.valor_encrypted ?? item.valor ?? '',
      valor_encrypted: existing?.valor_encrypted ?? item.valor_encrypted ?? null,
      sensivel: existing?.sensivel ?? item.sensivel,
      categoria: existing?.categoria ?? item.categoria,
      tipo: existing?.tipo ?? item.tipo,
      descricao: existing?.descricao ?? item.descricao,
      editavel: 'editavel' in item ? existing && 'editavel' in existing ? existing.editavel : item.editavel : undefined,
      editavel_por_cliente:
        'editavel_por_cliente' in item ? existing && 'editavel_por_cliente' in existing ? existing.editavel_por_cliente : item.editavel_por_cliente : undefined,
      usar_padrao_sistema:
        'usar_padrao_sistema' in item ? existing && 'usar_padrao_sistema' in existing ? existing.usar_padrao_sistema : item.usar_padrao_sistema : undefined,
    } as ConfigItem;
  });

  for (const item of current) {
    if (!merged.some((entry) => entry.chave === item.chave)) merged.push(item as ConfigItem);
  }
  return merged;
}

function valueFor(item: ConfigItem, drafts: Drafts) {
  return drafts[item.chave] ?? String(item.valor_encrypted ?? item.valor ?? '');
}

function sanitizeIntegrationPayload(integrations: Partial<ClienteIntegracao>) {
  const payload = { ...integrations } as Record<string, unknown>;
  delete payload.instagram_access_token;
  delete payload.instagram_access_token_encrypted;
  delete payload.google_drive_access_token_encrypted;
  delete payload.google_drive_refresh_token_encrypted;
  return payload;
}

function Field({
  label,
  value,
  onChange,
  secret = false,
  kind = 'text',
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  secret?: boolean;
  kind?: 'text' | 'number' | 'password' | 'textarea';
  disabled?: boolean;
  key?: React.Key;
}) {
  const inputClass = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 outline-none focus:border-brand-primary disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500';
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</span>
      {kind === 'textarea' ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={4} className={`${inputClass} font-mono text-[11px]`} spellCheck={false} disabled={disabled} />
      ) : (
        <input type={secret ? 'password' : kind} value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} spellCheck={false} disabled={disabled} />
      )}
    </label>
  );
}

function AuditCard({ item }: { item: ParametroAuditoria; key?: React.Key }) {
  const action = item.acao === 'CRIADO' ? 'Criado' : item.acao === 'ALTERADO' ? 'Alterado' : item.acao === 'REMOVIDO' ? 'Removido' : 'Testado';
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold text-slate-800">{item.chave}</p>
        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{action}</span>
      </div>
      <p className="mt-1 text-[11px] text-slate-500">
        {item.categoria} | {item.usuario_id || 'sistema'} | {new Date(item.criado_em).toLocaleString('pt-BR')}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: Cliente['status'] }) {
  const tone =
    status === 'ATIVO'
      ? 'bg-emerald-100 text-emerald-700'
      : status === 'SUSPENSO'
        ? 'bg-amber-100 text-amber-700'
        : 'bg-slate-100 text-slate-600';
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone}`}>{status}</span>;
}

export default function SettingsSync({ onSettingsSaved, activeClient, availableClients = [], onSelectClient, onClientsChanged }: Props) {
  const [tab, setTab] = useState<Tab>('sistema');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creatingClient, setCreatingClient] = useState(false);
  const [testing, setTesting] = useState('');
  const [error, setError] = useState('');
  const [searchClient, setSearchClient] = useState('');
  const [clientStatusFilter, setClientStatusFilter] = useState<'TODOS' | Cliente['status']>('TODOS');
  const [showSecrets, setShowSecrets] = useState(false);
  const [googleOauthStatus, setGoogleOauthStatus] = useState<{ ready: boolean; missing: string[]; redirectUri?: string }>({
    ready: false,
    missing: [],
  });
  const [systemItems, setSystemItems] = useState<ConfigItem[]>([]);
  const [systemDrafts, setSystemDrafts] = useState<Drafts>({});
  const [clientItems, setClientItems] = useState<ConfigItem[]>([]);
  const [clientDrafts, setClientDrafts] = useState<Drafts>({});
  const [clientInfo, setClientInfo] = useState<Partial<Cliente>>({});
  const [newClientForm, setNewClientForm] = useState({
    nome: '',
    slug: '',
    status: 'ATIVO' as Cliente['status'],
    logo_url: '',
    cor_primaria: '#002d5b',
    cor_secundaria: '#0060ac',
  });
  const [integrations, setIntegrations] = useState<Partial<ClienteIntegracao>>({});
  const [instagramManual, setInstagramManual] = useState({
    instagram_username: '',
    instagram_user_id: '',
    instagram_business_id: '',
    instagram_access_token: '',
    instagram_connection_mode: 'MANUAL_TEST_TOKEN' as NonNullable<ClienteIntegracao['instagram_connection_mode']>,
    instagram_token_status: 'ATIVO_TESTE' as NonNullable<ClienteIntegracao['instagram_token_status']>,
  });
  const [audits, setAudits] = useState<ParametroAuditoria[]>([]);
  const [systemAudits, setSystemAudits] = useState<ParametroAuditoria[]>([]);

  const clientId = activeClient?.id || '';
  const systemGroups = useMemo(() => {
    const groups = new Map<string, ConfigItem[]>();
    for (const item of systemItems) {
      const list = groups.get(item.categoria) || [];
      list.push(item);
      groups.set(item.categoria, list);
    }
    return Array.from(groups.entries());
  }, [systemItems]);

  const clientGeneralItems = useMemo(
    () => clientItems.filter((item) => item.categoria !== 'IA' && item.categoria !== 'APROVACAO' && item.categoria !== 'INTEGRACAO'),
    [clientItems],
  );
  const filteredClients = useMemo(
    () =>
      availableClients.filter((client) => {
        const matchesSearch =
          !searchClient.trim() ||
          client.nome.toLowerCase().includes(searchClient.toLowerCase()) ||
          client.slug.toLowerCase().includes(searchClient.toLowerCase());
        const matchesStatus = clientStatusFilter === 'TODOS' || client.status === clientStatusFilter;
        return matchesSearch && matchesStatus;
      }),
    [availableClients, searchClient, clientStatusFilter],
  );
  const iaItems = useMemo(() => clientItems.filter((item) => item.categoria === 'IA'), [clientItems]);
  const approvalItems = useMemo(() => clientItems.filter((item) => item.categoria === 'APROVACAO'), [clientItems]);
  const integrationConfigItems = useMemo(() => clientItems.filter((item) => item.categoria === 'INTEGRACAO'), [clientItems]);
  const googleConnectedEmail = String(integrationConfigItems.find((item) => item.chave === 'GOOGLE_OAUTH_ACCOUNT_EMAIL')?.valor || '');
  const googleConnectedAt = String(integrationConfigItems.find((item) => item.chave === 'GOOGLE_OAUTH_CONNECTED_AT')?.valor || '');
  const googleHasRefreshToken = Boolean(
    integrationConfigItems.find((item) => item.chave === 'GOOGLE_REFRESH_TOKEN')?.valor_encrypted ||
      integrationConfigItems.find((item) => item.chave === 'GOOGLE_REFRESH_TOKEN')?.valor,
  );
  const googleDriveStatusRaw = String(
    integrationConfigItems.find((item) => item.chave === 'GOOGLE_DRIVE_STATUS')?.valor || integrations.google_drive_status || 'NAO_CONECTADO',
  );
  const googleDriveStatus = googleHasRefreshToken && googleDriveStatusRaw === 'NAO_CONECTADO' ? 'CONECTADO' : googleDriveStatusRaw;
  const providerValue = String(clientDrafts.PROVEDOR_IA || iaItems.find((item) => item.chave === 'PROVEDOR_IA')?.valor || 'GEMINI').toUpperCase();
  const instagramStatus = String(integrations.instagram_token_status || 'NAO_CONFIGURADO');
  const instagramMode = String(integrations.instagram_connection_mode || 'INSTAGRAM_LOGIN');
  const instagramMaskedToken = String(integrations.instagram_access_token || '');
  const instagramHasToken = Boolean(instagramMaskedToken && instagramMaskedToken !== 'null' && instagramMaskedToken !== 'undefined');
  const instagramConnected = (instagramStatus === 'ATIVO' || instagramStatus === 'ATIVO_TESTE') && instagramHasToken;
  const providerModels = getProviderModels(providerValue);
  const selectedModel = String(clientDrafts.MODELO_IA || iaItems.find((item) => item.chave === 'MODELO_IA')?.valor || '');

  const loadData = async () => {
    if (!clientId) return;
    setLoading(true);
    setError('');
    try {
      const [systemRes, clientRes, auditRes, systemAuditRes] = await Promise.all([
        apiFetch('/api/admin/configuracoes/sistema'),
        apiFetch(`/api/clientes/${clientId}/configuracoes`),
        apiFetch(`/api/clientes/${clientId}/logs/parametros`).catch(() => null),
        apiFetch('/api/admin/logs/parametros').catch(() => null),
      ]);

      const systemData = await systemRes.json();
      const clientData = await clientRes.json();
      const auditData = auditRes ? await auditRes.json().catch(() => ({ items: [] })) : { items: [] };
      const systemAuditData = systemAuditRes ? await systemAuditRes.json().catch(() => ({ items: [] })) : { items: [] };

      const systemList = mergeDefaults(SYSTEM_DEFAULTS, (systemData.items || []) as SistemaConfiguracao[]);
      const clientList = mergeDefaults([...IA_DEFAULTS, ...APPROVAL_DEFAULTS], (clientData.configuracoes || []) as ClienteConfiguracao[]).filter(
        (item) => item.chave !== 'MODO_OPERACAO',
      );

      setSystemItems(systemList);
      setSystemDrafts(Object.fromEntries(systemList.map((item) => [item.chave, String(item.valor_encrypted ?? item.valor ?? '')])));
      setClientItems(clientList);
      setClientDrafts(Object.fromEntries(clientList.map((item) => [item.chave, String(item.valor_encrypted ?? item.valor ?? '')])));
      setClientInfo({
        nome: clientData.cliente?.nome || '',
        slug: clientData.cliente?.slug || '',
        status: clientData.cliente?.status || 'ATIVO',
        logo_url: clientData.cliente?.logo_url || '',
        cor_primaria: clientData.cliente?.cor_primaria || '',
        cor_secundaria: clientData.cliente?.cor_secundaria || '',
      });
      setIntegrations((clientData.integracoes || {}) as ClienteIntegracao);
      setInstagramManual({
        instagram_username: String(clientData.integracoes?.instagram_username || ''),
        instagram_user_id: String(clientData.integracoes?.instagram_user_id || ''),
        instagram_business_id: String(clientData.integracoes?.instagram_business_id || ''),
        instagram_access_token: '',
        instagram_connection_mode: (clientData.integracoes?.instagram_connection_mode || 'MANUAL_TEST_TOKEN') as NonNullable<ClienteIntegracao['instagram_connection_mode']>,
        instagram_token_status: (clientData.integracoes?.instagram_token_status || 'ATIVO_TESTE') as NonNullable<ClienteIntegracao['instagram_token_status']>,
      });
      setAudits((auditData.items || clientData.auditoria || []) as ParametroAuditoria[]);
      setSystemAudits((systemAuditData.items || []) as ParametroAuditoria[]);
      const oauthStatusRes = await apiFetch('/api/google/oauth/status').catch(() => null);
      if (oauthStatusRes) {
        const oauthStatus = await oauthStatusRes.json().catch(() => ({ ready: false, missing: ['GOOGLE_OAUTH_STATUS'] }));
        setGoogleOauthStatus({
          ready: Boolean(oauthStatus.ready),
          missing: Array.isArray(oauthStatus.missing) ? oauthStatus.missing : [],
          redirectUri: oauthStatus.redirectUri,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar configuracoes.');
    } finally {
      setLoading(false);
    }
  };

  const createClient = async () => {
    if (!newClientForm.nome.trim() || !newClientForm.slug.trim()) {
      setError('Nome e slug são obrigatórios.');
      return;
    }

    setCreatingClient(true);
    setError('');
    try {
      const res = await apiFetch('/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newClientForm),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Falha ao criar cliente.');

      setNewClientForm({
        nome: '',
        slug: '',
        status: 'ATIVO',
        logo_url: '',
        cor_primaria: '#002d5b',
        cor_secundaria: '#0060ac',
      });
      await onClientsChanged?.();
      if (data.cliente) onSelectClient?.(data.cliente as Cliente);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar cliente.');
    } finally {
      setCreatingClient(false);
    }
  };

  useEffect(() => {
    if (!clientId) {
      setLoading(false);
      return;
    }
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; success?: boolean; message?: string } | null;
      if (!data || (data.type !== 'instaflow-google-oauth' && data.type !== 'instaflow-instagram-oauth')) return;
      if (data.success && data.message) {
        alert(data.message);
      }
      void loadData();
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const saveItems = async (endpoint: string, category: string, items: ConfigItem[]) => {
    if (!clientId && endpoint.includes('/api/clientes/')) return;
    setSaving(true);
    setError('');
    try {
      const payload = items.map((item) => ({
        chave: item.chave,
        tipo: item.tipo,
        categoria: item.categoria || category,
        descricao: item.descricao,
        sensivel: item.sensivel,
        editavel_por_cliente: item.editavel_por_cliente ?? true,
        usar_padrao_sistema: item.usar_padrao_sistema ?? true,
        valor: item.sensivel ? null : clientDrafts[item.chave] || '',
        valor_encrypted: item.sensivel ? clientDrafts[item.chave] || '' : null,
      }));
      const res = await apiFetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: payload }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Falha ao salvar.');
      await onSettingsSaved?.();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const saveClient = async () => {
    if (!clientId) return;
    setSaving(true);
    setError('');
    try {
      const resClient = await apiFetch(`/api/clientes/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clientInfo),
      });
      const dataClient = await resClient.json();
      if (!resClient.ok || !dataClient.success) throw new Error(dataClient.error || 'Falha ao salvar dados do cliente.');
      await saveItems(`/api/clientes/${clientId}/configuracoes`, 'GERAL', clientGeneralItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar cliente.');
    } finally {
      setSaving(false);
    }
  };

  const saveIntegrations = async () => {
    if (!clientId) return;
    setSaving(true);
    setError('');
    try {
      const res = await apiFetch(`/api/clientes/${clientId}/integracoes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sanitizeIntegrationPayload(integrations)),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Falha ao salvar integracoes.');
      await onSettingsSaved?.();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar integracoes.');
    } finally {
      setSaving(false);
    }
  };

  const saveIntegrationMode = async (mode: NonNullable<ClienteIntegracao['modo_operacao']>) => {
    if (!clientId) return;
    const payload = sanitizeIntegrationPayload({ ...integrations, modo_operacao: mode });
    setIntegrations((current) => ({ ...current, modo_operacao: mode }));
    setSaving(true);
    setError('');
    try {
      const res = await apiFetch(`/api/clientes/${clientId}/integracoes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, modo_operacao: mode }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Falha ao salvar integracoes.');
      await onSettingsSaved?.();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar integracoes.');
    } finally {
      setSaving(false);
    }
  };

  const runTest = async (endpoint: string, name: string, payload: Record<string, unknown> = {}) => {
    setTesting(name);
    setError('');
    try {
      const res = await apiFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Falha ao testar.');
      alert(data.message || 'Teste executado com sucesso.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao testar.');
    } finally {
      setTesting('');
    }
  };

  const connectGoogleDrive = async () => {
    if (!clientId) return;
    if (!googleOauthStatus.ready) {
      setError(
        `Para abrir o login Google, configure no ambiente: ${googleOauthStatus.missing.join(', ') || 'GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_DRIVE_REDIRECT_URI'}.`,
      );
      return;
    }
    const popup = window.open('', 'instaflow-google-oauth', 'width=720,height=760,menubar=no,toolbar=no,location=yes,status=no');
    if (!popup) {
      setError('O navegador bloqueou o popup de login Google.');
      return;
    }
    try {
      const res = await apiFetch(`/api/clientes/${clientId}/integracoes/google-drive/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ return_to: window.location.pathname }),
      });
      const data = await res.json();
      if (!res.ok || !data.authorization_url) throw new Error(data.error || 'Falha ao iniciar login Google.');
      popup.location.href = String(data.authorization_url);
    } catch (err) {
      popup.close();
      setError(err instanceof Error ? err.message : 'Falha ao iniciar login Google.');
    }
  };

  const useExistingGoogleDriveFolder = async () => {
    if (!clientId) return;
    setTesting('drive-folder');
    setError('');
    try {
      const res = await apiFetch(`/api/clientes/${clientId}/integracoes/google-drive/use-existing-folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ google_drive_folder_id: integrations.google_drive_folder_id || '' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Falha ao validar pasta do Google Drive.');
      alert(data.folder?.name ? `Pasta '${data.folder.name}' vinculada com sucesso.` : 'Pasta raiz vinculada com sucesso.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao validar pasta do Google Drive.');
    } finally {
      setTesting('');
    }
  };

  const setupGoogleDriveFolders = async () => {
    if (!clientId) return;
    setTesting('drive-setup');
    setError('');
    try {
      const res = await apiFetch(`/api/clientes/${clientId}/integracoes/google-drive/setup-folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ google_drive_folder_id: integrations.google_drive_folder_id || '' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Falha ao criar estrutura do Google Drive.');
      alert('Estrutura do Google Drive criada e vinculada ao cliente.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar estrutura do Google Drive.');
    } finally {
      setTesting('');
    }
  };

  const disconnectGoogleDrive = async () => {
    if (!clientId) return;
    setTesting('drive-disconnect');
    setError('');
    try {
      const res = await apiFetch(`/api/clientes/${clientId}/integracoes/google-drive/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Falha ao desconectar Google Drive.');
      alert('Conta Google desconectada do cliente.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao desconectar Google Drive.');
    } finally {
      setTesting('');
    }
  };

  const connectInstagram = async (mode: 'instagram' | 'meta') => {
    if (!clientId) return;
    const popup = window.open('', 'instaflow-instagram-oauth', 'width=720,height=760,menubar=no,toolbar=no,location=yes,status=no');
    if (!popup) {
      setError('O navegador bloqueou o popup de login Instagram/Meta.');
      return;
    }
    try {
      const route = mode === 'instagram' ? '/api/integrations/instagram/connect' : '/api/integrations/meta/connect';
      const res = await apiFetch(
        `${route}?clienteId=${encodeURIComponent(clientId)}&return_to=${encodeURIComponent(window.location.pathname)}&format=json`,
      );
      const data = await res.json();
      if (!res.ok || !data.authorization_url) throw new Error(data.error || 'Falha ao iniciar login Instagram/Meta.');
      popup.location.href = String(data.authorization_url);
    } catch (err) {
      popup.close();
      setError(err instanceof Error ? err.message : 'Falha ao iniciar login Instagram/Meta.');
    }
  };

  const saveInstagramManualToken = async () => {
    if (!clientId) return;
    setSaving(true);
    setError('');
    try {
      const res = await apiFetch(`/api/clientes/${clientId}/integracoes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...integrations,
          ...instagramManual,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Falha ao salvar token Instagram.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar token Instagram.');
    } finally {
      setSaving(false);
    }
  };

  const testInstagramIntegration = async (mode: 'instagram' | 'meta') => {
    if (!clientId) return;
    await runTest(mode === 'instagram' ? '/api/integrations/instagram/test' : '/api/integrations/meta/test', `instagram-${mode}`, {
      clienteId: clientId,
    });
    await loadData();
  };

  const disconnectInstagramIntegration = async (mode: 'instagram' | 'meta') => {
    if (!clientId) return;
    setTesting(`instagram-disconnect-${mode}`);
    setError('');
    try {
      const res = await apiFetch(mode === 'instagram' ? '/api/integrations/instagram/disconnect' : '/api/integrations/meta/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clienteId: clientId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Falha ao desconectar integraÃ§Ã£o Instagram.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao desconectar integraÃ§Ã£o Instagram.');
    } finally {
      setTesting('');
    }
  };

  if (loading) {
    return <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">Carregando parametrizacoes...</div>;
  }

  if (!clientId) {
    return <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Nenhum cliente ativo foi selecionado.</div>;
  }

  const nav = (id: Tab, label: string, icon: React.ReactNode) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all ${
        tab === id ? 'bg-brand-secondary text-brand-darker shadow-sm' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold font-sans text-slate-800">Parametrizacoes</h2>
          <p className="mt-1 text-xs text-slate-500">Separacao entre sistema, cliente, integracoes, IA, aprovacao e auditoria.</p>
        </div>
        <SlidersHorizontal className="h-5 w-5 text-brand-secondary" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {nav('cliente', 'Clientes', <Building2 className="h-3.5 w-3.5" />)}
        {nav('sistema', 'Sistema', <Shield className="h-3.5 w-3.5" />)}
        {nav('integracoes', 'Integracoes', <Plug className="h-3.5 w-3.5" />)}
        {nav('ia', 'IA', <Bot className="h-3.5 w-3.5" />)}
        {nav('aprovacao', 'Aprovacao', <CheckCircle2 className="h-3.5 w-3.5" />)}
        {nav('auditoria', 'Auditoria', <History className="h-3.5 w-3.5" />)}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Cliente ativo</p>
            <p className="mt-1 text-sm font-bold text-slate-800">{activeClient?.nome}</p>
            <p className="text-[11px] text-slate-500">{activeClient?.slug}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void loadData()} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              <RefreshCw className="h-3.5 w-3.5" />
              Recarregar
            </button>
            <button type="button" onClick={() => setShowSecrets((value) => !value)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              {showSecrets ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {showSecrets ? 'Ocultar segredos' : 'Exibir segredos'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {tab === 'cliente' && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.5fr_0.85fr]">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                <input
                  value={searchClient}
                  onChange={(event) => setSearchClient(event.target.value)}
                  placeholder="Buscar cliente"
                  className="w-full bg-transparent text-xs outline-none"
                />
              </label>
              <select
                value={clientStatusFilter}
                onChange={(event) => setClientStatusFilter(event.target.value as typeof clientStatusFilter)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
              >
                <option value="TODOS">Todos</option>
                <option value="ATIVO">Ativo</option>
                <option value="INATIVO">Inativo</option>
                <option value="SUSPENSO">Suspenso</option>
              </select>
              <button
                type="button"
                onClick={() => void onClientsChanged?.()}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Atualizar
              </button>
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
              <div className="grid grid-cols-12 gap-2 bg-slate-50 px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                <div className="col-span-4">Cliente</div>
                <div className="col-span-3">Slug</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-3">Ações</div>
              </div>
              <div className="divide-y divide-slate-100">
                {filteredClients.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500">Nenhum cliente encontrado.</div>
                ) : (
                  filteredClients.map((client) => {
                    const selected = client.id === clientId;
                    return (
                      <div key={client.id} className={`grid grid-cols-1 gap-3 px-4 py-4 md:grid-cols-12 md:items-center ${selected ? 'bg-brand-light/30' : ''}`}>
                        <div className="md:col-span-4">
                          <p className="text-sm font-bold text-slate-800">{client.nome}</p>
                          <p className="text-[11px] text-slate-500">{client.id}</p>
                        </div>
                        <div className="md:col-span-3 text-xs text-slate-600">{client.slug}</div>
                        <div className="md:col-span-2">
                          <StatusBadge status={client.status} />
                        </div>
                        <div className="md:col-span-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => onSelectClient?.(client)}
                            className={`rounded-lg border px-3 py-2 text-[11px] font-semibold ${selected ? 'border-brand-secondary bg-brand-secondary text-brand-darker' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                          >
                            {selected ? 'Selecionado' : 'Selecionar'}
                          </button>
                          <button
                            type="button"
                            onClick={() => onSelectClient?.(client)}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Editar parametrizações
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Novo cliente</h3>
                <p className="mt-1 text-xs text-slate-500">Cadastro direto no Supabase.</p>
              </div>
              <Building2 className="h-4 w-4 text-brand-secondary" />
            </div>
            <div className="mt-4 space-y-3">
              <input
                value={newClientForm.nome}
                onChange={(event) => setNewClientForm((curr) => ({ ...curr, nome: event.target.value }))}
                placeholder="Nome do cliente"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none"
              />
              <input
                value={newClientForm.slug}
                onChange={(event) => setNewClientForm((curr) => ({ ...curr, slug: event.target.value }))}
                placeholder="Slug"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none"
              />
              <select
                value={newClientForm.status}
                onChange={(event) => setNewClientForm((curr) => ({ ...curr, status: event.target.value as Cliente['status'] }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none"
              >
                <option value="ATIVO">ATIVO</option>
                <option value="INATIVO">INATIVO</option>
                <option value="SUSPENSO">SUSPENSO</option>
              </select>
              <input
                value={newClientForm.logo_url}
                onChange={(event) => setNewClientForm((curr) => ({ ...curr, logo_url: event.target.value }))}
                placeholder="Logo URL"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none"
              />
              <input
                value={newClientForm.cor_primaria}
                onChange={(event) => setNewClientForm((curr) => ({ ...curr, cor_primaria: event.target.value }))}
                placeholder="Cor primária"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none"
              />
              <input
                value={newClientForm.cor_secundaria}
                onChange={(event) => setNewClientForm((curr) => ({ ...curr, cor_secundaria: event.target.value }))}
                placeholder="Cor secundária"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none"
              />
              <button
                type="button"
                onClick={() => void createClient()}
                disabled={creatingClient}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-secondary px-4 py-2 text-xs font-bold text-brand-darker disabled:opacity-60"
              >
                {creatingClient ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
                Criar cliente
              </button>
            </div>
          </div>
        </div>
      )}
      {tab === 'sistema' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-bold">Variáveis de sistema</p>
            <p className="mt-1 text-xs leading-relaxed">
              Estes parâmetros são operacionais e devem permanecer no ambiente, por exemplo em <code>.env.local</code>, infraestrutura
              ou variáveis do deploy. A tela abaixo serve para diagnóstico e leitura, não para edição de rotina.
            </p>
          </div>
          {systemGroups.map(([category, items]) => (
            <div key={category} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">{category}</h3>
                  <p className="mt-1 text-xs text-slate-500">{items.length} parametro(s)</p>
                </div>
                <button type="button" onClick={() => void runTest('/api/admin/configuracoes/sistema/testar', 'system')} disabled={testing === 'system'} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                  {testing === 'system' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  Testar
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {items.map((item) => (
                  <div key={item.chave} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{item.chave}</p>
                        <p className="mt-1 text-xs text-slate-500">{item.descricao || 'Parâmetro de ambiente'}</p>
                      </div>
                      <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                        {item.tipo}
                      </span>
                    </div>
                    <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800">
                      {showSecrets && item.sensivel ? String(item.valor_encrypted ?? item.valor ?? '') : valueFor(item, systemDrafts) || 'Não definido'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'cliente' && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800">Dados do cliente</h3>
            <div className="mt-4 grid grid-cols-1 gap-3">
              <Field label="Nome" value={String(clientInfo.nome || '')} onChange={(value) => setClientInfo((current) => ({ ...current, nome: value }))} />
              <Field label="Slug" value={String(clientInfo.slug || '')} onChange={(value) => setClientInfo((current) => ({ ...current, slug: value }))} />
              <Field label="Status" value={String(clientInfo.status || 'ATIVO')} onChange={(value) => setClientInfo((current) => ({ ...current, status: value as Cliente['status'] }))} />
              <Field label="Logo URL" value={String(clientInfo.logo_url || '')} onChange={(value) => setClientInfo((current) => ({ ...current, logo_url: value }))} />
              <Field label="Cor primaria" value={String(clientInfo.cor_primaria || '')} onChange={(value) => setClientInfo((current) => ({ ...current, cor_primaria: value }))} />
              <Field label="Cor secundaria" value={String(clientInfo.cor_secundaria || '')} onChange={(value) => setClientInfo((current) => ({ ...current, cor_secundaria: value }))} />
            </div>
            <div className="mt-4 flex justify-end">
              <button type="button" onClick={() => void saveClient()} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-brand-secondary px-4 py-2 text-xs font-bold text-brand-darker shadow-sm hover:bg-brand-primary disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar cliente
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Parametros do cliente</h3>
                <p className="mt-1 text-xs text-slate-500">Campos fora de IA e aprovacao.</p>
              </div>
              <button type="button" onClick={() => void saveClient()} disabled={saving} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Salvar parametros
              </button>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
              {clientGeneralItems.map((item) => (
                <Field
                  key={item.chave}
                  label={item.chave}
                  value={showSecrets && item.sensivel ? String(item.valor_encrypted ?? item.valor ?? '') : valueFor(item, clientDrafts)}
                  onChange={(value) => setClientDrafts((current) => ({ ...current, [item.chave]: value }))}
                  secret={item.sensivel}
                  kind={item.tipo === 'BOOLEAN' ? 'text' : item.tipo === 'NUMBER' ? 'number' : item.tipo === 'JSON' ? 'textarea' : 'text'}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'integracoes' && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Google Drive</h3>
                <p className="mt-1 text-xs text-slate-500">Conecte a conta Google do cliente, vincule a pasta raiz e monte a estrutura operacional.</p>
              </div>
              <button
                type="button"
                onClick={() => void connectGoogleDrive()}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Plug className="h-3.5 w-3.5" />
                Conectar conta Google
              </button>
            </div>
            <div className={`mt-3 rounded-xl border p-4 text-xs ${googleHasRefreshToken ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold">{googleHasRefreshToken ? 'Conta Google conectada' : 'Conta Google ainda não conectada'}</p>
                <span className="rounded-full border border-current/20 bg-white/70 px-2 py-0.5 text-[10px] font-semibold">
                  {googleDriveStatus}
                </span>
              </div>
              <p className="mt-1 leading-relaxed">
                {googleConnectedEmail
                  ? `Conta atual: ${googleConnectedEmail}.`
                  : 'Use o botão acima para autenticar a conta Google que terá acesso às pastas do cliente.'}
              </p>
              {googleConnectedAt && <p className="mt-1">Última conexão: {new Date(googleConnectedAt).toLocaleString('pt-BR')}</p>}
            </div>
            {!googleOauthStatus.ready && (
              <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
                <p className="font-bold">Login Google ainda indisponível</p>
                <p className="mt-1">
                  Faltam no ambiente: {googleOauthStatus.missing.join(', ')}.
                </p>
                {googleOauthStatus.redirectUri && <p className="mt-1">Redirect atual: {googleOauthStatus.redirectUri}</p>}
                <p className="mt-1">Para local, a URI costuma ser `http://localhost:3000/api/integrations/google-drive/callback`.</p>
              </div>
            )}
            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900">
              <p className="font-bold">Fluxo operacional do cliente</p>
              <ol className="mt-2 list-decimal space-y-1 pl-4 leading-relaxed">
                <li>Conectar a conta Google que terá acesso ao Drive do cliente.</li>
                <li>Informar a pasta raiz do cliente com o ID ou o link completo.</li>
                <li>Usar a pasta existente ou pedir ao sistema para criar a estrutura padrão.</li>
                <li>Validar a conexão antes de importar ou publicar.</li>
                <li>O cliente precisa garantir leitura e escrita nessa pasta.</li>
              </ol>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3">
              <Field label="Pasta raiz do Drive" value={String(integrations.google_drive_folder_id || '')} onChange={(value) => setIntegrations((current) => ({ ...current, google_drive_folder_id: value }))} />
              <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 lg:grid-cols-2">
                <Field label="01 Entrada" value={String(integrations.google_drive_entrada_folder_id || '')} onChange={(value) => setIntegrations((current) => ({ ...current, google_drive_entrada_folder_id: value }))} disabled />
                <Field label="02 Em aprovação" value={String(integrations.google_drive_aprovacao_folder_id || '')} onChange={(value) => setIntegrations((current) => ({ ...current, google_drive_aprovacao_folder_id: value }))} disabled />
                <Field label="03 Aprovados" value={String(integrations.google_drive_aprovados_folder_id || '')} onChange={(value) => setIntegrations((current) => ({ ...current, google_drive_aprovados_folder_id: value }))} disabled />
                <Field label="04 Publicados" value={String(integrations.google_drive_publicados_folder_id || '')} onChange={(value) => setIntegrations((current) => ({ ...current, google_drive_publicados_folder_id: value }))} disabled />
                <Field label="05 Rejeitados" value={String(integrations.google_drive_rejeitados_folder_id || '')} onChange={(value) => setIntegrations((current) => ({ ...current, google_drive_rejeitados_folder_id: value }))} disabled />
                <Field label="06 Arquivados" value={String(integrations.google_drive_arquivados_folder_id || '')} onChange={(value) => setIntegrations((current) => ({ ...current, google_drive_arquivados_folder_id: value }))} disabled />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => void useExistingGoogleDriveFolder()}
                disabled={testing === 'drive-folder'}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                {testing === 'drive-folder' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                Usar pasta existente
              </button>
              <button
                type="button"
                onClick={() => void setupGoogleDriveFolders()}
                disabled={testing === 'drive-setup'}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                {testing === 'drive-setup' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Building2 className="h-3.5 w-3.5" />}
                Criar estrutura padrão
              </button>
              <button
                type="button"
                onClick={() =>
                  void runTest(`/api/clientes/${clientId}/integracoes/google-drive/test`, 'drive', {
                    google_drive_folder_id: integrations.google_drive_folder_id || '',
                  })
                }
                disabled={testing === 'drive'}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                {testing === 'drive' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Testar Drive
              </button>
              <button
                type="button"
                onClick={() => void disconnectGoogleDrive()}
                disabled={testing === 'drive-disconnect'}
                className="inline-flex items-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
              >
                {testing === 'drive-disconnect' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                Desconectar
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Instagram / Meta</h3>
                <p className="mt-1 text-xs text-slate-500">Integração profissional por cliente com modo manual de teste e OAuth.</p>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-700">
                {instagramStatus}
              </span>
            </div>
            <div className={`mt-3 rounded-xl border p-4 text-xs ${instagramConnected ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
              <p className="font-bold">{instagramConnected ? 'Instagram conectado' : 'Instagram não conectado'}</p>
              <p className="mt-1 leading-relaxed">
                Conta: {String(integrations.instagram_username || instagramManual.instagram_username || '@não informado')} | ID: {String(integrations.instagram_user_id || instagramManual.instagram_user_id || 'não informado')}
              </p>
              <p className="mt-1 leading-relaxed">
                Modo: {instagramMode} | Token: {instagramMaskedToken || 'não cadastrado'}
              </p>
              {integrations.instagram_connected_at && <p className="mt-1">Última conexão: {new Date(String(integrations.instagram_connected_at)).toLocaleString('pt-BR')}</p>}
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3">
              <Field label="Instagram username" value={String(instagramManual.instagram_username || '')} onChange={(value) => setInstagramManual((current) => ({ ...current, instagram_username: value }))} />
              <Field label="Instagram user ID" value={String(instagramManual.instagram_user_id || '')} onChange={(value) => setInstagramManual((current) => ({ ...current, instagram_user_id: value }))} />
              <Field label="Instagram business ID" value={String(instagramManual.instagram_business_id || '')} onChange={(value) => setInstagramManual((current) => ({ ...current, instagram_business_id: value }))} />
              <Field label="Access token manual de teste" value={String(instagramManual.instagram_access_token || '')} onChange={(value) => setInstagramManual((current) => ({ ...current, instagram_access_token: value }))} secret />
              <Field label="Facebook page ID" value={String(integrations.facebook_page_id || '')} onChange={(value) => setIntegrations((current) => ({ ...current, facebook_page_id: value }))} />
              <Field label="Graph API version" value={String(integrations.graph_api_version || '')} onChange={(value) => setIntegrations((current) => ({ ...current, graph_api_version: value }))} />
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Modo de operacao</span>
                <select
                  value={String(integrations.modo_operacao || 'SIMULADOR')}
                  onChange={(e) => void saveIntegrationMode(e.target.value as NonNullable<ClienteIntegracao['modo_operacao']>)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 outline-none focus:border-brand-primary disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                  disabled={saving}
                >
                  <option value="SIMULADOR">SIMULADOR</option>
                  <option value="REAL">REAL</option>
                </select>
              </label>
            </div>
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
              <p className="font-bold text-slate-800">Fluxos disponíveis</p>
              <p className="mt-1">1. Token manual de teste para validar a conta `farmbyfernandacarlota`.</p>
              <p className="mt-1">2. Instagram Login como fluxo prioritário.</p>
              <p className="mt-1">3. Facebook Login + Página como fallback.</p>
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => void saveIntegrations()} disabled={saving} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Salvar integrações
              </button>
              <button type="button" onClick={() => connectInstagram('instagram')} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                <Plug className="h-3.5 w-3.5" />
                Conectar Instagram
              </button>
              <button type="button" onClick={() => connectInstagram('meta')} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                <Plug className="h-3.5 w-3.5" />
                Conectar via Meta
              </button>
              <button type="button" onClick={() => void saveInstagramManualToken()} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-brand-secondary px-4 py-2 text-xs font-bold text-brand-darker shadow-sm hover:bg-brand-primary disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar token manual
              </button>
              <button type="button" onClick={() => void testInstagramIntegration('instagram')} disabled={testing === 'instagram-instagram'} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                {testing === 'instagram-instagram' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Testar Instagram
              </button>
              <button type="button" onClick={() => void testInstagramIntegration('meta')} disabled={testing === 'instagram-meta'} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                {testing === 'instagram-meta' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Testar Meta
              </button>
              <button type="button" onClick={() => void disconnectInstagramIntegration('instagram')} disabled={testing === 'instagram-disconnect-instagram'} className="inline-flex items-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60">
                {testing === 'instagram-disconnect-instagram' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                Desconectar
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'ia' && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-800">IA do cliente</h3>
              <p className="mt-1 text-xs text-slate-500">Provider, modelo, prompt e chave do cliente.</p>
            </div>
            <button type="button" onClick={() => void runTest(`/api/clientes/${clientId}/ia/testar`, 'ia')} disabled={testing === 'ia'} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
              {testing === 'ia' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Testar IA
            </button>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
            {iaItems
              .filter((item) => item.chave !== 'PROVEDOR_IA' && item.chave !== 'MODELO_IA')
              .map((item) => (
                <Field
                  key={item.chave}
                  label={item.chave}
                  value={showSecrets && item.sensivel ? String(item.valor_encrypted ?? item.valor ?? '') : valueFor(item, clientDrafts)}
                  onChange={(value) => setClientDrafts((current) => ({ ...current, [item.chave]: value }))}
                  secret={item.sensivel}
                  kind={item.tipo === 'BOOLEAN' ? 'text' : item.tipo === 'NUMBER' ? 'number' : item.tipo === 'JSON' ? 'textarea' : 'text'}
                />
              ))}
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">PROVEDOR_IA</span>
              <select
                value={providerValue}
                onChange={(event) => {
                  const nextProvider = event.target.value;
                  setClientDrafts((current) => ({ ...current, PROVEDOR_IA: nextProvider, MODELO_IA: getProviderModels(nextProvider)[0] || '' }));
                }}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 outline-none focus:border-brand-primary"
              >
                {AI_PROVIDER_OPTIONS.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">MODELO_IA</span>
              <select
                value={selectedModel}
                onChange={(event) => setClientDrafts((current) => ({ ...current, MODELO_IA: event.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 outline-none focus:border-brand-primary"
              >
                <option value="">Selecione um modelo</option>
                {providerModels.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </label>
            <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
              <p className="font-bold text-slate-800">Observação</p>
              <p className="mt-1 leading-relaxed">
                O provedor e o modelo ficam salvos por cliente. Se precisar de um modelo fora da lista, ajuste o valor manualmente depois
                de selecionar o provedor desejado.
              </p>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button type="button" onClick={() => void saveItems(`/api/clientes/${clientId}/ia/configuracao`, 'IA', iaItems)} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-brand-secondary px-4 py-2 text-xs font-bold text-brand-darker shadow-sm hover:bg-brand-primary disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar IA
            </button>
          </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800">Catálogo de IA</h3>
            <p className="mt-1 text-xs text-slate-500">Provedores e exemplos de modelos disponíveis para escolha.</p>
            <div className="mt-4 space-y-3">
              {AI_PROVIDER_OPTIONS.map((option) => (
                <div key={option.key} className={`rounded-xl border p-4 ${providerValue === option.key ? 'border-brand-secondary bg-brand-light/40' : 'border-slate-200 bg-slate-50'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-800">{option.label}</p>
                      <p className="mt-1 text-xs text-slate-500">{option.description}</p>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600">{option.key}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {option.models.map((model) => (
                      <span key={model} className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-600">
                        {model}
                      </span>
                    ))}
                  </div>
                  <p className="mt-3 text-[11px] text-slate-500">Chave recomendada: {option.apiKeyLabel}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'aprovacao' && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Regras de aprovacao</h3>
              <p className="mt-1 text-xs text-slate-500">Fluxo de aprovacao, notificacoes e limites do cliente.</p>
            </div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {approvalItems.length} parametro(s)
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
            {approvalItems.map((item) => (
              <Field
                key={item.chave}
                label={item.chave}
                value={showSecrets && item.sensivel ? String(item.valor_encrypted ?? item.valor ?? '') : valueFor(item, clientDrafts)}
                onChange={(value) => setClientDrafts((current) => ({ ...current, [item.chave]: value }))}
                kind={item.tipo === 'BOOLEAN' ? 'text' : item.tipo === 'NUMBER' ? 'number' : item.tipo === 'JSON' ? 'textarea' : 'text'}
              />
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <button type="button" onClick={() => void saveItems(`/api/clientes/${clientId}/regras-aprovacao`, 'APROVACAO', approvalItems)} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-brand-secondary px-4 py-2 text-xs font-bold text-brand-darker shadow-sm hover:bg-brand-primary disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar aprovacao
            </button>
          </div>
        </div>
      )}

      {tab === 'auditoria' && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800">Auditoria do sistema</h3>
            <div className="mt-3 max-h-[420px] space-y-2 overflow-auto">{systemAudits.length === 0 ? <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">Nenhum registro.</div> : systemAudits.map((item) => <AuditCard key={item.id} item={item} />)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800">Auditoria do cliente</h3>
            <div className="mt-3 max-h-[420px] space-y-2 overflow-auto">{audits.length === 0 ? <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">Nenhum registro.</div> : audits.map((item) => <AuditCard key={item.id} item={item} />)}</div>
          </div>
        </div>
      )}
    </div>
  );
}



