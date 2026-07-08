/**
 * validators — common form validation utilities
 * Usage: validate(form, { name: [required(), maxLength(100)], email: [required(), email()] })
 * Returns: { valid, errors: { fieldName: 'error message' } }
 */

export const required = (msg) => (v) => {
  if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) return msg || '此字段为必填'
  return ''
}

export const email = (msg) => (v) => {
  if (!v) return ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return msg || '邮箱格式不正确'
  return ''
}

export const minLength = (min, msg) => (v) => {
  if (!v) return ''
  if (v.length < min) return msg || `最少 ${min} 个字符`
  return ''
}

export const maxLength = (max, msg) => (v) => {
  if (!v) return ''
  if (v.length > max) return msg || `最多 ${max} 个字符`
  return ''
}

export const pattern = (regex, msg) => (v) => {
  if (!v) return ''
  if (!regex.test(v)) return msg || '格式不正确'
  return ''
}

export const dateNotPast = (msg) => (v) => {
  if (!v) return ''
  if (new Date(v) < new Date(new Date().toDateString())) return msg || '日期不能早于今天'
  return ''
}

/**
 * validate — run validation rules against a form object
 * @param {Object} form — key-value form data
 * @param {Object} rules — { fieldName: [validatorFn, ...] }
 * @returns {{ valid: boolean, errors: Object }}
 */
export const validate = (form, rules) => {
  const errors = {}
  for (const [field, validators] of Object.entries(rules)) {
    for (const v of validators) {
      const msg = v(form[field])
      if (msg) { errors[field] = msg; break }
    }
  }
  return { valid: Object.keys(errors).length === 0, errors }
}

/**
 * hasError — check if a specific field has an error
 */
export const hasError = (errors, field) => !!errors[field]

/**
 * getError — get error message for a field
 */
export const getError = (errors, field) => errors[field] || ''
