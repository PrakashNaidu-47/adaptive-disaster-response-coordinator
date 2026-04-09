import React, { useEffect, useState } from "react";
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom";

import AppHeader from "./components/AppHeader";
import Dashboard from "./pages/Dashboard";
import HistoryPage from "./pages/HistoryPage";
import Home from "./pages/Home";
import LoginPage from "./pages/LoginPage";
import OperationsPage from "./pages/OperationsPage";
import SimulationPage from "./pages/SimulationPage";
import "./App.css";
import {
  fetchCurrentUser,
  getStoredSession,
  refreshSession,
  signInWithPassword,
  signUpWithPassword,
  signOut,
} from "./services/auth";
import { AssessmentProvider } from "./state/AssessmentContext";

const RequireAuth = ({ session, user, children }) => {
  const location = useLocation();
  if (!session || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
};

const AuthenticatedLayout = ({ user, onLogout }) => (
  <AssessmentProvider>
    <div className="app-shell">
      <AppHeader user={user} onLogout={onLogout} />
      <Outlet />
    </div>
  </AssessmentProvider>
);

const AppRoutes = ({
  session,
  user,
  authLoading,
  loginLoading,
  onLogin,
  onSignup,
  onLogout,
  logoutRedirect,
  onLogoutRedirected,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const from = location.state?.from?.pathname || "/dashboard";

  useEffect(() => {
    if (logoutRedirect && location.pathname === "/") {
      onLogoutRedirected();
    }
  }, [logoutRedirect, location.pathname, onLogoutRedirected]);

  if (logoutRedirect) {
    return <Navigate to="/" replace />;
  }
  const handleLogout = () => {
    onLogout();
    navigate("/", { replace: true });
  };

  if (authLoading) {
    return (
      <div className="app-shell">
        <div className="login-shell">
          <section className="login-panel">
            <p className="loading-hint">Checking session...</p>
          </section>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route
        path="/login"
        element={
          session && user ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <div className="app-shell">
              <LoginPage
                onLogin={onLogin}
                onSignup={onSignup}
                loading={loginLoading}
                onAuthSuccess={() => navigate(from, { replace: true })}
              />
            </div>
          )
        }
      />
      <Route
        element={
          <RequireAuth session={session} user={user}>
            <AuthenticatedLayout user={user} onLogout={handleLogout} />
          </RequireAuth>
        }
      >
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="simulation" element={<SimulationPage />} />
        <Route path="operations" element={<OperationsPage />} />
        <Route path="history" element={<HistoryPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

function App() {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [logoutRedirect, setLogoutRedirect] = useState(false);

  useEffect(() => {
    const restore = async () => {
      const storedSession = getStoredSession();
      if (!storedSession) {
        setAuthLoading(false);
        return;
      }

      try {
        const expiresAt = storedSession.expires_at || 0;
        const currentEpoch = Math.floor(Date.now() / 1000);
        const activeSession =
          expiresAt > currentEpoch + 60
            ? storedSession
            : await refreshSession(storedSession.refresh_token);

        const currentUser = await fetchCurrentUser(activeSession.access_token);
        setSession(activeSession);
        setUser(currentUser);
      } catch {
        signOut();
      } finally {
        setAuthLoading(false);
      }
    };

    restore();
  }, []);

  const handleLogin = async ({ email, password }) => {
    setLoginLoading(true);
    try {
      const nextSession = await signInWithPassword({ email, password });
      const currentUser = await fetchCurrentUser(nextSession.access_token);
      setSession(nextSession);
      setUser(currentUser);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleSignup = async ({ email, password }) => {
    setLoginLoading(true);
    try {
      const signUpResult = await signUpWithPassword({ email, password });

      if (signUpResult?.access_token) {
        const currentUser = await fetchCurrentUser(signUpResult.access_token);
        setSession(signUpResult);
        setUser(currentUser);
      }

      return signUpResult;
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    signOut();
    setSession(null);
    setUser(null);
    setLogoutRedirect(true);
  };

  return (
    <AppRoutes
      session={session}
      user={user}
      authLoading={authLoading}
      loginLoading={loginLoading}
      onLogin={handleLogin}
      onSignup={handleSignup}
      onLogout={handleLogout}
      logoutRedirect={logoutRedirect}
      onLogoutRedirected={() => setLogoutRedirect(false)}
    />
  );
}

export default App;
