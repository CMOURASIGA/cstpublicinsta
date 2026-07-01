import type { Cliente } from '../types';

const ACTIVE_CLIENT_KEY = 'instaflow.activeClientId';
const ACTIVE_CLIENT_DATA_KEY = 'instaflow.activeClient';

export function getStoredActiveClientId() {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(ACTIVE_CLIENT_KEY) || '';
}

export function setStoredActiveClient(client: Cliente | null) {
  if (typeof window === 'undefined') return;
  if (!client) {
    window.localStorage.removeItem(ACTIVE_CLIENT_KEY);
    window.localStorage.removeItem(ACTIVE_CLIENT_DATA_KEY);
    return;
  }

  window.localStorage.setItem(ACTIVE_CLIENT_KEY, client.id);
  window.localStorage.setItem(ACTIVE_CLIENT_DATA_KEY, JSON.stringify(client));
}

export function getStoredActiveClient() {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(ACTIVE_CLIENT_DATA_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Cliente;
  } catch {
    return null;
  }
}
