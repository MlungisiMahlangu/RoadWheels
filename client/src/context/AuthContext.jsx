import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api, AUTH_EVENT, captureSession, isSessionCurrent, notifyAuthChange } from '../services/api';

const AuthContext = createContext();
const validUser = (user) => user && typeof (user._id || user.id) === 'string'
  && typeof user.name === 'string' && typeof user.email === 'string'
  && (user.role === 'admin' || user.role === 'user') && !user.isSuspended;

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(() => {
    const snapshot = captureSession();
    return { snapshot, user: null, status: snapshot.token ? 'validating' : 'anonymous', error: null };
  });
  const sessionRef = useRef(session);
  const validation = useRef({ id: 0, controller: null });
  const mounted = useRef(false);

  const commit = useCallback((next) => {
    sessionRef.current = next;
    setSession(next);
  }, []);

  const cancelValidation = useCallback(() => {
    validation.current.id += 1;
    validation.current.controller?.abort();
  }, []);

  const retrySession = useCallback(async () => {
    cancelValidation();
    const id = validation.current.id;
    const snapshot = captureSession();
    if (!snapshot.token) {
      commit({ snapshot, user: null, status: 'anonymous', error: null });
      return;
    }
    const controller = new AbortController();
    validation.current.controller = controller;
    commit({ snapshot, user: null, status: 'validating', error: null });
    const current = () => mounted.current && id === validation.current.id && isSessionCurrent(snapshot);
    try {
      const user = await api.getMe({ signal: controller.signal });
      if (!current()) return;
      if (!validUser(user)) throw new Error('We couldn’t verify your account details. Please retry your session.');
      // Cached user data is never trusted to authorize or render protected content.
      localStorage.setItem('user', JSON.stringify(user));
      commit({ snapshot, user, status: 'ready', error: null });
    } catch (error) {
      if (!current()) return;
      // Offline, timeout and service errors retain the token for an explicit retry.
      commit({ snapshot, user: null, status: 'error', error: error.message });
    }
  }, [cancelValidation, commit]);

  useEffect(() => {
    mounted.current = true;
    const synchronize = (event) => {
      if (event.type === 'storage' && event.key !== null && event.key !== 'token' && event.key !== 'user') return;
      if (!isSessionCurrent(sessionRef.current.snapshot)) void retrySession();
    };
    window.addEventListener('storage', synchronize);
    window.addEventListener(AUTH_EVENT, synchronize);
    void retrySession();
    return () => {
      mounted.current = false;
      cancelValidation();
      window.removeEventListener('storage', synchronize);
      window.removeEventListener(AUTH_EVENT, synchronize);
    };
  }, [cancelValidation, retrySession]);

  const login = (user, token, expected = session.snapshot) => {
    if (!mounted.current || !isSessionCurrent(expected)) return false;
    if (!validUser(user) || typeof token !== 'string' || !token.trim()) {
      throw new Error('RoadWheels returned incomplete session details. Please try again.');
    }
    cancelValidation();
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    const snapshot = captureSession();
    commit({ snapshot, user, status: 'ready', error: null });
    notifyAuthChange();
    return true;
  };

  const logout = (expected = session.snapshot) => {
    if (!isSessionCurrent(expected)) return;
    cancelValidation();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    commit({ snapshot: captureSession(), user: null, status: 'anonymous', error: null });
    notifyAuthChange();
  };

  const current = isSessionCurrent(session.snapshot);
  const user = current && session.status === 'ready' ? session.user : null;
  return (
    <AuthContext.Provider value={{
      user, login, logout, retrySession,
      sessionSnapshot: session.snapshot,
      sessionStatus: current ? session.status : 'validating',
      sessionError: current ? session.error : null,
      sessionKey: user ? `${user._id || user.id}:${session.snapshot.generation}` : null,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
