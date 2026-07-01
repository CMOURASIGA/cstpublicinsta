import React, { useState } from 'react';
import { AlertCircle, Loader2, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { getSupabaseClient } from '../lib/supabase';
import { LOGOS, PLATFORM_NAME, PLATFORM_TAGLINE } from '../lib/branding';

interface LoginScreenProps {
  onLoggedIn: () => Promise<void> | void;
}

export default function LoginScreen({ onLoggedIn }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const supabase = await getSupabaseClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        throw signInError;
      }

      await onLoggedIn();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Falha ao autenticar no Supabase.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen px-4 py-8 text-slate-100">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="overflow-hidden rounded-[32px] border border-slate-200/70 bg-white/80 p-8 shadow-[0_24px_80px_rgba(0,24,54,0.12)] backdrop-blur">
          <div className="mb-8 flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
              <img src={LOGOS.squareText} alt={`${PLATFORM_NAME} logo`} className="h-full w-full object-contain" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-brand-secondary">{PLATFORM_NAME}</p>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">Portal multi-cliente</h1>
              <p className="mt-1 text-sm text-slate-500">{PLATFORM_TAGLINE}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <img src={LOGOS.squareMark} alt="Logo sem texto" className="h-12 w-12 object-contain" />
              <p className="mt-3 text-sm font-semibold text-slate-900">Admin</p>
              <p className="text-xs leading-relaxed text-slate-500">Acessa tudo, inclusive clientes, integrações e configurações.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <img src={LOGOS.squareMark} alt="Logo sem texto" className="h-12 w-12 object-contain" />
              <p className="mt-3 text-sm font-semibold text-slate-900">Aprovador</p>
              <p className="text-xs leading-relaxed text-slate-500">Aprova, rejeita, agenda e publica, sem mexer em configuração.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <img src={LOGOS.squareMark} alt="Logo sem texto" className="h-12 w-12 object-contain" />
              <p className="mt-3 text-sm font-semibold text-slate-900">Criador</p>
              <p className="text-xs leading-relaxed text-slate-500">Cria e edita rascunhos, sem aprovar e sem configuração.</p>
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">Regra operacional</p>
            <p className="mt-2 leading-relaxed">
              O usuário precisa existir na base e ter vínculo com ao menos um cliente no Supabase. O contexto ativo do cliente é
              carregado depois do login e todas as chamadas da aplicação passam a usar esse cliente.
            </p>
          </div>
        </div>

        <div className="rounded-[32px] border border-slate-200/70 bg-[linear-gradient(180deg,rgba(0,24,54,0.98),rgba(0,38,84,0.96))] p-8 shadow-[0_24px_80px_rgba(0,24,54,0.18)] backdrop-blur">
          <div className="flex items-center gap-3">
            <img src={LOGOS.wideText} alt="Logo horizontal" className="h-12 w-auto object-contain" />
          </div>
          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/80">Sessão</p>
          <h2 className="mt-2 text-2xl font-bold text-white">Entrar com e-mail e senha</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            O login usa Supabase Auth. Depois da autenticação, a aplicação resolve o cliente ativo e aplica as permissões do
            perfil operacional.
          </p>

          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                E-mail
              </label>
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <Mail className="h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="voce@empresa.com"
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
              />
            </div>
            </div>

            <div>
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                Senha
              </label>
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <LockKeyhole className="h-4 w-4 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Digite sua senha"
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 px-5 py-3.5 text-sm font-bold text-slate-950 transition-colors hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Entrar no sistema
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
