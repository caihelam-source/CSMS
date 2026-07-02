import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext.jsx'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Meetings from './pages/Meetings'
import Documents from './pages/Documents'
import Companies from './pages/Companies'
import CompanyDetail from './pages/CompanyDetail'
import Tasks from './pages/Tasks'
import Directors from './pages/Directors'
import ComplianceReminders from './pages/ComplianceReminders'
import ComplianceRules from './pages/ComplianceRules'
import Templates from './pages/Templates'
import SignTasks from './pages/SignTasks'
import Personnel from './pages/Personnel'
import PersonnelDetail from './pages/PersonnelDetail'
import AdminPanel from './pages/AdminPanel'
import Settings from './pages/Settings'

// Spinner used during auth check
const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
  </div>
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
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Protected — all wrapped in Layout (Outlet renders page) */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="companies" element={<Companies />} />
        <Route path="companies/:id" element={<CompanyDetail />} />
        <Route path="meetings" element={<Meetings />} />
        <Route path="documents" element={<Documents />} />
        <Route path="personnel" element={<Personnel />} />
        <Route path="personnel/:id" element={<PersonnelDetail />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="directors" element={<Directors />} />
        <Route path="compliance-rules" element={<ComplianceRules />} />
        <Route path="compliance-reminders" element={<ComplianceReminders />} />
        <Route path="templates" element={<Templates />} />
        <Route path="sign-tasks" element={<SignTasks />} />
        <Route path="settings" element={<Settings />} />
        <Route
          path="admin"
          element={
            <AdminRoute>
              <AdminPanel />
            </AdminRoute>
          }
        />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default App
