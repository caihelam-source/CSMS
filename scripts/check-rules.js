// scripts/check-rules.js — 一行一次性查询
const dns = require('dns'); dns.setServers(['8.8.8.8', '1.1.1.1']);
const fs = require('fs');
const txt = fs.readFileSync('.workbuddy/memory/SECRETS.md', 'utf8');
const m = txt.match(/mongodb\+srv:\/\/\S+/i);
process.env.MONGODB_URI = m[0].replace(/["'`)\]]/g, '').trim();
const mongoose = require('mongoose');
(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const Rule = require('../server/models/ComplianceRule');
  const Reminder = require('../server/models/ComplianceReminder');
  const rules = await Rule.find({}).lean();
  console.log('rules count:', rules.length);
  const hk42 = rules.filter((r) => r.ruleId === 'HK_AR_42');
  const hkbr = rules.filter((r) => r.ruleId === 'HK_BR_RENEW');
  console.log('HK_AR_42 exists:', hk42.length, 'status:', hk42[0]?.status, 'jurisdiction:', hk42[0]?.jurisdiction);
  console.log('HK_BR_RENEW exists:', hkbr.length, 'status:', hkbr[0]?.status, 'jurisdiction:', hkbr[0]?.jurisdiction);
  const rms = await Reminder.find({}).lean();
  console.log('reminders:', rms.length);
  for (const r of rms) console.log(' ', r.ruleId, r.status, 'due:', r.dueDate, 'co:', String(r.company).slice(-6));
  await mongoose.disconnect();
})();
