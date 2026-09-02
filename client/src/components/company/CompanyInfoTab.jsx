// CompanyInfoTab — 公司信息 / 地址 / 合规日期 / 近期会议任务（D2 等价重构，搬迁自 CompanyDetail 的 info Tab）。
// 行为 / 样式 / 交互与原版完全一致；数据来自 Shell 经 props 下传的 ctx。
import { Link } from 'react-router-dom'
import { Edit3, Calendar, CheckSquare, History, Plus, X, GitMerge } from 'lucide-react'
import { formatDate } from '../../utils/helpers'
import { FormField, inputClass, jurisdictionLabel, taskPriorityColor } from '../../components/UIHelpers'

export default function CompanyInfoTab({ ctx }) {
  const {
    company, editingInfo, openEditInfo, setEditingInfo, saveInfo, savingInfo, infoForm, setInfoForm,
    tasks, meetings,
    // v6.x 曾用名维护
    showFormerNameModal, setShowFormerNameModal,
    newFormerName, setNewFormerName,
    newFormerNameChinese, setNewFormerNameChinese,
    addingFormerName, saveNewFormerName, removeFormerName,
  } = ctx

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="card relative">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">公司信息</h3>
          {!editingInfo ? (
            <button onClick={openEditInfo} className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium">
              <Edit3 size={14} /> 编辑
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setEditingInfo(false)} className="text-sm text-ink-2 hover:text-ink">取消</button>
              <button onClick={saveInfo} disabled={savingInfo} className="text-sm btn-primary">{savingInfo ? '保存中...' : '保存'}</button>
            </div>
          )}
        </div>
        {editingInfo ? (
          /* 编辑模式 */
          <div className="space-y-3">
            <FormField label="公司名称" required>
              <input className={inputClass} value={infoForm.name} onChange={e => setInfoForm(f => ({ ...f, name: e.target.value }))} />
            </FormField>
            {/* 中文名独立可编辑（与 Personnel 同构）：简繁为公司当前使用的合法写法，
                展示层会做 "英文 · 中文" 合并显示；仅编辑其中一个字段不视为改名 */}
            <FormField label="中文名称（可选）">
              <input className={inputClass} value={infoForm.nameChinese || ''} onChange={e => setInfoForm(f => ({ ...f, nameChinese: e.target.value }))} placeholder="例如：匯駿控股" />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="注册号"><input className={inputClass} value={infoForm.registrationNumber} onChange={e => setInfoForm(f => ({ ...f, registrationNumber: e.target.value }))} /></FormField>
              <FormField label="类型">
                <select className={inputClass} value={infoForm.type} onChange={e => setInfoForm(f => ({ ...f, type: e.target.value }))}>
                  <option value="private_limited">Private Limited</option>
                  <option value="public_limited">Public Limited</option>
                  <option value="llp">LLP</option>
                  <option value="service_provider">Service Provider</option>
                </select>
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="属地"><input className={inputClass} value={infoForm.jurisdiction} onChange={e => setInfoForm(f => ({ ...f, jurisdiction: e.target.value }))} /></FormField>
              <FormField label="成立日期"><input type="date" className={inputClass} value={infoForm.incorporationDate} onChange={e => setInfoForm(f => ({ ...f, incorporationDate: e.target.value }))} /></FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {infoForm.jurisdiction === 'HK' && (
                <FormField label="商业登记证到期日">
                  <input type="date" className={inputClass} value={infoForm.brExpiryDate} onChange={e => setInfoForm(f => ({ ...f, brExpiryDate: e.target.value }))} />
                </FormField>
              )}
              {infoForm.jurisdiction === 'BVI' && (
                <FormField label="经济实质相关业务">
                  <input className={inputClass} value={infoForm.bviRelevantActivity} onChange={e => setInfoForm(f => ({ ...f, bviRelevantActivity: e.target.value }))} placeholder="如 holding / finance_leasing ..." />
                </FormField>
              )}
            </div>
            {/* HK 专属：标记「在港注册的非香港公司」，勾选后年度申报表由 NAR1 切换为 NN3 */}
            {infoForm.jurisdiction === 'HK' && (
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-info/5 border border-info/20 cursor-pointer hover:bg-info/10 transition-colors">
                <input
                  type="checkbox"
                  checked={!!infoForm.nonHongKongCompany}
                  onChange={e => setInfoForm(f => ({ ...f, nonHongKongCompany: e.target.checked }))}
                  className="mt-0.5 w-4 h-4 accent-primary-600"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink-1">在港注册的非香港公司</p>
                  <p className="text-xs text-ink-3 mt-0.5 leading-relaxed">
                    适用对象：根据《公司条例》注册的海外公司（如 BVI/Cayman 公司在港设有注册办事处）。勾选后年度申报表将由 <span className="font-medium text-primary-700">NAR1</span> 切换为 <span className="font-medium text-primary-700">NN3</span>。
                  </p>
                </div>
              </label>
            )}
            <div className="grid grid-cols-3 gap-3">
              <FormField label="已发行股份"><input type="number" className={inputClass} value={infoForm.issuedShares} onChange={e => setInfoForm(f => ({ ...f, issuedShares: e.target.value }))} /></FormField>
              <FormField label="已缴股本"><input type="number" className={inputClass} value={infoForm.paidUpCapital} onChange={e => setInfoForm(f => ({ ...f, paidUpCapital: e.target.value }))} /></FormField>
              <FormField label="货币">
                <select className={inputClass} value={infoForm.currency} onChange={e => setInfoForm(f => ({ ...f, currency: e.target.value }))}>
                  <option value="HKD">HKD</option>
                  <option value="USD">USD</option>
                  <option value="CNY">CNY</option>
                  <option value="GBP">GBP</option>
                </select>
              </FormField>
            </div>
          </div>
        ) : (
          /* 只读模式 */
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-ink-2">注册号</span><span>{company.registrationNumber || '-'}</span></div>
            <div className="flex justify-between"><span className="text-ink-2">类型</span><span className="capitalize">{company.type?.replace(/_/g, ' ') || '-'}</span></div>
            <div className="flex justify-between"><span className="text-ink-2">属地</span><span>{jurisdictionLabel(company.jurisdiction) || company.registeredAddress?.country || '-'}</span></div>
            <div className="flex justify-between"><span className="text-ink-2">成立日期</span><span>{formatDate(company.incorporationDate)}</span></div>
            {company.brExpiryDate && (() => {
              const days = Math.floor((new Date(company.brExpiryDate) - new Date()) / (1000 * 60 * 60 * 24));
              const dayColor = days <= 30 ? 'text-danger' : days <= 90 ? 'text-warning' : 'text-success';
              return (
                <div className="flex justify-between">
                  <span className="text-ink-2">商业登记证到期日</span>
                  <span>{formatDate(company.brExpiryDate)} <span className={dayColor}>（剩 {days} 天）</span></span>
                </div>
              );
            })()}
            {company.bviRelevantActivity && <div className="flex justify-between"><span className="text-ink-2">经济实质</span><span>{company.bviRelevantActivity}</span></div>}
            {company.shareCapital && (
              <>
                <div className="flex justify-between"><span className="text-ink-2">已发行股份</span><span>{company.shareCapital.issued?.toLocaleString()} {company.shareCapital.currency}</span></div>
                <div className="flex justify-between"><span className="text-ink-2">已缴股本</span><span>{company.shareCapital.paidUp?.toLocaleString()} {company.shareCapital.currency}</span></div>
              </>
            )}
            {/* 申报类型：HK 本地公司 NAR1 vs 在港注册非香港公司 NN3（BR 通用） */}
            {company.jurisdiction === 'HK' && company.nonHongKongCompany && (
              <div className="flex justify-between items-center pt-2 border-t border-hairline">
                <span className="text-ink-2">年度申报表</span>
                <span className="inline-flex items-center gap-1 text-xs font-medium bg-info/10 text-primary-700 px-2 py-1 rounded-full">
                  NN3 · 在港注册非香港公司
                </span>
              </div>
            )}
          </dl>
        )}
      </div>
      <div className="card">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          地址
          {editingInfo && <span className="text-xs text-primary-500 font-normal">（编辑中）</span>}
        </h3>
        {editingInfo ? (
          <div className="space-y-3">
            <FormField label="街道"><input className={inputClass} value={infoForm.street} onChange={e => setInfoForm(f => ({ ...f, street: e.target.value }))} placeholder="例如：皇后大道中 1 号" /></FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="城市"><input className={inputClass} value={infoForm.city} onChange={e => setInfoForm(f => ({ ...f, city: e.target.value }))} /></FormField>
              <FormField label="省份/州"><input className={inputClass} value={infoForm.state} onChange={e => setInfoForm(f => ({ ...f, state: e.target.value }))} /></FormField>
            </div>
            <FormField label="国家/地区"><input className={inputClass} value={infoForm.addressCountry} onChange={e => setInfoForm(f => ({ ...f, addressCountry: e.target.value }))} /></FormField>
          </div>
        ) : company.registeredAddress ? (
          <p className="text-sm text-ink-2">
            {[company.registeredAddress.street, company.registeredAddress.city, company.registeredAddress.state, company.registeredAddress.country].filter(Boolean).join(', ') || company.registeredAddress.country || '-'}
          </p>
        ) : <p className="text-sm text-ink-3">-</p>}
      </div>
      {/* Compliance dates — 增强版：显示完成状态 */}
      <div className="card">
        <h3 className="font-semibold mb-4">合规日期</h3>
        <dl className="space-y-3 text-sm">
          {/* AGM 到期 */}
          {(() => {
            const agmTask = tasks.find(t => t.status === 'completed' && (
              t.title?.includes('AGM') || t.title?.includes('周年大会') || t.title?.includes('年度大会')
            ))
            return (
              <div className="flex justify-between items-center">
                <span className="text-ink-2">AGM 到期</span>
                <div className="text-right">
                  <span>{formatDate(company.compliance?.agmDueDate) || '-'}</span>
                  {agmTask && (
                    <span className="ml-2 text-xs text-success font-medium bg-success/10 px-1.5 py-0.5 rounded-full">
                      ✓ 已完成
                    </span>
                  )}
                </div>
              </div>
            )
          })()}
          {/* 年报到期 */}
          {(() => {
            const arTask = tasks.find(t => t.status === 'completed' && (
              t.title?.includes('NAR1') || t.title?.includes('年报') || t.title?.includes('年度申报') || t.title?.includes('Annual Return')
            ))
            const arOverdue = company.compliance?.arDueDate && new Date(company.compliance.arDueDate) < new Date()
            return (
              <div className="flex justify-between items-center">
                <span className="text-ink-2">年报到期</span>
                <div className="text-right">
                  <span className={arOverdue ? 'text-danger font-medium' : ''}>{formatDate(company.compliance?.arDueDate)}</span>
                  {arTask ? (
                    <span className="ml-2 text-xs text-success font-medium bg-success/10 px-1.5 py-0.5 rounded-full">
                      ✓ {formatDate(arTask.updatedAt || arTask.completedAt)} 完成
                    </span>
                  ) : arOverdue ? (
                    <span className="ml-2 text-xs text-danger font-medium">已逾期</span>
                  ) : null}
                </div>
              </div>
            )
          })()}
          {/* 商业登记证到期 */}
          {(() => {
            const brTask = tasks.find(t => t.status === 'completed' && (
              t.title?.includes('商业登记') || t.title?.includes('BR')
            ))
            return company.brExpiryDate ? (
              <div className="flex justify-between items-center">
                <span className="text-ink-2">商业登记证到期</span>
                <div className="text-right">
                  <span>{formatDate(company.brExpiryDate)}</span>
                  {brTask && (
                    <span className="ml-2 text-xs text-success font-medium bg-success/10 px-1.5 py-0.5 rounded-full">
                      ✓ 已完成
                    </span>
                  )}
                </div>
              </div>
            ) : null
          })()}
          <div className="flex justify-between"><span className="text-ink-2">上次 AGM</span><span>{formatDate(company.compliance?.lastAgmDate)}</span></div>
        </dl>
        {/* 合规任务完成概览 */}
        {tasks.filter(t => t.status === 'completed' && (
          t.type === 'compliance' || t.taskSource === 'compliance'
        )).length > 0 && (
          <div className="mt-3 pt-3 border-t border-hairline text-xs text-ink-3">
            已完成 {tasks.filter(t => t.status === 'completed' && (t.type === 'compliance' || t.taskSource === 'compliance')).length} 项合规任务
          </div>
        )}
      </div>
      {meetings.length > 0 && (
        <div className="card">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Calendar size={16} /> 近期会议</h3>
          <div className="space-y-2">
            {meetings.slice(0, 3).map(m => (
              <Link key={m._id} to={`/meetings/${m._id}`} className="flex items-center justify-between p-2 rounded-lg hover:bg-canvas text-sm">
                <span className="text-primary-600">{m.title}</span>
                <span className="text-ink-3">{formatDate(m.scheduledAt)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
      {/* 新增 Task 区域 — 在概览页直接可见，无需切换 Tab */}
      {tasks.length > 0 && (
        <div className="card">
          <h3 className="font-semibold mb-4 flex items-center justify-between"><CheckSquare size={16} /> 近期任务
            <Link to="/tasks" className="text-xs text-primary-600 hover:underline font-normal">查看全部 →</Link>
          </h3>
          <div className="space-y-2">
            {tasks.slice(0, 5).map(t => (
              <Link key={t._id} to={`/tasks/${t._id}`} className="flex items-center justify-between p-2 rounded-lg hover:bg-canvas text-sm group transition-colors">
                <span className="text-primary-600 truncate group-hover:underline">{t.title}</span>
                <span className={`tag shrink-0 ml-2 ${
                  t.status === 'completed' ? 'bg-success/10 text-success'
                  : t.status === 'in_progress' ? 'bg-info/10 text-primary-700'
                  : taskPriorityColor(t.priority)
                }`}>
                  {t.status === 'completed' ? 'completed' : t.priority}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    {/* v6.x 曾用名 / 合并记录卡 — 用户手填 + merge 接口产生 */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2"><History size={16} /> 曾用名 / 历史记录</h3>
          {!company.mergedInto && (
            <button
              onClick={() => setShowFormerNameModal(true)}
              className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              <Plus size={14} /> 添加
            </button>
          )}
        </div>
        {company.mergedInto ? (
          <p className="text-xs text-warning flex items-center gap-1.5">
            <GitMerge size={14} /> 此公司已合并到另一公司，formerNames 不可修改。
            <Link to={`/companies/${company.mergedInto}`} className="underline text-primary-600">查看目标公司</Link>
          </p>
        ) : (company.formerNames?.length || 0) === 0 ? (
          <p className="text-sm text-ink-3">尚无历史名。可手动添加或通过 Companies → 检测重复 → 合并产生。</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {company.formerNames.map((fn, idx) => (
              <li key={idx} className="flex items-start justify-between gap-2 py-2 px-3 rounded-lg hover:bg-canvas">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-ink-1 break-words">{fn.name}</div>
                  {fn.nameChinese && <div className="text-xs text-ink-3 mt-0.5 break-words">{fn.nameChinese}</div>}
                  <div className="text-xs text-ink-3 mt-0.5 flex flex-wrap items-center gap-2">
                    <span className={`badge text-[10px] ${
                      fn.source === 'merger' ? 'bg-warning/10 text-warning' :
                      fn.source === 'seed' ? 'bg-info/10 text-primary-700' :
                      'bg-canvas text-ink-3'
                    }`}>
                      {fn.source === 'merger' ? '合并自' : fn.source === 'seed' ? '系统引入' : '手动'}
                    </span>
                    {fn.changedAt && <span>{formatDate(fn.changedAt)}</span>}
                    {fn.notes && <span className="text-ink-3">· {fn.notes}</span>}
                  </div>
                </div>
                {fn.source !== 'merger' && (
                  <button
                    onClick={() => removeFormerName(idx)}
                    className="p-1 text-ink-3 hover:text-danger rounded"
                    title="删除（仅手动/seed 源；合并源不可删）"
                  >
                    <X size={14} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      {/* v6.x 曾用名新增 Modal */}
      {showFormerNameModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowFormerNameModal(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold">添加曾用名</h3>
            <FormField label="曾用英文名（必填）">
              <input className={inputClass} value={newFormerName} onChange={e => setNewFormerName(e.target.value)} placeholder="例如：OldCo Holdings Limited" />
            </FormField>
            <FormField label="曾用中文名（可选）">
              <input className={inputClass} value={newFormerNameChinese} onChange={e => setNewFormerNameChinese(e.target.value)} placeholder="例如：旧公司控股有限公司" />
            </FormField>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowFormerNameModal(false)} className="btn-secondary">取消</button>
              <button onClick={saveNewFormerName} disabled={addingFormerName || !newFormerName.trim()} className="btn-primary">
                {addingFormerName ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
