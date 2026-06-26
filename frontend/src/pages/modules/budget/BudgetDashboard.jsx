import { useNavigate } from 'react-router-dom'
import useBudgetData from './useBudgetData'
import { formatDueIn, isOverBudget, money, overBudgetAmount } from './helpers'

export default function BudgetDashboard() {
  const navigate = useNavigate()
  const {
    month,
    setMonth,
    summary,
    transactions,
    recurringItems,
    loading,
    error,
    hasSetup,
  } = useBudgetData()

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-sm text-gray-500 hover:text-blue-700 hover:bg-blue-50 px-3 py-2 rounded-lg transition-colors cursor-pointer"
          >
            ← Dashboard
          </button>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <h1 className="text-lg font-semibold text-gray-900">Budget Tracker</h1>
            <input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <button
              onClick={() => navigate('/budget/manage')}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 cursor-pointer"
            >
              Manage budget
            </button>
            <button
              onClick={() => navigate('/budget/yearly')}
              className="border border-blue-200 text-blue-700 bg-blue-50 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-100 cursor-pointer"
            >
              Plan year
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 text-sm">{error}</div>}

        {!loading && !hasSetup && (
          <section className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
            <div className="text-5xl mb-4">🌱</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Your budget needs a quick setup</h2>
            <p className="text-gray-500 mb-6">Create starter groups, categories, and an account from the manage page.</p>
            <button
              onClick={() => navigate('/budget/manage?section=setup')}
              className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 cursor-pointer"
            >
              Go to setup
            </button>
          </section>
        )}

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            ['Actual Income', summary?.income_total, 'text-green-600'],
            ['Expected Income', summary?.expected_income_total, 'text-emerald-600'],
            ['Expenses', summary?.expense_total, 'text-red-600'],
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
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="font-semibold text-gray-900">Transactions</h2>
              <button onClick={() => navigate('/budget/manage?section=transactions')} className="text-sm text-blue-600 hover:text-blue-700 font-medium cursor-pointer">
                Add transaction →
              </button>
            </div>
            <div className="space-y-2">
              {transactions.length === 0 ? <p className="text-sm text-gray-500">No transactions for this month yet.</p> : transactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between border border-gray-100 rounded-xl p-3 gap-3">
                  <div>
                    <p className="font-medium text-gray-900">{tx.description || tx.payee || tx.category_name}</p>
                    <p className="text-xs text-gray-500">{tx.date} · {tx.category_name} · {tx.account_name}</p>
                  </div>
                  <span className={tx.type === 'income' ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>{tx.type === 'income' ? '+' : '-'}{money(tx.amount)}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="font-semibold text-gray-900">Monthly budgets</h2>
              <button onClick={() => navigate('/budget/manage?section=budgets')} className="text-sm text-blue-600 hover:text-blue-700 font-medium cursor-pointer">
                Edit →
              </button>
            </div>
            <div className="space-y-3">
              {(summary?.category_spending || []).length === 0 ? <p className="text-sm text-gray-500">No budgets set for this month yet.</p> : (summary?.category_spending || []).map((item) => {
                const percent = Math.min(100, (Number(item.spent) / Number(item.budgeted || 1)) * 100)
                const overBudget = isOverBudget(item)
                return (
                  <div key={item.category_id} className={`rounded-xl border p-3 ${overBudget ? 'border-red-200 bg-red-50' : 'border-transparent'}`}>
                    <div className="flex justify-between gap-3 text-sm mb-1">
                      <span className="font-medium text-gray-900">{item.category_name}</span>
                      <span className={overBudget ? 'text-red-700 font-semibold' : 'text-gray-700'}>{money(item.spent)} / {money(item.budgeted)}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full"><div className={`h-2 rounded-full ${overBudget ? 'bg-red-600' : 'bg-blue-600'}`} style={{ width: `${percent}%` }} /></div>
                    {overBudget && (
                      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-red-700">
                        <span className="font-semibold uppercase tracking-wide">Over budget</span>
                        <span>{money(overBudgetAmount(item))} over</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        </div>

        <section className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="font-semibold text-gray-900">Upcoming bills and subscriptions</h2>
            <button onClick={() => navigate('/budget/manage?section=recurring')} className="text-sm text-blue-600 hover:text-blue-700 font-medium cursor-pointer">
              Add recurring item →
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {recurringItems.length === 0 ? <p className="text-sm text-gray-500">No recurring items yet.</p> : recurringItems.map((item) => (
              <div key={item.id} className="border border-gray-100 rounded-xl p-3">
                <p className="font-medium text-gray-900">{item.name}</p>
                <p className="text-sm text-gray-500">{money(item.amount)} · {item.frequency} · first payment {item.next_due_date} · {formatDueIn(item.next_due_date)}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}