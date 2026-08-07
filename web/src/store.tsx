import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from './api';
import type { EventSummary, WalletStatus } from './types';

export type ToastType = 'success' | 'error' | 'info';
export interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface AppState {
  wallet: WalletStatus | null;
  events: EventSummary[] | null;
  eventsLoading: boolean;
  connected: boolean;
  refresh: () => Promise<void>;
  refreshWallet: () => Promise<void>;
  toasts: Toast[];
  pushToast: (message: string, type?: ToastType) => void;
  dismissToast: (id: number) => void;
  // attendee session (this browser)
  myAttendeeId: (eventId: string) => string | null;
  setMyAttendeeId: (eventId: string, attendeeId: string) => void;
  myCertificates: () => { eventId: string; certificateId: string }[];
  setMyCertificate: (eventId: string, certificateId: string) => void;
  clearAttendeeSession: () => void;
}

const AppContext = createContext<AppState | null>(null);

const LS_PREFIX = 'proofpresence:';

export function AppProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<WalletStatus | null>(null);
  const [events, setEvents] = useState<EventSummary[] | null>(null);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const refreshWallet = useCallback(async () => {
    try {
      const status = await api.status();
      setWallet(status);
    } catch {
      // keep previous wallet state; the UI shows connection issues separately
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const ledger = await api.listEvents();
      setEvents(ledger.events);
    } catch (err) {
      // ignore transient poll failures
    } finally {
      setEventsLoading(false);
    }
  }, []);

  // initial load + polling for live data
  useEffect(() => {
    refreshWallet();
    refresh();
    const interval = setInterval(() => {
      refresh();
      refreshWallet();
    }, 8000);
    return () => clearInterval(interval);
  }, [refresh, refreshWallet]);

  const pushToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev.slice(-3), { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 6000);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const myAttendeeId = useCallback((eventId: string) => localStorage.getItem(`${LS_PREFIX}attendee:${eventId}`), []);

  const setMyAttendeeId = useCallback((eventId: string, attendeeId: string) => {
    localStorage.setItem(`${LS_PREFIX}attendee:${eventId}`, attendeeId);
  }, []);

  const myCertificates = useCallback(() => {
    const out: { eventId: string; certificateId: string }[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(`${LS_PREFIX}cert:`)) {
        const eventId = key.slice(`${LS_PREFIX}cert:`.length);
        const certificateId = localStorage.getItem(key);
        if (certificateId) out.push({ eventId, certificateId });
      }
    }
    return out;
  }, []);

  const setMyCertificate = useCallback((eventId: string, certificateId: string) => {
    localStorage.setItem(`${LS_PREFIX}cert:${eventId}`, certificateId);
  }, []);

  const clearAttendeeSession = useCallback(() => {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith(LS_PREFIX)) localStorage.removeItem(key);
    }
  }, []);

  const value = useMemo<AppState>(
    () => ({
      wallet,
      events,
      eventsLoading,
      connected: Boolean(wallet),
      refresh,
      refreshWallet,
      toasts,
      pushToast,
      dismissToast,
      myAttendeeId,
      setMyAttendeeId,
      myCertificates,
      setMyCertificate,
      clearAttendeeSession,
    }),
    [wallet, events, eventsLoading, refresh, refreshWallet, toasts, pushToast, dismissToast, myAttendeeId, setMyAttendeeId, myCertificates, setMyCertificate, clearAttendeeSession],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
