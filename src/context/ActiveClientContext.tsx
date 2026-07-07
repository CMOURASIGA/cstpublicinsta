import React, { createContext, useContext } from 'react';
import type { Cliente } from '../types';

type ActiveClientContextValue = {
  activeClient: Cliente | null;
  availableClients: Cliente[];
  setActiveClient: (client: Cliente | null) => void;
};

const ActiveClientContext = createContext<ActiveClientContextValue | null>(null);

export function ActiveClientProvider({
  value,
  children,
}: {
  value: ActiveClientContextValue;
  children: React.ReactNode;
}) {
  return <ActiveClientContext.Provider value={value}>{children}</ActiveClientContext.Provider>;
}

export function useActiveClient() {
  const context = useContext(ActiveClientContext);
  if (!context) {
    throw new Error('useActiveClient must be used within ActiveClientProvider.');
  }
  return context;
}
