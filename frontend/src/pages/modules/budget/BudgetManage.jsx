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
  updateBudget,
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
  const [successMessage, setSuccessMessage] = useState({ key: '', message: '' })

  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current)
    }
  }, [])

  const filteredCategories = useMemo(
    () => categories.filter((category) => category.type === transactionForm.type && !category.is_archived),
    [categories, transactionForm.type]
  )

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
          <section className="grid grid-cols-1 lg:grid-cols-5 gap-6">
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
                      <button onClick={() => runAction(() => deleteTransaction(tx.id))} className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded cursor-pointer">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
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
                        <span className={overBudget ? 'text-red-700 font-semibold' : 'text-blue-600 font-semibold'}>{money(budget.amount)}</span>
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
                  <div key={item.id} className="border border-gray-100 rounded-xl p-3">
                    <p className="font-medium text-gray-900">{item.name}</p>
                    <p className="text-sm text-gray-500">{money(item.amount)} · {item.frequency} · first payment {item.next_due_date} · {formatDueIn(item.next_due_date)}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}