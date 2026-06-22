interface PublicRuntimeConfig {
  appUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
}

let runtimeConfigPromise: Promise<PublicRuntimeConfig> | null = null;

export async function getPublicRuntimeConfig(): Promise<PublicRuntimeConfig> {
  if (!runtimeConfigPromise) {
    runtimeConfigPromise = fetch('/api/public-config')
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || !data.config) {
          throw new Error(data.error || 'Falha ao carregar a configuração pública do backend.');
        }
        return data.config as PublicRuntimeConfig;
      });
  }

  return runtimeConfigPromise;
}
