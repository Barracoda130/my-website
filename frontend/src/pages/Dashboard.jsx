import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Map of module slugs to their display info
const MODULE_INFO = {
  budget_tracker: {
    title: 'Budget Tracker',
    description: 'Track your personal income, expenses, and budgets.',
    icon: '💰',
    route: '/budget',
    color: 'bg-green-50 border-green-200 hover:bg-green-100 hover:border-green-300',
    iconBg: 'bg-green-100',
  },
  family_finances: {
    title: 'Family Finances',
    description: 'Manage shared finances with your household group.',
    icon: '🏠',
    route: '/family',
    color: 'bg-blue-50 border-blue-200 hover:bg-blue-100 hover:border-blue-300',
    iconBg: 'bg-blue-100',
  },
}

export default function Dashboard() {
  const { user, modules, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const displayName = user?.first_name || user?.username || 'there'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900">My Dashboard</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">
              Signed in as <span className="font-medium text-gray-700">{user?.username}</span>
            </span>
            <button
              onClick={handleLogout}
              className="text-sm text-red-600 hover:text-red-700 hover:bg-red-50 font-medium px-3 py-2 rounded-lg transition-colors cursor-pointer"
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Hello, {displayName}! 👋</h2>
          <p className="text-gray-500 mt-1">Here are the tools you have access to.</p>
        </div>

        {modules.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
            <div className="text-4xl mb-4">🔐</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No modules yet</h3>
            <p className="text-gray-500 text-sm">
              You don&apos;t have access to any modules yet. Contact an administrator to get access.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {modules.map((mod) => {
              const info = MODULE_INFO[mod.module]
              if (!info) return null
              return (
                <button
                  key={mod.module}
                  onClick={() => navigate(info.route)}
                  className={`text-left p-6 rounded-2xl border transition-colors cursor-pointer ${info.color}`}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4 ${info.iconBg}`}>
                    {info.icon}
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">{info.title}</h3>
                  <p className="text-sm text-gray-500">{info.description}</p>
                </button>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
