import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { queryClient } from "./lib/api";
import { AppStateProvider, useMe } from "./lib/app-state";
import { Shell } from "./components/Shell";
import { Loading } from "./components/ui";
import { Workspace } from "./pages/Workspace";
import { LoginPage, RegisterPage } from "./pages/Auth";
import { Onboarding } from "./pages/Onboarding";
import { AgendaPage, ApprovalsPage, BriefingPage, HistoryPage, InboxPage, TasksPage } from "./pages/Views";
import { ConnectionsPage, ProfilePage, RulesPage, TemplatesPage, UsagePage } from "./pages/Settings";
import "./styles.css";
import "./studio.css";

function Guard({ children, allowOnboarding }: { children: ReactNode; allowOnboarding?: boolean }) {
  const me = useMe();
  const loc = useLocation();
  if (me.isLoading) return <Loading />;
  if (me.isError || !me.data) return <Navigate to="/connexion" replace state={{ from: loc.pathname }} />;
  if (!me.data.onboardingCompleted && !allowOnboarding && loc.pathname !== "/connexions") return <Navigate to="/bienvenue" replace />;
  return <>{children}</>;
}

const inShell = (el: ReactNode) => (
  <Guard>
    <Shell>{el}</Shell>
  </Guard>
);

function App() {
  return (
    <Routes>
      <Route path="/connexion" element={<LoginPage />} />
      <Route path="/inscription" element={<RegisterPage />} />
      <Route
        path="/bienvenue"
        element={
          <Guard allowOnboarding>
            <Onboarding />
          </Guard>
        }
      />
      <Route path="/" element={inShell(<Workspace />)} />
      <Route path="/point" element={inShell(<BriefingPage />)} />
      <Route path="/messages" element={inShell(<InboxPage />)} />
      <Route path="/agenda" element={inShell(<AgendaPage />)} />
      <Route path="/taches" element={inShell(<TasksPage />)} />
      <Route path="/validations" element={inShell(<ApprovalsPage />)} />
      <Route path="/historique" element={inShell(<HistoryPage />)} />
      <Route path="/modeles" element={inShell(<TemplatesPage />)} />
      <Route path="/regles" element={inShell(<RulesPage />)} />
      <Route path="/connexions" element={inShell(<ConnectionsPage />)} />
      <Route path="/connections" element={<Navigate to="/connexions" replace />} />
      <Route path="/profil" element={inShell(<ProfilePage />)} />
      <Route path="/consommation" element={inShell(<UsagePage />)} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user">
        <BrowserRouter>
          <AppStateProvider>
            <App />
          </AppStateProvider>
        </BrowserRouter>
      </MotionConfig>
    </QueryClientProvider>
  </StrictMode>,
);
