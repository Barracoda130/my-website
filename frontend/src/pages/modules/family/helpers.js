export const formatCurrency = (value) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(Number(value || 0))

export const formatDate = (value) => value ? new Date(value).toLocaleDateString('en-GB') : '—'

export const calculateAge = (dateOfBirth) => {
  if (!dateOfBirth) return '—'
  const dob = new Date(dateOfBirth)
  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const monthDiff = today.getMonth() - dob.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age -= 1
  return age
}

export const todayInput = () => new Date().toISOString().slice(0, 10)

export const emptyTransaction = (children = []) => ({
  date: todayInput(),
  title: '',
  amount: '',
  currency: 'GBP',
  type: 'one_off_personal_expense',
  category: 'other',
  paid_by: 'both',
  counts_toward_fairness: true,
  is_large_expense: false,
  split_between_children: false,
  recurring: false,
  recurring_frequency: 'none',
  recurring_start_date: '',
  recurring_end_date: '',
  notes: '',
  receipt_url: '',
  splits: children[0] ? [{ child: children[0].id, amount: '', percentage: '100.00' }] : [],
})