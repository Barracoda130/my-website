import { useEffect, useState } from 'react'
import FamilyLayout from './FamilyLayout'
import { createTransaction, getChildPaidTransactions, getChildren, getFamilyOptions } from '../../../api/family'
import { formatCurrency, formatDate, todayInput } from './helpers'

const newChildPaidForm = (children = []) => ({
  date: todayInput(),
  title: '',
  amount: '',
  currency: 'GBP',
  type: 'child_paid_personal_transaction',
  category: 'other',
  paid_by: 'child',
  counts_toward_fairness: false,
  is_large_expense: false,
  split_between_children: false,
  recurring: false,
  recurring_frequency: 'none',
  recurring_start_date: '',
  recurring_end_date: '',
  notes: '',
  receipt_url: '',
  splits: children[0] ? [{ child: children[0].id, amount: '', percentage: '100.00' }] : [],
})

export default function FamilyChildPaidTransactions() {
  const [children, setChildren] = useState([])
  const [options, setOptions] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [form, setForm] = useState(null)
  const [message, setMessage] = useState('')

  const load = () => getChildPaidTransactions().then(setTransactions)

  useEffect(() => {
    Promise.all([getChildren(), getFamilyOptions(), getChildPaidTransactions()]).then(([kids, opts, txs]) => {
      setChildren(kids)
      setOptions(opts)
      setTransactions(txs)
      setForm(newChildPaidForm(kids))
    })
  }, [])

  const setField = (name, value) => setForm((prev) => ({ ...prev, [name]: value }))

  const save = async (event) => {
    event.preventDefault()
    await createTransaction({
      ...form,
      type: 'child_paid_personal_transaction',
      paid_by: 'child',
      counts_toward_fairness: false,
      recurring: false,
      recurring_frequency: 'none',
      splits: form.splits.map((split) => ({ ...split, amount: form.amount, percentage: '100.00' })),
    })
    setMessage('Child-paid personal transaction added.')
    setForm(newChildPaidForm(children))
    load()
  }

  if (!form || !options) {
    return <FamilyLayout title="Child-paid transactions"><p className="text-gray-500">Loading child-paid transactions...</p></FamilyLayout>
  }

  return (
    <FamilyLayout title="Child-paid transactions">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Child-paid personal transactions</h2>
        <p className="text-gray-500 mt-1">
          Record purchases the child paid for themselves. These are informational only and do not count toward fairness.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className="xl:col-span-2 bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="p-5 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">All child-paid transactions</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="p-3 text-left">Date</th>
                  <th className="p-3 text-left">Child</th>
                  <th className="p-3 text-left">Title</th>
                  <th className="p-3 text-left">Category</th>
                  <th className="p-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} className="border-t border-gray-100">
                    <td className="p-3">{formatDate(tx.date)}</td>
                    <td className="p-3">{tx.splits.map((split) => split.child_name).join(', ')}</td>
                    <td className="p-3">
                      <div className="font-medium text-gray-900">{tx.title}</div>
                      {tx.notes && <div className="text-xs text-gray-500">{tx.notes}</div>}
                    </td>
                    <td className="p-3">{tx.category_display}</td>
                    <td className="p-3 text-right">{formatCurrency(tx.amount)}</td>
                  </tr>
                ))}
                {transactions.length === 0 && (
                  <tr><td colSpan="5" className="p-6 text-center text-gray-500">No child-paid transactions recorded yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <form onSubmit={save} className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3 h-fit">
          <h3 className="font-semibold text-gray-900">Add child-paid transaction</h3>
          <input required value={form.date} onChange={(event) => setField('date', event.target.value)} type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2" />
          <select value={form.splits[0]?.child || ''} onChange={(event) => setField('splits', [{ child: Number(event.target.value), amount: form.amount, percentage: '100.00' }])} className="w-full border border-gray-300 rounded-lg px-3 py-2">
            {children.map((child) => <option key={child.id} value={child.id}>{child.name}</option>)}
          </select>
          <input required value={form.title} onChange={(event) => setField('title', event.target.value)} placeholder="What did they buy?" className="w-full border border-gray-300 rounded-lg px-3 py-2" />
          <input required value={form.amount} onChange={(event) => setField('amount', event.target.value)} type="number" min="0.01" step="0.01" placeholder="Amount" className="w-full border border-gray-300 rounded-lg px-3 py-2" />
          <select value={form.category} onChange={(event) => setField('category', event.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2">
            {options.categories.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <textarea value={form.notes} onChange={(event) => setField('notes', event.target.value)} placeholder="Notes" className="w-full border border-gray-300 rounded-lg px-3 py-2" />
          <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 text-xs text-amber-800">
            These transactions are saved as paid by child and excluded from fairness calculations automatically.
          </div>
          <button className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 cursor-pointer">Add personal transaction</button>
          {message && <p className="text-sm text-green-700">{message}</p>}
        </form>
      </div>
    </FamilyLayout>
  )
}