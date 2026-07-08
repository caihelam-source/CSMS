import { Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import Navbar from './Navbar'

export default function Layout() {
  const { user } = useAuth()

  return (
    <div className="min-h-screen flex">
      {/* Sidebar — uses shared Navbar component with grouped nav, admin section, demo badge */}
      <Navbar />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Demo mode banner */}
        {!user?.token || user?.token?.startsWith('demo-') ? (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-sm text-amber-800">
            🎭 <strong>Demo Mode</strong> — No backend required. All features are interactive.
          </div>
        ) : null}

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
