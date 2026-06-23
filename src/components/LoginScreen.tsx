import React, { useState } from 'react';
import { AlertCircle, Loader2, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { getSupabaseClient } from '../lib/supabase';

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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#123b5a_0%,#0b1f33_55%,#08131f_100%)] px-4 py-10 text-slate-100">
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[28px] border border-white/10 bg-white/6 p-8 shadow-2xl shadow-black/20 backdrop-blur">
          <div className="mb-8 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-white p-1 shadow-lg shadow-black/20">
              <img src="/app-logo.jpg" alt="Logo do sistema" className="h-full w-full rounded-xl object-contain" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">InstaFlow</p>
              <h1 className="text-3xl font-bold tracking-tight text-white">Login Operacional</h1>
            </div>
          </div>

          <p className="max-w-xl text-sm leading-relaxed text-slate-300">
            Entre com e-mail e senha liberado. Depois do login, faça a operação desejada.
          </p>

          <div className="mt-8 rounded-2xl border border-cyan-200/10 bg-slate-950/25 p-5 text-sm text-slate-300">
            <p className="font-semibold text-white">Regras de acesso</p>
            <p className="mt-2 leading-relaxed">
              O usuário precisa existir na base de dados. Se a conta autenticar mas não estiver cadastrada como ativa
              na base operacional, o acesso será bloqueado. Entre em contato com o admin para uso.
            </p>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-slate-950/35 p-8 shadow-2xl shadow-black/20 backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-200/80">Sessão</p>
          <h2 className="mt-2 text-2xl font-bold text-white">Entrar com e-mail e senha</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            A sessão é persistida pelo Supabase Auth e o sistema passa a exigir autenticação logo na abertura.
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
