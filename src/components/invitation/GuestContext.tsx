'use client';

import { createContext, useContext } from 'react';

export interface GuestState {
  token: string | null;
  name: string | null;
  status: 'none' | 'loading' | 'ok' | 'not_found' | 'error';
}

export const GuestContext = createContext<GuestState>({ token: null, name: null, status: 'none' });
export const useGuest = () => useContext(GuestContext);
