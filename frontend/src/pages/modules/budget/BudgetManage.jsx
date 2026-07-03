import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  bootstrapBudgetDefaults,
  createAccount,
  createBudget,
  createCategory,
  createCategoryGroup,
  createRecurringItem,
  createTransaction,
  deleteTransaction,
  importTransactionsCsv,
  updateAccount,
  updateBudget,
  updateCategory,
  updateCategoryGroup,
  updateRecurringItem,
  updateTransaction,
} from '../../../api/budget'
import useBudgetData from './useBudgetData'
import { emptyRecurringItem, emptyTransaction, formatDueIn, isOverBudget, money, monthToDate, overBudgetAmount } from './helpers'

const sections = [
  {
    id: 'transactions',
    title: 'Transactions',
    description: 'Add income and expenses, or remove mistakes.',
    icon: '💳',
  },
  {
    id: 'budgets',
    title: 'Budgets',
    description: 'Set monthly spending limits by category.',
    icon: '📊',
  },
  {
    id: 'setup',
    title: 'Accounts & categories',
    description: 'Manage the structure your budget uses.',
    icon: '🧰',
  },
  {
    id: 'recurring',
    title: 'Recurring items',
    description: 'Track upcoming bills and subscriptions.',
    icon: '🔁',
  },
]

const getErrorMessage = (err) => {
  const data = err.response?.data
  return typeof data === 'string' ? data : data?.detail || JSON.stringify(data || 'Something went wrong.')
}

const accountTypes = [
  ['current', 'Current'],
  ['savings', 'Savings'],
  ['cash', 'Cash'],
  ['credit_card', 'Credit card'],
  ['loan', 'Loan'],
  ['investment', 'Investment'],
  ['other', 'Other'],
]

const groupTypes = [['expense', 'Expense'], ['income', 'Income'], ['mixed', 'Mixed']]
const categoryTypes = [['expense', 'Expense'], ['income', 'Income']]
const recurringTypes = [['bill', 'Bill'], ['subscription', 'Subscription'], ['income', 'Income']]
const recurringFrequencies = [['weekly', 'Weekly'], ['monthly', 'Monthly'], ['yearly', 'Yearly']]

const buildEditForm = (kind, item, month) => {
  if (kind === 'transaction') return { type: item.type, amount: item.amount, date: item.date, account: String(item.account || ''), category: String(item.category || ''), description: item.description || '', payee: item.payee || '', notes: item.notes || '' }
  if (kind === 'budget') return { category: String(item.category || ''), month: item.month || monthToDate(month), amount: item.amount }
  if (kind === 'account') return { name: item.name || '', type: item.type || 'current', opening_balance: item.opening_balance, is_archived: Boolean(item.is_archived) }
  if (kind === 'group') return { name: item.name || '', type: item.type || 'expense', sort_order: String(item.sort_order ?? 0), is_archived: Boolean(item.is_archived) }
  if (kind === 'category') return { name: item.name || '', group: String(item.group || ''), type: item.type || 'expense', color: item.color || '#2563eb', icon: item.icon || '', sort_order: String(item.sort_order ?? 0), is_archived: Boolean(item.is_archived) }
  return { name: item.name || '', amount: item.amount, next_due_date: item.next_due_date || '', frequency: item.frequency || 'monthly', account: String(item.account || ''), category: String(item.category || ''), type: item.type || 'bill', is_active: Boolean(item.is_active), notes: item.notes || '' }
}

const editLabels = {
  transaction: 'transaction',
  budget: 'budget',
  account: 'account',
  group: 'category group',
  category: 'category',
  recurring: 'recurring item',
}

export default function BudgetManage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeSection = sections.some((section) => section.id === searchParams.get('section')) ? searchParams.get('section') : 'transactions'
  const successTimeoutRef = useRef(null)
  const budgetData = useBudgetData()
  const {
    month,
    setMonth,
    summary,
    groups,
    categories,
    accounts,
    transactions,
    budgets,
    recurringItems,
    error,
    setError,
    loadBudgetData,
    hasSetup,
    expenseCategories,
  } = budgetData
  const [saving, setSaving] = useState(false)
  const [transactionForm, setTransactionForm] = useState(emptyTransaction)
  const [budgetForm, setBudgetForm] = useState({ category: '', amount: '' })
  const [categoryForm, setCategoryForm] = useState({ group: '', name: '', type: 'expense' })
  const [groupForm, setGroupForm] = useState({ name: '', type: 'expense' })
  const [accountForm, setAccountForm] = useState({ name: '', type: 'current', opening_balance: '0.00' })
  const [recurringForm, setRecurringForm] = useState(emptyRecurringItem)
  const [csvImportForm, setCsvImportForm] = useState({ account: '', file: null })
  const csvFileInputRef = useRef(null)
  const [successMessage, setSuccessMessage] = useState({ key: '', message: '' })
  const [editingRecord, setEditingRecord] = useState(null)
  const [editForm, setEditForm] = useState({})

  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current)
    }
  }, [])

  const filteredCategories = useMemo(
    () => categories.filter((category) => category.type === transactionForm.type && !category.is_archived),
    [categories, transactionForm.type]
  )

  const activeAccounts = useMemo(() => accounts.filter((account) => !account.is_archived), [accounts])
  const activeGroups = useMemo(() => groups.filter((group) => !group.is_archived), [groups])
  const activeCategories = useMemo(() => categories.filter((category) => !category.is_archived), [categories])

  const showSuccess = (key, message) => {
    if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current)
    setSuccessMessage({ key, message })
    successTimeoutRef.current = setTimeout(() => {
      setSuccessMessage({ key: '', message: '' })
    }, 3500)
  }

  const successFor = (key) => successMessage.key === key ? (
    <p className="mt-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
      {successMessage.message}
    </p>
  ) : null

  const runAction = async (action, success) => {
    setSaving(true)
    setError('')
    try {
      await action()
      await loadBudgetData()
      if (success) showSuccess(success.key, success.message)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (kind, item) => {
    setEditingRecord({ kind, item })
    setEditForm(buildEditForm(kind, item, month))
    setError('')
  }

  const closeEdit = () => {
    setEditingRecord(null)
    setEditForm({})
  }

  const updateEditForm = (field, value) => {
    setEditForm((current) => ({
      ...current,
      [field]: value,
      ...(field === 'type' && editingRecord?.kind === 'transaction' ? { category: '' } : {}),
      ...(field === 'type' && editingRecord?.kind === 'recurring' ? { category: '' } : {}),
    }))
  }

  const handleSaveEdit = (event) => {
    event.preventDefault()
    if (!editingRecord) return
    const { kind, item } = editingRecord
    const actions = {
      transaction: () => updateTransaction(item.id, editForm),
      budget: () => updateBudget(item.id, editForm),
      account: () => updateAccount(item.id, editForm),
      group: () => updateCategoryGroup(item.id, editForm),
      category: () => updateCategory(item.id, editForm),
      recurring: () => updateRecurringItem(item.id, editForm),
    }
    runAction(async () => {
      await actions[kind]()
      closeEdit()
    }, { key: `edit-${kind}`, message: `${editLabels[kind]} updated` })
  }

  const handleSectionChange = (section) => {
    setSearchParams({ section })
  }

  const handleBootstrap = () => runAction(bootstrapBudgetDefaults, { key: 'bootstrap', message: 'Default setup created' })

  const handleCreateTransaction = (event) => {
    event.preventDefault()
    runAction(async () => {
      await createTransaction(transactionForm)
      setTransactionForm({ ...emptyTransaction, account: transactionForm.account, type: transactionForm.type })
    }, { key: 'transaction', message: 'Transaction added' })
  }

  const handleImportTransactionsCsv = (event) => {
    event.preventDefault()
    if (!csvImportForm.file) {
      setError('Choose a CSV file to import.')
      return
    }
    runAction(async () => {
      const result = await importTransactionsCsv(csvImportForm)
      setCsvImportForm({ account: csvImportForm.account, file: null })
      event.target.reset()
      if (csvFileInputRef.current) csvFileInputRef.current.value = ''
      showSuccess(
        'csv-import',
        `Imported ${result.created_transactions} transactions. Created ${result.created_categories} categories. Skipped ${result.skipped_duplicates} duplicates.`
      )
    })
  }

  const handleCreateBudget = (event) => {
    event.preventDefault()
    runAction(async () => {
      const existing = budgets.find((budget) => Number(budget.category) === Number(budgetForm.category))
      const payload = { ...budgetForm, month: monthToDate(month) }
      if (existing) await updateBudget(existing.id, payload)
      else await createBudget(payload)
      setBudgetForm({ category: '', amount: '' })
    }, { key: 'budget', message: 'Budget saved' })
  }

  const handleCreateGroup = (event) => {
    event.preventDefault()
    runAction(async () => {
      await createCategoryGroup(groupForm)
      setGroupForm({ name: '', type: 'expense' })
    }, { key: 'group', message: 'Group added' })
  }

  const handleCreateCategory = (event) => {
    event.preventDefault()
    runAction(async () => {
      await createCategory({ ...categoryForm, color: '#2563eb' })
      setCategoryForm({ group: '', name: '', type: 'expense' })
    }, { key: 'category', message: 'Category added' })
  }

  const handleCreateAccount = (event) => {
    event.preventDefault()
    runAction(async () => {
      await createAccount(accountForm)
      setAccountForm({ name: '', type: 'current', opening_balance: '0.00' })
    }, { key: 'account', message: 'Account added' })
  }

  const handleCreateRecurring = (event) => {
    event.preventDefault()
    runAction(async () => {
      await createRecurringItem(recurringForm)
      setRecurringForm({ ...emptyRecurringItem, account: recurringForm.account, category: recurringForm.category })
    }, { key: 'recurring', message: 'Recurring item added' })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <button
            onClick={() => navigate('/budget')}
            className="text-sm text-gray-500 hover:text-blue-700 hover:bg-blue-50 px-3 py-2 rounded-lg transition-colors cursor-pointer"
          >
            ← Budget dashboard
          </button>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <h1 className="text-lg font-semibold text-gray-900">Manage Budget</h1>
            <input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 text-sm">{error}</div>}

        <section className="bg-white rounded-2xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500 mb-4">Choose one area to manage. This keeps each page focused and avoids showing every budget control at once.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {sections.map((section) => {
              const isActive = section.id === activeSection
              return (
                <button
                  key={section.id}
                  onClick={() => handleSectionChange(section.id)}
                  className={`text-left rounded-2xl border p-4 transition-colors cursor-pointer ${isActive ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{section.icon}</span>
                    <h2 className="font-semibold text-gray-900">{section.title}</h2>
                  </div>
                  <p className="text-sm text-gray-500">{section.description}</p>
                </button>
              )
            })}
          </div>
        </section>

        {activeSection === 'transactions' && (
          <section className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-1">Add transaction</h2>
              <p className="text-sm text-gray-500 mb-4">Record one income or expense item.</p>
              <form onSubmit={handleCreateTransaction} className="space-y-3">
                <select value={transactionForm.type} onChange={(e) => setTransactionForm({ ...transactionForm, type: e.target.value, category: '' })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
                <input required type="number" step="0.01" min="0.01" placeholder="Amount" value={transactionForm.amount} onChange={(e) => setTransactionForm({ ...transactionForm, amount: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                <input required type="date" value={transactionForm.date} onChange={(e) => setTransactionForm({ ...transactionForm, date: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                <select required value={transactionForm.account} onChange={(e) => setTransactionForm({ ...transactionForm, account: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option value="">Account</option>
                  {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                </select>
                <select required value={transactionForm.category} onChange={(e) => setTransactionForm({ ...transactionForm, category: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option value="">Category</option>
                  {filteredCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
                <input placeholder="Description (optional)" value={transactionForm.description} onChange={(e) => setTransactionForm({ ...transactionForm, description: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                <button disabled={saving || !hasSetup} className="w-full bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed">Add transaction</button>
                {successFor('transaction')}
                {successFor('edit-transaction')}
              </form>
              </div>

              <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-4">This month&apos;s transactions</h2>
              <div className="space-y-2">
                {transactions.length === 0 ? <p className="text-sm text-gray-500">No transactions for this month yet.</p> : transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between border border-gray-100 rounded-xl p-3 gap-3">
                    <div>
                      <p className="font-medium text-gray-900">{tx.description || tx.payee || tx.category_name}</p>
                      <p className="text-xs text-gray-500">{tx.date} · {tx.category_name} · {tx.account_name}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={tx.type === 'income' ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>{tx.type === 'income' ? '+' : '-'}{money(tx.amount)}</span>
                      <button type="button" onClick={() => openEdit('transaction', tx)} className="text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded cursor-pointer">Edit</button>
                      <button onClick={() => runAction(() => deleteTransaction(tx.id))} className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded cursor-pointer">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-1">Import transactions from CSV</h2>
              <p className="text-sm text-gray-500 mb-4">Upload a Starling-style CSV statement. Missing categories will be created automatically.</p>
              <form onSubmit={handleImportTransactionsCsv} className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-end">
                <label className="block text-sm font-medium text-gray-700">
                  Import into account
                  <select required value={csvImportForm.account} onChange={(e) => setCsvImportForm({ ...csvImportForm, account: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-normal">
                    <option value="">Account</option>
                    {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                  </select>
                </label>
                <label className="block text-sm font-medium text-gray-700 cursor-pointer group">
                  CSV file
                  <span className="mt-1 flex min-h-10 items-center justify-between gap-3 rounded-lg border-2 border-dashed border-blue-200 bg-blue-50 px-3 py-2 text-sm font-normal text-blue-800 transition-colors group-hover:border-blue-500 group-hover:bg-blue-100 group-focus-within:border-blue-600 group-focus-within:ring-2 group-focus-within:ring-blue-200">
                    <span className="truncate">{csvImportForm.file?.name || 'Click to browse for a CSV file'}</span>
                    <span className="shrink-0 rounded-md bg-white px-2 py-1 text-xs font-semibold text-blue-700 shadow-sm group-hover:bg-blue-600 group-hover:text-white">Browse</span>
                  </span>
                  <input
                    ref={csvFileInputRef}
                    required
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(e) => setCsvImportForm({ ...csvImportForm, file: e.target.files?.[0] || null })}
                    className="sr-only"
                  />
                </label>
                <button disabled={saving || !hasSetup} className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed">
                  {saving ? 'Importing...' : 'Import CSV'}
                </button>
              </form>
              {successFor('csv-import')}
            </div>
          </section>
        )}

        {activeSection === 'budgets' && (
          <section className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-1">Set monthly budget</h2>
              <p className="text-sm text-gray-500 mb-4">Choose an expense category and set this month&apos;s limit.</p>
              <form onSubmit={handleCreateBudget} className="space-y-3">
                <select required value={budgetForm.category} onChange={(e) => setBudgetForm({ ...budgetForm, category: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option value="">Expense category</option>
                  {expenseCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
                <input required type="number" step="0.01" min="0.01" placeholder="Budget amount" value={budgetForm.amount} onChange={(e) => setBudgetForm({ ...budgetForm, amount: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                <button disabled={saving || !hasSetup} className="w-full bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed">Set budget</button>
                {successFor('budget')}
                {successFor('edit-budget')}
              </form>
            </div>

            <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Current budget amounts</h2>
              <div className="space-y-2">
                {budgets.length === 0 ? <p className="text-sm text-gray-500">No budgets set for this month yet.</p> : budgets.map((budget) => {
                  const spending = (summary?.category_spending || []).find((item) => Number(item.category_id) === Number(budget.category))
                  const overBudget = isOverBudget(spending)
                  return (
                    <div key={budget.id} className={`border rounded-xl p-3 ${overBudget ? 'border-red-200 bg-red-50' : 'border-gray-100'}`}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-gray-900">{budget.category_name}</span>
                        <div className="flex items-center gap-2">
                          <span className={overBudget ? 'text-red-700 font-semibold' : 'text-blue-600 font-semibold'}>{money(budget.amount)}</span>
                          <button type="button" onClick={() => openEdit('budget', budget)} className="text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded cursor-pointer">Edit</button>
                        </div>
                      </div>
                      {overBudget && (
                        <p className="mt-2 text-xs text-red-700 font-medium">Over budget by {money(overBudgetAmount(spending))}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </section>
        )}

        {activeSection === 'setup' && (
          <section className="space-y-6">
            {!hasSetup && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center">
                <div className="text-4xl mb-3">🌱</div>
                <h2 className="font-semibold text-gray-900 mb-2">Start with default setup</h2>
                <p className="text-sm text-gray-500 mb-4">Create starter groups, categories, and a current account.</p>
                <button onClick={handleBootstrap} disabled={saving} className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed">
                  {saving ? 'Creating...' : 'Create default setup'}
                </button>
                <div className="max-w-sm mx-auto">{successFor('bootstrap')}</div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h2 className="font-semibold text-gray-900 mb-1">Category group</h2>
                <p className="text-sm text-gray-500 mb-4">Group related categories together.</p>
                <form onSubmit={handleCreateGroup} className="space-y-3">
                  <input required placeholder="New group name" value={groupForm.name} onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  <select value={groupForm.type} onChange={(e) => setGroupForm({ ...groupForm, type: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                  <button disabled={saving} className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm hover:bg-gray-50 cursor-pointer disabled:opacity-60">Add group</button>
                  {successFor('group')}
                </form>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h2 className="font-semibold text-gray-900 mb-1">Category</h2>
                <p className="text-sm text-gray-500 mb-4">Create income or expense categories.</p>
                <form onSubmit={handleCreateCategory} className="space-y-3">
                  <input required placeholder="New category name" value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  <select required value={categoryForm.group} onChange={(e) => setCategoryForm({ ...categoryForm, group: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    <option value="">Group</option>
                    {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                  </select>
                  <select value={categoryForm.type} onChange={(e) => setCategoryForm({ ...categoryForm, type: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                  <button disabled={saving} className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm hover:bg-gray-50 cursor-pointer disabled:opacity-60">Add category</button>
                  {successFor('category')}
                </form>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h2 className="font-semibold text-gray-900 mb-1">Account</h2>
                <p className="text-sm text-gray-500 mb-4">Add bank accounts, wallets, or cash pots.</p>
                <form onSubmit={handleCreateAccount} className="space-y-3">
                  <input required placeholder="New account name" value={accountForm.name} onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  <input required type="number" step="0.01" placeholder="Opening balance" value={accountForm.opening_balance} onChange={(e) => setAccountForm({ ...accountForm, opening_balance: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  <button disabled={saving} className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm hover:bg-gray-50 cursor-pointer disabled:opacity-60">Add account</button>
                  {successFor('account')}
                </form>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <EditableList title="Accounts" empty="No accounts yet." success={successFor('edit-account')}>
                {accounts.map((account) => (
                  <EditableRow key={account.id} title={account.name} meta={`${accountTypes.find(([value]) => value === account.type)?.[1] || account.type} · opening ${money(account.opening_balance)}${account.is_archived ? ' · archived' : ''}`} onEdit={() => openEdit('account', account)} />
                ))}
              </EditableList>
              <EditableList title="Category groups" empty="No category groups yet." success={successFor('edit-group')}>
                {groups.map((group) => (
                  <EditableRow key={group.id} title={group.name} meta={`${groupTypes.find(([value]) => value === group.type)?.[1] || group.type} · sort ${group.sort_order}${group.is_archived ? ' · archived' : ''}`} onEdit={() => openEdit('group', group)} />
                ))}
              </EditableList>
              <EditableList title="Categories" empty="No categories yet." success={successFor('edit-category')}>
                {categories.map((category) => (
                  <EditableRow key={category.id} title={`${category.icon ? `${category.icon} ` : ''}${category.name}`} meta={`${category.group_name} · ${category.type}${category.is_archived ? ' · archived' : ''}`} onEdit={() => openEdit('category', category)} />
                ))}
              </EditableList>
            </div>
          </section>
        )}

        {activeSection === 'recurring' && (
          <section className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-1">Add recurring item</h2>
              <p className="text-sm text-gray-500 mb-4">Track regular bills, subscriptions, or expected income.</p>
              <form onSubmit={handleCreateRecurring} className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">
                  Name
                  <input required placeholder="e.g. Netflix" value={recurringForm.name} onChange={(e) => setRecurringForm({ ...recurringForm, name: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-normal" />
                </label>
                <label className="block text-sm font-medium text-gray-700">
                  Amount
                  <input required type="number" step="0.01" min="0.01" placeholder="0.00" value={recurringForm.amount} onChange={(e) => setRecurringForm({ ...recurringForm, amount: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-normal" />
                </label>
                <label className="block text-sm font-medium text-gray-700">
                  First payment date
                  <input required type="date" value={recurringForm.next_due_date} onChange={(e) => setRecurringForm({ ...recurringForm, next_due_date: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-normal" />
                  <span className="mt-1 block text-xs text-gray-500 font-normal">This is saved as the next due date for this recurring item.</span>
                </label>
                <label className="block text-sm font-medium text-gray-700">
                  Frequency
                  <select required value={recurringForm.frequency} onChange={(e) => setRecurringForm({ ...recurringForm, frequency: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-normal">
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </label>
                <select required value={recurringForm.account} onChange={(e) => setRecurringForm({ ...recurringForm, account: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"><option value="">Account</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select>
                <select required value={recurringForm.category} onChange={(e) => setRecurringForm({ ...recurringForm, category: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"><option value="">Category</option>{expenseCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
                <button disabled={saving || !hasSetup} className="w-full bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed">Add recurring item</button>
                {successFor('recurring')}
              </form>
            </div>

            <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Existing recurring items</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {recurringItems.length === 0 ? <p className="text-sm text-gray-500">No recurring items yet.</p> : recurringItems.map((item) => (
                  <div key={item.id} className={`border rounded-xl p-3 ${item.is_active ? 'border-gray-100' : 'border-gray-200 bg-gray-50'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-gray-900">{item.name}</p>
                        <p className="text-sm text-gray-500">{money(item.amount)} · {item.frequency} · first payment {item.next_due_date} · {formatDueIn(item.next_due_date)}{item.is_active ? '' : ' · inactive'}</p>
                      </div>
                      <button type="button" onClick={() => openEdit('recurring', item)} className="text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded cursor-pointer">Edit</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
      <EditDialog
        editingRecord={editingRecord}
        editForm={editForm}
        saving={saving}
        accounts={activeAccounts}
        groups={activeGroups}
        categories={activeCategories}
        expenseCategories={expenseCategories}
        onChange={updateEditForm}
        onClose={closeEdit}
        onSubmit={handleSaveEdit}
      />
    </div>
  )
}

function EditableList({ title, empty, success, children }) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children
  const isEmpty = Array.isArray(items) ? items.length === 0 : !items
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <h2 className="font-semibold text-gray-900 mb-4">{title}</h2>
      <div className="space-y-2">{isEmpty ? <p className="text-sm text-gray-500">{empty}</p> : items}</div>
      {success}
    </div>
  )
}

function EditableRow({ title, meta, onEdit }) {
  return (
    <div className="flex items-center justify-between gap-3 border border-gray-100 rounded-xl p-3">
      <div>
        <p className="font-medium text-gray-900">{title}</p>
        <p className="text-xs text-gray-500">{meta}</p>
      </div>
      <button type="button" onClick={onEdit} className="text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded cursor-pointer">Edit</button>
    </div>
  )
}

function EditDialog({ editingRecord, editForm, saving, accounts, groups, categories, expenseCategories, onChange, onClose, onSubmit }) {
  if (!editingRecord) return null
  const { kind } = editingRecord
  const title = `Edit ${editLabels[kind]}`
  const transactionCategories = categories.filter((category) => category.type === editForm.type)
  const recurringCategories = categories.filter((category) => editForm.type === 'income' ? category.type === 'income' : category.type === 'expense')

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/40 px-4 py-6 flex items-center justify-center">
      <div role="dialog" aria-modal="true" aria-labelledby="edit-dialog-title" className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl border border-gray-200 shadow-xl">
        <div className="border-b border-gray-200 px-6 py-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Edit details</p>
            <h2 id="edit-dialog-title" className="mt-1 text-lg font-bold text-gray-900">{title}</h2>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-100 px-2 py-1 rounded cursor-pointer disabled:opacity-60">Close</button>
        </div>
        <form onSubmit={onSubmit} className="px-6 py-5 space-y-4">
          {kind === 'transaction' && <TransactionEditFields form={editForm} accounts={accounts} categories={transactionCategories} onChange={onChange} />}
          {kind === 'budget' && <BudgetEditFields form={editForm} categories={expenseCategories} onChange={onChange} />}
          {kind === 'account' && <AccountEditFields form={editForm} onChange={onChange} />}
          {kind === 'group' && <GroupEditFields form={editForm} onChange={onChange} />}
          {kind === 'category' && <CategoryEditFields form={editForm} groups={groups} onChange={onChange} />}
          {kind === 'recurring' && <RecurringEditFields form={editForm} accounts={accounts} categories={recurringCategories} onChange={onChange} />}
          <div className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} disabled={saving} className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed">Cancel</button>
            <button disabled={saving} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed">{saving ? 'Saving...' : 'Save changes'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return <label className="block text-sm font-medium text-gray-700">{label}{children}</label>
}

function ToggleField({ label, checked, onChange }) {
  return <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 rounded border-gray-300" />{label}</label>
}

function TransactionEditFields({ form, accounts, categories, onChange }) {
  return <>
    <Field label="Type"><select value={form.type} onChange={(e) => onChange('type', e.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-normal"><option value="expense">Expense</option><option value="income">Income</option></select></Field>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field label="Amount"><input required type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => onChange('amount', e.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-normal" /></Field><Field label="Date"><input required type="date" value={form.date} onChange={(e) => onChange('date', e.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-normal" /></Field></div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field label="Account"><select required value={form.account} onChange={(e) => onChange('account', e.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-normal"><option value="">Account</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></Field><Field label="Category"><select required value={form.category} onChange={(e) => onChange('category', e.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-normal"><option value="">Category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></Field></div>
    <Field label="Description"><input value={form.description} onChange={(e) => onChange('description', e.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-normal" /></Field>
    <Field label="Payee"><input value={form.payee} onChange={(e) => onChange('payee', e.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-normal" /></Field>
    <Field label="Notes"><textarea value={form.notes} onChange={(e) => onChange('notes', e.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-normal" rows="3" /></Field>
  </>
}

function BudgetEditFields({ form, categories, onChange }) {
  return <div className="grid grid-cols-1 sm:grid-cols-3 gap-3"><Field label="Category"><select required value={form.category} onChange={(e) => onChange('category', e.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-normal"><option value="">Category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></Field><Field label="Month"><input required type="date" value={form.month} onChange={(e) => onChange('month', e.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-normal" /></Field><Field label="Amount"><input required type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => onChange('amount', e.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-normal" /></Field></div>
}

function AccountEditFields({ form, onChange }) {
  return <><Field label="Name"><input required value={form.name} onChange={(e) => onChange('name', e.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-normal" /></Field><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field label="Type"><select value={form.type} onChange={(e) => onChange('type', e.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-normal">{accountTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field label="Opening balance"><input required type="number" step="0.01" value={form.opening_balance} onChange={(e) => onChange('opening_balance', e.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-normal" /></Field></div><ToggleField label="Archive account" checked={form.is_archived} onChange={(value) => onChange('is_archived', value)} /></>
}

function GroupEditFields({ form, onChange }) {
  return <><Field label="Name"><input required value={form.name} onChange={(e) => onChange('name', e.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-normal" /></Field><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field label="Type"><select value={form.type} onChange={(e) => onChange('type', e.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-normal">{groupTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field label="Sort order"><input required type="number" min="0" step="1" value={form.sort_order} onChange={(e) => onChange('sort_order', e.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-normal" /></Field></div><ToggleField label="Archive group" checked={form.is_archived} onChange={(value) => onChange('is_archived', value)} /></>
}

function CategoryEditFields({ form, groups, onChange }) {
  return <><Field label="Name"><input required value={form.name} onChange={(e) => onChange('name', e.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-normal" /></Field><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field label="Group"><select required value={form.group} onChange={(e) => onChange('group', e.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-normal"><option value="">Group</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></Field><Field label="Type"><select value={form.type} onChange={(e) => onChange('type', e.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-normal">{categoryTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field></div><div className="grid grid-cols-1 sm:grid-cols-3 gap-3"><Field label="Colour"><input value={form.color} onChange={(e) => onChange('color', e.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-normal" /></Field><Field label="Icon"><input value={form.icon} onChange={(e) => onChange('icon', e.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-normal" /></Field><Field label="Sort order"><input required type="number" min="0" step="1" value={form.sort_order} onChange={(e) => onChange('sort_order', e.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-normal" /></Field></div><ToggleField label="Archive category" checked={form.is_archived} onChange={(value) => onChange('is_archived', value)} /></>
}

function RecurringEditFields({ form, accounts, categories, onChange }) {
  return <><Field label="Name"><input required value={form.name} onChange={(e) => onChange('name', e.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-normal" /></Field><div className="grid grid-cols-1 sm:grid-cols-3 gap-3"><Field label="Type"><select value={form.type} onChange={(e) => onChange('type', e.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-normal">{recurringTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field label="Amount"><input required type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => onChange('amount', e.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-normal" /></Field><Field label="Frequency"><select value={form.frequency} onChange={(e) => onChange('frequency', e.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-normal">{recurringFrequencies.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field></div><Field label="First / next payment date"><input required type="date" value={form.next_due_date} onChange={(e) => onChange('next_due_date', e.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-normal" /></Field><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field label="Account"><select required value={form.account} onChange={(e) => onChange('account', e.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-normal"><option value="">Account</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></Field><Field label="Category"><select required value={form.category} onChange={(e) => onChange('category', e.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-normal"><option value="">Category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></Field></div><Field label="Notes"><textarea value={form.notes} onChange={(e) => onChange('notes', e.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-normal" rows="3" /></Field><ToggleField label="Recurring item is active" checked={form.is_active} onChange={(value) => onChange('is_active', value)} /></>
}