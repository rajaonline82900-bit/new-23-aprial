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
    } catch (error) {
      // ONLY logout when server explicitly says token invalid (401).
      // Network errors / timeouts must NOT auto-logout the user.
      if (error.response && error.response.status === 401) {
        localStorage.removeItem('matka11_token');
        setUser(false);
      } else if (!stored) {
        // No saved token AND request failed -> user is genuinely not logged in
        setUser(false);
      }
      // else: keep previous user state (avoid flicker / unwanted logout on flaky network)
    } finally {
      setLoading(false);
    }
  }, []);

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
