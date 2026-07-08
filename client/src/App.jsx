import { lazy, Suspense, Component } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext.jsx'
import Layout from './components/Layout'

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
const Directors = lazy(() => import('./pages/Directors'))
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
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
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

// ErrorBoundary — captures rendering errors and displays the error message
class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null, errorInfo: null }
  }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error, errorInfo) { this.setState({ errorInfo }) }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-red-50 p-8 font-mono text-sm overflow-auto">
          <h1 className="text-xl font-bold text-red-700 mb-4">⚠️ 页面渲染错误 (RouteErrorBoundary)</h1>
          <pre className="bg-white border border-red-200 rounded-lg p-4 text-red-600 whitespace-pre-wrap break-all">
{this.state.error.message}
{'\n\n'}
{this.state.error.stack || ''}
          </pre>
          {this.state.errorInfo && (
            <details className="mt-4">
              <summary className="cursor-pointer text-red-500 font-semibold">组件堆栈</summary>
              <pre className="mt-2 bg-white border border-red-200 rounded-lg p-3 text-xs text-gray-600 whitespace-pre-wrap">
{this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
        </div>
      )
    }
    return this.props.children
  }
}

function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LazyPage><Login /></LazyPage>} />
        <Route path="/register" element={<LazyPage><Register /></LazyPage>} />

        {/* Protected — all wrapped in Layout (Outlet renders page) */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <RouteErrorBoundary>
                <Layout />
              </RouteErrorBoundary>
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
          <Route path="directors" element={<LazyPage><Directors /></LazyPage>} />
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
