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
    try {
      const headers = stored ? { Authorization: `Bearer ${stored}` } : {};
      const { data } = await axios.get(`${API_URL}/api/auth/me`, {
        withCredentials: true,
        timeout: 10000,
        headers,
      });
      setUser(data);
      // Cache user info so we can rehydrate offline / on flaky network
      try { localStorage.setItem('matka11_user_cache', JSON.stringify(data)); } catch (_) {}
    } catch (error) {
      // ONLY logout when server explicitly says token invalid (401).
      // Network errors / timeouts must NOT auto-logout the user.
      if (error.response && error.response.status === 401) {
        localStorage.removeItem('matka11_token');
        localStorage.removeItem('matka11_user_cache');
        setUser(false);
      } else if (stored) {
        // Token exists but server unreachable — rehydrate from last known good cache
        try {
          const cached = localStorage.getItem('matka11_user_cache');
          if (cached) {
            setUser(JSON.parse(cached));
          } else if (!user) {
            // No cache and no current user — keep loading-ish state but don't kick to /signup
            setUser({ _offline: true });
          }
        } catch (_) {
          if (!user) setUser({ _offline: true });
        }
      } else {
        // No saved token AND request failed -> user is genuinely not logged in
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
