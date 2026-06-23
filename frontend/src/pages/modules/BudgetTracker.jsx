import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  bootstrapBudgetDefaults,
  createAccount,
  createBudget,
  createCategory,
  createCategoryGroup,
  createRecurringItem,
  createTransaction,
  deleteTransaction,
  getAccounts,
  getBudgetSummary,
  getBudgets,
  getCategories,
  getCategoryGroups,
  getRecurringItems,
  getTransactions,
  updateBudget,
} from '../../api/budget'

const todayIso = () => new Date().toISOString().slice(0, 10)
const currentMonth = () => new Date().toISOString().slice(0, 7)
const monthToDate = (month) => `${month}-01`
const money = (value) => `£${Number(value || 0).toFixed(2)}`

const emptyTransaction = {
  type: 'expense',
  account: '',
  category: '',
  amount: '',
  date: todayIso(),
  description: '',
  payee: '',
}

export default function BudgetTracker() {
  const navigate = useNavigate()
  const [month, setMonth] = useState(currentMonth())
  const [summary, setSummary] = useState(null)
  const [groups, setGroups] = useState([])
  const [categories, setCategories] = useState([])
  const [accounts, setAccounts] = useState([])
  const [transactions, setTransactions] = useState([])
  const [budgets, setBudgets] = useState([])
  const [recurringItems, setRecurringItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [transactionForm, setTransactionForm] = useState(emptyTransaction)
  const [budgetForm, setBudgetForm] = useState({ category: '', amount: '' })
  const [categoryForm, setCategoryForm] = useState({ group: '', name: '', type: 'expense' })
  const [groupForm, setGroupForm] = useState({ name: '', type: 'expense' })
  const [accountForm, setAccountForm] = useState({ name: '', type: 'current', opening_balance: '0.00' })
  const [recurringForm, setRecurringForm] = useState({
    name: '',
    account: '',
    category: '',
    amount: '',
    frequency: 'monthly',
    next_due_date: todayIso(),
    type: 'bill',
  })

  const expenseCategories = useMemo(() => categories.filter((category) => category.type === 'expense' && !category.is_archived), [categories])
  const filteredCategories = useMemo(
    () => categories.filter((category) => category.type === transactionForm.type && !category.is_archived),
    [categories, transactionForm.type]
  )

  const loadBudgetData = async () => {
    setLoading(true)
    setError('')
    try {
      const [summaryData, groupData, categoryData, accountData, transactionData, budgetData, recurringData] = await Promise.all([
        getBudgetSummary(month),
        getCategoryGroups(),
        getCategories(),
        getAccounts(),
        getTransactions({ month }),
        getBudgets(month),
        getRecurringItems(),
      ])
      setSummary(summaryData)
      setGroups(groupData)
      setCategories(categoryData)
      setAccounts(accountData)
      setTransactions(transactionData)
      setBudgets(budgetData)
      setRecurringItems(recurringData)
      setTransactionForm((form) => ({
        ...form,
        account: form.account || accountData[0]?.id || '',
        category: form.category || categoryData.find((category) => category.type === form.type)?.id || '',
      }))
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not load your budget data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadBudgetData()
    }, 0)
    return () => clearTimeout(timeoutId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month])

  const runAction = async (action) => {
    setSaving(true)
    setError('')
    try {
      await action()
      await loadBudgetData()
    } catch (err) {
      const data = err.response?.data
      setError(typeof data === 'string' ? data : data?.detail || JSON.stringify(data || 'Something went wrong.'))
    } finally {
      setSaving(false)
    }
  }

  const handleBootstrap = () => runAction(bootstrapBudgetDefaults)

  const handleCreateTransaction = (event) => {
    event.preventDefault()
    runAction(async () => {
      await createTransaction(transactionForm)
      setTransactionForm({ ...emptyTransaction, account: transactionForm.account, type: transactionForm.type })
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
    })
  }

  const handleCreateGroup = (event) => {
    event.preventDefault()
    runAction(async () => {
      await createCategoryGroup(groupForm)
      setGroupForm({ name: '', type: 'expense' })
    })
  }

  const handleCreateCategory = (event) => {
    event.preventDefault()
    runAction(async () => {
      await createCategory({ ...categoryForm, color: '#2563eb' })
      setCategoryForm({ group: '', name: '', type: 'expense' })
    })
  }

  const handleCreateAccount = (event) => {
    event.preventDefault()
    runAction(async () => {
      await createAccount(accountForm)
      setAccountForm({ name: '', type: 'current', opening_balance: '0.00' })
    })
  }

  const handleCreateRecurring = (event) => {
    event.preventDefault()
    runAction(async () => {
      await createRecurringItem(recurringForm)
      setRecurringForm({ ...recurringForm, name: '', amount: '' })
    })
  }

  const hasSetup = groups.length > 0 && categories.length > 0 && accounts.length > 0

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← Dashboard
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-gray-900">Budget Tracker</h1>
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

        {!loading && !hasSetup && (
          <section className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
            <div className="text-5xl mb-4">🌱</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Start with a simple budget setup</h2>
            <p className="text-gray-500 mb-6">Create starter groups, categories, and a current account so you can add your first transaction.</p>
            <button onClick={handleBootstrap} disabled={saving} className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
              {saving ? 'Creating...' : 'Create default setup'}
            </button>
          </section>
        )}

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            ['Income', summary?.income_total, 'text-green-600'],
            ['Expenses', summary?.expense_total, 'text-red-600'],
            ['Net', summary?.net_total, 'text-blue-600'],
            ['Budget Remaining', summary?.remaining_budget, 'text-purple-600'],
          ].map(([label, value, color]) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-200 p-5">
              <p className="text-sm text-gray-500">{label}</p>
              <p className={`text-2xl font-bold mt-2 ${color}`}>{money(value)}</p>
            </div>
          ))}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Add transaction</h2>
            <form onSubmit={handleCreateTransaction} className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
              <select value={transactionForm.type} onChange={(e) => setTransactionForm({ ...transactionForm, type: e.target.value, category: '' })} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
              <input required type="number" step="0.01" min="0.01" placeholder="Amount" value={transactionForm.amount} onChange={(e) => setTransactionForm({ ...transactionForm, amount: e.target.value })} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              <input required type="date" value={transactionForm.date} onChange={(e) => setTransactionForm({ ...transactionForm, date: e.target.value })} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              <select required value={transactionForm.account} onChange={(e) => setTransactionForm({ ...transactionForm, account: e.target.value })} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="">Account</option>
                {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
              </select>
              <select required value={transactionForm.category} onChange={(e) => setTransactionForm({ ...transactionForm, category: e.target.value })} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="">Category</option>
                {filteredCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
              <input required placeholder="Description" value={transactionForm.description} onChange={(e) => setTransactionForm({ ...transactionForm, description: e.target.value })} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              <button disabled={saving || !hasSetup} className="md:col-span-3 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-60">Add transaction</button>
            </form>

            <h2 className="font-semibold text-gray-900 mb-3">Transactions</h2>
            <div className="space-y-2">
              {transactions.length === 0 ? <p className="text-sm text-gray-500">No transactions for this month yet.</p> : transactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between border border-gray-100 rounded-xl p-3">
                  <div>
                    <p className="font-medium text-gray-900">{tx.description}</p>
                    <p className="text-xs text-gray-500">{tx.date} · {tx.category_name} · {tx.account_name}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={tx.type === 'income' ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>{tx.type === 'income' ? '+' : '-'}{money(tx.amount)}</span>
                    <button onClick={() => runAction(() => deleteTransaction(tx.id))} className="text-xs text-red-500 hover:text-red-700">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Monthly budgets</h2>
            <form onSubmit={handleCreateBudget} className="space-y-3 mb-5">
              <select required value={budgetForm.category} onChange={(e) => setBudgetForm({ ...budgetForm, category: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="">Expense category</option>
                {expenseCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
              <input required type="number" step="0.01" min="0.01" placeholder="Budget amount" value={budgetForm.amount} onChange={(e) => setBudgetForm({ ...budgetForm, amount: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              <button disabled={saving} className="w-full bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-60">Set budget</button>
            </form>
            <div className="space-y-3">
              {(summary?.category_spending || []).map((item) => {
                const percent = Math.min(100, (Number(item.spent) / Number(item.budgeted || 1)) * 100)
                return (
                  <div key={item.category_id}>
                    <div className="flex justify-between text-sm mb-1"><span>{item.category_name}</span><span>{money(item.spent)} / {money(item.budgeted)}</span></div>
                    <div className="h-2 bg-gray-100 rounded-full"><div className="h-2 rounded-full bg-blue-600" style={{ width: `${percent}%` }} /></div>
                  </div>
                )
              })}
            </div>
          </section>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Setup</h2>
            <form onSubmit={handleCreateGroup} className="space-y-2 mb-4">
              <input required placeholder="New group name" value={groupForm.name} onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              <button className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm">Add group</button>
            </form>
            <form onSubmit={handleCreateCategory} className="space-y-2 mb-4">
              <input required placeholder="New category name" value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              <select required value={categoryForm.group} onChange={(e) => setCategoryForm({ ...categoryForm, group: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="">Group</option>
                {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
              </select>
              <select value={categoryForm.type} onChange={(e) => setCategoryForm({ ...categoryForm, type: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
              <button className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm">Add category</button>
            </form>
            <form onSubmit={handleCreateAccount} className="space-y-2">
              <input required placeholder="New account name" value={accountForm.name} onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              <button className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm">Add account</button>
            </form>
          </section>

          <section className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Upcoming bills and subscriptions</h2>
            <form onSubmit={handleCreateRecurring} className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
              <input required placeholder="Name" value={recurringForm.name} onChange={(e) => setRecurringForm({ ...recurringForm, name: e.target.value })} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              <input required type="number" step="0.01" min="0.01" placeholder="Amount" value={recurringForm.amount} onChange={(e) => setRecurringForm({ ...recurringForm, amount: e.target.value })} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              <input required type="date" value={recurringForm.next_due_date} onChange={(e) => setRecurringForm({ ...recurringForm, next_due_date: e.target.value })} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              <select required value={recurringForm.account} onChange={(e) => setRecurringForm({ ...recurringForm, account: e.target.value })} className="border border-gray-300 rounded-lg px-3 py-2 text-sm"><option value="">Account</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select>
              <select required value={recurringForm.category} onChange={(e) => setRecurringForm({ ...recurringForm, category: e.target.value })} className="border border-gray-300 rounded-lg px-3 py-2 text-sm"><option value="">Category</option>{expenseCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
              <button disabled={saving || !hasSetup} className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-60">Add recurring item</button>
            </form>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {recurringItems.length === 0 ? <p className="text-sm text-gray-500">No recurring items yet.</p> : recurringItems.map((item) => (
                <div key={item.id} className="border border-gray-100 rounded-xl p-3">
                  <p className="font-medium text-gray-900">{item.name}</p>
                  <p className="text-sm text-gray-500">{money(item.amount)} · {item.frequency} · due {item.next_due_date}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
