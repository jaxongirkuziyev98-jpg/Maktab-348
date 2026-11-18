import { useCallback, useEffect, useState } from 'react';
import { AdminCabinet } from './components/AdminCabinet.tsx';
import { LandingAndAuth } from './components/LandingAndAuth.tsx';
import { StudentCabinet } from './components/StudentCabinet.tsx';
import { StudentPaymentGate } from './components/StudentPaymentGate.tsx';
import { TeacherCabinet } from './components/TeacherCabinet.tsx';
import { TeacherFaceVerificationGate } from './components/TeacherFaceVerificationGate.tsx';
import {
  apiFetch,
  clearStoredSession,
  getStoredLang,
  getStoredTheme,
  getStoredToken,
  getStoredUser,
  setStoredLang,
  setStoredSession,
  setStoredTheme,
  updateStoredUser,
} from './lib/api.ts';
import type { Lang, ThemeMode, UserProfile } from './types/lms.ts';

function isStudentSubscriptionActive(user: UserProfile): boolean {
  if (user.role !== 'student') return true;
  if (!user.subscriptionExpiresAt) return false;
  return new Date(user.subscriptionExpiresAt).getTime() > Date.now();
}

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(() => getStoredUser());
  const [checkingSession, setCheckingSession] = useState(() => Boolean(getStoredToken()));
  const [lang, setLang] = useState<Lang>(() => getStoredLang());
  const [theme, setTheme] = useState<ThemeMode>(() => getStoredTheme());

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    setStoredTheme(theme);
  }, [theme]);

  useEffect(() => {
    setStoredLang(lang);
  }, [lang]);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setCheckingSession(false);
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const paymentOrderId = params.get('payment_order');

    apiFetch<{ user: UserProfile }>('/api/auth/me')
      .then(async (res) => {
        let resolvedUser = res.user;
        if (paymentOrderId) {
          try {
            const ord = await apiFetch<{ order: { status: string }; user: UserProfile }>(
              `/api/payments/orders/${encodeURIComponent(paymentOrderId)}`
            );
            if (ord.order?.status === 'paid' && ord.user) {
              resolvedUser = ord.user;
            }
          } catch {
            // ignore if order doesn't belong to user or not paid yet
          } finally {
            params.delete('payment_order');
            const qs = params.toString();
            const cleanUrl = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`;
            window.history.replaceState({}, '', cleanUrl);
          }
        }
        setUser(resolvedUser);
        updateStoredUser(resolvedUser);
      })
      .catch(() => {
        clearStoredSession();
        setUser(null);
      })
      .finally(() => setCheckingSession(false));
  }, []);

  const handleToggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const handleAuthenticated = useCallback((token: string, nextUser: UserProfile) => {
    setStoredSession(token, nextUser);
    setUser(nextUser);
  }, []);

  const handleUserUpdated = useCallback((nextUser: UserProfile) => {
    updateStoredUser(nextUser);
    setUser(nextUser);
  }, []);

  const handleLogout = useCallback(async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    clearStoredSession();
    setUser(null);
  }, []);

  if (checkingSession && !user) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 flex items-center justify-center text-sm">
        348-MAKTAB yuklanmoqda...
      </div>
    );
  }

  if (!user) {
    return (
      <LandingAndAuth
        lang={lang}
        onLangChange={setLang}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onAuthenticated={handleAuthenticated}
      />
    );
  }

  if (user.role === 'teacher' && !user.faceVerified) {
    return (
      <TeacherFaceVerificationGate
        user={user}
        lang={lang}
        onLangChange={setLang}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onVerified={handleUserUpdated}
        onLogout={handleLogout}
      />
    );
  }

  if (user.role === 'student' && !isStudentSubscriptionActive(user)) {
    return (
      <StudentPaymentGate
        user={user}
        lang={lang}
        onLangChange={setLang}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onActivated={handleUserUpdated}
        onLogout={handleLogout}
      />
    );
  }

  if (user.role === 'student') {
    return (
      <StudentCabinet
        user={user}
        lang={lang}
        onLangChange={setLang}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onUserUpdated={handleUserUpdated}
        onPaymentRequired={() =>
          handleUserUpdated({ ...user, subscriptionExpiresAt: null })
        }
        onLogout={handleLogout}
      />
    );
  }

  if (user.role === 'teacher') {
    return (
      <TeacherCabinet
        user={user}
        lang={lang}
        onLangChange={setLang}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <AdminCabinet
      user={user}
      lang={lang}
      onLangChange={setLang}
      theme={theme}
      onToggleTheme={handleToggleTheme}
      onLogout={handleLogout}
    />
  );
}
