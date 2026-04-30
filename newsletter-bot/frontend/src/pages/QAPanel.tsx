import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getCampaign, approveCampaign, sendCampaign, updateCampaign } from '../api/client'
import {
  CheckCircle, Send, ChevronLeft, ExternalLink,
  Lightbulb, FileText, BarChart3, Edit3, Save, X
} from 'lucide-react'
import toast from 'react-hot-toast'

function SectionLabel({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon size={15} className="text-brand-400" />
      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
    </div>
  )
}

function VariantPreview({ variant, label, subject }: { variant: any; label: string; subject: string }) {
  if (!variant) return null
  return (
    <div className="space-y-4">
      <div className="bg-slate-800/60 rounded-lg p-4 border border-slate-700">
        <p className="text-xs text-slate-500 mb-1">Subject line</p>
        <p className="text-sm font-medium text-slate-200">"{subject}"</p>
      </div>

      <div className="border-l-4 border-brand-600 pl-4">
        <p className="text-xs text-slate-500 mb-1">Hook</p>
        <p className="text-sm text-slate-200 italic leading-relaxed">{variant.hook}</p>
      </div>

      <div>
        <p className="text-xs text-slate-500 mb-1">Insight</p>
        <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">{variant.insight_block}</p>
      </div>

      <div className="bg-blue-950/40 border border-blue-800/30 rounded-lg p-3">
        <p className="text-xs text-blue-400 mb-1">Mid CTA</p>
        <p className="text-sm text-slate-300">{variant.mid_cta}</p>
      </div>

      <div>
        <p className="text-xs text-slate-500 mb-2">Key Takeaways</p>
        <ul className="space-y-1.5">
          {(variant.practical_takeaway || []).map((t: string, i: number) => (
            <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
              <span className="text-brand-400 mt-0.5 flex-shrink-0">•</span>
              {t}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="text-xs text-slate-500 mb-1">Closing Thought</p>
        <p className="text-sm text-slate-300 leading-relaxed">{variant.closing_thought}</p>
      </div>

      <div className="bg-slate-900 border border-slate-700 rounded-lg p-3">
        <p className="text-xs text-slate-500 mb-1">End CTA</p>
        <p className="text-sm text-slate-300">{variant.end_cta}</p>
      </div>
    </div>
  )
}

export default function QAPanel() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<'a' | 'b'>('a')
  const [editingNotes, setEditingNotes] = useState(false)
  const [notes, setNotes] = useState('')

  const { data: campaign, isLoading } = useQuery({
    queryKey: ['campaign', id],
    queryFn: () => getCampaign(Number(id)),
    onSuccess: (d: any) => setNotes(d.qa_notes || ''),
  } as any)

  const approveMut = useMutation({
    mutationFn: () => approveCampaign(Number(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaign', id] })
      qc.invalidateQueries({ queryKey: ['campaigns'] })
      toast.success('Campaign approved and ready to send')
    },
    onError: () => toast.error('Approval failed'),
  })

  const sendMut = useMutation({
    mutationFn: () => sendCampaign(Number(id)),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['campaign', id] })
      toast.success(`Sending to ${data.recipient_count} subscribers`)
      navigate('/campaigns')
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Send failed'),
  })

  const saveNotesMut = useMutation({
    mutationFn: () => updateCampaign(Number(id), { qa_notes: notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaign', id] })
      setEditingNotes(false)
      toast.success('Notes saved')
    },
  })

  if (isLoading || !campaign) {
    return (
      <div className="p-8 flex justify-center">
        <div className="animate-pulse text-slate-500">Loading campaign…</div>
      </div>
    )
  }

  let variantA: any = null
  let variantB: any = null
  try { variantA = JSON.parse(campaign.body_a || '{}') } catch {}
  try { variantB = JSON.parse(campaign.body_b || '{}') } catch {}

  const canApprove = ['pending_qa', 'draft'].includes(campaign.status)
  const canSend = campaign.status === 'approved'
  const alreadySent = campaign.status === 'sent'

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/campaigns')} className="btn-secondary flex items-center gap-1.5 text-xs">
          <ChevronLeft size={14} /> Back
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-100 truncate">{campaign.title}</h1>
          <p className="text-xs text-slate-500 mt-0.5">QA Review Panel</p>
        </div>
        <div className="flex items-center gap-2">
          {canApprove && (
            <button
              onClick={() => approveMut.mutate()}
              disabled={approveMut.isPending}
              className="btn-primary flex items-center gap-2"
            >
              <CheckCircle size={15} />
              Approve Campaign
            </button>
          )}
          {canSend && (
            <button
              onClick={() => {
                if (confirm('Send this campaign to all active subscribers?')) sendMut.mutate()
              }}
              disabled={sendMut.isPending}
              className="btn-primary flex items-center gap-2 bg-green-700 hover:bg-green-600"
            >
              <Send size={15} />
              Send Now
            </button>
          )}
          {alreadySent && (
            <span className="badge bg-green-900/40 text-green-400">Sent</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left: QA analysis */}
        <div className="col-span-1 space-y-4">

          {/* Campaign Rationale */}
          <div className="card">
            <SectionLabel icon={Lightbulb} label="Why This Campaign Works" />
            <p className="text-sm text-slate-300 leading-relaxed">{campaign.campaign_rationale}</p>
          </div>

          {/* Writing Style */}
          <div className="card">
            <SectionLabel icon={FileText} label="Writing Style & Angle" />
            <div className="mb-3">
              <p className="text-xs text-slate-500 mb-1">Angle Taken (Variant A)</p>
              <span className="badge bg-brand-600/20 text-brand-400">{campaign.angle}</span>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">{campaign.style_rationale}</p>
            <div className="mt-3 pt-3 border-t border-slate-800">
              <p className="text-xs text-slate-500 mb-1">A/B Test Design</p>
              <p className="text-xs text-slate-400">
                Variant A = analytical/data-led. Variant B = narrative/scenario-led.
                Test measures CFO preference: precision vs context-first framing.
              </p>
            </div>
          </div>

          {/* Sources */}
          <div className="card">
            <SectionLabel icon={ExternalLink} label="Sources Used" />
            {(campaign.sources || []).length === 0 ? (
              <p className="text-xs text-slate-500">No sources recorded.</p>
            ) : (
              <ul className="space-y-2">
                {campaign.sources.map((s: any, i: number) => (
                  <li key={i} className="text-xs">
                    <p className="text-slate-300 font-medium">{s.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-slate-600">{s.source}</span>
                      {s.url && (
                        <a href={s.url} target="_blank" rel="noreferrer"
                          className="text-brand-400 hover:text-brand-300 flex items-center gap-0.5">
                          <ExternalLink size={10} /> View
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Stats if sent */}
          {alreadySent && campaign.stats && (
            <div className="card">
              <SectionLabel icon={BarChart3} label="Campaign Results" />
              <div className="grid grid-cols-2 gap-3 text-sm">
                {['a', 'b'].map(v => {
                  const vs = campaign.stats[`variant_${v}`] || {}
                  return (
                    <div key={v} className="bg-slate-800/50 rounded-lg p-3">
                      <p className="text-xs text-slate-500 mb-2 font-medium">Variant {v.toUpperCase()}</p>
                      <p className="text-lg font-bold text-slate-100">{vs.open_rate ?? 0}%</p>
                      <p className="text-xs text-slate-500">open rate</p>
                      <p className="text-sm font-semibold text-slate-200 mt-1">{vs.click_rate ?? 0}%</p>
                      <p className="text-xs text-slate-500">click rate</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* QA Notes */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <SectionLabel icon={Edit3} label="QA Notes" />
              {!editingNotes ? (
                <button onClick={() => setEditingNotes(true)} className="text-xs text-slate-500 hover:text-slate-300">
                  Edit
                </button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => saveNotesMut.mutate()} className="text-xs text-brand-400 flex items-center gap-1">
                    <Save size={11} /> Save
                  </button>
                  <button onClick={() => setEditingNotes(false)} className="text-xs text-slate-500 flex items-center gap-1">
                    <X size={11} /> Cancel
                  </button>
                </div>
              )}
            </div>
            {editingNotes ? (
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="input h-28 resize-none text-xs"
                placeholder="Add your QA notes, edits, feedback…"
              />
            ) : (
              <p className="text-xs text-slate-400 leading-relaxed">
                {campaign.qa_notes || 'No notes yet. Click Edit to add QA feedback.'}
              </p>
            )}
          </div>
        </div>

        {/* Right: Newsletter preview with A/B toggle */}
        <div className="col-span-2 card space-y-5">
          <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1 w-fit">
            <button
              onClick={() => setActiveTab('a')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'a' ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Variant A — Analytical
            </button>
            <button
              onClick={() => setActiveTab('b')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'b' ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Variant B — Narrative
            </button>
          </div>

          {activeTab === 'a' ? (
            <VariantPreview variant={variantA} label="A" subject={campaign.subject_a} />
          ) : (
            <VariantPreview variant={variantB} label="B" subject={campaign.subject_b || campaign.subject_a} />
          )}
        </div>
      </div>
    </div>
  )
}
