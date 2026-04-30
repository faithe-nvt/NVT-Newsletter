import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDropzone } from 'react-dropzone'
import { getSubscribers, getSubscriberStats, createSubscriber, deleteSubscriber } from '../api/client'
import api from '../api/client'
import { Upload, UserPlus, Trash2, Users, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Subscribers() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ email: '', first_name: '', last_name: '', company: '' })
  const [uploading, setUploading] = useState(false)

  const { data: subscribers = [] } = useQuery({ queryKey: ['subscribers'], queryFn: getSubscribers })
  const { data: stats } = useQuery({ queryKey: ['subStats'], queryFn: getSubscriberStats })

  const createMut = useMutation({
    mutationFn: createSubscriber,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subscribers'] })
      qc.invalidateQueries({ queryKey: ['subStats'] })
      setForm({ email: '', first_name: '', last_name: '', company: '' })
      setShowForm(false)
      toast.success('Subscriber added')
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Already subscribed'),
  })

  const deleteMut = useMutation({
    mutationFn: deleteSubscriber,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subscribers'] })
      qc.invalidateQueries({ queryKey: ['subStats'] })
      toast.success('Subscriber removed')
    },
  })

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (!file) return
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await api.post('/subscribers/upload-csv', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      qc.invalidateQueries({ queryKey: ['subscribers'] })
      qc.invalidateQueries({ queryKey: ['subStats'] })
      toast.success(`Imported: ${res.data.created} added, ${res.data.skipped} skipped`)
    } catch {
      toast.error('CSV import failed')
    } finally {
      setUploading(false)
    }
  }, [qc])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    multiple: false,
  })

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Subscribers</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your newsletter list</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
          <UserPlus size={15} />
          Add Subscriber
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total', value: stats?.total ?? 0 },
          { label: 'Active', value: stats?.active ?? 0 },
          { label: 'Inactive', value: stats?.inactive ?? 0 },
        ].map(s => (
          <div key={s.label} className="card text-center">
            <p className="text-2xl font-bold text-slate-100">{s.value}</p>
            <p className="text-sm text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Add subscriber form */}
      {showForm && (
        <div className="card space-y-4">
          <h3 className="font-semibold text-slate-200">Add Subscriber</h3>
          <div className="grid grid-cols-2 gap-3">
            <input className="input" placeholder="Email *" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} />
            <input className="input" placeholder="Company" value={form.company} onChange={e => setForm(f => ({...f, company: e.target.value}))} />
            <input className="input" placeholder="First Name" value={form.first_name} onChange={e => setForm(f => ({...f, first_name: e.target.value}))} />
            <input className="input" placeholder="Last Name" value={form.last_name} onChange={e => setForm(f => ({...f, last_name: e.target.value}))} />
          </div>
          <div className="flex gap-2">
            <button onClick={() => createMut.mutate(form)} disabled={!form.email || createMut.isPending} className="btn-primary">
              Add
            </button>
            <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {/* CSV Upload */}
      <div className="card">
        <h3 className="font-semibold text-slate-200 mb-3 flex items-center gap-2">
          <Upload size={16} /> CSV Import
        </h3>
        <p className="text-xs text-slate-500 mb-3">
          Required column: <code className="bg-slate-800 px-1 rounded">email</code>. Optional: <code className="bg-slate-800 px-1 rounded">first_name</code>, <code className="bg-slate-800 px-1 rounded">last_name</code>, <code className="bg-slate-800 px-1 rounded">company</code>
        </p>
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragActive ? 'border-brand-500 bg-brand-600/10' : 'border-slate-700 hover:border-slate-600'
          }`}
        >
          <input {...getInputProps()} />
          {uploading ? (
            <p className="text-sm text-slate-400">Importing…</p>
          ) : isDragActive ? (
            <p className="text-sm text-brand-400">Drop the CSV here</p>
          ) : (
            <p className="text-sm text-slate-500">Drag & drop a CSV file, or click to browse</p>
          )}
        </div>
      </div>

      {/* Subscriber table */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-500 border-b border-slate-800">
              <th className="text-left pb-2 font-medium">Email</th>
              <th className="text-left pb-2 font-medium">Name</th>
              <th className="text-left pb-2 font-medium">Company</th>
              <th className="text-left pb-2 font-medium">Source</th>
              <th className="text-left pb-2 font-medium">Added</th>
              <th className="pb-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {subscribers.map((s: any) => (
              <tr key={s.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="py-2.5 pr-4 text-slate-200">{s.email}</td>
                <td className="py-2.5 pr-4 text-slate-400">
                  {[s.first_name, s.last_name].filter(Boolean).join(' ') || '—'}
                </td>
                <td className="py-2.5 pr-4 text-slate-400">{s.company || '—'}</td>
                <td className="py-2.5 pr-4">
                  <span className="badge bg-slate-800 text-slate-400">{s.source}</span>
                </td>
                <td className="py-2.5 pr-4 text-slate-600 text-xs">
                  {s.created_at ? new Date(s.created_at).toLocaleDateString('en-AU') : '—'}
                </td>
                <td className="py-2.5">
                  <button
                    onClick={() => {
                      if (confirm('Remove subscriber?')) deleteMut.mutate(s.id)
                    }}
                    className="text-slate-600 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {subscribers.length === 0 && (
          <p className="text-center text-slate-500 text-sm py-8">No subscribers yet.</p>
        )}
      </div>
    </div>
  )
}
