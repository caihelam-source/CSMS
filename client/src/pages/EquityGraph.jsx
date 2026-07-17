import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Building2, Users, Network, ArrowDown } from 'lucide-react'
import { companyService } from '../services/index.js'
import { LoadingSpinner, jurisdictionLabel } from '../components/UIHelpers'

const MAX_DEPTH = 5

// 递归构建股权穿透树：从选定公司出发，向下穿透其「公司类股东」的股东结构
async function buildTree(rootId, visited, depth) {
  if (visited.has(rootId) || depth > MAX_DEPTH) return null
  visited.add(rootId)
  let c
  try {
    const { data } = await companyService.getOne(rootId)
    c = data?.data
  } catch {
    return null
  }
  if (!c) return null

  const links = c.links || []
  const shareholderLinks = links.filter(l => (l.roles || []).includes('shareholder'))
  const directorLinks = links.filter(l => (l.roles || []).some(r => ['director', 'secretary', 'alternate_director'].includes(r)))

  const children = []
  for (const sh of shareholderLinks) {
    if (sh.linkModel === 'Company' && sh.link?._id && !visited.has(sh.link._id)) {
      const sub = await buildTree(sh.link._id, visited, depth + 1)
      if (sub) {
        sub.relationship = {
          shares: sh.shares,
          shareType: sh.shareType,
          appointedDate: sh.appointedDate,
        }
        children.push(sub)
      }
    }
  }
  return { company: c, shareholderLinks, directorLinks, children }
}

function sharePercent(shares, totalPaidUp) {
  if (!shares || !totalPaidUp) return '-'
  const pct = (shares / totalPaidUp) * 100
  return Number.isFinite(pct) ? `${pct.toFixed(2)}%` : '-'
}

function TreeNode({ node, relationship, depth }) {
  const { company, shareholderLinks, directorLinks, children } = node
  const totalPaidUp = company.shareCapital?.paidUp
  const personShareholders = shareholderLinks.filter(l => l.linkModel === 'Personnel')

  return (
    <div className="relative">
      <div className="bg-surface rounded-xl border border-hairline shadow-sm p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-2 bg-primary-50 rounded-lg shrink-0"><Building2 size={18} className="text-primary-600" /></div>
            <div className="min-w-0">
              <Link to={`/companies/${company._id}`} className="font-semibold text-ink hover:text-primary-600 truncate block">{company.name}</Link>
              <p className="text-xs text-ink-3">{company.registrationNumber} · {jurisdictionLabel(company.jurisdiction)}</p>
            </div>
          </div>
          {relationship && (
            <div className="shrink-0 text-right">
              <span className="inline-block px-2 py-1 bg-success/10 text-success border border-success/20 rounded-lg text-xs font-medium">
                持股 {(relationship.shares || 0).toLocaleString()} {relationship.shareType || '普通'} 股
              </span>
              <p className="text-xs text-ink-3 mt-1">占比 {sharePercent(relationship.shares, totalPaidUp)}</p>
            </div>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-4 text-xs text-ink-2">
          <span>已发行：{(company.shareCapital?.issued || 0).toLocaleString()} {company.shareCapital?.currency || 'HKD'}</span>
          <span>已缴：{(totalPaidUp || 0).toLocaleString()} {company.shareCapital?.currency || 'HKD'}</span>
          <span className="flex items-center gap-1"><Users size={12} />{directorLinks.length} 位董事/秘书</span>
        </div>

        {/* 个人股东 */}
        {personShareholders.length > 0 && (
          <div className="mt-3 pt-3 border-t border-hairline">
            <p className="text-xs font-medium text-ink-3 mb-1">个人股东</p>
            <div className="flex flex-wrap gap-2">
              {personShareholders.map(l => (
                <Link key={l._id} to={`/personnel/${l.link?._id}`}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-canvas border border-hairline rounded-lg text-xs hover:bg-gray-100">
                  <Users size={11} /> {l.link?.name || '未知'}
                  <span className="text-ink-3">{(l.shares || 0).toLocaleString()} 股</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* 董事/秘书 */}
        {directorLinks.length > 0 && (
          <div className="mt-3 pt-3 border-t border-hairline">
            <p className="text-xs font-medium text-ink-3 mb-1">董事 / 公司秘书</p>
            <div className="flex flex-wrap gap-2">
              {directorLinks.map(l => (
                <Link key={l._id} to={`/personnel/${l.link?._id}`}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-info/10 border border-info/20 rounded-lg text-xs text-primary-700 hover:bg-info/10">
                  {l.link?.name || '未知'}
                  <span className="text-primary-400">{(l.roles || []).join('/')}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 子节点（公司类股东） */}
      {children.length > 0 && (
        <div className="mt-4 ml-6 space-y-4 border-l-2 border-dashed border-hairline pl-6">
          {children.map(child => (
            <div key={child.company._id}>
              <div className="flex items-center gap-1 text-gray-300 text-xs mb-1"><ArrowDown size={12} /> 穿透至下层股东</div>
              <TreeNode node={child} relationship={child.relationship} depth={depth + 1} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function EquityGraph({ companyId }) {
  const [tree, setTree] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const visited = new Set()
      const t = await buildTree(companyId, visited, 0)
      setTree(t)
    } catch {
      toast.error('无法生成股权架构图')
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => { load() }, [load])

  if (loading) return <LoadingSpinner text="穿透计算中..." />
  if (!tree) return <p className="text-ink-3 text-sm">无法加载股权架构</p>

  const hasCompanyShareholders = tree.shareholderLinks.some(l => l.linkModel === 'Company')

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-ink-2">
        <Network size={16} className="text-primary-600" />
        <span>从 <strong className="text-ink">{tree.company.name}</strong> 出发，按股东记录向下穿透（最多 {MAX_DEPTH} 层）。点击任意公司/人员可查看详情。</span>
      </div>
      {!hasCompanyShareholders && (
        <div className="bg-canvas border border-hairline rounded-lg p-3 text-sm text-ink-2">
          该公司暂无「公司类股东」记录，股权结构仅限于自然人股东与董事（见上方卡片）。
        </div>
      )}
      <TreeNode node={tree} relationship={null} depth={0} />
    </div>
  )
}
