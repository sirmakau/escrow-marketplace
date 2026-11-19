import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { api, refreshProfile } from '../api';
import { activeSession, useAppState } from '../store';
import type { Order, Paged, User } from '../types';

interface EscrowData {
  orders: Order[];
  user: User | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
}

const EscrowContext = createContext<EscrowData | null>(null);

export function EscrowProvider({ children }: { children: ReactNode }) {
  const { sessions, activePhone } = useAppState();
  const session = activeSession(sessions, activePhone);
  const [orders, setOrders] = useState<Order[]>([]);
  const [user, setUser] = useState<User | null>(session?.user ?? null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    setUser(session?.user ?? null);
  }, [session?.user]);

  const refresh = useCallback(async () => {
    if (!activeSession()) {
      setOrders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [profile, result] = await Promise.all([
        refreshProfile(),
        api<Paged<Order>>('/api/orders?limit=50', { quiet: true }),
      ]);
      if (!alive.current) return;
      if (profile) setUser(profile);
      setOrders(Array.isArray(result?.items) ? result.items : []);
      setLastUpdated(new Date());
    } catch (err) {
      if (!alive.current) return;
      setError((err as Error).message);
    } finally {
      if (alive.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [activePhone, refresh]);

  const value = useMemo(
    () => ({ orders, user, loading, error, lastUpdated, refresh }),
    [orders, user, loading, error, lastUpdated, refresh],
  );

  return <EscrowContext.Provider value={value}>{children}</EscrowContext.Provider>;
}

export function useEscrows(): EscrowData {
  const value = useContext(EscrowContext);
  if (!value) throw new Error('useEscrows must be used inside EscrowProvider');
  return value;
}
