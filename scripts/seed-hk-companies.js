/**
 * Backend seed script — import 5 HK companies from NAR1 forms
 * Usage: node scripts/seed-hk-companies.js
 *
 * Requires: npm install mongoose
 * Make sure MONGODB_URI is set in .env
 */

const mongoose = require('mongoose')
const path = require('path')
const fs = require('fs')

// ====== Seed Data (from NAR1 PDFs) ======
const companies = [
  {
    name: 'EASY RICH CORPORATION LIMITED',
    chineseName: '順富興業有限公司',
    businessRegistrationNo: '65940948',
    type: 'private_limited',
    status: 'active',
    incorporationDate: new Date('2015-04-01'),
    registeredAddress: {
      room: 'Room 4010, 40/F',
      building: 'China Resources Building',
      street: '26 Harbour Road',
      district: 'Wan Chai',
      country: 'Hong Kong',
      region: 'Hong Kong',
    },
    shareCapital: { issued: 1, issuedCurrency: 'HKD', paidUp: 1, paidUpCurrency: 'HKD' },
    financialYearEnd: { day: 31, month: 3 },
    compliance: {
      agmDueDate: new Date('2027-04-01'),
      arDueDate: new Date('2027-06-30'),
      lastAgmDate: new Date('2026-04-01'),
      taxFilingDue: new Date('2026-11-30'),
    },
  },
  {
    name: 'ZHONG AN TRAVEL LIMITED',
    chineseName: '眾安旅遊有限公司',
    businessRegistrationNo: '69459923',
    type: 'private_limited',
    status: 'active',
    incorporationDate: new Date('2016-06-05'),
    registeredAddress: {
      room: 'Room 4010, 40/F',
      building: 'China Resources Building',
      street: '26 Harbour Road',
      district: 'Wan Chai',
      country: 'Hong Kong',
      region: 'Hong Kong',
    },
    shareCapital: { issued: 1, issuedCurrency: 'HKD', paidUp: 1, paidUpCurrency: 'HKD' },
    financialYearEnd: { day: 31, month: 5 },
    compliance: {
      agmDueDate: new Date('2027-06-05'),
      arDueDate: new Date('2027-08-05'),
      lastAgmDate: new Date('2026-06-05'),
      taxFilingDue: new Date('2026-11-30'),
    },
  },
  {
    name: 'HUIJUN (INTERNATIONAL) HOLDINGS LIMITED',
    chineseName: '匯駿(國際)控股有限公司',
    businessRegistrationNo: '35387857',
    type: 'private_limited',
    status: 'active',
    incorporationDate: new Date('2015-03-04'),
    registeredAddress: {
      room: 'Room 4010, 40/F',
      building: 'China Resources Building',
      street: '26 Harbour Road',
      district: 'Wan Chai',
      country: 'Hong Kong',
      region: 'Hong Kong',
    },
    shareCapital: { issued: 100000, issuedCurrency: 'HKD', paidUp: 100000, paidUpCurrency: 'HKD' },
    financialYearEnd: { day: 28, month: 2 },
    compliance: {
      agmDueDate: new Date('2027-03-04'),
      arDueDate: new Date('2027-05-04'),
      lastAgmDate: new Date('2026-03-04'),
      taxFilingDue: new Date('2026-11-30'),
    },
  },
  {
    name: 'HONG KONG TIME HONOUR PROPERTY LIMITED',
    chineseName: '香港時駿地産有限公司',
    businessRegistrationNo: '63822186',
    type: 'private_limited',
    status: 'active',
    incorporationDate: new Date('2015-09-15'),
    registeredAddress: {
      room: 'Room 301, Unit 1',
      building: 'Block 23, Zhong An Shanshuiyuan',
      street: 'Shushan Street, Xiaoshan District',
      district: 'Hangzhou',
      country: 'China',
      region: 'Zhejiang',
    },
    shareCapital: { issued: 10000, issuedCurrency: 'HKD', paidUp: 10000, paidUpCurrency: 'HKD' },
    financialYearEnd: { day: 31, month: 8 },
    compliance: {
      agmDueDate: new Date('2026-09-15'),
      arDueDate: new Date('2026-11-15'),
      lastAgmDate: new Date('2025-09-15'),
      taxFilingDue: new Date('2026-11-30'),
    },
  },
  {
    name: 'PANNIX INDUSTRIAL (HONG KONG) LIMITED',
    chineseName: '佳潤實業(香港)有限公司',
    businessRegistrationNo: '63822047',
    type: 'private_limited',
    status: 'active',
    incorporationDate: new Date('2015-09-15'),
    registeredAddress: {
      room: 'Room 301, Unit 1',
      building: 'Block 23, Zhong An Shanshuiyuan',
      street: 'Shushan Street, Xiaoshan District',
      district: 'Hangzhou',
      country: 'China',
      region: 'Zhejiang',
    },
    shareCapital: { issued: 10000, issuedCurrency: 'HKD', paidUp: 10000, paidUpCurrency: 'HKD' },
    financialYearEnd: { day: 31, month: 8 },
    compliance: {
      agmDueDate: new Date('2026-09-15'),
      arDueDate: new Date('2026-11-15'),
      lastAgmDate: new Date('2025-09-15'),
      taxFilingDue: new Date('2026-11-30'),
    },
  },
]

const personnel = [
  {
    name: '林才賀',
    nric: 'M151',
    email: 'lincaihe@example.com',
    phone: '',
    nationality: 'China',
    hkid: 'M151',
    address: 'Room 4010, 40/F, China Resources Building, 26 Harbour Road, Wan Chai, Hong Kong',
    roles: ['company_secretary'],
  },
  {
    name: '施金帆',
    nric: '',
    email: 'shijinfan@example.com',
    phone: '',
    nationality: 'China',
    address: 'Room 4010, 40/F, China Resources Building, 26 Harbour Road, Wan Chai, Hong Kong',
    roles: ['director'],
  },
  {
    name: '施南路',
    nric: '',
    email: 'shinanlu@example.com',
    phone: '',
    nationality: 'China',
    passportNo: 'G5084',
    passportCountry: 'China',
    address: 'Room 301, Unit 1, Block 23, Zhong An Shanshuiyuan, Shushan Street, Xiaoshan District, Hangzhou, Zhejiang Province, China',
    roles: ['director'],
  },
  {
    name: '施中安',
    nric: 'R578',
    formerName: '施侃成',
    email: 'shizhongan@example.com',
    phone: '',
    nationality: 'China',
    hkid: 'R578',
    address: 'Room 4010, 40/F, China Resources Building, 26 Harbour Road, Wan Chai, Hong Kong',
    roles: ['director'],
  },
]

// ====== Main ======
async function seed() {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/claw'
  
  await mongoose.connect(MONGODB_URI)
  console.log('✅ Connected to MongoDB:', MONGODB_URI)

  // Dynamically import models (to avoid require issues)
  const Company = require(path.join(__dirname, '../server/models/Company'))
  const Personnel = require(path.join(__dirname, '../server/models/Personnel'))

  // Clear existing seed data (optional)
  console.log('\n📋 Seeding companies...')
  const createdCompanies = []
  for (const c of companies) {
    const existing = await Company.findOne({ businessRegistrationNo: c.businessRegistrationNo })
    if (existing) {
      console.log(`  ⚠️  Skipped (exists): ${c.name}`)
      createdCompanies.push(existing)
    } else {
      const doc = await Company.create(c)
      createdCompanies.push(doc)
      console.log(`  ✅ Created: ${c.name} (${c.businessRegistrationNo})`)
    }
  }

  console.log('\n👥 Seeding personnel...')
  const createdPersonnel = []
  for (const p of personnel) {
    const existing = await Personnel.findOne({ name: p.name })
    if (existing) {
      console.log(`  ⚠️  Skipped (exists): ${p.name}`)
      createdPersonnel.push(existing)
    } else {
      const doc = await Personnel.create(p)
      createdPersonnel.push(doc)
      console.log(`  ✅ Created: ${p.name}`)
    }
  }

  // Link personnel to companies
  console.log('\n🔗 Linking personnel to companies...')
  // Easy Rich: 林才賀(CS), 施金帆(D), 施南路(D)
  await linkPersonnel(Company, createdCompanies[0]._id, [
    { personnel: createdPersonnel[0]._id, roles: ['company_secretary'] },
    { personnel: createdPersonnel[1]._id, roles: ['director'] },
    { personnel: createdPersonnel[2]._id, roles: ['director'] },
  ])
  console.log(`  ✅ Linked to ${createdCompanies[0].name}`)

  // Zhong An Travel: 林才賀(CS), 施南路(D)
  await linkPersonnel(Company, createdCompanies[1]._id, [
    { personnel: createdPersonnel[0]._id, roles: ['company_secretary'] },
    { personnel: createdPersonnel[2]._id, roles: ['director'] },
  ])
  console.log(`  ✅ Linked to ${createdCompanies[1].name}`)

  // Huijun: 林才賀(CS), 施中安(D)
  await linkPersonnel(Company, createdCompanies[2]._id, [
    { personnel: createdPersonnel[0]._id, roles: ['company_secretary'] },
    { personnel: createdPersonnel[3]._id, roles: ['director'] },
  ])
  console.log(`  ✅ Linked to ${createdCompanies[2].name}`)

  // HK Time Honour: 林才賀(CS), 施南路(D)
  await linkPersonnel(Company, createdCompanies[3]._id, [
    { personnel: createdPersonnel[0]._id, roles: ['company_secretary'] },
    { personnel: createdPersonnel[2]._id, roles: ['director'] },
  ])
  console.log(`  ✅ Linked to ${createdCompanies[3].name}`)

  // Pannix: 林才賀(CS), 施南路(D)
  await linkPersonnel(Company, createdCompanies[4]._id, [
    { personnel: createdPersonnel[0]._id, roles: ['company_secretary'] },
    { personnel: createdPersonnel[2]._id, roles: ['director'] },
  ])
  console.log(`  ✅ Linked to ${createdCompanies[4].name}`)

  // ====== Seed Documents (NAR1 PDFs) ======
  const Document = require(path.join(__dirname, '../server/models/Document'))
  const pdfFiles = [
    {
      pdfPath: 'D:/BaiduSyncdisk/CNC接收文件/HK Companies/Easy Rich/NAR1 - Easy Rich Corporation Ltd 2026.pdf',
      companyIdx: 0,
      title: 'NAR1 - Easy Rich Corporation Ltd 2026',
      category: 'annual_return',
      description: '周年申報表 2026',
      uploadedAt: new Date('2026-04-08'),
    },
    {
      pdfPath: 'D:/BaiduSyncdisk/CNC接收文件/HK Companies/Zhong An Travel/NAR1- Zhong An Travel Ltd 2026.pdf',
      companyIdx: 1,
      title: 'NAR1 - Zhong An Travel Ltd 2026',
      category: 'annual_return',
      description: '周年申報表 2026',
      uploadedAt: new Date('2026-06-17'),
    },
    {
      pdfPath: 'D:/BaiduSyncdisk/CNC接收文件/HK Companies/Huijun/NAR1 - HuiJun (International) Holdings Ltd 2026.pdf',
      companyIdx: 2,
      title: 'NAR1 - HuiJun (International) Holdings Ltd 2026',
      category: 'annual_return',
      description: '周年申報表 2026',
      uploadedAt: new Date('2026-03-16'),
    },
    {
      pdfPath: 'D:/BaiduSyncdisk/CNC接收文件/HK Companies/HK Time Honour Property Limited/NAR1 - Hong Kong Time Honour Property Ltd 2025.pdf',
      companyIdx: 3,
      title: 'NAR1 - Hong Kong Time Honour Property Ltd 2025',
      category: 'annual_return',
      description: '周年申報表 2025',
      uploadedAt: new Date('2025-10-14'),
    },
    {
      pdfPath: 'D:/BaiduSyncdisk/CNC接收文件/HK Companies/Pannix Industrial/NAR1 - Pannix Industrial (Hong Kong) Limited 2025.pdf',
      companyIdx: 4,
      title: 'NAR1 - Pannix Industrial (Hong Kong) Limited 2025',
      category: 'annual_return',
      description: '周年申報表 2025',
      uploadedAt: new Date('2025-09-17'),
    },
  ]

  console.log('\n📄 Seeding documents (NAR1 PDFs)...')
  const createdDocuments = []
  for (const pdf of pdfFiles) {
    const company = createdCompanies[pdf.companyIdx]
    if (!company) continue

    const existing = await Document.findOne({ title: pdf.title, company: company._id })
    if (existing) {
      console.log(`  ⏭ Skipped (exists): ${pdf.title}`)
      createdDocuments.push(existing)
      continue
    }

    // Generate document number
    const docNumber = await Document.generateDocNumber(company, null, pdf.category, pdf.uploadedAt)

    const doc = await Document.create({
      docNumber,
      title: pdf.title,
      category: pdf.category,
      company: company._id,
      description: pdf.description,
      filename: pdf.title.replace(/[^a-zA-Z0-9.\-]/g, '_') + '.pdf',
      originalName: pdf.title + '.pdf',
      mimetype: 'application/pdf',
      size: 500000,
      uploadedBy: null, // No user in seed
      createdAt: pdf.uploadedAt,
      updatedAt: pdf.uploadedAt,
    })
    createdDocuments.push(doc)
    console.log(`  ✅ Created: ${docNumber} — ${pdf.title}`)
  }

  console.log('\n🎉 Seed complete!')
  console.log(`   Companies: ${createdCompanies.length}`)
  console.log(`   Personnel: ${createdPersonnel.length}`)
  console.log(`   Documents: ${createdDocuments.length}`)

  await mongoose.disconnect()
}

async function linkPersonnel(Company, companyId, links) {
  const company = await Company.findById(companyId)
  if (!company) return
  // Merge links (avoid duplicates)
  for (const link of links) {
    const exists = company.links.some(l => l.link.toString() === link.personnel.toString())
    if (!exists) {
      company.links.push({
        link: link.personnel,
        linkModel: 'Personnel',
        roles: link.roles,
        appointmentDate: new Date(),
      })
    }
  }
  await company.save()
}

seed().catch(err => {
  console.error('❌ Seed failed:', err)
  process.exit(1)
})
