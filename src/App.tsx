import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { DemoProvider } from "@/hooks/useDemo";
import Landing from "./pages/Landing";
import LoginPage from "./pages/LoginPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import PricingPage from "./pages/PricingPage";
import NotFound from "./pages/NotFound";
import { AppLayout } from "./components/AppLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import InboxPage from "./pages/app/InboxPage";
import PriorityPage from "./pages/app/PriorityPage";
import AccountsPage from "./pages/app/AccountsPage";
import SettingsPage from "./pages/app/SettingsPage";
import AdminPage from "./pages/app/AdminPage";
import AnalyticsPage from "./pages/app/AnalyticsPage";
import FoldersPage from "./pages/app/FoldersPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import TermsPage from "./pages/TermsPage";
import PrivacyPage from "./pages/PrivacyPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <DemoProvider>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/pricing" element={<PricingPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/auth/callback/:platform" element={<AuthCallbackPage />} />
              <Route path="/app" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                <Route index element={<Navigate to="/app/inbox" replace />} />
                <Route path="inbox" element={<InboxPage />} />
                <Route path="folders" element={<FoldersPage />} />
                <Route path="priority" element={<PriorityPage />} />
                <Route path="analytics" element={<AnalyticsPage />} />
                <Route path="accounts" element={<AccountsPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="admin" element={<AdminPage />} />
              </Route>
              <Route path="/demo" element={<AppLayout />}>
                <Route index element={<Navigate to="/demo/inbox" replace />} />
                <Route path="inbox" element={<InboxPage />} />
                <Route path="folders" element={<FoldersPage />} />
                <Route path="priority" element={<PriorityPage />} />
                <Route path="analytics" element={<AnalyticsPage />} />
                <Route path="accounts" element={<AccountsPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </DemoProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
