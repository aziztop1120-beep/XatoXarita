import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { auth, db, DEFAULT_PROFILE } from '../services/db.js';
import { useLang } from '../i18n/LangContext.jsx';
import { tracking } from '../services/tracking.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { setLang } = useLang();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let alive = true;
    auth.getUser().then((u) => { if (alive) { setUser(u); setChecked(true); } });
    const off = auth.onChange((u) => { if (alive) setUser((prev) => (prev?.id === u?.id ? prev : u)); });
    return () => { alive = false; off(); };
  }, []);

  useEffect(() => {
    setProfile(null);
    if (!user) return undefined;
    let alive = true;
    db.getProfile(user)
      .then((p) => { if (alive) { setProfile(p); setLang(p.language); } })
      .catch(() => { if (alive) setProfile({ ...DEFAULT_PROFILE }); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // O‘quvchi saytda ekanini ustozga bildirish (kirish + har 30 soniyada heartbeat). Ustoz kuzatilmaydi.
  useEffect(() => {
    if (!user || !profile || profile.role === 'teacher') return undefined;
    tracking.startPresence(user);
    return () => tracking.stopPresence();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, profile?.role, !!profile]);

  const updateProfile = useCallback(async (patch) => {
    const next = await db.updateProfile(user, patch);
    setProfile(next);
    if (patch.language) setLang(patch.language);
    return next;
  }, [user, setLang]);

  const loading = !checked || (!!user && !profile);

  return (
    <AuthContext.Provider value={{ user, profile, loading, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
