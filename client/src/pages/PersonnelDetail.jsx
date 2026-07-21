import { useState, useEffect, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { User, Building2, FileText, Mail, Phone, MapPin, Calendar, Bell, CheckSquare, Edit3 } from 'lucide-react'
import { personnelService } from '../services/index.js'
import { formatDate, getStatusColor, docExpiryStatus, DOC_EXPIRY_BADGE } from '../utils/helpers'
import { DetailHeader, EmptyState, SectionSkeleton, taskPriorityColor, FormField, inputClass } from '../components/UIHelpers'

// 角色元数据：标签 + 图标 + 配色（读时聚合自 Company.links.roles）
const ROLE_META = {
  director: { label: '董事', color: 'bg-primary-100 text-primary-700' },
  alternate_director: { label: '替任董事', color: 'bg-info/10 text-primary-700' },
  shareholder: { label: '股东', color: 'bg-success/10 text-success' },
  secretary: { label: '公司秘书', color: 'bg-warning/10 text-warning' },
  auditor: { label: '审计师', color: 'bg-canvas text-ink-2' },
  other: { label: '其他', color: 'bg-canvas text-ink-2' },
}

// 页面级骨架（人员基础信息加载时）
function PersonnelSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-canvas animate-pulse" />
        <div className="space-y-2">
          <div className="h-5 bg-canvas rounded animate-pulse w-40" />
          <div className="h-3 bg-canvas rounded animate-pulse w-24" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card"><SectionSkeleton lines={3} /></div>
        <div className="card"><SectionSkeleton lines={4} /></div>
      </div>
      <div className="card"><SectionSkeleton lines={3} /></div>
    </div>
  )
}

// 板块容器：标题 + 独立骨架/内容
function Section({ icon: Icon, title, count, loading, children }) {
  return (
    <div className="card">
      <h3 className="font-semibold mb-4 flex items-center gap-2">
        {Icon && <Icon size={18} />} {title}
        {count !== undefined && <span className="text-ink-3">（{count}）</span>}
      </h3>
      {loading ? <SectionSkeleton lines={3} /> : children}
    </div>
  )
}

export default function PersonnelDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [person, setPerson] = useState(null)
  const [personLoading, setPersonLoading] = useState(true)

  // 个人信息内联编辑
  const [editingPersonal, setEditingPersonal] = useState(false)
  const [personalForm, setPersonalForm] = useState({})
  const [savingPersonal, setSavingPersonal] = useState(false)

  // 五个板块独立加载状态（互不阻塞）
  const [companies, setCompanies] = useState({ loading: true, data: [], error: null })
  const [meetings, setMeetings] = useState({ loading: true, data: [], error: null })
  const [documents, setDocuments] = useState({ loading: true, data: [], error: null })
  const [allReminders, setAllReminders] = useState({ loading: true, data: [], error: null })
  const [tasks, setTasks] = useState({ loading: true, data: [], error: null })

  // 真实数据驱动的 Person 360：一次读时聚合（后端从 Company.links 反查公司，再聚合 Task/Meeting/Document/Reminder）
  useEffect(() => {
    let alive = true
    setPersonLoading(true)
    personnelService.getByPersonnel(id)
      .then(res => {
        if (!alive) return
        const d = res.data.data
        setPerson(d.personnel)
        setCompanies({ loading: false, data: d.companies || [] })
        setMeetings({ loading: false, data: d.meetings || [] })
        setDocuments({ loading: false, data: d.documents || [] })
        setAllReminders({ loading: false, data: d.reminders || [] })
        setTasks({ loading: false, data: d.tasks || [] })
      })
      .catch(() => { if (alive) { toast.error('Failed to load personnel'); navigate('/personnel') } })
      .finally(() => { if (alive) setPersonLoading(false) })
    return () => { alive = false }
  }, [id, navigate])

  // 由关联公司过滤合规提醒（读时聚合）—— 必须放在 early return 之前，避免渲染间 hooks 数量不一致
  const linkedCompanyIds = useMemo(
    () => new Set((companies.data || []).map(c => c.company?._id || c._id)),
    [companies.data],
  )
  const reminders = useMemo(
    () => (allReminders.data || []).filter(r => linkedCompanyIds.has(r.company?._id)),
    [allReminders.data, linkedCompanyIds],
  )
  // 角色徽章来自实际任职（Company.links.roles）
  const roleSet = useMemo(() => {
    const s = new Set()
    ;(companies.data || []).forEach(c => (c.roles || []).forEach(r => s.add(r)))
    return [...s]
  }, [companies.data])

  // ---- 个人信息内联编辑 ----
  const openEditPersonal = () => {
    setPersonalForm({
      name: person?.name || '',
      email: person?.email || '',
      phone: person?.phone || '',
      nric: person?.nric || '',
      nationality: person?.nationality || '',
      addressCountry: person?.address?.country || '',
      addressStreet: person?.address?.street || '',
      notes: person?.notes || '',
    })
    setEditingPersonal(true)
  }

  const savePersonal = async () => {
    setSavingPersonal(true)
    try {
      const payload = {
        name: personalForm.name,
        email: personalForm.email,
        phone: personalForm.phone,
        nric: personalForm.nric,
        nationality: personalForm.nationality,
        address: {
          country: personalForm.addressCountry,
          street: personalForm.addressStreet,
        },
        notes: personalForm.notes,
      }
      await personnelService.update(id, payload)
      toast.success('个人信息已更新')
      setEditingPersonal(false)
      // reload personnel data
      const res = await personnelService.getByPersonnel(id)
      setPerson(res.data.data.personnel)
    } catch { toast.error('更新失败') } finally { setSavingPersonal(false) }
  }

  if (personLoading) return <PersonnelSkeleton />
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
        badges={
          <>
            {roleSet.map(r => (
              <span key={r} className={`badge ${ROLE_META[r]?.color || 'bg-canvas text-ink-2'}`}>
                {ROLE_META[r]?.label || r}
              </span>
            ))}
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 左：个人信息 */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2"><User size={18} /> 个人信息</h3>
            {!editingPersonal ? (
              <button onClick={openEditPersonal} className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium">
                <Edit3 size={14} /> 编辑
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setEditingPersonal(false)} className="text-sm text-ink-2 hover:text-ink">取消</button>
                <button onClick={savePersonal} disabled={savingPersonal} className="text-sm btn-primary">{savingPersonal ? '保存中...' : '保存'}</button>
              </div>
            )}
          </div>
          {editingPersonal ? (
            /* 编辑模式 */
            <div className="space-y-3 text-sm">
              <FormField label="姓名" required><input className={inputClass} value={personalForm.name} onChange={e => setPersonalForm(f => ({ ...f, name: e.target.value }))} /></FormField>
              <FormField label="邮箱"><input className={inputClass} type="email" value={personalForm.email} onChange={e => setPersonalForm(f => ({ ...f, email: e.target.value }))} /></FormField>
              <FormField label="电话"><input className={inputClass} value={personalForm.phone} onChange={e => setPersonalForm(f => ({ ...f, phone: e.target.value }))} /></FormField>
              <FormField label="NRIC / 护照"><input className={inputClass} value={personalForm.nric} onChange={e => setPersonalForm(f => ({ ...f, nric: e.target.value }))} /></FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="国籍"><input className={inputClass} value={personalForm.nationality} onChange={e => setPersonalForm(f => ({ ...f, nationality: e.target.value }))} /></FormField>
                <FormField label="国家/地区"><input className={inputClass} value={personalForm.addressCountry} onChange={e => setPersonalForm(f => ({ ...f, addressCountry: e.target.value }))} /></FormField>
              </div>
              <FormField label="地址"><input className={inputClass} value={personalForm.addressStreet} onChange={e => setPersonalForm(f => ({ ...f, addressStreet: e.target.value }))} placeholder="街道地址" /></FormField>
              <FormField label="备注"><textarea className={inputClass} rows={2} value={personalForm.notes} onChange={e => setPersonalForm(f => ({ ...f, notes: e.target.value }))} /></FormField>
            </div>
          ) : (
            /* 只读模式 */
            <div className="space-y-3 text-sm">
              {person.email && (
                <div className="flex items-center gap-2 text-ink-2"><Mail size={14} className="text-ink-3" /> {person.email}</div>
              )}
              {person.phone && (
                <div className="flex items-center gap-2 text-ink-2"><Phone size={14} className="text-ink-3" /> {person.phone}</div>
              )}
              {person.nric && (
                <div className="flex items-center gap-2 text-ink-2"><User size={14} className="text-ink-3" /> NRIC: {person.nric}</div>
              )}
              {person.nationality && (
                <div className="flex items-center gap-2 text-ink-2"><MapPin size={14} className="text-ink-3" /> {person.nationality}</div>
              )}
              {person.address?.country && (
                <div className="flex items-center gap-2 text-ink-2"><MapPin size={14} className="text-ink-3" /> {person.address.country}</div>
              )}
              {person.address?.street && (
                <div className="flex items-start gap-2 text-ink-2"><MapPin size={14} className="text-ink-3 mt-0.5 shrink-0" /> <span>{person.address.street}</span></div>
              )}
            </div>
          )}
          {!editingPersonal && person.notes && (
            <div className="pt-3 border-t border-hairline">
              <p className="text-sm text-ink-2">{person.notes}</p>
            </div>
          )}
        </div>

        {/* 右：任职公司（按角色） */}
        <div className="card md:col-span-2">
          <Section icon={Building2} title="任职公司" count={companies.data.length} loading={companies.loading}>
            {companies.data.length === 0 ? (
              <EmptyState icon={Building2} title="暂无任职公司" />
            ) : (
              <div className="space-y-2">
                {companies.data.map((item, idx) => {
                  const c = item.company || item.link || {}
                  return (
                    <Link key={item._id || idx} to={`/companies/${c._id}`}
                      className="flex items-center justify-between p-3 bg-canvas rounded-lg hover:bg-canvas transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${ROLE_META[(item.roles || [])[0]]?.color || 'bg-canvas text-ink-2'}`}>
                          {c.name?.charAt(0) || '?'}
                        </div>
                        <div>
                          <p className="font-medium text-primary-600">{c.name}</p>
                          <p className="text-xs text-ink-3">{c.registrationNumber}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-ink-2">
                        {(item.roles || []).map(r => (
                          <span key={r} className={`badge ${ROLE_META[r]?.color || 'bg-canvas text-ink-2'}`}>{ROLE_META[r]?.label || r}</span>
                        ))}
                        {item.shares > 0 && <span>{item.shares?.toLocaleString()} 股</span>}
                        {item.appointmentDate && <span>自 {formatDate(item.appointmentDate)}</span>}
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </Section>
        </div>
      </div>

      {/* 会议 */}
      <Section icon={Calendar} title="关联会议" count={meetings.data.length} loading={meetings.loading}>
        {meetings.data.length === 0 ? (
          <EmptyState icon={Calendar} title="暂无关联会议" />
        ) : (
          <div className="space-y-2">
            {meetings.data.map(m => (
              <Link key={m._id} to={`/meetings/${m._id}`}
                className="flex items-center justify-between p-3 bg-canvas rounded-lg hover:bg-canvas transition-colors">
                <div>
                  <p className="font-medium text-primary-600">{m.title}</p>
                  <p className="text-xs text-ink-3">{m.company?.name} &middot; {m.type}</p>
                </div>
                <span className="text-xs text-ink-2">{formatDate(m.scheduledAt)}</span>
              </Link>
            ))}
          </div>
        )}
      </Section>

      {/* 文件 */}
      <Section icon={FileText} title="关联文件" count={documents.data.length} loading={documents.loading}>
        {documents.data.length === 0 ? (
          <EmptyState icon={FileText} title="暂无关联文件" />
        ) : (
          <div className="space-y-2">
            {documents.data.map(doc => {
              const badge = DOC_EXPIRY_BADGE[docExpiryStatus(doc)]
              return (
                <div key={doc._id} className="flex items-center justify-between p-3 bg-canvas rounded-lg">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText size={18} className="text-primary-600 shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {doc.docNumber && <span className="text-xs font-mono text-ink-3">{doc.docNumber}</span>}
                        <p className="font-medium truncate">{doc.name}</p>
                        {badge && <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>}
                      </div>
                      <p className="text-xs text-ink-3">
                        {doc.type && <span className="capitalize">{doc.type.replace(/_/g, ' ')}</span>}
                        {doc.createdAt && <> &middot; {formatDate(doc.createdAt)}</>}
                      </p>
                    </div>
                  </div>
                  {doc.fileUrl ? (
                    <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary text-xs shrink-0">Download</a>
                  ) : (
                    <span className="text-xs text-ink-3 shrink-0">No file</span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Section>

      {/* 合规提醒（由关联公司过滤） */}
      <Section icon={Bell} title="关联合规提醒" count={reminders.length} loading={allReminders.loading}>
        {reminders.length === 0 ? (
          <EmptyState icon={Bell} title="暂无关联合规提醒" />
        ) : (
          <div className="space-y-2">
            {reminders.map(r => (
              <Link key={r._id} to="/compliance-reminders"
                className="flex items-center justify-between p-3 bg-canvas rounded-lg hover:bg-canvas transition-colors">
                <div>
                  <p className="font-medium text-primary-600">{r.title}</p>
                  <p className="text-xs text-ink-3">{r.company?.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-ink-2">{formatDate(r.dueDate)}</span>
                  <span className={`badge ${getStatusColor(r.status)}`}>{r.status}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Section>

      {/* 任务（新增板块） */}
      <Section icon={CheckSquare} title="关联任务" count={tasks.data.length} loading={tasks.loading}>
        {tasks.data.length === 0 ? (
          <EmptyState icon={CheckSquare} title="暂无关联任务" />
        ) : (
          <div className="space-y-2">
            {tasks.data.map(t => (
              <Link key={t._id} to={`/tasks/${t._id}`}
                className="flex items-center justify-between p-3 bg-canvas rounded-lg hover:bg-canvas transition-colors">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{t.title}</p>
                  <p className="text-xs text-ink-3">{t.type} &middot; 到期 {formatDate(t.dueDate)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${taskPriorityColor(t.priority)}`}>{t.priority}</span>
                  <span className={`badge ${getStatusColor(t.status)}`}>{t.status}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}
