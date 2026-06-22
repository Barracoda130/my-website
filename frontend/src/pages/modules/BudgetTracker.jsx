import { useNavigate } from 'react-router-dom'

export default function BudgetTracker() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← Dashboard
          </button>
          <h1 className="text-lg font-semibold text-gray-900">Budget Tracker</h1>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-20 text-center">
        <div className="text-6xl mb-6">💰</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">Budget Tracker</h2>
        <p className="text-gray-500 mb-2">This module is coming soon.</p>
        <p className="text-sm text-gray-400">
          The Budget Tracker will let you manage personal budgets, track income and expenses,
          and view spending summaries.
        </p>
      </main>
    </div>
  )
}
