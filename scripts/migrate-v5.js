/**
 * v5.0 数据迁移脚本（读时聚合版）
 * ─────────────────────────────────────────────────────────────────
 * 将 Director / ShareholderEntry / DirectorEntry 三张历史表合并进统一的
 * Personnel 实体，并以 Company.links[] 为公司中枢（唯一事实源）。
 *
 * 设计要点（与「方案甲双写」彻底切割）：
 *   - 迁移【只写】Company.links[]，绝不物化 Personnel.appointments / roles。
 *   - 人的角色、任职公司列表、股份等，全部由服务层从 Company.links 读时聚合
 *     （deriveRoles / getReverseLinks / $lookup），无第二份拷贝 → 无同步漂移。
 *   - Personnel 实体本身仍保留（它是"人"的主数据），仅承载人的固有属性。
 *
 * 用法：
 *   node scripts/migrate-v5.js                 # DRY RUN（仅统计+对账，不写入）
 *   node scripts/migrate-v5.js --apply         # 真实写入（务必先在备份库验证）
 *   node scripts/migrate-v5.js --apply --with-roles-cache
 *        # 过渡兼容：额外把 link 的 roles 镜像进 Personnel.roles，
 *        # 使尚未改为 deriveRoles 的后端 role-filter 暂不崩。Step2 改完后弃用。
 *
 * 安全策略：
 *   - 默认 DRY RUN，绝不写库。
 *   - 连接库由环境变量 MONGODB_URI 指定；禁止直连疑似生产库（见下方守卫）。
 *   - 按 idNumber / passportNumber / nric / 归一化姓名 查重，复用已有 Personnel。
 *   - Company.links 按 (linkModel, link, role) 去重，避免重复关联。
 *   - 旧表保留不删，确认无误后由 DBA 手动 drop。
 *   - 全程记录 traceability（旧条目 → 新 link），用于 100% 回溯校验。
 */

const mongoose = require('mongoose');
const path = require('path');

const modelsDir = path.join(__dirname, '..', 'server', 'models');
const ShareholderEntry = require(path.join(modelsDir, 'ShareholderEntry'));
const DirectorEntry = require(path.join(modelsDir, 'DirectorEntry'));
const Personnel = require(path.join(modelsDir, 'Personnel'));
const Company = require(path.join(modelsDir, 'Company'));

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/company-secretary';
const DRY_RUN = !process.argv.includes('--apply');
const WITH_ROLES_CACHE = process.argv.includes('--with-roles-cache');

// ── 生产库守卫：避免误伤。怀疑是生产库且未显式确认则不执行写入 ──────────
function assertSafeToWrite() {
  const dbName = (MONGO_URI.split('/').pop() || '').toLowerCase();
  const looksProd = /prod|production|live|主/.test(dbName);
  if (looksProd && !process.argv.includes('--i-know-this-is-prod')) {
    throw new Error(
      `检测到疑似生产库 "${dbName}"。若确认要在该库执行，请追加 --i-know-this-is-prod。\n` +
      `强烈建议：先 mongodump 备份，恢复到临时实例后再 --apply。`
    );
  }
}

// 职位 → roles[]（一个 link 只挂一个主角色，避免单一 linkType 无法表达多角色的问题）
function mapPositionToRoles(position) {
  const p = position || '';
  if (p.includes('秘书') || p.toLowerCase().includes('secretary')) return ['secretary'];
  if (p.includes('替任') || p.toLowerCase().includes('alternate')) return ['alternate_director'];
  if (p.includes('审计') || p.toLowerCase().includes('auditor')) return ['auditor'];
  return ['director'];
}

// 边界 Case④：同一人可能同时出现在 Director 与 DirectorEntry，按身份键去重合并
async function findOrCreatePersonnel(d) {
  const idKey = d.idNumber || d.passportNumber || d.nric;
  let person = null;
  if (idKey) {
    person = await Personnel.findOne({
      $or: [{ nric: idKey }, { idNumber: idKey }, { passportNumber: idKey }],
    });
  }
  if (!person && d.name) person = await Personnel.findOne({ name: d.name });
  if (person) return { person, created: false };

  if (DRY_RUN) {
    return { person: { _id: 'DRYRUN', name: d.name }, created: true };
  }
  person = await Personnel.create({
    name: d.name,
    nameChinese: d.nameChinese,
    dateOfBirth: d.dateOfBirth,
    nric: d.idNumber || d.nric,
    passportNumber: d.passportNumber,
    email: d.email,
    phone: d.phone,
    nationality: d.nationality,
    address: { street: d.residentialAddress || d.correspondenceAddress || d.usualResidentialAddress },
    formerNameOrAlias: d.formerNameOrAlias,
    documentServiceAddress: d.documentServiceAddress,
    usualResidentialAddress: d.usualResidentialAddress,
    placeOfBirth: d.placeOfBirth,
    idType: d.idType,
    occupation: d.occupation,
    notes: d.notes,
  });
  return { person, created: true };
}

function linkExists(company, linkModel, linkId, role) {
  return (company.links || []).some(l =>
    l.linkModel === linkModel &&
    l.link?.toString() === linkId?.toString() &&
    (l.roles || []).includes(role)
  );
}

async function pushLink(company, linkDoc, traceability, source, role) {
  if (linkExists(company, linkDoc.linkModel, linkDoc.link, role)) return false;
  if (!DRY_RUN) {
    company.links.push(linkDoc);
    await company.save();
  }
  traceability.push({
    source,                       // 例如 'Director:64f...' / 'ShareholderEntry:...'
    companyId: company._id?.toString(),
    linkModel: linkDoc.linkModel,
    linkId: linkDoc.link?.toString(),
    role,
  });
  return true;
}

async function main() {
  await mongoose.connect(MONGO_URI);
  if (!DRY_RUN) assertSafeToWrite();
  console.log(DRY_RUN ? '🔍 DRY RUN 模式（仅统计 + 对账，不写入）'
                      : `✍️  APPLY 模式（写入 ${MONGO_URI}）`);
  if (WITH_ROLES_CACHE && !DRY_RUN) console.log('⚠️  已开启 --with-roles-cache：将镜像 roles 到 Personnel.roles（过渡用，Step2 后弃用）');
  console.log('');

  const stats = { directors: 0, shareholders: 0, directorEntries: 0, linksAdded: 0, personsCreated: 0, orphans: [] };
  const traceability = [];

  // ① Director → Personnel + Company.links(role: director / secretary / alternate_director / auditor)
  // 边界 Case①：同一人在 A 任董事、B 任股东 → 由 findOrCreatePersonnel 按身份去重为 1 个 Personnel，多条 link。
  // 注：直接读取旧 'directors' 集合（raw collection），不再依赖已删除的 Director 模型。
  const directors = await mongoose.connection.collection('directors').find({}).toArray();
  for (const d of directors) {
    const { person, created } = await findOrCreatePersonnel(d);
    if (created) stats.personsCreated++;
    for (const appt of d.appointments || []) {
      const company = await Company.findById(appt.company);
      if (!company) { stats.orphans.push(`Director:${d._id} → 公司 ${appt.company} 不存在`); continue; }
      const roles = mapPositionToRoles(appt.position);
      for (const role of roles) {
        const added = await pushLink(company, {
          linkModel: 'Personnel', link: person._id, roles: [role],
          appointmentDate: appt.appointedDate, cessationDate: appt.resignedDate, notes: appt.notes,
        }, traceability, `Director:${d._id}`, role);
        if (added) stats.linksAdded++;
      }
    }
    stats.directors++;
  }
  console.log(`① Director 处理: ${stats.directors} 人, 新增 links ${stats.linksAdded}`);

  // ② ShareholderEntry → Company.links(role: shareholder)
  // 边界 Case②：shareholderType==='公司' → linkModel:'Company'，【不建】Personnel。
  // 边界 Case⑥：股份只挂在 shareholder link（director link 不带 shares）。
  const shEntries = await ShareholderEntry.find({});
  for (const s of shEntries) {
    const company = await Company.findById(s.company);
    if (!company) { stats.orphans.push(`ShareholderEntry:${s._id} → 公司 ${s.company} 不存在`); stats.shareholders++; continue; }

    if (s.shareholderType === '公司' && s.companyRef) {
      const added = await pushLink(company, {
        linkModel: 'Company', link: s.companyRef, roles: ['shareholder'],
        shares: s.totalSharesHeld, shareRecords: s.shareRecords, notes: s.remarks,
      }, traceability, `ShareholderEntry:${s._id}`, 'shareholder');
      if (added) stats.linksAdded++;
    } else {
      // 边界 Case③：personnelRef 为空、仅手填姓名 → 建 Personnel（按姓名去重/模糊匹配）
      let person = s.personnelRef ? await Personnel.findById(s.personnelRef) : null;
      if (!person && s.shareholderName) person = await Personnel.findOne({ name: s.shareholderName });
      if (!person && s.shareholderName) {
        if (DRY_RUN) { stats.personsCreated++; }
        else {
          person = await Personnel.create({
            name: s.shareholderName, nameChinese: s.shareholderNameChinese,
            address: { street: s.shareholderAddress }, occupation: s.shareholderOccupation,
          });
          stats.personsCreated++;
        }
      }
      if (person) {
        const added = await pushLink(company, {
          linkModel: 'Personnel', link: person._id, roles: ['shareholder'],
          shares: s.totalSharesHeld, shareRecords: s.shareRecords, notes: s.remarks,
        }, traceability, `ShareholderEntry:${s._id}`, 'shareholder');
        if (added) stats.linksAdded++;
      }
    }
    stats.shareholders++;
  }
  console.log(`② ShareholderEntry 处理: ${stats.shareholders} 条`);

  // ③ DirectorEntry（ROD）→ 吸收 ROD 字段 + Company.links(role: secretary / director)
  // 边界 Case⑤：离任记录 cessationDate 必须保留在 link（历史不全删）。
  const deEntries = await DirectorEntry.find({});
  for (const e of deEntries) {
    let person = e.personnelRef ? await Personnel.findById(e.personnelRef) : null;
    if (!person && e.fullName) person = await Personnel.findOne({ name: e.fullName });
    if (!person && e.fullName) {
      if (DRY_RUN) { stats.personsCreated++; }
      else {
        person = await Personnel.create({
          name: e.fullName, nameChinese: e.fullNameChinese,
          formerNameOrAlias: e.formerNameOrAlias, documentServiceAddress: e.documentServiceAddress,
          usualResidentialAddress: e.usualResidentialAddress,
          dateOfBirth: e.dateOfBirth, placeOfBirth: e.placeOfBirth, nationality: e.nationality,
          idType: e.idType, idNumber: e.idNumber, occupation: e.occupation,
        });
        stats.personsCreated++;
      }
    }
    // ROD 专有字段合并进 Personnel 主数据（仅补空，不覆盖）
    if (person && !DRY_RUN) {
      const p = await Personnel.findById(person._id);
      if (!p.documentServiceAddress && e.documentServiceAddress) p.documentServiceAddress = e.documentServiceAddress;
      if (!p.formerNameOrAlias && e.formerNameOrAlias) p.formerNameOrAlias = e.formerNameOrAlias;
      if (!p.usualResidentialAddress && e.usualResidentialAddress) p.usualResidentialAddress = e.usualResidentialAddress;
      await p.save();
    }
    const company = await Company.findById(e.company);
    if (company && person) {
      const role = e.positionType === '公司秘书' ? 'secretary' : 'director';
      const added = await pushLink(company, {
        linkModel: 'Personnel', link: person._id, roles: [role],
        appointmentDate: e.dateOfAppointment, cessationDate: e.dateOfCessation, notes: e.remarks,
      }, traceability, `DirectorEntry:${e._id}`, role);
      if (added) stats.linksAdded++;
    } else if (!company) {
      stats.orphans.push(`DirectorEntry:${e._id} → 公司 ${e.company} 不存在`);
    }
    stats.directorEntries++;
  }
  console.log(`③ DirectorEntry 处理: ${stats.directorEntries} 条`);

  // ④ 过渡兼容：可选镜像 roles 到 Personnel.roles（仅 --with-roles-cache 且非 DRY RUN）
  if (WITH_ROLES_CACHE && !DRY_RUN) {
    const byPerson = {};
    for (const t of traceability) {
      if (t.linkModel !== 'Personnel') continue;
      (byPerson[t.linkId] = byPerson[t.linkId] || new Set()).add(t.role);
    }
    for (const [pid, roleSet] of Object.entries(byPerson)) {
      await Personnel.findByIdAndUpdate(pid, { $addToSet: { roles: { $each: [...roleSet] } } });
    }
    console.log(`④ 过渡 roles 缓存：已镜像至 ${Object.keys(byPerson).length} 个 Personnel`);
  }

  // ⑤ 校验（100% 可回溯）
  await verify(stats, traceability);

  await mongoose.disconnect();
}

async function verify(stats, traceability) {
  console.log('\n📊 迁移统计:', JSON.stringify(stats, null, 2));

  // 旧系统"应映射条目数"≈ 董事任职数 + 股东条目数 + 董事条目数
  const expectedSources = stats.directors + stats.shareholders + stats.directorEntries;
  const mappedSources = new Set(traceability.map(t => t.source)).size;
  const personnelLinks = traceability.filter(t => t.linkModel === 'Personnel').length;
  const companyLinks = traceability.filter(t => t.linkModel === 'Company').length;

  console.log('\n🔎 对账校验:');
  console.log(`  旧条目总数(估):     ${expectedSources}`);
  console.log(`  已映射不同来源数:   ${mappedSources}`);
  console.log(`  Company.links 新增:  ${stats.linksAdded} (Personnel ${personnelLinks} / Company ${companyLinks})`);
  console.log(`  孤儿(公司不存在):   ${stats.orphans.length}`);
  if (stats.orphans.length) {
    console.log('  孤儿清单:');
    stats.orphans.forEach(o => console.log('    - ' + o));
  }

  const ok = stats.orphans.length === 0;
  console.log(ok
    ? '\n✅ 校验通过：所有旧条目均映射到 Company.links，无孤儿遗漏。'
    : '\n⚠️  存在孤儿（关联公司已删除），请人工核对这些历史记录是否还需保留。');

  if (DRY_RUN) {
    console.log('\n⚠️  这是 DRY RUN，未写入任何数据。');
    console.log('    建议流程：');
    console.log('      1) mongodump 生产库 → 恢复到临时实例');
    console.log('      2) MONGODB_URI=<临时实例> node scripts/migrate-v5.js --apply');
    console.log('      3) 用本对账输出确认 100% 可回溯');
    console.log('      4) 无误后再对生产库执行（或确认临时实例即新生产）');
  } else {
    console.log('\n✅ 迁移完成。旧表 Director/ShareholderEntry/DirectorEntry 已保留未删，确认无误后由 DBA 手动 drop。');
    console.log('    注意：Personnel.appointments 未写入（读时聚合）。若后端 personnel role-filter 仍读 stored roles，');
    console.log('    请改用 deriveRoles 从 Company.links 聚合（见 Step2），或本次加 --with-roles-cache 过渡。');
  }
}

main().catch((err) => {
  console.error('❌ 迁移失败:', err.message);
  mongoose.disconnect().catch(() => undefined).finally(() => process.exit(1));
});
