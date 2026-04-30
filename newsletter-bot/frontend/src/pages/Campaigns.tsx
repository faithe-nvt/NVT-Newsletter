import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getCampaigns, generateCampaign, deleteCampaign, sendCampaign } from '../api/client'
import { Plus, Loader2, Trash2, Eye, Send, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-700 text-slate-300',
  pending_qa: 'bg-amber-900/40 text-amber-400',
  approved: 'bg-blue-900/40 text-blue-400',
  scheduled: 'bg-purple-900/40 text-purple-400',
  sent: 'bg-green-900/40 text-green-400',
}

export default function Campaigns() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [generating, setGenerating] = useState(false)
  const [industry, setIndustry] = useState('accounting')

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: getCampaigns,
  })

  const deleteMut = useMutation({
    mutationFn: deleteCampaign,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns'] })
      toast.success('Campaign deleted')
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Delete failed'),
  })

  const sendMut = useMutation({
    mutationFn: sendCampaign,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['campaigns'] })
      toast.success(`Sending to ${data.recipient_count} subscribers`)
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Send failed'),
  })

  async function handleGenerate() {
    setGenerating(true)
    try {
      const result = await generateCampaign(industry)
      qc.invalidateQueries({ queryKey: ['campaigns'] })
      toast.success('Campaign generated — review in QA')
      navigate(`/campaigns/${result.campaign_id}/qa`)
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Generation failed. Check your API key in Settings.')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Campaigns</h1>
          <p className="text-sm text-slate-500 mt-1">Generate, review, and send A/B newsletters</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={industry}
            onChange={e => setIndustry(e.target.value)}
            className="input w-auto"
          >
            <option value="accounting">AU Accounting / Finance</option>
          </select>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="btn-primary flex items-center gap-2"
          >
            {generating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            {generating ? 'Generating…' : 'Generate Campaign'}
          </button>
        </div>
      </div>

      {generating && (
        <div className="card flex items-center gap-4 bg-brand-600/10 border-brand-600/30">
          <Loader2 size={20} className="animate-spin text-brand-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-brand-300">Sourcing AU news and generating A/B variants…</p>
            <p className="text-xs text-slate-500 mt-0.5">This takes 15-30 seconds — Claude is writing both variants and the QA rationale.</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={24} className="animate-spin text-slate-500" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-slate-500 text-sm">No campaigns yet. Click Generate Campaign to start.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c: any) => (
            <div key={c.id} className="card hover:border-slate-700 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className={`badge ${STATUS_COLORS[c.status] || ''}`}>
                      {c.status.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-slate-600">
                      {c.created_at ? new Date(c.created_at).toLocaleDateString('en-AU') : ''}
                    </span>
                  </div>
                  <h3 className="font-medium text-slate-200 truncate">{c.title}</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    A: "{c.subject_a}"
                    {c.subject_b && <> &nbsp;|&nbsp; B: "{c.subject_b}"</>}
                  </p>
                  {c.angle && (
                    <p className="text-xs text-slate-600 mt-1">Angle: {c.angle}</p>
                  )}
                </div>

                <div className="flex items-center gap-4 flex-shrink-0">
                  {c.status === 'sent' && (
                    <div className="text-right text-xs text-slate-500">
                      <p>{c.stats?.open_rate ?? 0}% open</p>
                      <p>{c.stats?.click_rate ?? 0}% click</p>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigate(`/campaigns/${c.id}/qa`)}
                      className="btn-secondary flex items-center gap-1.5 text-xs"
                    >
                      <Eye size={13} /> Review
                    </button>
                    {c.status === 'approved' && (
                      <button
                        onClick={() => sendMut.mutate(c.id)}
                        disabled={sendMut.isPending}
                        className="btn-primary flex items-center gap-1.5 text-xs"
                      >
                        <Send size={13} /> Send
                      </button>
                    )}
                    {c.status !== 'sent' && (
                      <button
                        onClick={() => {
                          if (confirm('Delete this campaign?')) deleteMut.mutate(c.id)
                        }}
                        className="btn-danger flex items-center gap-1.5 text-xs"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
