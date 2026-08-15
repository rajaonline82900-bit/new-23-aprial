import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LanguageProvider } from "./context/LanguageContext";
import { Toaster } from "./components/ui/sonner";
import { checkVersionAndMaybeReload } from "./utils/versionCheck";
import "./index.css";

// Simple Loader - transparent overlay so background shows through
const SplashScreen = () => (
  <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(140deg, #0B0420 0%, #1A0B3D 50%, #0B0420 100%)' }}>
    <div className="w-12 h-12 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
  </div>
);

// Pages
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import AdminLoginPage from "./pages/AdminLoginPage";
import DashboardPage from "./pages/DashboardPage";
import GamePage from "./pages/GamePage";
import KalyanGamePage from "./pages/KalyanGamePage";
import KalyanChartPage from "./pages/KalyanChartPage";
import AviatorPage from "./pages/AviatorPage";
import CoinPage from "./pages/CoinPage";
import LudoLobbyPage from "./pages/LudoLobbyPage";
import LudoGamePage from "./pages/LudoGamePage";
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
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import AuthCallback from "./pages/AuthCallback";
import ResultPopupListener from "./components/ResultPopupListener";

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
        path="/forgot-password"
        element={
          <PublicRoute>
            <ForgotPasswordPage />
          </PublicRoute>
        }
      />
      <Route
        path="/admin-login"
        element={<AdminLoginPage />}
      />

      {/* Protected Routes */}
      {/* Legacy routes redirect to Coin — only Coin Toss game is active */}
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/game/:gameId" element={<ProtectedRoute><GamePage /></ProtectedRoute>} />
      <Route path="/kalyan/:gameId" element={<ProtectedRoute><KalyanGamePage /></ProtectedRoute>} />
      <Route path="/kalyan/:gameId/chart" element={<ProtectedRoute><KalyanChartPage /></ProtectedRoute>} />
      <Route path="/aviator" element={<ProtectedRoute><AviatorPage /></ProtectedRoute>} />
      <Route path="/ludo" element={<ProtectedRoute><LudoLobbyPage /></ProtectedRoute>} />
      <Route path="/ludo/table/:tableId" element={<ProtectedRoute><LudoGamePage /></ProtectedRoute>} />
      <Route path="/bets" element={<ProtectedRoute><BetsPage /></ProtectedRoute>} />
      <Route path="/results" element={<ProtectedRoute><ResultsPage /></ProtectedRoute>} />
      <Route path="/jantri" element={<ProtectedRoute><JantriPage /></ProtectedRoute>} />
      <Route path="/rate-list" element={<ProtectedRoute><RateListPage /></ProtectedRoute>} />

      <Route
        path="/coin"
        element={
          <ProtectedRoute>
            <CoinPage />
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

      {/* Default Route — preserve query string (e.g. ?ah= for APK auto-login) */}
      <Route path="/" element={<Navigate to={`/signup${window.location.search}`} replace />} />
      <Route path="*" element={<Navigate to={`/signup${window.location.search}`} replace />} />
    </Routes>
  );
}

// Global overlays shown only to authenticated NON-admin users
const AuthedOverlays = () => {
  const { user } = useAuth();
  if (!user) return null;
  if (user.role === 'admin') return null;
  return <ResultPopupListener />;
};

// Soft banner: shown when the bundled APK build lags behind the live backend
// and auto-reload has been exhausted. Prevents the infinite-reload/blank-screen
// state that killed APKs on version mismatch. Users can dismiss & keep using.
const UpdateAvailableBanner = () => {
  const [info, setInfo] = React.useState(null);
  const [dismissed, setDismissed] = React.useState(false);
  React.useEffect(() => {
    // Pick up flag if already set before this component mounted
    if (window.__matka_needs_update) setInfo(window.__matka_needs_update);
    const on = (e) => setInfo(e.detail || window.__matka_needs_update);
    window.addEventListener('matka:update-available', on);
    return () => window.removeEventListener('matka:update-available', on);
  }, []);
  if (!info || dismissed) return null;
  return (
    <div
      data-testid="update-available-banner"
      style={{
        position: 'fixed', bottom: 12, left: 12, right: 12, zIndex: 9999,
        background: 'linear-gradient(90deg,#7C2D12,#B45309)',
        color: '#FEF3C7', borderRadius: 14, padding: '10px 14px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, fontSize: 12,
      }}
    >
      <span style={{ fontSize: 18 }}>⬆️</span>
      <div style={{ flex: 1, lineHeight: 1.25 }}>
        <div style={{ fontWeight: 900 }}>Naya APK Update Available</div>
        <div style={{ opacity: 0.9, fontSize: 10 }}>
          Latest features paane ke liye Play Store / official link se APK update karein.
        </div>
      </div>
      <button
        onClick={() => setDismissed(true)}
        style={{ background: 'rgba(0,0,0,0.3)', border: 'none', color: '#FEF3C7', borderRadius: 8, padding: '4px 10px', fontWeight: 800, fontSize: 11 }}
      >Bad me</button>
    </div>
  );
};

function App() {
  // Run version check on app boot — will attempt at most 1 auto-reload per
  // session, then falls back to a soft banner (no more infinite reload loops).
  React.useEffect(() => {
    checkVersionAndMaybeReload({ isBoot: true });
    const onFocus = () => checkVersionAndMaybeReload();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <LanguageProvider>
        <div className="App">
          <AppRoutes />
          <AuthedOverlays />
          <UpdateAvailableBanner />
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
        </LanguageProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
