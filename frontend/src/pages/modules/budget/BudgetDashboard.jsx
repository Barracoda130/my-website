import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getBudgetReports } from '../../../api/budget'
import useBudgetData from './useBudgetData'
import { addMonths, formatDueIn, getMonthDateRange, isOverBudget, money, monthLabel, overBudgetAmount } from './helpers'

const numberValue = (value) => Number(value || 0)

function EmptyInsight({ children }) {
  return <p className="text-sm text-gray-500">{children}</p>
}

function ProgressBar({ value, max, color = 'bg-blue-600' }) {
  const percent = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return <div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className={`h-2 rounded-full ${color}`} style={{ width: `${percent}%` }} /></div>
}

function SectionHeader({ title, action }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-4">
      <h2 className="font-semibold text-gray-900">{title}</h2>
      {action}
    </div>
  )
}

export default function BudgetDashboard() {
  const navigate = useNavigate()
  const {
    month,
    setMonth,
    summary,
    recurringItems,
    loading,
    error,
    hasSetup,
  } = useBudgetData()
  const [reports, setReports] = useState(null)
  const [reportsLoading, setReportsLoading] = useState(true)
  const [reportsError, setReportsError] = useState('')

  const reportStart = useMemo(() => addMonths(month, -5), [month])
  const reportEnd = month

  useEffect(() => {
    let ignore = false
    const loadReports = async () => {
      setReportsLoading(true)
      setReportsError('')
      try {
        const data = await getBudgetReports({ start: reportStart, end: reportEnd })
        if (!ignore) setReports(data)
      } catch (err) {
        if (!ignore) setReportsError(err.response?.data?.detail || 'Could not load spending reports.')
      } finally {
        if (!ignore) setReportsLoading(false)
      }
    }
    loadReports()
    return () => { ignore = true }
  }, [reportStart, reportEnd])

  const monthlyTotals = reports?.monthly_totals || []
  const categoryTotals = reports?.category_totals || []
  const topPayees = reports?.top_payees || []
  const currentMonthDays = useMemo(() => getMonthDateRange(month), [month])
  const dailySpending = useMemo(() => {
    const totalsByDate = new Map((reports?.daily_expense_totals || []).map((item) => [item.date, numberValue(item.spent)]))
    return currentMonthDays.map((date) => ({ date, spent: totalsByDate.get(date) || 0 }))
  }, [currentMonthDays, reports])
  const maxMonthlyExpense = Math.max(1, ...monthlyTotals.map((item) => numberValue(item.expense_total)), ...monthlyTotals.map((item) => numberValue(item.budgeted_total)))
  const maxCategorySpend = Math.max(1, ...categoryTotals.map((item) => numberValue(item.spent)))
  const maxDailySpend = Math.max(1, ...dailySpending.map((item) => item.spent))

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
              onClick={() => navigate('/budget/manage?section=transactions')}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 cursor-pointer"
            >
              Transactions
            </button>
            <button
              onClick={() => navigate('/budget/manage')}
              className="border border-gray-200 text-gray-700 bg-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 cursor-pointer"
            >
              Manage
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
        {reportsError && <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-2xl p-4 text-sm">{reportsError}</div>}

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
            ['Expenses', summary?.expense_total, 'text-red-600'],
            ['Net', summary?.net_total, numberValue(summary?.net_total) >= 0 ? 'text-green-600' : 'text-red-600'],
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
            <SectionHeader title="Spending trend" action={<span className="text-xs text-gray-500">{monthLabel(reportStart)}–{monthLabel(reportEnd)}</span>} />
            {reportsLoading ? <EmptyInsight>Loading spending trend…</EmptyInsight> : monthlyTotals.length === 0 ? <EmptyInsight>No spending trend data yet.</EmptyInsight> : (
              <div className="space-y-4">
                {monthlyTotals.map((item) => {
                  const spent = numberValue(item.expense_total)
                  const budgeted = numberValue(item.budgeted_total)
                  return (
                    <div key={item.month} className="space-y-2">
                      <div className="flex justify-between text-sm gap-3">
                        <span className="font-medium text-gray-900">{monthLabel(item.month)}</span>
                        <span className="text-gray-600">Spent {money(spent)} · Budget {money(budgeted)}</span>
                      </div>
                      <div className="space-y-1">
                        <ProgressBar value={spent} max={maxMonthlyExpense} color="bg-red-500" />
                        <ProgressBar value={budgeted} max={maxMonthlyExpense} color="bg-blue-500" />
                      </div>
                    </div>
                  )
                })}
                <div className="flex gap-4 text-xs text-gray-500"><span><span className="inline-block w-3 h-2 bg-red-500 rounded-sm mr-1" />Spent</span><span><span className="inline-block w-3 h-2 bg-blue-500 rounded-sm mr-1" />Budgeted</span></div>
              </div>
            )}
          </section>

          <section className="bg-white rounded-2xl border border-gray-200 p-6">
            <SectionHeader title="Category breakdown" action={<span className="text-xs text-gray-500">report range</span>} />
            <div className="space-y-3">
              {categoryTotals.length === 0 ? <EmptyInsight>No expense category data yet.</EmptyInsight> : categoryTotals.slice(0, 6).map((item) => {
                const spent = numberValue(item.spent)
                return (
                  <div key={item.category_id} className="space-y-1">
                    <div className="flex justify-between text-sm gap-3">
                      <span className="font-medium text-gray-900">{item.category_name}</span>
                      <span className="text-gray-600">{money(spent)}</span>
                    </div>
                    <ProgressBar value={spent} max={maxCategorySpend} color="bg-purple-500" />
                  </div>
                )
              })}
            </div>
          </section>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-6">
            <SectionHeader title={`Daily spending in ${monthLabel(month)}`} action={<button onClick={() => navigate('/budget/manage?section=transactions')} className="text-sm text-blue-600 hover:text-blue-700 font-medium cursor-pointer">View transactions →</button>} />
            {dailySpending.every((item) => item.spent === 0) ? <EmptyInsight>No daily spending for this month yet.</EmptyInsight> : (
              <div className="h-44 flex items-end gap-1 border-b border-gray-100 pb-2">
                {dailySpending.map((item) => (
                  <div key={item.date} className="flex-1 bg-blue-100 rounded-t hover:bg-blue-200" title={`${item.date}: ${money(item.spent)}`}>
                    <div className="bg-blue-600 rounded-t min-h-1" style={{ height: `${Math.max(3, (item.spent / maxDailySpend) * 160)}px` }} />
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bg-white rounded-2xl border border-gray-200 p-6">
            <SectionHeader title="Top payees" action={<button onClick={() => navigate('/budget/manage?section=transactions')} className="text-sm text-blue-600 hover:text-blue-700 font-medium cursor-pointer">Open →</button>} />
            <div className="space-y-3">
              {topPayees.length === 0 ? <EmptyInsight>No payee data yet.</EmptyInsight> : topPayees.map((item) => (
                <div key={item.payee} className="flex justify-between gap-3 text-sm border-b border-gray-100 pb-2 last:border-b-0">
                  <span className="font-medium text-gray-900 truncate">{item.payee}</span>
                  <span className="text-red-600 font-semibold">{money(item.spent)}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-6">
            <SectionHeader title="Budget vs actual" action={<button onClick={() => navigate('/budget/manage?section=budgets')} className="text-sm text-blue-600 hover:text-blue-700 font-medium cursor-pointer">Edit budgets →</button>} />
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

          <section className="bg-white rounded-2xl border border-gray-200 p-6">
            <SectionHeader title="Upcoming bills" action={<button onClick={() => navigate('/budget/manage?section=recurring')} className="text-sm text-blue-600 hover:text-blue-700 font-medium cursor-pointer">Add →</button>} />
            <div className="space-y-3">
            {recurringItems.length === 0 ? <p className="text-sm text-gray-500">No recurring items yet.</p> : recurringItems.slice(0, 5).map((item) => (
              <div key={item.id} className="border border-gray-100 rounded-xl p-3">
                <p className="font-medium text-gray-900">{item.name}</p>
                <p className="text-sm text-gray-500">{money(item.amount)} · {item.frequency} · first payment {item.next_due_date} · {formatDueIn(item.next_due_date)}</p>
              </div>
            ))}
            </div>
          </section>
        </div>

        <section className="bg-blue-50 rounded-2xl border border-blue-100 p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="font-semibold text-blue-950">Need the transaction ledger?</h2>
            <p className="text-sm text-blue-700 mt-1">Transactions now live in the management area so this dashboard can focus on trends and monthly spending insights.</p>
          </div>
          <button onClick={() => navigate('/budget/manage?section=transactions')} className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 cursor-pointer">
            View / manage transactions
          </button>
        </section>
      </main>
    </div>
  )
}