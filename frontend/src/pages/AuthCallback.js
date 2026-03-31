import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const AuthCallback = () => {
  const hasProcessed = useRef(false);
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processSession = async () => {
      const hash = window.location.hash;
      const sessionId = hash?.split('session_id=')[1]?.split('&')[0];

      if (!sessionId) {
        navigate('/signup');
        return;
      }

      try {
        await axios.post(
          `${API_URL}/api/auth/google/session`,
          { session_id: sessionId },
          { withCredentials: true }
        );
        toast.success('Google लॉगिन सफल!');
        await refreshUser();
        navigate('/dashboard', { replace: true });
      } catch (e) {
        toast.error('Google लॉगिन विफल');
        navigate('/signup', { replace: true });
      }
    };

    processSession();
  }, [navigate, refreshUser]);

  return (
    <div className="min-h-screen bg-[#0A0A0C] flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-white">Google से लॉगिन हो रहा है...</p>
      </div>
    </div>
  );
};

export default AuthCallback;
