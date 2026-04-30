import { useQuery } from '@tanstack/react-query'
import {
  getOverview, getCampaignAnalytics, getEventsTimeline,
  getSubscriberGrowth, getABResults
} from '../api/client'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend
} from 'recharts'
import { Trophy, TrendingUp, TrendingDown, Minus } from 'lucide-react'

const CHART_STYLE = {
  tooltip: { contentStyle: { background: '#1e293b', border: '1px solid #334155', borderRadius: 8 } },
}

export default function Analytics() {
  const { data: overview } = useQuery({ queryKey: ['overview'], queryFn: getOverview })
  const { data: timeline = [] } = useQuery({ queryKey: ['timeline'], queryFn: () => getEventsTimeline(30) })
  const { data: growth = [] } = useQuery({ queryKey: ['growth'], queryFn: () => getSubscriberGrowth(90) })
  const { data: abResults = [] } = useQuery({ queryKey: ['abResults'], queryFn: getABResults })
  const { data: campaigns = [] } = useQuery({ queryKey: ['campaignAnalytics'], queryFn: getCampaignAnalytics })

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Analytics</h1>
        <p className="text-sm text-slate-500 mt-1">Campaign performance, A/B results, and subscriber growth</p>
      </div>

      {/* Overview numbers */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Sends', value: overview?.total_sends ?? 0 },
          { label: 'Total Opens', value: overview?.total_opens ?? 0 },
          { label: 'Avg Open Rate', value: `${overview?.avg_open_rate ?? 0}%` },
          { label: 'Avg Click Rate', value: `${overview?.avg_click_rate ?? 0}%` },
        ].map(s => (
          <div key={s.label} className="card text-center">
            <p className="text-2xl font-bold text-slate-100">{s.value}</p>
            <p className="text-sm text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Opens & Clicks timeline */}
      <div className="card">
        <h2 className="font-semibold text-slate-200 mb-4">Opens & Clicks — Last 30 Days</h2>
        {timeline.length === 0 ? (
          <p className="text-sm text-slate-500 py-8 text-center">No tracking data yet. Send a campaign to start collecting data.</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={timeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
              <Tooltip {...CHART_STYLE.tooltip} />
              <Legend />
              <Line type="monotone" dataKey="opens" stroke="#3b82f6" strokeWidth={2} dot={false} name="Opens" />
              <Line type="monotone" dataKey="clicks" stroke="#10b981" strokeWidth={2} dot={false} name="Clicks" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* A/B Test Results */}
      <div className="card">
        <h2 className="font-semibold text-slate-200 mb-4">A/B Test Results</h2>
        {abResults.length === 0 ? (
          <p className="text-sm text-slate-500 py-4 text-center">No A/B results yet.</p>
        ) : (
          <div className="space-y-4">
            {abResults.map((r: any) => (
              <div key={r.campaign_id} className="bg-slate-800/40 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-slate-200">{r.title}</p>
                  {r.winner && (
                    <span className="badge bg-amber-900/40 text-amber-400 flex items-center gap-1">
                      <Trophy size={11} />
                      Variant {r.winner.toUpperCase()} wins
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {['a', 'b'].map(v => {
                    const data = r[`variant_${v}`] || {}
                    const isWinner = r.winner === v
                    return (
                      <div key={v} className={`rounded-lg p-3 border ${isWinner ? 'border-amber-600/30 bg-amber-900/10' : 'border-slate-700 bg-slate-900'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold text-slate-400">Variant {v.toUpperCase()}</p>
                          {isWinner && <Trophy size={12} className="text-amber-400" />}
                        </div>
                        <p className="text-xs text-slate-500 truncate mb-2">"{data.subject}"</p>
                        <div className="flex gap-4">
                          <div>
                            <p className="text-lg font-bold text-slate-100">{data.open_rate ?? 0}%</p>
                            <p className="text-xs text-slate-500">open rate</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-slate-100">{data.click_rate ?? 0}%</p>
                            <p className="text-xs text-slate-500">click rate</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-slate-100">{data.sent ?? 0}</p>
                            <p className="text-xs text-slate-500">sent</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Subscriber Growth */}
      <div className="card">
        <h2 className="font-semibold text-slate-200 mb-4">Subscriber Growth — Last 90 Days</h2>
        {growth.length === 0 ? (
          <p className="text-sm text-slate-500 py-8 text-center">No subscriber data yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={growth}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} allowDecimals={false} />
              <Tooltip {...CHART_STYLE.tooltip} />
              <Bar dataKey="new_subscribers" fill="#3b82f6" radius={[3, 3, 0, 0]} name="New Subscribers" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Campaign breakdown table */}
      <div className="card overflow-x-auto">
        <h2 className="font-semibold text-slate-200 mb-4">Campaign Breakdown</h2>
        {campaigns.length === 0 ? (
          <p className="text-sm text-slate-500 py-4 text-center">No sent campaigns yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 border-b border-slate-800">
                <th className="text-left pb-2 font-medium">Campaign</th>
                <th className="text-left pb-2 font-medium">Sent</th>
                <th className="text-left pb-2 font-medium">Open Rate</th>
                <th className="text-left pb-2 font-medium">Click Rate</th>
                <th className="text-left pb-2 font-medium">A Winner</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {campaigns.map((c: any) => {
                const va = c.stats?.variant_a || {}
                const vb = c.stats?.variant_b || {}
                const winner = va.open_rate > vb.open_rate ? 'A' : vb.open_rate > va.open_rate ? 'B' : '—'
                return (
                  <tr key={c.id}>
                    <td className="py-2.5 pr-4">
                      <p className="text-slate-200 truncate max-w-xs">{c.title}</p>
                      <p className="text-xs text-slate-500">{c.angle}</p>
                    </td>
                    <td className="py-2.5 pr-4 text-slate-500 text-xs">
                      {c.sent_at ? new Date(c.sent_at).toLocaleDateString('en-AU') : '—'}
                    </td>
                    <td className="py-2.5 pr-4 text-slate-300">{c.stats?.open_rate ?? 0}%</td>
                    <td className="py-2.5 pr-4 text-slate-300">{c.stats?.click_rate ?? 0}%</td>
                    <td className="py-2.5 text-amber-400 font-medium">{winner}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
