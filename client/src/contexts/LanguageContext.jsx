import { createContext, useContext, useState, useEffect } from 'react'

// 翻译字典 — 按需扩展
const TRANSLATIONS = {
  zh: {
    // Navbar
    dashboard: '控制台',
    companies: '公司',
    personnel: '人员',
    documents: '文件',
    meetings: '会议',
    tasks: '任务',
    reminders: '合规提醒',
    templates: '模板库',
    signTasks: '签署任务',
    settings: '系统设置',
    admin: '管理后台',
    logout: '退出登录',
    search: '全局搜索...',
    // Common
    loading: '加载中...',
    noData: '暂无数据',
    save: '保存',
    cancel: '取消',
    edit: '编辑',
    delete: '删除',
    add: '新增',
    confirm: '确认',
    back: '返回',
    actions: '操作',
    status: '状态',
    date: '日期',
    name: '名称',
    type: '类型',
    description: '描述',
    notes: '备注',
    all: '全部',
    active: '有效',
    completed: '已完成',
    pending: '待处理',
    expired: '已过期',
    // Dashboard
    totalCompanies: '公司总数',
    totalPersonnel: '人员总数',
    upcomingReminders: '即将到期',
    overdueItems: '逾期事项',
    pendingSignTasks: '待签署任务',
    recentMeetings: '近期会议',
    // Company
    basicInfo: '基本信息',
    peopleTab: '董事/股东',
    documentsTab: '文件',
    equityTab: '股权架构',
    registersTab: '登记册',
    complianceTab: '合规',
    tasksTab: '任务',
    address: '地址',
    registrationNumber: '注册号',
    incorporationDate: '成立日期',
    jurisdiction: '属地',
    shareCapital: '股份资本',
    issuedShares: '已发行股份',
    paidUpCapital: '已缴股本',
    currency: '货币',
    // Personnel
    personalInfo: '个人信息',
    affiliatedCompanies: '任职公司',
    relatedMeetings: '关联会议',
    relatedFiles: '关联文件',
    relatedReminders: '关联合规提醒',
    relatedTasks: '关联任务',
    nric: 'NRIC / 护照',
    nationality: '国籍 / 地区',
    phone: '电话',
    email: '邮箱',
    // Registers
    rod: '董事登记册 (ROD)',
    rom: '股东登记册 (ROM)',
    ros: '秘书登记册',
    current: '现任',
    former: '历任',
    markCeased: '标记离任',
    restore: '恢复任职',
    addHistorical: '添加历史记录',
    generateWord: '生成 Word (.doc)',
    // Compliance
    addReminder: '新增提醒',
    selectRule: '从规则库选择',
    customFill: '自定义填写',
    saveAsRule: '保存为规则（沉淀到规则库，供其他公司复用）',
    availableRules: '可用规则',
    // Language toggle label
    language: '语言',
  },
  en: {
    // Navbar
    dashboard: 'Dashboard',
    companies: 'Companies',
    personnel: 'Personnel',
    documents: 'Documents',
    meetings: 'Meetings',
    tasks: 'Tasks',
    reminders: 'Compliance',
    templates: 'Templates',
    signTasks: 'Signing Tasks',
    settings: 'Settings',
    admin: 'Admin Panel',
    logout: 'Logout',
    search: 'Global Search...',
    // Common
    loading: 'Loading...',
    noData: 'No Data',
    save: 'Save',
    cancel: 'Cancel',
    edit: 'Edit',
    delete: 'Delete',
    add: 'Add New',
    confirm: 'Confirm',
    back: 'Back',
    actions: 'Actions',
    status: 'Status',
    date: 'Date',
    name: 'Name',
    type: 'Type',
    description: 'Description',
    notes: 'Notes',
    all: 'All',
    active: 'Active',
    completed: 'Completed',
    pending: 'Pending',
    expired: 'Expired',
    // Dashboard
    totalCompanies: 'Total Companies',
    totalPersonnel: 'Total Personnel',
    upcomingReminders: 'Upcoming Reminders',
    overdueItems: 'Overdue Items',
    pendingSignTasks: 'Pending Signings',
    recentMeetings: 'Recent Meetings',
    // Company
    basicInfo: 'Basic Info',
    peopleTab: 'People',
    documentsTab: 'Documents',
    equityTab: 'Equity Structure',
    registersTab: 'Registers',
    complianceTab: 'Compliance',
    tasksTab: 'Tasks',
    address: 'Address',
    registrationNumber: 'Reg. No.',
    incorporationDate: 'Incorporated',
    jurisdiction: 'Jurisdiction',
    shareCapital: 'Share Capital',
    issuedShares: 'Issued Shares',
    paidUpCapital: 'Paid-up Capital',
    currency: 'Currency',
    // Personnel
    personalInfo: 'Personal Info',
    affiliatedCompanies: 'Affiliated Companies',
    relatedMeetings: 'Related Meetings',
    relatedFiles: 'Related Files',
    relatedReminders: 'Related Reminders',
    relatedTasks: 'Related Tasks',
    nric: 'NRIC / Passport',
    nationality: 'Nationality',
    phone: 'Phone',
    email: 'Email',
    // Registers
    rod: 'Register of Directors (ROD)',
    rom: 'Register of Members (ROM)',
    ros: 'Register of Secretaries',
    current: 'Current',
    former: 'Former',
    markCeased: 'Mark Ceased',
    restore: 'Restore',
    addHistorical: 'Add Historical Entry',
    generateWord: 'Generate Word (.doc)',
    // Compliance
    addReminder: 'Add Reminder',
    selectRule: 'Select from Rules',
    customFill: 'Custom Fill',
    saveAsRule: 'Save as Rule (reusable across companies)',
    availableRules: 'Available Rules',
    // Language toggle label
    language: 'Language',
  },
}

const LanguageContext = createContext({
  locale: 'zh', // default Chinese
  setLocale: () => {},
  t: (key) => key, // translation function
})

export function LanguageProvider({ children }) {
  const [locale, setLocaleState] = useState(() => {
    try { return localStorage.getItem('claw-locale') || 'zh' } catch { return 'zh' }
  })

  const setLocale = (newLocale) => {
    setLocaleState(newLocale)
    try { localStorage.setItem('claw-locale', newLocale) } catch {}
  }

  const t = (key) => {
    return TRANSLATIONS[locale]?.[key] || TRANSLATIONS.zh?.[key] || key
  }

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
