interface PublicRuntimeConfig {
  appUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  platformName: string;
  logos: {
    squareText: string;
    squareMark: string;
    wideText: string;
  };
}

let runtimeConfigPromise: Promise<PublicRuntimeConfig> | null = null;

export async function getPublicRuntimeConfig(): Promise<PublicRuntimeConfig> {
  if (!runtimeConfigPromise) {
    runtimeConfigPromise = fetch('/api/public-config').then(async (res) => {
      const raw = await res.text();
      let data: { config?: PublicRuntimeConfig; error?: string } = {};

      try {
        data = raw ? (JSON.parse(raw) as typeof data) : {};
      } catch {
        if (!res.ok) {
          throw new Error(raw || 'Falha ao carregar a configuração pública do backend.');
        }

        throw new Error('Resposta inválida ao carregar a configuração pública do backend.');
      }

      if (!res.ok || !data.config) {
        throw new Error(data.error || 'Falha ao carregar a configuração pública do backend.');
      }

      return data.config as PublicRuntimeConfig;
    });
  }

  return runtimeConfigPromise;
}
