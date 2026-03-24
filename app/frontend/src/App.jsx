import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { UserProvider, useUser } from "./context/UserContext";
import { Toaster } from "./components/ui/sonner";
import Layout from "./components/Layout";
import { ThemeProvider } from "./components/ThemeProvider";
import Dashboard from "./pages/Dashboard";
import ApplyLeave from "./pages/ApplyLeave";
import MyLeaves from "./pages/MyLeaves";
import TeamLeaves from "./pages/TeamLeaves";
import CalendarView from "./pages/CalendarView";
import Employees from "./pages/Employees";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import Holidays from "./pages/Holidays";

function ProtectedRoute({ children }) {
  const { currentUser, loading } = useUser();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] dark:bg-background transition-colors">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-slate-300 dark:border-slate-600 border-t-slate-800 dark:border-t-slate-200 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function AppContent() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/apply-leave" element={<ApplyLeave />} />
                <Route path="/my-leaves" element={<MyLeaves />} />
                <Route path="/team-leaves" element={<TeamLeaves />} />
                <Route path="/calendar" element={<CalendarView />} />
                <Route path="/employees" element={<Employees />} />
                <Route path="/holidays" element={<Holidays />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <BrowserRouter>
        <UserProvider>
          <AppContent />
          <Toaster position="top-right" richColors />
        </UserProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;