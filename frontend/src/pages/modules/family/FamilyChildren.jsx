import { useEffect, useState } from 'react'
import FamilyLayout from './FamilyLayout'
import { activateChild, createChild, deactivateChild, deleteChild, getChildren, updateChild } from '../../../api/family'
import { calculateAge } from './helpers'

export default function FamilyChildren() {
  const [children, setChildren] = useState([])
  const [form, setForm] = useState({ name: '', date_of_birth: '', notes: '' })
  const [editing, setEditing] = useState(null)
  const [message, setMessage] = useState('')

  const load = () => getChildren().then(setChildren)
  useEffect(() => { load() }, [])
  const save = async (e) => { e.preventDefault(); editing ? await updateChild(editing, form) : await createChild(form); setForm({ name: '', date_of_birth: '', notes: '' }); setEditing(null); setMessage('Child saved.'); load() }
  const toggleActive = async (child) => { child.active ? await deactivateChild(child.id) : await activateChild(child.id); setMessage(child.active ? 'Child deactivated.' : 'Child activated.'); load() }
  const removeChild = async (child) => { if (!window.confirm(`Delete ${child.name}? This will permanently remove the child and their linked transaction splits.`)) return; await deleteChild(child.id); setMessage('Child deleted.'); load() }

  return <FamilyLayout title="Children"><div className="grid grid-cols-1 lg:grid-cols-3 gap-6"><section className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">{children.map((child) => <div key={child.id} className="bg-white rounded-2xl border border-gray-200 p-5"><div className="flex justify-between"><h3 className="font-semibold text-gray-900">{child.name}</h3><span className={`text-xs px-2 py-1 rounded-full ${child.active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{child.active ? 'Active' : 'Inactive'}</span></div><p className="text-sm text-gray-500 mt-2">Age: {calculateAge(child.date_of_birth)}</p><p className="text-sm text-gray-500 mt-2">{child.notes || 'No notes yet.'}</p><div className="flex flex-wrap gap-2 mt-4"><button onClick={() => { setEditing(child.id); setForm({ name: child.name, date_of_birth: child.date_of_birth || '', notes: child.notes || '' }) }} className="text-sm px-3 py-2 bg-blue-50 text-blue-700 rounded-lg cursor-pointer">Edit</button><button onClick={() => toggleActive(child)} className={`text-sm px-3 py-2 rounded-lg cursor-pointer ${child.active ? 'bg-gray-100 text-gray-700' : 'bg-green-50 text-green-700'}`}>{child.active ? 'Deactivate' : 'Activate'}</button><button onClick={() => removeChild(child)} className="text-sm px-3 py-2 bg-red-50 text-red-700 rounded-lg cursor-pointer">Delete</button></div></div>)}</section><form onSubmit={save} className="bg-white rounded-2xl border border-gray-200 p-5 h-fit space-y-4"><h3 className="font-semibold text-gray-900">{editing ? 'Edit child' : 'Add child'}</h3><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" className="w-full border border-gray-300 rounded-lg px-3 py-2" /><input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2" /><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes" className="w-full border border-gray-300 rounded-lg px-3 py-2" /><button className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 cursor-pointer">Save child</button>{message && <p className="text-sm text-green-700">{message}</p>}</form></div></FamilyLayout>
}