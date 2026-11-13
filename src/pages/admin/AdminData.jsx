import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { adminApi } from '../../services/db.js';
import { buildModel } from '../../lib/adminModel.js';
import { useAuth } from '../../context/AuthContext.jsx';

const Ctx = createContext(null);
export const useAdminData = () => useContext(Ctx);

// Bitta joyda yuklanadi va barcha bo'limlar uchun umumiy: Supabase Realtime + (kerak bo'lsa) polling.
export function AdminDataProvider({ children }) {
  const { user } = useAuth();
  const [state, setState] = useState({ loading: true, error: null, raw: null });
  const [now, setNow] = useState(Date.now());
  const [live, setLive] = useState('connecting');
  const [updatedAt, setUpdatedAt] = useState(null);
  const timer = useRef(null);

  const load = useCallback(async (silent) => {
    if (!silent) setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const raw = await adminApi.loadAll();
      setState({ loading: false, error: null, raw });
      setUpdatedAt(Date.now());
    } catch (error) {
      console.error(error);
      setState((s) => (silent && s.raw ? s : { loading: false, error, raw: null }));
    }
  }, []);

  useEffect(() => { load(false); }, [load, user.id]);

  const schedule = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => load(true), 1500);
  }, [load]);

  useEffect(() => {
    const off = adminApi.subscribe(({ table, payload }) => {
      if (table === 'profiles' && payload?.eventType && (payload.new?.id || payload.old?.id)) {
        // Profil o'zgarishi (heartbeat) darhol joyiga qo'yiladi — qayta yuklash shart emas
        setState((s) => {
          if (!s.raw) return s;
          let profiles = s.raw.profiles;
          if (payload.eventType === 'DELETE') profiles = profiles.filter((p) => p.id !== payload.old.id);
          else if (profiles.some((p) => p.id === payload.new.id)) profiles = profiles.map((p) => (p.id === payload.new.id ? { ...p, ...payload.new } : p));
          else profiles = [...profiles, payload.new];
          return { ...s, raw: { ...s.raw, profiles } };
        });
        setUpdatedAt(Date.now());
      } else schedule();
    }, setLive);
    return () => { off(); clearTimeout(timer.current); };
  }, [schedule]);

  // Realtime ulanmasa — har 30 soniyada yangilab turadi
  useEffect(() => {
    if (live === 'SUBSCRIBED') return undefined;
    const id = setInterval(() => load(true), 30000);
    return () => clearInterval(id);
  }, [live, load]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);

  const model = useMemo(() => (state.raw ? buildModel(state.raw, now) : null), [state.raw, now]);
  const value = useMemo(() => ({
    model, raw: state.raw, loading: state.loading, error: state.error, now, live, updatedAt,
    realtime: live === 'SUBSCRIBED', reload: () => load(false), refresh: () => load(true),
  }), [model, state, now, live, updatedAt, load]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
