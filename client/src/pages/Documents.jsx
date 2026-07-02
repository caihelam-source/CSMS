import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { documentService } from '../services/index.js'
import { formatDate } from '../utils/helpers'
import { FileText, Search, Download, Building2, User } from 'lucide-react'
import toast from 'react-hot-toast'

const DOC_TYPE_LABELS = {
  minutes: 'Minutes', resolution: 'Resolution', agreement: 'Agreement',
  form: 'Form', certificate: 'Certificate', return: 'Return', notice: 'Notice',
  annual_report: 'Annual Report', financial_statement: 'Financial Statement',
  id_document: 'ID Document', passport: 'Passport', proof_of_address: 'Proof of Address',
  board_resolution: 'Board Resolution', incorporation_doc: 'Incorporation Doc', other: 'Other',
}

export default function Documents() {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')

  useEffect(() => { loadDocuments() }, [])

  const loadDocuments = async () => {
    setLoading(true)
    try {
      const { data } = await documentService.getAll()
      setDocuments(data.data || [])
    } catch {
      toast.error('Failed to load documents')
    } finally {
      setLoading(false)
    }
  }

  const filtered = documents.filter(d => {
    const q = search.toLowerCase()
    return (!q || d.name?.toLowerCase().includes(q)) && (!filterType || d.type === filterType)
  })

  const types = [...new Set(documents.map(d => d.type).filter(Boolean))]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Documents</h1>
        <p className="text-gray-500">{documents.length} documents</p>
      </div>

      {/* Filters */}
      <div className="card flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input-field pl-9" placeholder="Search documents..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input-field w-auto" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">All Types</option>
          {types.map(t => <option key={t} value={t}>{DOC_TYPE_LABELS[t] || t}</option>)}
        </select>
      </div>

      {/* Document List */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" /></div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <FileText size={48} className="mx-auto mb-4 opacity-50" />
          <p>No documents found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(doc => (
            <div key={doc._id} className="card flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <div className="p-2 bg-primary-50 rounded-lg">
                  <FileText size={20} className="text-primary-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{doc.name}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-gray-400">
                    <span>{DOC_TYPE_LABELS[doc.type] || doc.type || 'Other'}</span>
                    {doc.fileSize > 0 && <span>{(doc.fileSize / 1024).toFixed(0)} KB</span>}
                    {doc.createdAt && <span>{formatDate(doc.createdAt)}</span>}
                    {doc.company && (
                      <Link to={`/companies/${doc.company._id}`} className="text-primary-500 hover:underline flex items-center gap-1">
                        <Building2 size={12} /> {doc.company.name}
                      </Link>
                    )}
                    {doc.personnel && (
                      <Link to={`/personnel/${doc.personnel._id}`} className="text-primary-500 hover:underline flex items-center gap-1">
                        <User size={12} /> {doc.personnel.name}
                      </Link>
                    )}
                  </div>
                </div>
              </div>
              {doc.fileUrl ? (
                <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
                  className="btn-secondary text-sm flex items-center gap-1 flex-shrink-0">
                  <Download size={14} /> Download
                </a>
              ) : (
                <span className="text-xs text-gray-300 flex-shrink-0">No file</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
