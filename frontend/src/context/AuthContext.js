import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Configure axios defaults
axios.defaults.withCredentials = true;

// Add token from localStorage to every request as fallback
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('matka11_token');
  if (token && !config.headers['Authorization']) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    const stored = localStorage.getItem('matka11_token');
    const cached = localStorage.getItem('matka11_user_cache');

    // If we have cached user data, show it IMMEDIATELY so user never sees a flash of logged-out state
    if (cached) {
      try { setUser(JSON.parse(cached)); } catch (_) {}
    }

    try {
      const headers = stored ? { Authorization: `Bearer ${stored}` } : {};
      const { data } = await axios.get(`${API_URL}/api/auth/me`, {
        withCredentials: true,
        timeout: 10000,
        headers,
      });
      setUser(data);
      try { localStorage.setItem('matka11_user_cache', JSON.stringify(data)); } catch (_) {}
    } catch (error) {
      // NEVER auto-logout. User can only log out manually via the logout button.
      // - Network errors: keep cached user.
      // - 401 (token expired/invalid): keep cached user so they don't lose their session.
      //   They will be prompted to re-login only when they explicitly take an action that fails.
      if (cached) {
        try { setUser(JSON.parse(cached)); } catch (_) {}
      } else if (stored) {
        // Have token but no cache yet — keep a placeholder so ProtectedRoute doesn't kick them out
        setUser({ _offline: true });
      } else {
        // Truly not logged in (no token, no cache)
        setUser(false);
      }
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (window.location.hash?.includes('session_id=')) {
      setLoading(false);
      return;
    }
    checkAuth();
  }, [checkAuth]);

  const logout = async () => {
    try {
      await axios.post(`${API_URL}/api/auth/logout`, {}, { withCredentials: true });
    } catch (error) {
      console.error('Logout error:', error);
    }
    localStorage.removeItem('matka11_token');
    localStorage.removeItem('matka11_user_cache');
    setUser(false);
  };

  const refreshUser = async () => {
    await checkAuth();
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
