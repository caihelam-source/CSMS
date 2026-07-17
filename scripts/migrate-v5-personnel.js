#!/usr/bin/env node
'use strict';

/**
 * ============================================================
 *  Claw v5.0 数据迁移脚本
 *  Director / DirectorEntry / ShareholderEntry  →  Personnel + Company.links
 * ============================================================
 *
 *  ⚠️  执行前必读（DBA / 架构师复核清单）
 *  ------------------------------------------------------------
 *  1. 本脚本会写入数据库，属于破坏性操作。
 *  2. 默认行为是【只读演练 dry-run】，不写入任何数据，只打印预计影响。
 *  3. 真正写入需显式加 --execute，并会自动先做库内备份
 *     （克隆到 <coll>_pre_v5_<timestamp> 集合 + 一份 manifest JSON）。
 *  4. 执行前请确认已另有离线备份（mongodump），本脚本的库内备份
 *     仅用于快速回滚，不能替代离线备份。
 *  5. 迁移后请用 --verify 校验，并由 DBA 复核 report 再签字。
 *  6. 签字确认无误后，用 --cleanup-flags 清除迁移标记；
 *     若发现异常，用 --rollback <timestamp> 回滚。
 *
 *  用法：
 *    node scripts/migrate-v5-personnel.js                 # 只读演练，打印预计影响
 *    node scripts/migrate-v5-personnel.js --execute       # 备份 + 执行迁移
 *    node scripts/migrate-v5-personnel.js --execute --verify
 *    node scripts/migrate-v5-personnel.js --verify        # 仅校验当前库（重算 vs 实际）
 *    node scripts/migrate-v5-personnel.js --list          # 列出已有备份
 *    node scripts/migrate-v5-personnel.js --rollback <timestamp>
 *    node scripts/migrate-v5-personnel.js --cleanup-flags # 清除 v5Migrated 标记
 *
 *  环境变量：
 *    MONGODB_URI  默认 mongodb://127.0.0.1:27017/claw
 * ============================================================
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/claw';

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const argAfter = (f) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : null; };

const DRY_RUN = !has('--execute');
const DO_BACKUP = has('--execute') && !has('--no-backup');
const DO_VERIFY = has('--verify') || has('--execute');
const CREATE_MISSING_COMPANIES = !has('--no-create-missing-companies');
const ROLLBACK_TS = argAfter('--rollback');
const CLEANUP = has('--cleanup-flags');
const LIST = has('--list');

const TS = new Date().toISOString().replace(/[:.]/g, '-');

function classifyRole(position) {
  if (!position) return 'other';
  const p = String(position);
  if (/秘书|secretary/i.test(p)) return 'secretary';
  if (/董事|主席|chair|director|executive/i.test(p)) return 'director';
  return 'other';
}

// 容错取集合名（处理 mongoose 复数化歧义）
async function resolveColl(db, candidates) {
  const names = (await db.listCollections().toArray()).map((n) => n.name);
  const existing = new Set(names);
  for (const c of candidates) if (existing.has(c)) return c;
  return candidates[0];
}

function coll(db, name) { return db.collection(name); }

function blankPerson() {
  return {
    _id: new mongoose.Types.ObjectId(),
    name: '', nameChinese: '', nric: '', email: '', phone: '', nationality: '',
    address: { street: '', city: '', state: '', postalCode: '', country: '' },
    dateOfBirth: undefined, placeOfBirth: undefined, idType: undefined, idNumber: undefined,
    passportNumber: undefined, occupation: undefined,
    formerNameOrAlias: undefined, documentServiceAddress: undefined, usualResidentialAddress: undefined,
    notes: '',
    v5Migrated: true,
  };
}

const conflicts = [];
function setField(person, field, value, source) {
  if (value === undefined || value === null || value === '') return;
  if (person[field] === undefined || person[field] === null || person[field] === '') {
    person[field] = value;
  } else if (String(person[field]) !== String(value)) {
    conflicts.push({ source, field, existing: person[field], incoming: value });
  }
}
function setAddressStreet(person, street, source) {
  if (!street) return;
  const cur = person.address && person.address.street;
  if (!cur) { person.address = person.address || {}; person.address.street = street; }
  else if (cur !== street) { conflicts.push({ source, field: 'address.street', existing: cur, incoming: street }); }
}

function primaryKey(doc) {
  const idn = String(doc.idNumber || doc.nric || '').trim().toLowerCase();
  if (idn) return 'idn:' + idn;
  const email = String(doc.email || '').trim().toLowerCase();
  if (email) return 'email:' + email;
  const name = String(doc.name || '').trim().toLowerCase();
  if (name) return 'name:' + name;
  return null;
}

/**
 * 计算迁移计划（只读，不写库）。
 * 返回 { people, linksByCompany, createdCompanies, warnings, stats }
 */
async function computePlan(db) {
  const directorsName = await resolveColl(db, ['directors']);
  const dirEntriesName = await resolveColl(db, ['directorentries']);
  const shEntriesName = await resolveColl(db, ['shareholderentries']);
  const personnelName = await resolveColl(db, ['personnel']);
  const companiesName = await resolveColl(db, ['companies']);

  const directors = await coll(db, directorsName).find({}).toArray();
  const dirEntries = await coll(db, dirEntriesName).find({}).toArray();
  const shEntries = await coll(db, shEntriesName).find({}).toArray();
  const existingPersonnel = await coll(db, personnelName).find({ v5Migrated: { $ne: true } }).toArray();
  const companies = await coll(db, companiesName).find({}).toArray();

  const companyIds = new Set(companies.map((c) => String(c._id)));

  // 人员去重：key -> personObj
  const people = new Map();
  const peopleById = new Map();
  const anonCounter = { n: 0 };

  function getPerson(key, seed) {
    if (!key) key = 'anon:' + (anonCounter.n++);
    if (people.has(key)) return people.get(key);
    const p = blankPerson();
    if (seed) {
      setField(p, 'name', seed.name, 'seed');
      setField(p, 'nameChinese', seed.nameChinese, 'seed');
      setField(p, 'idNumber', seed.idNumber, 'seed');
      setField(p, 'email', seed.email, 'seed');
      setField(p, 'nationality', seed.nationality, 'seed');
      setField(p, 'occupation', seed.occupation, 'seed');
    }
    people.set(key, p);
    peopleById.set(String(p._id), p);
    return p;
  }
  function getPersonById(id) {
    const sid = String(id);
    if (peopleById.has(sid)) return peopleById.get(sid);
    const ex = existingPersonnel.find((e) => String(e._id) === sid);
    if (ex) {
      const p = Object.assign(blankPerson(), ex);
      p._id = ex._id; p.v5Migrated = false; p.isExisting = true;
      peopleById.set(sid, p);
      // 同时按 key 注册，便于后续同一人合并
      const k = primaryKey(ex) || ('id:' + sid);
      if (!people.has(k)) people.set(k, p);
      return p;
    }
    return null;
  }

  // 公司型股东：按需创建最小 Company 记录
  const createdCompanies = [];
  const createdCompanyByName = new Map();
  function ensureCompany(name) {
    if (createdCompanyByName.has(name)) return createdCompanyByName.get(name);
    const c = { _id: new mongoose.Types.ObjectId(), name, status: 'unknown', jurisdiction: 'Unknown', links: [], v5Migrated: true };
    createdCompanies.push(c);
    createdCompanyByName.set(name, c._id);
    return c._id;
  }

  const linksByCompany = new Map();
  const warnings = [];
  function addLink(companyId, link) {
    if (!companyId) return;
    if (!companyIds.has(String(companyId)) && !createdCompanyByNameHas(String(companyId))) {
      warnings.push(`链接指向不存在的公司 ${companyId}，已跳过`);
      return;
    }
    if (!linksByCompany.has(String(companyId))) linksByCompany.set(String(companyId), new Map());
    const m = linksByCompany.get(String(companyId));
    const lk = link.linkModel + ':' + String(link.link);
    if (m.has(lk)) {
      const ex = m.get(lk);
      for (const r of link.roles) if (!ex.roles.includes(r)) ex.roles.push(r);
      if (link.shares && (!ex.shares || link.shares > ex.shares)) ex.shares = link.shares;
      if (link.shareType && !ex.shareType) ex.shareType = link.shareType;
      if (link.appointmentDate && !ex.appointmentDate) ex.appointmentDate = link.appointmentDate;
      if (link.cessationDate && !ex.cessationDate) ex.cessationDate = link.cessationDate;
      if (link.formerNameOrAlias && !ex.formerNameOrAlias) ex.formerNameOrAlias = link.formerNameOrAlias;
      if (link.documentServiceAddress && !ex.documentServiceAddress) ex.documentServiceAddress = link.documentServiceAddress;
      if (link.usualResidentialAddress && !ex.usualResidentialAddress) ex.usualResidentialAddress = link.usualResidentialAddress;
      if (link.shareRecords && link.shareRecords.length) {
        for (const sr of link.shareRecords) {
          const dup = ex.shareRecords.some((e) => e.certificateNumber === sr.certificateNumber && String(e.transactionDate) === String(sr.transactionDate));
          if (!dup) ex.shareRecords.push(sr);
        }
      }
      if (link.notes && !(ex.notes || '').includes(link.notes)) ex.notes = [ex.notes, link.notes].filter(Boolean).join('; ');
    } else {
      m.set(lk, link);
    }
  }
  function createdCompanyByNameHas(id) { return [...createdCompanyByName.values()].some((v) => String(v) === String(id)); }

  // ---- 1) Director ----
  for (const d of directors) {
    const key = primaryKey({ name: d.name, nameChinese: d.nameChinese, idNumber: d.idNumber, email: d.email }) || ('anon:' + String(d._id));
    const p = getPerson(key, { name: d.name, nameChinese: d.nameChinese, idNumber: d.idNumber, email: d.email });
    setField(p, 'name', d.name, 'Director');
    setField(p, 'nameChinese', d.nameChinese, 'Director');
    setField(p, 'dateOfBirth', d.dateOfBirth, 'Director');
    setField(p, 'idNumber', d.idNumber, 'Director');
    setField(p, 'passportNumber', d.passportNumber, 'Director');
    setField(p, 'email', d.email, 'Director');
    setField(p, 'phone', d.phone, 'Director');
    setField(p, 'nationality', d.nationality, 'Director');
    setAddressStreet(p, d.residentialAddress, 'Director');
    if (d.correspondenceAddress && d.correspondenceAddress !== d.residentialAddress) {
      p.notes = [p.notes, '通讯地址: ' + d.correspondenceAddress].filter(Boolean).join('; ');
    }
    for (const a of (d.appointments || [])) {
      const role = classifyRole(a.position);
      addLink(a.company, {
        linkModel: 'Personnel', link: p._id, roles: [role],
        appointmentDate: a.appointedDate || undefined,
        cessationDate: a.resignedDate || undefined,
        notes: a.status === '离任' ? '离任' : (a.status || ''),
        shareRecords: [], v5Migrated: true,
      });
    }
  }

  // ---- 2) DirectorEntry (ROD 登记册) ----
  for (const e of dirEntries) {
    let p;
    if (e.personnelRef) {
      p = getPersonById(e.personnelRef) || getPerson(primaryKey({ name: e.fullName, nameChinese: e.fullNameChinese, idNumber: e.idNumber, email: '' }) || ('anon:' + String(e._id)), { name: e.fullName, nameChinese: e.fullNameChinese, idNumber: e.idNumber });
    } else {
      p = getPerson(primaryKey({ name: e.fullName, nameChinese: e.fullNameChinese, idNumber: e.idNumber, email: '' }) || ('anon:' + String(e._id)), { name: e.fullName, nameChinese: e.fullNameChinese, idNumber: e.idNumber });
    }
    setField(p, 'name', e.fullName, 'DirectorEntry');
    setField(p, 'nameChinese', e.fullNameChinese, 'DirectorEntry');
    setField(p, 'formerNameOrAlias', e.formerNameOrAlias, 'DirectorEntry');
    setField(p, 'dateOfBirth', e.dateOfBirth, 'DirectorEntry');
    setField(p, 'placeOfBirth', e.placeOfBirth, 'DirectorEntry');
    setField(p, 'nationality', e.nationality, 'DirectorEntry');
    setField(p, 'idType', e.idType, 'DirectorEntry');
    setField(p, 'idNumber', e.idNumber, 'DirectorEntry');
    setField(p, 'documentServiceAddress', e.documentServiceAddress, 'DirectorEntry');
    setField(p, 'usualResidentialAddress', e.usualResidentialAddress, 'DirectorEntry');
    setField(p, 'occupation', e.occupation, 'DirectorEntry');

    const role = e.positionType === '公司秘书' ? 'secretary' : (e.positionType === '其他' ? 'other' : 'director');
    const notes = [e.remarks, e.entryMadeBy ? ('登记人:' + e.entryMadeBy) : '', (!e.isCurrent ? '离任(ROD)' : '')].filter(Boolean).join('; ');
    addLink(e.company, {
      linkModel: 'Personnel', link: p._id, roles: [role],
      appointmentDate: e.dateOfAppointment || undefined,
      cessationDate: e.dateOfCessation || undefined,
      formerNameOrAlias: e.formerNameOrAlias || undefined,
      documentServiceAddress: e.documentServiceAddress || undefined,
      usualResidentialAddress: e.usualResidentialAddress || undefined,
      notes, shareRecords: [], v5Migrated: true,
    });
  }

  // ---- 3) ShareholderEntry ----
  for (const s of shEntries) {
    let ref = null;
    if (s.shareholderType === '公司') {
      if (s.companyRef) ref = { model: 'Company', id: s.companyRef };
      else if (s.shareholderName && CREATE_MISSING_COMPANIES) {
        const cid = ensureCompany(s.shareholderName);
        ref = { model: 'Company', id: cid };
        warnings.push(`公司型股东无 companyRef，已按名称创建最小 Company 记录: "${s.shareholderName}"`);
      } else {
        warnings.push(`ShareholderEntry ${s._id} 为公司类型但无 companyRef/名称，已跳过`);
      }
    } else {
      if (s.personnelRef) {
        const pp = getPersonById(s.personnelRef);
        ref = { model: 'Personnel', id: (pp && pp._id) || s.personnelRef };
      } else {
        const p = getPerson(primaryKey({ name: s.shareholderName, nameChinese: s.shareholderNameChinese, idNumber: '', email: '' }) || ('anon:' + String(s._id)), { name: s.shareholderName, nameChinese: s.shareholderNameChinese, occupation: s.shareholderOccupation });
        setAddressStreet(p, s.shareholderAddress, 'ShareholderEntry');
        setField(p, 'occupation', s.shareholderOccupation, 'ShareholderEntry');
        ref = { model: 'Personnel', id: p._id };
      }
    }
    if (ref) {
      const shareRecords = (s.shareRecords || []).map((r) => ({
        transactionType: r.transactionType, distinctiveNumberFrom: r.distinctiveNumberFrom,
        distinctiveNumberTo: r.distinctiveNumberTo, certificateNumber: r.certificateNumber,
        transferDeed: r.transferDeed, considerationPaid: r.considerationPaid,
        numberOfShares: r.numberOfShares, transactionDate: r.transactionDate,
      }));
      addLink(s.company, {
        linkModel: ref.model, link: ref.id, roles: ['shareholder'],
        shares: s.totalSharesHeld || undefined,
        shareType: s.totalSharesHeld ? 'ordinary' : undefined,
        appointmentDate: s.dateEnteredAsMember || undefined,
        cessationDate: s.dateCeasedAsMember || undefined,
        notes: [s.remarks, (!s.isCurrentMember ? '已退出成员' : '')].filter(Boolean).join('; '),
        shareRecords, v5Migrated: true,
      });
    }
  }

  const stats = {
    directors: directors.length,
    directorEntries: dirEntries.length,
    shareholderEntries: shEntries.length,
    existingPersonnel: existingPersonnel.length,
    companies: companies.length,
    newPersonnel: [...people.values()].filter((p) => !p.isExisting).length,
    mergedIntoExisting: [...people.values()].filter((p) => p.isExisting).length,
    linksToAdd: [...linksByCompany.values()].reduce((a, m) => a + m.size, 0),
    createdCompanies: createdCompanies.length,
    conflicts: conflicts.length,
    warnings: warnings.length,
  };
  return { people, linksByCompany, createdCompanies, warnings, stats };
}

async function backup(db, ts) {
  const legacy = ['directors', 'directorentries', 'shareholderentries', 'companies', 'personnel'];
  const manifest = { ts, uri: MONGODB_URI, collections: {} };
  for (const name of legacy) {
    const docs = await coll(db, name).find({}).toArray();
    const bak = name + '_pre_v5_' + ts;
    await coll(db, bak).deleteMany({});
    if (docs.length) await coll(db, bak).insertMany(docs);
    manifest.collections[name] = { backup: bak, count: docs.length };
  }
  const mf = path.join(__dirname, 'migrate-v5-manifest-' + ts + '.json');
  fs.writeFileSync(mf, JSON.stringify(manifest, null, 2));
  return mf;
}

async function writePlan(db, plan) {
  const personnelName = await resolveColl(db, ['personnel']);
  const companiesName = await resolveColl(db, ['companies']);

  // 1) personnel：新建插入，已有更新（仅填充空字段，不覆盖）
  for (const p of plan.people.values()) {
    const doc = {};
    for (const [k, v] of Object.entries(p)) {
      if (k === '_id' || k === 'isExisting' || k === 'roles') continue;
      if (v === undefined) continue;
      doc[k] = v;
    }
    if (p.isExisting) {
      await coll(db, personnelName).updateOne({ _id: p._id }, { $set: doc });
    } else {
      await coll(db, personnelName).insertOne(doc);
    }
  }

  // 2) 插入新建的公司型股东
  for (const c of plan.createdCompanies) {
    await coll(db, companiesName).insertOne(c);
  }

  // 3) 逐公司写入 links（保留既有非 v5 链接，追加新链接）
  for (const [companyId, linkMap] of plan.linksByCompany) {
    const cur = await coll(db, companiesName).findOne({ _id: new mongoose.Types.ObjectId(companyId) }, { projection: { links: 1 } });
    const base = (cur && cur.links ? cur.links : []).filter((l) => !l.v5Migrated);
    const added = [...linkMap.values()].map((l) => {
      const o = {};
      for (const [k, v] of Object.entries(l)) if (v !== undefined) o[k] = v;
      return o;
    });
    await coll(db, companiesName).updateOne(
      { _id: new mongoose.Types.ObjectId(companyId) },
      { $set: { links: base.concat(added) } }
    );
  }
}

async function verify(db) {
  console.log('\n=== 校验 (verify) ===');
  const plan = await computePlan(db); // 重算预期
  const companiesName = await resolveColl(db, ['companies']);
  const personnelName = await resolveColl(db, ['personnel']);

  const companies = await coll(db, companiesName).find({}).toArray();
  const personnel = await coll(db, personnelName).find({}).toArray();
  const personnelIds = new Set(personnel.map((p) => String(p._id)));
  const companyIds = new Set(companies.map((c) => String(c._id)));

  let actualLinks = 0; const roleCount = {}; const orphans = [];
  for (const c of companies) {
    for (const l of (c.links || [])) {
      actualLinks++;
      for (const r of (l.roles || [])) roleCount[r] = (roleCount[r] || 0) + 1;
      const target = l.linkModel === 'Personnel' ? personnelIds : companyIds;
      if (!target.has(String(l.link))) orphans.push({ company: c._id, link: l.link, model: l.linkModel });
    }
  }

  const expectedLinks = plan.stats.linksToAdd;
  const expectedNewPersonnel = plan.stats.newPersonnel;
  const actualNewPersonnel = personnel.filter((p) => p.v5Migrated).length;

  console.log('预期新增 links:', expectedLinks, '| 实际 links:', actualLinks);
  console.log('预期新建 Personnel:', expectedNewPersonnel, '| 实际 v5Migrated Personnel:', actualNewPersonnel);
  console.log('角色分布(实际):', JSON.stringify(roleCount));
  console.log('孤儿链接(指向不存在的记录):', orphans.length);
  orphans.slice(0, 20).forEach((o) => console.log('  -', JSON.stringify(o)));

  const pass = (expectedLinks === actualLinks) && (expectedNewPersonnel === actualNewPersonnel) && orphans.length === 0;
  console.log(pass ? '✅ 校验通过' : '⚠️ 校验存在差异，请人工复核');
  return pass;
}

async function rollback(ts) {
  if (!ts) { console.error('请指定回滚时间戳：--rollback <timestamp>'); process.exit(1); }
  const mf = path.join(__dirname, 'migrate-v5-manifest-' + ts + '.json');
  if (!fs.existsSync(mf)) { console.error('找不到 manifest:', mf); process.exit(1); }
  const manifest = JSON.parse(fs.readFileSync(mf, 'utf8'));
  const db = mongoose.connection.db;
  for (const [name, info] of Object.entries(manifest.collections)) {
    const bakDocs = await coll(db, info.backup).find({}).toArray();
    await coll(db, name).deleteMany({});
    if (bakDocs.length) await coll(db, name).insertMany(bakDocs);
    console.log(`恢复 ${name} <- ${info.backup} (${bakDocs.length} 条)`);
  }
  const personnelName = await resolveColl(db, ['personnel']);
  const companiesName = await resolveColl(db, ['companies']);
  const r1 = await coll(db, personnelName).deleteMany({ v5Migrated: true });
  const r2 = await coll(db, companiesName).deleteMany({ v5Migrated: true });
  const r3 = await coll(db, companiesName).updateMany({}, { $pull: { links: { v5Migrated: true } } });
  console.log(`清除迁移数据: 新建Personnel ${r1.deletedCount}, 新建Company ${r2.deletedCount}, 剥离links ${r3.modifiedCount}`);
  console.log('✅ 回滚完成');
}

async function cleanupFlags(db) {
  const personnelName = await resolveColl(db, ['personnel']);
  const companiesName = await resolveColl(db, ['companies']);
  await coll(db, personnelName).updateMany({ v5Migrated: true }, { $unset: { v5Migrated: '' } });
  await coll(db, companiesName).updateMany({ v5Migrated: true }, { $unset: { v5Migrated: '' } });
  await coll(db, companiesName).updateMany({}, { $unset: { 'links.$[].v5Migrated': '' } });
  console.log('✅ 已清除 v5Migrated 迁移标记');
}

async function listBackups(db) {
  const names = (await db.listCollections().toArray()).map((n) => n.name);
  const backs = names.filter((n) => /_pre_v5_/.test(n));
  console.log('已有备份集合:');
  backs.forEach((b) => console.log('  -', b));
  const manifests = fs.readdirSync(__dirname).filter((f) => /^migrate-v5-manifest-.*\.json$/.test(f));
  console.log('已有 manifest:');
  manifests.forEach((m) => console.log('  -', m));
}

function printReport(plan) {
  console.log('\n========== Claw v5.0 迁移演练报告 (DRY-RUN, 未写入) ==========');
  console.log('源数据统计:');
  console.log('  Director 记录:', plan.stats.directors);
  console.log('  DirectorEntry 记录:', plan.stats.directorEntries);
  console.log('  ShareholderEntry 记录:', plan.stats.shareholderEntries);
  console.log('  现有 Company:', plan.stats.companies, '| 现有 Personnel:', plan.stats.existingPersonnel);
  console.log('预计产出:');
  console.log('  新建 Personnel:', plan.stats.newPersonnel);
  console.log('  合并进已有 Personnel:', plan.stats.mergedIntoExisting);
  console.log('  新增 Company.links:', plan.stats.linksToAdd);
  console.log('  新建公司型股东 Company:', plan.stats.createdCompanies);
  console.log('字段冲突(需 DBA 复核):', plan.stats.conflicts);
  console.log('警告:', plan.stats.warnings);
  if (conflicts.length) {
    console.log('\n--- 字段冲突明细(前20条) ---');
    conflicts.slice(0, 20).forEach((c) => console.log('  ', JSON.stringify(c)));
  }
  if (plan.warnings.length) {
    console.log('\n--- 警告明细(前20条) ---');
    plan.warnings.slice(0, 20).forEach((w) => console.log('  -', w));
  }
  console.log('\n下一步: 复核以上数据后，运行');
  console.log('  node scripts/migrate-v5-personnel.js --execute --verify');
  console.log('==============================================================\n');
}

async function main() {
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  // mongoose 8: listCollections / collection 在原生 Db 上，Connection 上不存在
  const db = mongoose.connection.db;
  console.log('已连接:', MONGODB_URI);

  if (LIST) { await listBackups(db); await mongoose.disconnect(); return; }
  if (ROLLBACK_TS) { await rollback(ROLLBACK_TS); await mongoose.disconnect(); return; }
  if (CLEANUP) { await cleanupFlags(db); await mongoose.disconnect(); return; }

  const plan = await computePlan(db);

  if (DRY_RUN) {
    printReport(plan);
    await mongoose.disconnect();
    return;
  }

  // 真正执行
  console.log('⚠️ 正在执行写入迁移（非演练）...');
  let mf = null;
  if (DO_BACKUP) { mf = await backup(db, TS); console.log('库内备份完成:', mf); }
  await writePlan(db, plan);
  console.log('迁移写入完成。');
  printReport(plan);

  if (DO_VERIFY) {
    const ok = await verify(db);
    if (!ok) { console.log('校验未完全通过，请复核。如需回滚：--rollback', TS); }
  }
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('迁移脚本错误:', err);
  process.exit(1);
});
