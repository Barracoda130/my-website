import { NavLink, useNavigate } from 'react-router-dom'

const navItems = [
  ['Overview', '/family'],
  ['Children', '/family/children'],
  ['Transactions', '/family/transactions'],
  ['Fairness', '/family/fairness'],
]

export default function FamilyLayout({ title, children }) {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/dashboard')} className="text-sm text-gray-500 hover:text-gray-700 cursor-pointer">← Dashboard</button>
            <h1 className="text-lg font-semibold text-gray-900">{title || 'Family Planner'}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {navItems.map(([label, to]) => (
              <NavLink key={to} to={to} end={to === '/family'} className={({ isActive }) => `px-3 py-2 rounded-lg text-sm font-medium ${isActive ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                {label}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  )
}