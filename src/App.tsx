import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AuthPage from "./pages/AuthPage";
import AdminDashboard from "./pages/AdminDashboard";
import KanbanBoard from "./pages/KanbanBoard";
import ProjectInitiation from "./pages/ProjectInitiation";
import ProjectsView from "./pages/ProjectsView";
import ExecutiveReport from "./pages/ExecutiveReport";
import NotificationsPage from "./pages/NotificationsPage";
import MessagesPage from "./pages/MessagesPage";
import AdminProjectList from "./pages/AdminProjectList";
import AdminClientList from "./pages/AdminClientList";
import DashboardLayout from "./components/DashboardLayout";
import { Loader2 } from "lucide-react";
import { useInactivityLogout } from "@/hooks/useInactivityLogout";

const queryClient = new QueryClient();

function AppRoutes() {
  const { user, role, loading } = useAuth();
  useInactivityLogout();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <AuthPage />;

  return (
    <DashboardLayout>
      <Routes>
        {role === 'admin' && <Route path="/" element={<AdminDashboard />} />}
        {role === 'staff' && <Route path="/" element={<Navigate to="/pipeline" replace />} />}
        {role === 'client' && <Route path="/" element={<Navigate to="/projects" replace />} />}
        
        {(role === 'admin' || role === 'staff') && (
          <Route path="/pipeline" element={<KanbanBoard />} />
        )}
        
        {role === 'client' && (
          <Route path="/new-project" element={<ProjectInitiation />} />
        )}

        {role === 'admin' && (
          <Route path="/report" element={<ExecutiveReport />} />
        )}
        
        <Route path="/projects" element={<ProjectsView />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </DashboardLayout>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
