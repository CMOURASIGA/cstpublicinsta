import { getSupabaseClient } from './supabase';
import { getStoredActiveClientId } from './client-store';

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  const supabase = await getSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }

  const clientId = getStoredActiveClientId();
  if (clientId) {
    headers.set('x-client-id', clientId);
  }

  return fetch(input, {
    ...init,
    headers,
  });
}
