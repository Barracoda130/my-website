import { useEffect, useState } from 'react'
import FamilyLayout from './FamilyLayout'
import { getFamilyContext, getFamilyDashboard } from '../../../api/family'
import { formatCurrency } from './helpers'

function StatCard({ label, value, tone = 'blue' }) {
  const tones = { blue: 'bg-blue-50 text-blue-700', green: 'bg-green-50 text-green-700', amber: 'bg-amber-50 text-amber-700' }
  return <div className="bg-white rounded-2xl border border-gray-200 p-5"><p className="text-sm text-gray-500">{label}</p><p className={`mt-2 text-2xl font-bold ${tones[tone]}`}>{value}</p></div>
}

export default function FamilyDashboard() {
  const [context, setContext] = useState(null)
  const [dashboard, setDashboard] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([getFamilyContext(), getFamilyDashboard()])
      .then(([familyContext, dashboardData]) => { setContext(familyContext); setDashboard(dashboardData) })
      .catch((err) => setError(err.response?.data?.detail || 'Could not load Family Planner.'))
  }, [])

  if (error) return <FamilyLayout><div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-gray-600">{error}</div></FamilyLayout>
  if (!dashboard) return <FamilyLayout><p className="text-gray-500">Loading family planner...</p></FamilyLayout>

  return (
    <FamilyLayout title={`${context?.family?.name || 'Family'} Planner`}>
      <div className="mb-8"><h2 className="text-2xl font-bold text-gray-900">Family fairness ledger</h2><p className="text-gray-500 mt-1">Track counted support, excluded support, and shared expenses calmly over time.</p></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard label="Family average counted support" value={formatCurrency(dashboard.family_average)} />
        <StatCard label="Total counted support" value={formatCurrency(dashboard.total_counted_support)} tone="green" />
        <StatCard label="Largest fairness gap" value={formatCurrency(dashboard.largest_fairness_gap)} tone="amber" />
      </div>
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="p-5 border-b border-gray-200"><h3 className="font-semibold text-gray-900">Support by child</h3></div>
        <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-gray-50 text-gray-500"><tr><th className="text-left p-3">Child</th><th className="text-right p-3">This month</th><th className="text-right p-3">This year</th><th className="text-right p-3">All-time</th><th className="text-right p-3">Difference from average</th></tr></thead><tbody>{dashboard.children.map((child) => (<tr key={child.child_id} className="border-t border-gray-100"><td className="p-3 font-medium text-gray-900">{child.child_name}</td><td className="p-3 text-right">{formatCurrency(dashboard.this_month[child.child_id])}</td><td className="p-3 text-right">{formatCurrency(dashboard.this_year[child.child_id])}</td><td className="p-3 text-right">{formatCurrency(child.counted_total)}</td><td className="p-3 text-right">{formatCurrency(child.difference_from_average)}</td></tr>))}</tbody></table></div>
      </div>
    </FamilyLayout>
  )
}