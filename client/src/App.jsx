import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext.jsx'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'

// Lazy-loaded page components
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Meetings = lazy(() => import('./pages/Meetings'))
const MeetingDetail = lazy(() => import('./pages/MeetingDetail'))
const Documents = lazy(() => import('./pages/Documents'))
const Companies = lazy(() => import('./pages/Companies'))
const CompanyDetail = lazy(() => import('./pages/CompanyDetail'))
const Tasks = lazy(() => import('./pages/Tasks'))
const TaskDetail = lazy(() => import('./pages/TaskDetail'))
const ComplianceReminders = lazy(() => import('./pages/ComplianceReminders'))
const ComplianceReminderDetail = lazy(() => import('./pages/ComplianceReminderDetail'))
const ComplianceRules = lazy(() => import('./pages/ComplianceRules'))
const Templates = lazy(() => import('./pages/Templates'))
const SignTasks = lazy(() => import('./pages/SignTasks'))
const Personnel = lazy(() => import('./pages/Personnel'))
const PersonnelDetail = lazy(() => import('./pages/PersonnelDetail'))
const AdminPanel = lazy(() => import('./pages/AdminPanel'))
const Settings = lazy(() => import('./pages/Settings'))

// Spinner used during auth check and lazy loading
const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-canvas">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
  </div>
)

// Page-level loading fallback (lighter, inside layout)
const PageLoader = () => (
  <div className="flex items-center justify-center h-64">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
  </div>
)

// Suspense wrapper for lazy pages
const LazyPage = ({ children }) => (
  <Suspense fallback={<PageLoader />}>
    {children}
  </Suspense>
)

// Requires login
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  return children
}

// Requires admin role
const AdminRoute = ({ children }) => {
  const { user, loading, isAdmin } = useAuth()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  return isAdmin ? children : <Navigate to="/dashboard" replace />
}

function App() {
  const location = useLocation()
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        {/* Public — 同样包边界，避免登录/注册页抛错直接白屏 */}
        <Route path="/login" element={<ErrorBoundary><LazyPage><Login /></LazyPage></ErrorBoundary>} />
        <Route path="/register" element={<ErrorBoundary><LazyPage><Register /></LazyPage></ErrorBoundary>} />

        {/* Protected — all wrapped in Layout (Outlet renders page) */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <ErrorBoundary resetKey={location.pathname}>
                <Layout />
              </ErrorBoundary>
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<LazyPage><Dashboard /></LazyPage>} />
          <Route path="companies" element={<LazyPage><Companies /></LazyPage>} />
          <Route path="companies/:id" element={<LazyPage><CompanyDetail /></LazyPage>} />
          <Route path="meetings" element={<LazyPage><Meetings /></LazyPage>} />
          <Route path="meetings/:id" element={<LazyPage><MeetingDetail /></LazyPage>} />
          <Route path="documents" element={<LazyPage><Documents /></LazyPage>} />
          <Route path="personnel" element={<LazyPage><Personnel /></LazyPage>} />
          <Route path="personnel/:id" element={<LazyPage><PersonnelDetail /></LazyPage>} />
          <Route path="tasks" element={<LazyPage><Tasks /></LazyPage>} />
          <Route path="tasks/:id" element={<LazyPage><TaskDetail /></LazyPage>} />
          <Route path="compliance-rules" element={<LazyPage><ComplianceRules /></LazyPage>} />
          <Route path="compliance-reminders" element={<LazyPage><ComplianceReminders /></LazyPage>} />
          <Route path="compliance-reminders/:id" element={<LazyPage><ComplianceReminderDetail /></LazyPage>} />
          <Route path="templates" element={<LazyPage><Templates /></LazyPage>} />
          <Route path="sign-tasks" element={<LazyPage><SignTasks /></LazyPage>} />
          <Route path="settings" element={<LazyPage><Settings /></LazyPage>} />
          <Route
            path="admin"
            element={
              <AdminRoute>
                <LazyPage><AdminPanel /></LazyPage>
              </AdminRoute>
            }
          />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  )
}

export default App
