// Read-only Atlas audit: confirm HKEX reminders + listing/stockCode state + whether sourceRuleId fix is live.
const fs = require('fs');
const path = require('path');
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const { MongoClient } = require(path.join(process.cwd(), 'node_modules', 'mongodb'));

const MEM = path.join(process.cwd(), '.workbuddy', 'memory', 'SECRETS.md');
const txt = fs.readFileSync(MEM, 'utf8');
const m = txt.match(/mongodb\+srv:\/\/\S+/);
if (!m) { console.error('NO URI'); process.exit(1); }
const uri = m[0].replace(/[`"')\s]+$/g, '');

(async () => {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  const colls = (await db.listCollections().toArray()).map(c => c.name);
  console.log('COLLECTIONS:', colls.sort().join(','));

  const companies = db.collection('companies');
  const reminders = db.collection('compliancereminders');

  // Listed / non-HK companies
  const listed = await companies.find({
    $or: [{ isListed: true }, { nonHongKongCompany: true }]
  }, { name: 1, jurisdiction: 1, isListed: 1, nonHongKongCompany: 1, listingLocation: 1, stockCode: 1, financialYearEnd: 1 }).toArray();
  console.log('\n=== LISTED / NON-HK COMPANIES (' + listed.length + ') ===');
  listed.forEach(c => console.log(JSON.stringify({ name: c.name, jur: c.jurisdiction, isListed: c.isListed, nonHK: c.nonHongKongCompany, loc: c.listingLocation, code: c.stockCode, fye: c.financialYearEnd })));

  // HKEX reminders
  const hkex = await reminders.find({ sourceRuleId: { $regex: '^HKEX_' } }, { company: 1, sourceRuleId: 1, ruleId: 1, year: 1, title: 1, dueDate: 1, status: 1 }).toArray();
  console.log('\n=== HKEX REMINDERS (' + hkex.length + ') ===');
  hkex.forEach(r => console.log(JSON.stringify({ rule: r.sourceRuleId || r.ruleId, year: r.year, title: r.title, status: r.status, due: r.dueDate })));

  // Is the sourceRuleId fix live? Check a sample of ALL reminders for sourceRuleId/year population
  const total = await reminders.countDocuments({});
  const withSourceRule = await reminders.countDocuments({ sourceRuleId: { $exists: true, $ne: null } });
  const withYear = await reminders.countDocuments({ year: { $exists: true, $ne: null } });
  console.log('\n=== REMINDER POPULATION (fix-live probe) ===');
  console.log('total reminders:', total, '| with sourceRuleId:', withSourceRule, '| with year:', withYear);

  // Show companies for HKEX reminders (resolve names)
  for (const r of hkex) {
    const comp = await companies.findOne({ _id: r.company }, { name: 1 });
    if (comp) console.log('  ->', comp.name, '|', r.sourceRuleId);
  }

  await client.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
