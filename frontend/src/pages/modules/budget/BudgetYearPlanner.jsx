import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createCategory, createCategoryGroup, deleteCategory, deleteCategoryGroup, getYearlyBudgetPlan, saveYearlyBudgetPlan } from '../../../api/budget'
import { buildMonthString, currentMonthNumber, currentYear, money, monthToDate } from './helpers'

const monthOptions = [
  ['1', 'January'], ['2', 'February'], ['3', 'March'], ['4', 'April'], ['5', 'May'], ['6', 'June'],
  ['7', 'July'], ['8', 'August'], ['9', 'September'], ['10', 'October'], ['11', 'November'], ['12', 'December'],
]

const frequencyOptions = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
]

const taxProfile = {
  personalAllowance: 12570,
  taperStarts: 100000,
  bands: [
    { from: 0, to: 37700, rate: 0.2 },
    { from: 37700, to: 125140, rate: 0.4 },
    { from: 125140, to: Infinity, rate: 0.45 },
  ],
}

const emptyRow = { name: '', amount: '', frequency: 'monthly', taxed: true }
const emptyGroupForm = { name: '' }
const rowGridClass = 'grid grid-cols-1 sm:grid-cols-[1fr_110px_140px_140px_80px] gap-2 items-center'
const rowGridNoTaxClass = 'grid grid-cols-1 sm:grid-cols-[1fr_140px_140px_80px] gap-2 items-center'
const numberInputClass = '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'

const sortByName = (items) => [...items].sort((first, second) => first.name.localeCompare(second.name, undefined, { sensitivity: 'base' }))

const toMonthlyAmount = (amount, frequency) => {
  const value = Number(amount || 0)
  if (frequency === 'weekly') return value * 52 / 12
  if (frequency === 'yearly') return value / 12
  return value
}

const fromMonthlyAmount = (monthlyAmount, frequency) => {
  const value = Number(monthlyAmount || 0)
  if (frequency === 'weekly') return value * 12 / 52
  if (frequency === 'yearly') return value * 12
  return value
}

const calculateIncomeTax = (grossSalary) => {
  const salary = Math.max(0, Number(grossSalary || 0))
  const allowanceReduction = salary > taxProfile.taperStarts ? Math.min(taxProfile.personalAllowance, (salary - taxProfile.taperStarts) / 2) : 0
  const allowance = Math.max(0, taxProfile.personalAllowance - allowanceReduction)
  const taxableIncome = Math.max(0, salary - allowance)
  const tax = taxProfile.bands.reduce((total, band) => {
    const taxableInBand = Math.max(0, Math.min(taxableIncome, band.to) - band.from)
    return total + taxableInBand * band.rate
  }, 0)
  return { tax, net: salary - tax }
}

const getErrorMessage = (err) => {
  const data = err.response?.data
  return typeof data === 'string' ? data : data?.detail || JSON.stringify(data || 'Something went wrong.')
}

export default function BudgetYearPlanner() {
  const navigate = useNavigate()
  const [startMonth, setStartMonth] = useState(String(currentMonthNumber()))
  const [startYear, setStartYear] = useState(String(currentYear()))
  const [displayFrequency, setDisplayFrequency] = useState('monthly')
  const [plan, setPlan] = useState(null)
  const [expenseValues, setExpenseValues] = useState({})
  const [expenseAddForms, setExpenseAddForms] = useState({})
  const [incomeRows, setIncomeRows] = useState([])
  const [incomeAddForm, setIncomeAddForm] = useState(emptyRow)
  const [groupForm, setGroupForm] = useState(emptyGroupForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [pendingDelete, setPendingDelete] = useState(null)

  const start = buildMonthString(Number(startYear), Number(startMonth))

  const loadPlan = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getYearlyBudgetPlan(start)
      setPlan(data)
      const budgetsByCategory = data.budgets.reduce((acc, budget) => {
        const categoryId = String(budget.category)
        if (!acc[categoryId]) acc[categoryId] = []
        acc[categoryId].push(Number(budget.amount || 0))
        return acc
      }, {})
      setExpenseValues((current) => {
        const next = { ...current }
        data.categories.filter((category) => category.type === 'expense').forEach((category) => {
          const categoryId = String(category.id)
          if (next[categoryId]) return
          const saved = budgetsByCategory[categoryId] || []
          const averageMonthly = saved.length > 0 ? saved.reduce((total, amount) => total + amount, 0) / saved.length : 0
          next[categoryId] = { amount: averageMonthly ? averageMonthly.toFixed(2) : '', frequency: 'monthly' }
        })
        return next
      })
      setIncomeRows((current) => {
        const existingIds = new Set(current.map((row) => Number(row.id)))
        const rowsFromCategories = data.categories
          .filter((category) => category.type === 'income' && !existingIds.has(Number(category.id)))
          .map((category) => {
            const categoryId = String(category.id)
            const saved = budgetsByCategory[categoryId] || []
            const averageMonthly = saved.length > 0 ? saved.reduce((total, amount) => total + amount, 0) / saved.length : 0
            return { id: category.id, name: category.name, amount: averageMonthly ? averageMonthly.toFixed(2) : '', frequency: 'monthly', taxed: true }
          })
        return [...current, ...rowsFromCategories]
      })
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [start])

  useEffect(() => {
    const timeoutId = setTimeout(() => { loadPlan() }, 0)
    return () => clearTimeout(timeoutId)
  }, [loadPlan])

  const months = plan?.months || []
  const expenseCategories = useMemo(() => (plan?.categories || []).filter((category) => category.type === 'expense'), [plan])
  const incomeGroups = useMemo(() => (plan?.category_groups || []).filter((group) => group.type === 'income'), [plan])
  const expenseGroups = useMemo(() => (plan?.category_groups || [])
    .filter((group) => group.type !== 'income')
    .map((group) => ({ ...group, categories: sortByName(expenseCategories.filter((category) => Number(category.group) === Number(group.id))) })), [expenseCategories, plan])

  const updateExpenseValue = (categoryId, field, value) => {
    setExpenseValues((current) => ({ ...current, [categoryId]: { amount: '', frequency: 'monthly', ...current[categoryId], [field]: value } }))
  }

  const updateExpenseAddForm = (groupId, field, value) => {
    setExpenseAddForms((current) => ({ ...current, [groupId]: { ...emptyRow, ...current[groupId], [field]: value } }))
  }

  const updateIncomeRow = (rowId, field, value) => {
    setIncomeRows((rows) => rows.map((row) => row.id === rowId ? { ...row, [field]: value } : row))
  }

  const expenseMonthlyAmount = (categoryId) => {
    const value = expenseValues[String(categoryId)] || { amount: '', frequency: 'monthly' }
    return toMonthlyAmount(value.amount, value.frequency)
  }

  const incomeMonthlyAmount = (row) => toMonthlyAmount(row.amount, row.frequency)
  const taxedIncomeYearly = incomeRows.filter((row) => row.taxed).reduce((total, row) => total + incomeMonthlyAmount(row) * 12, 0)
  const untaxedIncomeMonthly = incomeRows.filter((row) => !row.taxed).reduce((total, row) => total + incomeMonthlyAmount(row), 0)
  const incomeTax = calculateIncomeTax(taxedIncomeYearly).tax
  const totalIncomeMonthly = Math.max(0, (taxedIncomeYearly - incomeTax) / 12) + untaxedIncomeMonthly

  const groupMonthlyTotal = (group) => group.categories.reduce((total, category) => total + expenseMonthlyAmount(category.id), 0)
  const totalExpenseMonthly = expenseGroups.reduce((total, group) => total + groupMonthlyTotal(group), 0)
  const displayTotal = (monthlyAmount) => fromMonthlyAmount(monthlyAmount, displayFrequency)

  const ensureIncomeGroup = async () => {
    if (incomeGroups.length > 0) return incomeGroups[0]
    return createCategoryGroup({ name: 'Income', type: 'income' })
  }

  const handleAddIncome = async (event) => {
    event.preventDefault()
    if (!incomeAddForm.name.trim()) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const group = await ensureIncomeGroup()
      const category = await createCategory({ group: group.id, name: incomeAddForm.name.trim(), type: 'income', color: '#16a34a' })
      setIncomeRows((rows) => [...rows, { ...incomeAddForm, id: category.id, name: category.name }])
      setPlan((current) => current ? { ...current, categories: [...current.categories, category] } : current)
      setIncomeAddForm(emptyRow)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleAddExpenseGroup = async (event) => {
    event.preventDefault()
    if (!groupForm.name.trim()) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await createCategoryGroup({ name: groupForm.name.trim(), type: 'expense' })
      setGroupForm(emptyGroupForm)
      setSuccess(`${groupForm.name.trim()} group added.`)
      await loadPlan()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleAddExpenseCategory = async (event, group) => {
    event.preventDefault()
    const form = { ...emptyRow, ...expenseAddForms[group.id] }
    if (!form.name.trim()) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const category = await createCategory({ group: group.id, name: form.name.trim(), type: 'expense', color: '#2563eb' })
      setExpenseValues((current) => ({ ...current, [category.id]: { amount: form.amount, frequency: form.frequency } }))
      setExpenseAddForms((current) => ({ ...current, [group.id]: emptyRow }))
      setPlan((current) => current ? { ...current, categories: [...current.categories, category] } : current)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const requestDeleteCategory = (category) => {
    setPendingDelete({ type: 'category', item: category })
  }

  const requestDeleteIncome = (row) => {
    setPendingDelete({ type: 'category', item: row })
  }

  const requestDeleteExpenseGroup = (group) => {
    setPendingDelete({ type: 'group', item: group })
  }

  const handleDeleteCategory = async (category) => {
    const categoryId = category.id
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await deleteCategory(categoryId)
      setExpenseValues((current) => {
        const next = { ...current }
        delete next[String(categoryId)]
        return next
      })
      setPlan((current) => current ? {
        ...current,
        categories: current.categories.filter((item) => Number(item.id) !== Number(categoryId)),
        budgets: current.budgets.filter((budget) => Number(budget.category) !== Number(categoryId)),
      } : current)
      setIncomeRows((rows) => rows.filter((row) => Number(row.id) !== Number(categoryId)))
      setSuccess(`${category.name} deleted.`)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteExpenseGroup = async (group) => {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const categoryIds = group.categories.map((category) => Number(category.id))
      await deleteCategoryGroup(group.id)
      setExpenseValues((current) => {
        const next = { ...current }
        categoryIds.forEach((categoryId) => { delete next[String(categoryId)] })
        return next
      })
      setPlan((current) => current ? {
        ...current,
        category_groups: current.category_groups.filter((item) => Number(item.id) !== Number(group.id)),
        categories: current.categories.filter((category) => !categoryIds.includes(Number(category.id))),
        budgets: current.budgets.filter((budget) => !categoryIds.includes(Number(budget.category))),
      } : current)
      setSuccess(`${group.name} group deleted.`)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const confirmPendingDelete = async () => {
    if (!pendingDelete) return
    const { type, item } = pendingDelete
    setPendingDelete(null)
    if (type === 'category') {
      await handleDeleteCategory(item)
      return
    }
    await handleDeleteExpenseGroup(item)
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const expenseBudgets = expenseCategories.flatMap((category) => {
        const amount = expenseMonthlyAmount(category.id).toFixed(2)
        return months.map((month) => ({ category: category.id, month: monthToDate(month), amount }))
      })
      const incomeBudgets = incomeRows.flatMap((row) => {
        const amount = incomeMonthlyAmount(row).toFixed(2)
        return months.map((month) => ({ category: row.id, month: monthToDate(month), amount }))
      })
      const budgets = [...expenseBudgets, ...incomeBudgets]
      await saveYearlyBudgetPlan({ start, budgets })
      navigate('/budget', { state: { success: 'Income and expense budget allocations saved successfully.' } })
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <button onClick={() => navigate('/budget')} className="text-sm text-gray-500 hover:text-blue-700 hover:bg-blue-50 px-3 py-2 rounded-lg transition-colors cursor-pointer">← Budget dashboard</button>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <h1 className="text-lg font-semibold text-gray-900">Yearly budget planner</h1>
            <select value={startMonth} onChange={(event) => setStartMonth(event.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">{monthOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <input type="number" value={startYear} onChange={(event) => setStartYear(event.target.value)} className={`rounded-lg border border-gray-300 px-3 py-2 text-sm w-28 ${numberInputClass}`} />
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 text-sm">{error}</div>}
        {success && <div className="bg-green-50 border border-green-200 text-green-700 rounded-2xl p-4 text-sm">{success}</div>}

        <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="bg-blue-900 text-white px-6 py-4 text-center"><h2 className="text-2xl font-bold">Personal Budget Planner</h2></div>
          <div className="p-6 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-sm text-gray-500">Income and expense allocations save as monthly budget expectations.</p>
            <label className="block text-sm font-medium text-gray-700">Show totals as
              <select value={displayFrequency} onChange={(event) => setDisplayFrequency(event.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-normal">{frequencyOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
            </label>
          </div>

          <div className="bg-blue-700 text-white px-6 py-3"><h3 className="text-lg font-bold">Income</h3></div>
          <IncomeSection rows={incomeRows} addForm={incomeAddForm} saving={saving} displayFrequency={displayFrequency} totalIncomeMonthly={totalIncomeMonthly} incomeTax={incomeTax} updateRow={updateIncomeRow} setAddForm={setIncomeAddForm} onAddIncome={handleAddIncome} onDeleteIncome={requestDeleteIncome} />

          <div className="bg-blue-700 text-white px-6 py-3"><h3 className="text-lg font-bold">Main Expenses</h3></div>
          {loading ? <p className="p-6 text-sm text-gray-500">Loading planner…</p> : (
            <div className="divide-y divide-gray-200">
              {expenseGroups.map((group) => (
                <ExpenseGroup key={group.id} group={group} values={expenseValues} addForm={{ ...emptyRow, ...expenseAddForms[group.id] }} saving={saving} displayFrequency={displayFrequency} updateValue={updateExpenseValue} updateAddForm={updateExpenseAddForm} groupMonthlyTotal={groupMonthlyTotal} displayTotal={displayTotal} onAddCategory={handleAddExpenseCategory} onDeleteCategory={requestDeleteCategory} onDeleteGroup={requestDeleteExpenseGroup} />
              ))}
              <form onSubmit={handleAddExpenseGroup} className="px-6 py-5 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 bg-gray-50">
                <input value={groupForm.name} onChange={(event) => setGroupForm({ name: event.target.value })} className="border border-dashed border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Add new category group" />
                <button disabled={saving || !groupForm.name.trim()} className="border border-blue-200 text-blue-700 bg-blue-50 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-100 disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed">Add group</button>
              </form>
            </div>
          )}

          <SummaryTable expenseGroups={expenseGroups} totalIncomeMonthly={totalIncomeMonthly} totalExpenseMonthly={totalExpenseMonthly} displayFrequency={displayFrequency} groupMonthlyTotal={groupMonthlyTotal} displayTotal={displayTotal} />

          <div className="bg-gray-100 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-gray-300">
            <div><p className="text-sm text-gray-500">Net total shown as {displayFrequency}</p><p className="text-2xl font-bold text-gray-900">{money(displayTotal(totalIncomeMonthly - totalExpenseMonthly))}</p></div>
            <button onClick={handleSave} disabled={saving || loading} className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed">{saving ? 'Saving...' : 'Save budget allocations'}</button>
          </div>
        </section>
      </main>
      <DeleteWarning pendingDelete={pendingDelete} saving={saving} onCancel={() => setPendingDelete(null)} onConfirm={confirmPendingDelete} />
    </div>
  )
}

function DeleteWarning({ pendingDelete, saving, onCancel, onConfirm }) {
  if (!pendingDelete) return null

  const isGroup = pendingDelete.type === 'group'
  const title = isGroup ? `Delete ${pendingDelete.item.name} group?` : `Delete ${pendingDelete.item.name}?`
  const message = isGroup
    ? 'This will delete the category group, all categories inside it, and any saved budget allocations linked to those categories.'
    : 'This will remove the category and any saved budget allocations linked to it.'

  return <div className="fixed inset-0 z-50 bg-gray-900/40 px-4 py-6 flex items-center justify-center">
    <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden">
      <div className="bg-red-50 border-b border-red-100 px-6 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Confirm delete</p>
        <h2 className="mt-1 text-lg font-bold text-gray-900">{title}</h2>
      </div>
      <div className="px-6 py-5 space-y-4">
        <p className="text-sm text-gray-600">{message}</p>
        <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={saving} className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed">Cancel</button>
          <button type="button" onClick={onConfirm} disabled={saving} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed">{saving ? 'Deleting...' : 'Delete'}</button>
        </div>
      </div>
    </div>
  </div>
}

function BudgetRow({ name, amount, frequency, taxed, showTaxed, onAmountChange, onFrequencyChange, onTaxedChange, onDelete }) {
  return <div className={`${showTaxed ? rowGridClass : rowGridNoTaxClass} py-1 pl-4`}>
    <span className="text-gray-900">{name}</span>
    {showTaxed && <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={taxed} onChange={(event) => onTaxedChange(event.target.checked)} /> Taxed</label>}
    <select value={frequency} onChange={(event) => onFrequencyChange(event.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">{frequencyOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
    <input type="number" min="0" step="0.01" value={amount} onChange={(event) => onAmountChange(event.target.value)} className={`border border-gray-300 rounded-lg px-3 py-2 text-sm text-right ${numberInputClass}`} placeholder="0.00" />
    <button type="button" onClick={onDelete} className="text-xs text-red-600 hover:text-red-800 hover:bg-red-50 px-2 py-2 rounded-lg cursor-pointer">Delete</button>
  </div>
}

function IncomeSection({ rows, addForm, saving, displayFrequency, totalIncomeMonthly, incomeTax, updateRow, setAddForm, onAddIncome, onDeleteIncome }) {
  return <section className="px-6 py-5">
    <div className="space-y-1">{rows.length === 0 ? <p className="text-sm text-gray-500 pl-4">No income rows yet.</p> : rows.map((row) => <BudgetRow key={row.id} name={row.name} amount={row.amount} frequency={row.frequency} taxed={row.taxed} showTaxed onAmountChange={(value) => updateRow(row.id, 'amount', value)} onFrequencyChange={(value) => updateRow(row.id, 'frequency', value)} onTaxedChange={(value) => updateRow(row.id, 'taxed', value)} onDelete={() => onDeleteIncome(row)} />)}</div>
    <form onSubmit={onAddIncome} className={`mt-3 ${rowGridClass} pl-4`}>
      <input value={addForm.name} onChange={(event) => setAddForm((current) => ({ ...current, name: event.target.value }))} className="border border-dashed border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Add income" />
      <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={addForm.taxed} onChange={(event) => setAddForm((current) => ({ ...current, taxed: event.target.checked }))} /> Taxed</label>
      <select value={addForm.frequency} onChange={(event) => setAddForm((current) => ({ ...current, frequency: event.target.value }))} className="border border-dashed border-gray-300 rounded-lg px-3 py-2 text-sm">{frequencyOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
      <input type="number" min="0" step="0.01" value={addForm.amount} onChange={(event) => setAddForm((current) => ({ ...current, amount: event.target.value }))} className={`border border-dashed border-gray-300 rounded-lg px-3 py-2 text-sm text-right ${numberInputClass}`} placeholder="0.00" />
      <button disabled={saving || !addForm.name.trim()} className="border border-blue-200 text-blue-700 bg-blue-50 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-100 disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed">Add</button>
    </form>
    <div className="mt-3 space-y-1 border-t border-gray-200 pt-2 pl-4 font-bold italic text-gray-900">
      <div className={rowGridClass}><span>Estimated tax on taxed income</span><span /><span /><span className="text-right pr-3">{money(fromMonthlyAmount(incomeTax / 12, displayFrequency))}</span><span /></div>
      <div className={rowGridClass}><span>Income subtotal</span><span /><span className="text-xs text-gray-500 not-italic font-normal">{displayFrequency}</span><span className="text-right pr-3">{money(fromMonthlyAmount(totalIncomeMonthly, displayFrequency))}</span><span /></div>
    </div>
  </section>
}

function ExpenseGroup({ group, values, addForm, saving, displayFrequency, updateValue, updateAddForm, groupMonthlyTotal, displayTotal, onAddCategory, onDeleteCategory, onDeleteGroup }) {
  return <section className="px-6 py-5"><div className="bg-blue-100 text-blue-900 font-bold px-3 py-2 -mx-3 mb-2 rounded-sm flex items-center justify-between gap-3"><span>{group.name}</span><button type="button" onClick={() => onDeleteGroup(group)} className="text-xs text-red-700 hover:text-red-900 hover:bg-red-50 px-2 py-1 rounded cursor-pointer">Delete group</button></div><div className="space-y-1">{group.categories.map((category) => { const value = values[String(category.id)] || { amount: '', frequency: 'monthly' }; return <BudgetRow key={category.id} name={category.name} amount={value.amount} frequency={value.frequency} showTaxed={false} onAmountChange={(amount) => updateValue(category.id, 'amount', amount)} onFrequencyChange={(frequency) => updateValue(category.id, 'frequency', frequency)} onDelete={() => onDeleteCategory(category)} /> })}</div><form onSubmit={(event) => onAddCategory(event, group)} className={`mt-3 ${rowGridNoTaxClass} pl-4`}><input value={addForm.name} onChange={(event) => updateAddForm(group.id, 'name', event.target.value)} className="border border-dashed border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder={`Add category to ${group.name}`} /><select value={addForm.frequency} onChange={(event) => updateAddForm(group.id, 'frequency', event.target.value)} className="border border-dashed border-gray-300 rounded-lg px-3 py-2 text-sm">{frequencyOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><input type="number" min="0" step="0.01" value={addForm.amount} onChange={(event) => updateAddForm(group.id, 'amount', event.target.value)} className={`border border-dashed border-gray-300 rounded-lg px-3 py-2 text-sm text-right ${numberInputClass}`} placeholder="0.00" /><button disabled={saving || !addForm.name.trim()} className="border border-blue-200 text-blue-700 bg-blue-50 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-100 disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed">Add</button></form><div className="mt-3 border-t border-gray-200 pt-2 pl-4 font-bold italic text-gray-900"><div className={rowGridNoTaxClass}><span>{group.name} subtotal</span><span className="text-xs text-gray-500 not-italic font-normal">{displayFrequency}</span><span className="text-right pr-3">{money(displayTotal(groupMonthlyTotal(group)))}</span><span /></div></div></section>
}

function SummaryTable({ expenseGroups, totalIncomeMonthly, totalExpenseMonthly, displayFrequency, groupMonthlyTotal, displayTotal }) {
  return <section className="px-6 py-5 border-t border-gray-300"><h3 className="font-bold text-gray-900 mb-3">Summary</h3><div className="overflow-x-auto"><table className="min-w-full text-sm"><tbody><tr className="border-b border-gray-200"><td className="py-2 font-medium text-green-700">Total income</td><td className="py-2 text-right font-semibold text-green-700">{money(displayTotal(totalIncomeMonthly))}</td></tr>{expenseGroups.map((group) => <tr key={group.id} className="border-b border-gray-100"><td className="py-2 text-gray-700">{group.name}</td><td className="py-2 text-right text-red-600">{money(displayTotal(groupMonthlyTotal(group)))}</td></tr>)}<tr className="border-b border-gray-200"><td className="py-2 font-medium text-red-700">Total expenses</td><td className="py-2 text-right font-semibold text-red-700">{money(displayTotal(totalExpenseMonthly))}</td></tr><tr><td className="py-3 font-bold text-gray-900">Net total</td><td className="py-3 text-right font-bold text-gray-900">{money(displayTotal(totalIncomeMonthly - totalExpenseMonthly))} <span className="text-xs text-gray-500 font-normal">{displayFrequency}</span></td></tr></tbody></table></div></section>
}