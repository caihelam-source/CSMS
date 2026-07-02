// 测试 mock.js 的 Service 函数是否能正常调用
import { companies, personnel, documents } from './mock.js'

console.log('=== 测试 companies.getAll ===')
try {
  const result = await companies.getAll({})
  console.log('companies.getAll result:', JSON.stringify(result).slice(0, 200))
} catch (e) {
  console.error('companies.getAll ERROR:', e.message)
}

console.log('\n=== 测试 companies.getOne ===')
try {
  const result = await companies.getOne('company-001')
  console.log('companies.getOne result:', JSON.stringify(result).slice(0, 200))
} catch (e) {
  console.error('companies.getOne ERROR:', e.message)
}

console.log('\n=== 测试 companies.getShareholderEntries ===')
try {
  const result = await companies.getShareholderEntries('company-001')
  console.log('companies.getShareholderEntries result:', JSON.stringify(result).slice(0, 200))
} catch (e) {
  console.error('companies.getShareholderEntries ERROR:', e.message)
}

console.log('\n=== 测试 personnel.getAll ===')
try {
  const result = await personnel.getAll({})
  console.log('personnel.getAll result:', JSON.stringify(result).slice(0, 200))
} catch (e) {
  console.error('personnel.getAll ERROR:', e.message)
}

console.log('\n=== 测试 documents.getAll ===')
try {
  const result = await documents.getAll({})
  console.log('documents.getAll result:', JSON.stringify(result).slice(0, 200))
} catch (e) {
  console.error('documents.getAll ERROR:', e.message)
}

console.log('\n=== 所有测试完成 ===')
