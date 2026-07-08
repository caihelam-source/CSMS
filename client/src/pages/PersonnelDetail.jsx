import { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { User, Building2, FileText, Mail, Phone, MapPin } from 'lucide-react'
import { personnelService, documentService } from '../services/index.js'
import { formatDate } from '../utils/helpers'
import { LoadingSpinner, DetailHeader, EmptyState } from '../components/UIHelpers'

export default function PersonnelDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [person, setPerson] = useState(null)
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [personRes, docRes] = await Promise.all([
        personnelService.getOne(id),
        documentService.getByPersonnel(id).catch(() => ({ data: { data: [] } })),
      ])
      setPerson(personRes.data.data)
      setDocuments(docRes.data.data || [])
    } catch {
      toast.error('Failed to load personnel')
      navigate('/personnel')
    } finally {
      setLoading(false)
    }
  }, [id, navigate])

  useEffect(() => { loadAll() }, [loadAll])

  if (loading) return <LoadingSpinner size="md" />
  if (!person) return <EmptyState icon={User} title="人员未找到" description="该人员记录不存在或已被删除" />

  return (
    <div className="space-y-6">
      {/* Header */}
      <DetailHeader
        onBack={() => navigate('/personnel')}
        title={person.name}
        subtitle={
          <>
            {person.nric && <span>{person.nric} &middot; </span>}
            {person.nationality && <span>{person.nationality}</span>}
          </>
        }
        initials={person.name?.charAt(0) || '?'}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left: Info */}
        <div className="card space-y-4">
          <h3 className="font-semibold flex items-center gap-2"><User size={18} /> 个人信息</h3>
          <div className="space-y-3 text-sm">
            {person.email && (
              <div className="flex items-center gap-2 text-gray-600">
                <Mail size={14} className="text-gray-400" /> {person.email}
              </div>
            )}
            {person.phone && (
              <div className="flex items-center gap-2 text-gray-600">
                <Phone size={14} className="text-gray-400" /> {person.phone}
              </div>
            )}
            {person.nric && (
              <div className="flex items-center gap-2 text-gray-600">
                <User size={14} className="text-gray-400" /> NRIC: {person.nric}
              </div>
            )}
            {person.nationality && (
              <div className="flex items-center gap-2 text-gray-600">
                <MapPin size={14} className="text-gray-400" /> {person.nationality}
              </div>
            )}
            {person.address?.country && (
              <div className="flex items-center gap-2 text-gray-600">
                <MapPin size={14} className="text-gray-400" /> {person.address.country}
              </div>
            )}
          </div>
          {person.notes && (
            <div className="pt-3 border-t border-gray-100">
              <p className="text-sm text-gray-500">{person.notes}</p>
            </div>
          )}
        </div>

        {/* Center: Linked Companies */}
        <div className="card md:col-span-2 space-y-4">
          <h3 className="font-semibold flex items-center gap-2"><Building2 size={18} /> 关联公司 ({person.companies?.length || 0})</h3>
          {!person.companies || person.companies.length === 0 ? (
            <EmptyState icon={Building2} title="No linked companies" />
          ) : (
            <div className="space-y-2">
              {person.companies.map((item, idx) => (
                <Link key={idx} to={`/companies/${item.company._id}`}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-primary-100 flex items-center justify-center text-primary-700 text-xs font-bold">
                      {item.company.name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <p className="font-medium text-primary-600">{item.company.name}</p>
                      <p className="text-xs text-gray-400">{item.company.registrationNumber} &middot; {item.company.type?.replace(/_/g, ' ')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.roles?.map(r => <span key={r} className="badge badge-info text-xs">{r}</span>)}
                    {item.shares > 0 && <span className="text-xs text-gray-500">{item.shares?.toLocaleString()} shares</span>}
                    {item.appointmentDate && <span className="text-xs text-gray-400">{formatDate(item.appointmentDate)}</span>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Documents */}
      <div className="card">
        <h3 className="font-semibold mb-4 flex items-center gap-2"><FileText size={18} /> 关联文件 ({documents.length})</h3>
        {documents.length === 0 ? (
          <EmptyState icon={FileText} title="No documents" />
        ) : (
          <div className="space-y-2">
            {documents.map(doc => (
              <div key={doc._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <FileText size={18} className="text-primary-600" />
                  <div>
                    <p className="font-medium text-sm">{doc.name}</p>
                    <p className="text-xs text-gray-400">
                      {doc.type && <span className="capitalize">{doc.type.replace(/_/g, ' ')}</span>}
                      {doc.fileSize && <> &middot; {(doc.fileSize / 1024).toFixed(0)} KB</>}
                      {doc.createdAt && <> &middot; {formatDate(doc.createdAt)}</>}
                      {doc.company && <> &middot; {doc.company.name}</>}
                    </p>
                  </div>
                </div>
                {doc.fileUrl ? (
                  <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary text-xs">Download</a>
                ) : (
                  <span className="text-xs text-gray-400">No file</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
