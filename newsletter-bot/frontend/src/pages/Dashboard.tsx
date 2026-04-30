import { useQuery } from '@tanstack/react-query'
import { getOverview, getCampaigns, getSubscriberStats } from '../api/client'
import { Mail, Users, BarChart3, MousePointerClick, TrendingUp, Send } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

function StatCard({ label, value, icon: Icon, sub }: any) {
  return (
    <div className="card flex items-start gap-4">
      <div className="w-10 h-10 bg-brand-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
        <Icon size={18} className="text-brand-400" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-100">{value}</p>
        <p className="text-sm text-slate-400">{label}</p>
        {sub && <p className="text-xs text-slate-600 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-700 text-slate-300',
  pending_qa: 'bg-amber-900/40 text-amber-400',
  approved: 'bg-blue-900/40 text-blue-400',
  scheduled: 'bg-purple-900/40 text-purple-400',
  sent: 'bg-green-900/40 text-green-400',
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { data: overview } = useQuery({ queryKey: ['overview'], queryFn: getOverview })
  const { data: campaigns } = useQuery({ queryKey: ['campaigns'], queryFn: getCampaigns })
  const { data: subStats } = useQuery({ queryKey: ['subStats'], queryFn: getSubscriberStats })

  const recent = (campaigns || []).slice(0, 5)

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">AU Accounting & Finance Newsletter Overview</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard label="Active Subscribers" value={subStats?.active ?? '—'} icon={Users} />
        <StatCard label="Campaigns Sent" value={overview?.sent_campaigns ?? '—'} icon={Send} />
        <StatCard label="Total Sends" value={overview?.total_sends ?? '—'} icon={Mail} />
        <StatCard label="Total Opens" value={overview?.total_opens ?? '—'} icon={TrendingUp} />
        <StatCard
          label="Avg Open Rate"
          value={overview ? `${overview.avg_open_rate}%` : '—'}
          icon={BarChart3}
        />
        <StatCard
          label="Avg Click Rate"
          value={overview ? `${overview.avg_click_rate}%` : '—'}
          icon={MousePointerClick}
        />
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-200">Recent Campaigns</h2>
          <button onClick={() => navigate('/campaigns')} className="text-xs text-brand-400 hover:text-brand-300">
            View all →
          </button>
        </div>

        {!recent.length ? (
          <p className="text-sm text-slate-500 py-6 text-center">
            No campaigns yet. Go to Campaigns to generate your first one.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 border-b border-slate-800">
                <th className="text-left pb-2 font-medium">Campaign</th>
                <th className="text-left pb-2 font-medium">Status</th>
                <th className="text-left pb-2 font-medium">Open Rate</th>
                <th className="text-left pb-2 font-medium">Click Rate</th>
                <th className="text-left pb-2 font-medium">Sent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {recent.map((c: any) => (
                <tr
                  key={c.id}
                  className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                  onClick={() => navigate(`/campaigns/${c.id}/qa`)}
                >
                  <td className="py-3 pr-4">
                    <p className="text-slate-200 font-medium truncate max-w-xs">{c.title}</p>
                    <p className="text-xs text-slate-500">{c.angle}</p>
                  </td>
                  <td className="py-3 pr-4">
                    <span className={`badge ${STATUS_COLORS[c.status] || 'bg-slate-700 text-slate-300'}`}>
                      {c.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-slate-300">{c.stats?.open_rate ?? 0}%</td>
                  <td className="py-3 pr-4 text-slate-300">{c.stats?.click_rate ?? 0}%</td>
                  <td className="py-3 text-slate-500">
                    {c.sent_at ? new Date(c.sent_at).toLocaleDateString('en-AU') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2 className="font-semibold text-slate-200 mb-3">Writing Style Guide — AU Accountants & CFOs</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="bg-slate-800/50 rounded-lg p-4">
            <p className="text-brand-400 font-medium mb-2">Tone</p>
            <p className="text-slate-400">Analytical, data-first, ROI-focused. No fluff, no exclamation marks. Treat the reader like a peer — they are.</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-4">
            <p className="text-brand-400 font-medium mb-2">Structure</p>
            <p className="text-slate-400">Hook with a stat → insight → mid CTA → actionable takeaways → closing → soft sell. The content sandwich.</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-4">
            <p className="text-brand-400 font-medium mb-2">What Works</p>
            <p className="text-slate-400">ATO updates, cash flow pressure, headcount costs, BAS/compliance friction, time-to-value for admin tasks.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
