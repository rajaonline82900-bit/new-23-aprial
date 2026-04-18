import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Toaster } from "./components/ui/sonner";
import "./index.css";

// Branded Splash Screen
const SplashScreen = () => (
  <div className="min-h-screen bg-[#0A0A0C] flex flex-col items-center justify-center">
    <div className="flex items-center gap-2.5 mb-6 animate-pulse">
      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#D4AF37] via-[#FDE047] to-[#D4AF37] flex items-center justify-center font-black font-['Unbounded'] text-black text-2xl shadow-lg shadow-[#D4AF37]/30">
        M
      </div>
      <div className="flex items-baseline gap-0.5">
        <span className="text-3xl font-black font-['Unbounded'] tracking-tight bg-gradient-to-r from-[#D4AF37] via-[#FDE047] to-[#D4AF37] bg-clip-text text-transparent">
          MATKA
        </span>
        <span className="text-4xl font-black font-['Unbounded'] tracking-tighter text-white">
          11
        </span>
      </div>
    </div>
    <div className="flex gap-1.5">
      <div className="w-2 h-2 rounded-full bg-[#D4AF37] animate-bounce" style={{animationDelay: '0ms'}} />
      <div className="w-2 h-2 rounded-full bg-[#D4AF37] animate-bounce" style={{animationDelay: '150ms'}} />
      <div className="w-2 h-2 rounded-full bg-[#D4AF37] animate-bounce" style={{animationDelay: '300ms'}} />
    </div>
  </div>
);

// Pages
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import AdminLoginPage from "./pages/AdminLoginPage";
import DashboardPage from "./pages/DashboardPage";
import GamePage from "./pages/GamePage";
import WalletPage from "./pages/WalletPage";
import BetsPage from "./pages/BetsPage";
import ResultsPage from "./pages/ResultsPage";
import ProfilePage from "./pages/ProfilePage";
import AdminPage from "./pages/AdminPage";
import NotificationsPage from "./pages/NotificationsPage";
import JantriPage from "./pages/JantriPage";
import HowToPlayPage from "./pages/HowToPlayPage";
import ReferPage from "./pages/ReferPage";
import RateListPage from "./pages/RateListPage";
import HelpPage from "./pages/HelpPage";
import ChatPage from "./pages/ChatPage";
import LandingPage from "./pages/LandingPage";
import SignupPage from "./pages/SignupPage";
import AuthCallback from "./pages/AuthCallback";

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <SplashScreen />;
  }

  if (!user) {
    return <Navigate to="/signup" replace />;
  }

  return children;
};

// Public Route Component (redirect if logged in)
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <SplashScreen />;
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <SignupPage />
          </PublicRoute>
        }
      />
      <Route
        path="/signup"
        element={
          <PublicRoute>
            <SignupPage />
          </PublicRoute>
        }
      />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route
        path="/admin-login"
        element={<AdminLoginPage />}
      />

      {/* Protected Routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/game/:gameId"
        element={
          <ProtectedRoute>
            <GamePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/wallet"
        element={
          <ProtectedRoute>
            <WalletPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/bets"
        element={
          <ProtectedRoute>
            <BetsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/results"
        element={
          <ProtectedRoute>
            <ResultsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/notifications"
        element={
          <ProtectedRoute>
            <NotificationsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/jantri"
        element={
          <ProtectedRoute>
            <JantriPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/how-to-play"
        element={
          <ProtectedRoute>
            <HowToPlayPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/refer"
        element={
          <ProtectedRoute>
            <ReferPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/rate-list"
        element={
          <ProtectedRoute>
            <RateListPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/help"
        element={
          <ProtectedRoute>
            <HelpPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/chat"
        element={
          <ProtectedRoute>
            <ChatPage />
          </ProtectedRoute>
        }
      />

      {/* Default Route */}
      <Route path="/" element={<Navigate to="/signup" replace />} />
      <Route path="*" element={<Navigate to="/signup" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="App">
          <AppRoutes />
          <Toaster 
            position="bottom-right"
            toastOptions={{
              style: {
                background: '#141418',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#fff',
              },
            }}
          />
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
