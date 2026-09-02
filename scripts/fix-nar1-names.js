/**
 * fix-nar1-names.js — 用「修复后」的 NAR1 识别结果，回填 Atlas 中已落库但人名错误的 Personnel/Company
 *
 * 背景：seed-nar1-full.js 只 create-missing（已存在则 skip），所以早期用「buggy 识别」落库的人名
 * （漏姓氏 / 漏中文名，如 CAIHE / NANLU / SHI Nanlu）不会被覆盖。本脚本专门修正这些人名。
 *
 * 匹配策略（只读 Atlas 后构建计划）：
 *   - 公司：按 registrationNumber（=BR号）找 Atlas 公司；找不到则回退按 name 找。
 *   - 人员：取该公司 Company.links 中 linkModel='Personnel' 的活跃人员，与「修复后」识别结果匹配：
 *       1) 精确 nameChinese 命中（中文名是稳定锚）
 *       2) 否则英文去空格大写相互包含（镜像 personnelDedup PINYIN 逻辑：NANLU⊂SHINANLU / CAIHE⊂LINCAIHE）
 *   - 命中且当前 name/nameChinese 与修复值不同 → 进入重命名计划；未命中 → 列入 unmatched 供人工复核。
 *
 * 用法：
 *   node scripts/fix-nar1-names.js            # DRY-RUN：只读，打印 重命名计划 + 未命中，不写库
 *   node scripts/fix-nar1-names.js --apply    # 真写：回填 name/nameChinese（Company 同名同步）
 *
 * 门禁：连 Atlas 需 DNS override（公共 DNS）+ Bash 跑时 dangerouslyDisableSandbox:true（沙箱 egress 拦 mongodb）。
 */
'use strict'

const fs = require('fs')
const path = require('path')
const dns = require('dns')
try { dns.setServers(['8.8.8.8', '1.1.1.1']) } catch (e) { console.log('⚠️ 无法设置 DNS resolver:', e.message) }
const mongoose = require('mongoose')

function parseSecrets() {
  const p = path.join(__dirname, '..', '.workbuddy', 'memory', 'SECRETS.md')
  if (!fs.existsSync(p)) return {}
  const txt = fs.readFileSync(p, 'utf8')
  const out = {}
  const m = txt.match(/mongodb\+srv:\/\/\S+/i)
  if (m) out.MONGODB_URI = m[0].replace(/["'`)\]]/g, '').trim()
  return out
}
const SEC = parseSecrets()
process.env.MONGODB_URI = process.env.MONGODB_URI || SEC.MONGODB_URI
const APPLY = process.argv.includes('--apply')
const DRY = !APPLY

const Personnel = require('../server/models/Personnel')
const Company = require('../server/models/Company')

// ---------- 构建「修复后」权威名单（按 BR/registrationNumber 索引） ----------
function buildCorrected() {
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '_nar1_recognized.json'), 'utf8'))
  const results = raw.results || raw
  const byReg = {}
  for (const r of results) {
    const c = r.company || {}
    const reg = c.registrationNumber || c.brNumber
    if (!reg) continue
    const persons = []
    for (const grp of ['companySecretary', 'directors', 'shareholders']) {
      for (const p of (r[grp] || [])) {
        if (!p || !p.name) continue
        // 规范化为「全大写 + 单空格」(HK 姓名标准写法)，消除同人不同大小写(如 SHI Nanlu / SHI NANLU)
        const canon = String(p.name).toUpperCase().replace(/\s+/g, ' ').trim()
        persons.push({ role: p.role || grp.replace('companySecretary', 'secretary'), name: canon, nameChinese: p.nameChinese || undefined })
      }
    }
    byReg[reg] = { company: c, persons }
  }
  return byReg
}

function norm(s) { return String(s || '').toUpperCase().replace(/\s+/g, '') }

async function main() {
  if (!process.env.MONGODB_URI) { console.error('❌ 未找到 MONGODB_URI（SECRETS.md 缺失）'); process.exit(2) }
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 })
  console.log('✅ 已连 Atlas')

  const byReg = buildCorrected()
  console.log(`📋 修复后识别结果覆盖 ${Object.keys(byReg).length} 家公司`)

  const plan = []      // { kind, id, company, current, currentC, next, nextC }
  const unmatched = [] // { id, company, name, nameChinese }
  const companySkipped = []

  for (const reg of Object.keys(byReg)) {
    const { company: corr, persons } = byReg[reg]
    let company = await Company.findOne({ registrationNumber: reg, status: { $ne: 'merged' } })
    if (!company) company = await Company.findOne({ name: corr.name, status: { $ne: 'merged' } })
    if (!company) { companySkipped.push(reg + ' (' + corr.name + ')'); continue }

    // 公司名同步（修复后名称为权威；旧落库公司名本应正确，仅作保险）
    if (company.name !== corr.name || (corr.nameChinese && company.nameChinese !== corr.nameChinese)) {
      plan.push({ kind: 'company', id: String(company._id), company: company.name, current: company.name, currentC: company.nameChinese, next: corr.name, nextC: corr.nameChinese })
    }

    const linkRefs = (company.links || []).filter((l) => l.linkModel === 'Personnel').map((l) => l.link)
    if (!linkRefs.length) continue
    const personnel = await Personnel.find({ _id: { $in: linkRefs }, status: { $ne: 'merged' } })
    for (const per of personnel) {
      let match = persons.find((pp) => pp.nameChinese && per.nameChinese && pp.nameChinese === per.nameChinese)
      if (!match) {
        const n = norm(per.name)
        if (n) match = persons.find((pp) => { const cn = norm(pp.name); return cn && (cn.includes(n) || n.includes(cn)) })
      }
      if (match) {
        if (per.name !== match.name || per.nameChinese !== match.nameChinese) {
          plan.push({ kind: 'personnel', id: String(per._id), company: company.name, current: per.name, currentC: per.nameChinese, next: match.name, nextC: match.nameChinese })
        }
      } else {
        unmatched.push({ id: String(per._id), company: company.name, name: per.name, nameChinese: per.nameChinese })
      }
    }
  }

  console.log('\n========== 重命名计划 ==========')
  if (!plan.length) console.log('（无需要修改的姓名）')
  for (const p of plan) {
    console.log(`[${p.kind}] ${p.company}\n    ${p.current}${p.currentC ? ' / ' + p.currentC : ''}  →  ${p.next}${p.nextC ? ' / ' + p.nextC : ''}   (id=${p.id})`)
  }
  console.log('\n========== 未命中（需人工复核） ==========')
  if (!unmatched.length) console.log('（无）')
  for (const u of unmatched) console.log(`[${u.company}] ${u.name}${u.nameChinese ? ' / ' + u.nameChinese : ''}  (id=${u.id})`)
  console.log('\n========== 公司未找到（跳过） ==========')
  if (!companySkipped.length) console.log('（无）')
  for (const s of companySkipped) console.log('  ' + s)

  console.log(`\n统计: 计划修改 ${plan.length} 项（公司 ${plan.filter((p) => p.kind === 'company').length} / 人员 ${plan.filter((p) => p.kind === 'personnel').length}），未命中 ${unmatched.length}，公司跳过 ${companySkipped.length}`)

  if (DRY) {
    console.log('\n🔍 DRY-RUN 完成，未做任何修改。确认无误后加 --apply 执行。')
  } else {
    let done = 0
    for (const p of plan) {
      if (p.kind === 'personnel') {
        await Personnel.findByIdAndUpdate(p.id, { name: p.next, nameChinese: p.nextC }, { runValidators: false })
      } else {
        const set = { name: p.next }
        if (p.nextC) set.nameChinese = p.nextC
        await Company.findByIdAndUpdate(p.id, set, { runValidators: false })
      }
      done++
    }
    console.log(`\n✅ 已写入 ${done} 项修改。`)
  }

  await mongoose.disconnect()
}

main().catch((e) => { console.error('❌ 失败:', e); process.exit(1) })
