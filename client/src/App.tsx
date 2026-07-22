import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/auth'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import AcceptInvitePage from './pages/AcceptInvitePage'
import OnboardingPage from './pages/OnboardingPage'
import Layout from './components/layout/Layout'
import OwnerDashboard from './pages/OwnerDashboard'
import ROPDashboard from './pages/ROPDashboard'
import ManagerDashboard from './pages/ManagerDashboard'
import MarketerDashboard from './pages/MarketerDashboard'
import UsersPage from './pages/UsersPage'
import ReportPage from './pages/ReportPage'
import SettingsPage from './pages/SettingsPage'
import PlansPage from './pages/PlansPage'
import TrackingPage from './pages/TrackingPage'
import MarketingPage from './pages/MarketingPage'
import ROPLinksPage from './pages/ROPLinksPage'
import LiderLeadsPage from './pages/LiderLeadsPage'
import CloserLeadsPage from './pages/CloserLeadsPage'
import CloserTasksPage from './pages/CloserTasksPage'
import LiderTasksPage from './pages/LiderTasksPage'
import CloserArchivePage from './pages/CloserArchivePage'
import ROPTasksPage from './pages/ROPTasksPage'
// Admin
import AdminLoginPage from './pages/admin/AdminLoginPage'
import AdminLayout from './pages/admin/AdminLayout'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminCompaniesPage from './pages/admin/AdminCompaniesPage'
import AdminCompanyDetailPage from './pages/admin/AdminCompanyDetailPage'
import AdminUsersPage from './pages/admin/AdminUsersPage'
import AdminAuditPage from './pages/admin/AdminAuditPage'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuthStore(s => s.token)
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

function DashboardRedirect() {
  const user = useAuthStore(s => s.user)
  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'OWNER') return <Navigate to="/dashboard/owner" replace />
  if (user.role === 'ROP') return <Navigate to="/dashboard/rop" replace />
  if (user.role === 'MANAGER') return <Navigate to="/dashboard/manager" replace />
  if (user.role === 'MARKETER') return <Navigate to="/dashboard/marketer" replace />
  return <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/accept-invite" element={<AcceptInvitePage />} />
        {/* App (authenticated) */}
        <Route path="/app" element={<RequireAuth><DashboardRedirect /></RequireAuth>} />
        <Route path="/onboarding" element={<RequireAuth><OnboardingPage /></RequireAuth>} />
        <Route element={<RequireAuth><Layout /></RequireAuth>}>
          <Route path="/dashboard/owner" element={<OwnerDashboard />} />
          <Route path="/dashboard/rop" element={<ROPDashboard />} />
          <Route path="/dashboard/manager" element={<ManagerDashboard />} />
          <Route path="/dashboard/marketer" element={<MarketerDashboard />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/report" element={<ReportPage />} />
          <Route path="/plans" element={<PlansPage />} />
          <Route path="/tracking" element={<TrackingPage />} />
          <Route path="/marketing" element={<MarketingPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/rop/links" element={<ROPLinksPage />} />
          <Route path="/lider/leads" element={<LiderLeadsPage />} />
          <Route path="/closer/leads" element={<CloserLeadsPage />} />
          <Route path="/closer/tasks" element={<CloserTasksPage />} />
          <Route path="/lider/tasks" element={<LiderTasksPage />} />
          <Route path="/closer/archive" element={<CloserArchivePage />} />
          <Route path="/rop/tasks" element={<ROPTasksPage />} />
        </Route>
        {/* Super Admin Panel */}
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="companies" element={<AdminCompaniesPage />} />
          <Route path="companies/:id" element={<AdminCompanyDetailPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="audit" element={<AdminAuditPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
