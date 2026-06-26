export const todayIso = () => new Date().toISOString().slice(0, 10)

export const currentMonth = () => new Date().toISOString().slice(0, 7)

export const monthToDate = (month) => `${month}-01`

export const money = (value) => `£${Number(value || 0).toFixed(2)}`

export const monthLabel = (month) => new Date(`${month}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })

export const currentYear = () => new Date().getFullYear()

export const currentMonthNumber = () => new Date().getMonth() + 1

export const buildMonthString = (year, monthNumber) => `${year}-${String(monthNumber).padStart(2, '0')}`

export const recurringMonthlyEquivalent = (item) => {
  const amount = Number(item?.amount || 0)
  if (item?.frequency === 'weekly') return amount * 52 / 12
  if (item?.frequency === 'yearly') return amount / 12
  return amount
}

export const recurringYearlyEquivalent = (item) => recurringMonthlyEquivalent(item) * 12

export const getDaysUntil = (dateString) => {
  if (!dateString) return null
  const today = new Date()
  const target = new Date(`${dateString}T00:00:00`)
  today.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  return Math.round((target - today) / (1000 * 60 * 60 * 24))
}

export const formatDueIn = (dateString) => {
  const days = getDaysUntil(dateString)
  if (days === null || Number.isNaN(days)) return ''
  if (days === 0) return 'due today'
  if (days === 1) return 'due tomorrow'
  if (days > 1) return `in ${days} days`
  if (days === -1) return '1 day overdue'
  return `${Math.abs(days)} days overdue`
}

export const isOverBudget = (item) => Number(item?.spent || 0) > Number(item?.budgeted || 0)

export const overBudgetAmount = (item) => Math.max(0, Number(item?.spent || 0) - Number(item?.budgeted || 0))

export const emptyTransaction = {
  type: 'expense',
  account: '',
  category: '',
  amount: '',
  date: todayIso(),
  description: '',
  payee: '',
}

export const emptyRecurringItem = {
  name: '',
  account: '',
  category: '',
  amount: '',
  frequency: 'monthly',
  next_due_date: todayIso(),
  type: 'bill',
}