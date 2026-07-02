import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { companyService, meetingService, documentService } from '../services/index.js'
import { formatDate } from '../utils/helpers'
import { Calendar, FileText, Building2, Users, Clock, AlertTriangle } from 'lucide-react'

const StatCard = ({ icon: Icon, label, value, color, to }) => (
  <Link to={to} className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm text-gray-500 mb-1">{label}</p>
        <p className="text-3xl font-bold text-gray-900">{value}</p>
      </div>
      <div className={`p-3 rounded-lg ${color}`}><Icon size={24} /></div>
    </div>
  </Link>
)

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [statsRes, meetRes] = await Promise.all([
        companyService.getDashboardStats().catch(() => ({ data: { data: {} } })),
        meetingService.getAll().catch(() => ({ data: { data: [] } })),
      ])
      setStats(statsRes.data.data)
      setMeetings(meetRes.data.data || [])
    } catch (err) {
      console.error('Dashboard load error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" /></div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-gray-500">Welcome back, Alice Chen</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Building2} label="Companies" value={stats?.totalCompanies || 0} color="bg-blue-50 text-blue-600" to="/companies" />
        <StatCard icon={Users} label="Personnel" value={stats?.totalPersonnel || 0} color="bg-green-50 text-green-600" to="/personnel" />
        <StatCard icon={FileText} label="Documents" value={stats?.totalDocuments || 0} color="bg-purple-50 text-purple-600" to="/documents" />
        <StatCard icon={Calendar} label="Meetings" value={stats?.totalMeetings || 0} color="bg-orange-50 text-orange-600" to="/meetings" />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Meetings */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2"><Calendar size={18} /> Upcoming Meetings</h3>
            <Link to="/meetings" className="text-sm text-primary-600 hover:underline">View all</Link>
          </div>
          {meetings.length === 0 ? (
            <p className="text-gray-400 text-sm py-4 text-center">No upcoming meetings</p>
          ) : (
            <div className="space-y-2">
              {meetings.slice(0, 3).map(m => (
                <Link key={m._id} to={`/meetings/${m._id}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${m.status === 'scheduled' ? 'bg-blue-500' : 'bg-green-500'}`} />
                    <div>
                      <p className="font-medium text-sm">{m.title}</p>
                      <p className="text-xs text-gray-400">{m.company?.name} &middot; {m.type?.toUpperCase()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm">{formatDate(m.scheduledAt)}</p>
                    <span className={`badge text-xs ${m.status === 'scheduled' ? 'badge-info' : 'badge-success'}`}>{m.status}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Compliance Overview */}
        <div className="card">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><AlertTriangle size={18} /> Compliance Overview</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Clock size={16} className="text-yellow-600" />
                <div>
                  <p className="text-sm font-medium">Annual Return Due</p>
                  <p className="text-xs text-gray-500">{stats?.activeCompanies || 0} active companies</p>
                </div>
              </div>
              <span className="badge badge-warning text-xs">Review needed</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Building2 size={16} className="text-gray-500" />
                <div>
                  <p className="text-sm font-medium">Total Active Links</p>
                  <p className="text-xs text-gray-500">Directors, shareholders & secretaries</p>
                </div>
              </div>
              <Link to="/personnel" className="text-sm text-primary-600 hover:underline">Manage</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
