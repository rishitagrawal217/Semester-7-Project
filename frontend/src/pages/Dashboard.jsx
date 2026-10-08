import { useEffect, useMemo, useState } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import StatCard from '../components/StatCard.jsx'
import AuthGate from '../components/AuthGate.jsx'
import SourceTabs from '../components/SourceTabs.jsx'
import ConfidenceRing from '../components/ConfidenceRing.jsx'
import Icon from '../components/Icons.jsx'
import { useAuth } from '../auth/AuthContext.jsx'
import { getMetrics, getQrMetrics, getLogs, getQrLogs } from '../api/client.js'

const COLORS = { safe: '#34d399', phishing: '#fb7185', unreadable: '#fbbf24' }
const TOOLTIP_STYLE = {
  background: '#0f1526',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  color: '#e2e8f0',
}

/** Buckets logs into the last 7 UTC calendar days (oldest → newest). */
function buildTimeline(logs) {
  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setUTCHours(0, 0, 0, 0)
    d.setUTCDate(d.getUTCDate() - i)
    days.push({
      key: d.toISOString().slice(0, 10),
      day: d.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' }),
      Safe: 0,
      Phishing: 0,
    })
  }
  const index = Object.fromEntries(days.map((d, i) => [d.key, i]))
  for (const log of logs) {
    if (log.is_phishing == null) continue // unreadable QR rows have no verdict
    const i = index[new Date(log.timestamp).toISOString().slice(0, 10)]
    if (i === undefined) continue
    if (log.is_phishing) days[i].Phishing += 1
    else days[i].Safe += 1
  }
  return days
}

export default function Dashboard() {
  const { isAuthenticated, logout } = useAuth()
  const [source, setSource] = useState('url') // 'url' | 'qr'
  const [metrics, setMetrics] = useState(null)
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [m, l] =
        source === 'url'
          ? await Promise.all([getMetrics(), getLogs(500)])
          : await Promise.all([getQrMetrics(), getQrLogs(500)])
      setMetrics(m)
      setLogs(l)
    } catch (err) {
      const status = err?.response?.status
      if (status === 401 || status === 403) {
        logout()
        setMetrics(null)
        setLogs([])
      } else {
        setError(err.message || 'Failed to load metrics.')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAuthenticated) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, source])

  const timeline = useMemo(() => buildTimeline(logs), [logs])
  const recentThreats = useMemo(() => logs.filter((l) => l.is_phishing).slice(0, 5), [logs])

  if (!isAuthenticated) {
    return <AuthGate message="view the dashboard" />
  }

  const total = metrics?.total_checks ?? 0
  const phishing = metrics?.phishing_detected ?? 0
  const unreadable = metrics?.unreadable_count ?? 0
  const safe = Math.max(0, total - phishing - unreadable)
  const rate = metrics?.detection_rate ?? 0
  const isUrl = source === 'url'

  const pieData = [
    { name: 'Safe', value: safe, color: COLORS.safe },
    { name: 'Phishing', value: phishing, color: COLORS.phishing },
    ...(isUrl ? [] : [{ name: 'Unreadable', value: unreadable, color: COLORS.unreadable }]),
  ]

  return (
    <div>
      <div className="reveal mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Threat <span className="text-gradient">dashboard</span>
          </h1>
          <p className="mt-1 text-slate-400">
            Overview of all {isUrl ? 'URL' : 'QR code'} checks.
          </p>
        </div>
        <button onClick={load} className="btn-ghost">
          <Icon name="refresh" className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="reveal mb-6" style={{ animationDelay: '60ms' }}>
        <SourceTabs value={source} onChange={setSource} />
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-neon-rose/30 bg-neon-rose/10 px-4 py-3 text-sm text-neon-rose">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="glass h-28 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${isUrl ? 'lg:grid-cols-3' : 'lg:grid-cols-4'}`}>
            <StatCard label="Total checked" value={total} accent="blue" icon="database" />
            <StatCard
              label="Phishing detected"
              value={phishing}
              accent="red"
              icon="alert"
              sub={`${safe} marked safe`}
              delay={80}
            />
            <StatCard
              label="Detection rate"
              value={rate}
              suffix="%"
              decimals={rate % 1 ? 1 : 0}
              accent="amber"
              icon="bolt"
              sub={isUrl ? 'of all checks flagged' : 'of readable checks flagged'}
              delay={160}
            />
            {!isUrl && (
              <StatCard
                label="Readable rate"
                value={metrics?.readable_rate ?? 0}
                suffix="%"
                decimals={(metrics?.readable_rate ?? 0) % 1 ? 1 : 0}
                accent="violet"
                icon="scan"
                sub={`${unreadable} unreadable`}
                delay={240}
              />
            )}
          </div>

          {total === 0 ? (
            <div className="glass reveal mt-6 p-10 text-center">
              <Icon name="chart" className="mx-auto h-10 w-10 text-slate-600" />
              <p className="mt-3 text-slate-400">
                No checks yet — run a {isUrl ? 'URL' : 'QR code'} on the{' '}
                {isUrl ? 'Checker' : 'QR Checker'} page first.
              </p>
            </div>
          ) : (
            <>
              <div className="mt-6 grid gap-6 lg:grid-cols-5">
                <div className="glass reveal p-6 lg:col-span-3" style={{ animationDelay: '120ms' }}>
                  <h2 className="text-lg font-semibold text-white">Activity — last 7 days</h2>
                  <p className="text-xs text-slate-500">Checks per day, split by verdict</p>
                  <div className="mt-4 h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={timeline} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.08)" />
                        <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#94a3b8' }} stroke="rgba(255,255,255,0.1)" />
                        <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#94a3b8' }} stroke="rgba(255,255,255,0.1)" />
                        <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} contentStyle={TOOLTIP_STYLE} itemStyle={{ color: '#e2e8f0' }} />
                        <Legend />
                        <Bar dataKey="Safe" stackId="a" fill={COLORS.safe} isAnimationActive={false} />
                        <Bar dataKey="Phishing" stackId="a" fill={COLORS.phishing} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="glass reveal p-6 lg:col-span-2" style={{ animationDelay: '200ms' }}>
                  <h2 className="text-lg font-semibold text-white">Verdict split</h2>
                  <p className="text-xs text-slate-500">
                    {isUrl ? 'Safe vs phishing' : 'Safe vs phishing vs unreadable'}
                  </p>
                  <div className="mt-4 h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={88}
                          paddingAngle={3}
                          stroke="none"
                          isAnimationActive={false}
                        >
                          {pieData.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={{ color: '#e2e8f0' }} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-5">
                <div className="glass reveal flex items-center gap-6 p-6 lg:col-span-2" style={{ animationDelay: '260ms' }}>
                  <ConfidenceRing percent={Math.round(rate)} color="#fbbf24" label="flagged" />
                  <div>
                    <h2 className="text-lg font-semibold text-white">Threat rate</h2>
                    <p className="mt-1 text-sm text-slate-400">
                      {phishing} of {isUrl ? total : total - unreadable} {isUrl ? 'checks' : 'readable checks'} were
                      flagged as phishing.
                    </p>
                  </div>
                </div>

                <div className="glass reveal p-6 lg:col-span-3" style={{ animationDelay: '320ms' }}>
                  <h2 className="text-lg font-semibold text-white">Recent threats</h2>
                  {recentThreats.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-400">Nothing flagged recently — all clear.</p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {recentThreats.map((log) => (
                        <li
                          key={log.id}
                          className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="h-2 w-2 shrink-0 rounded-full bg-neon-rose shadow-[0_0_8px_#fb7185]" />
                            <span className="truncate font-mono text-sm text-slate-300">
                              {isUrl ? log.url : log.decoded_url}
                            </span>
                          </span>
                          <span className="shrink-0 text-xs tabular-nums text-neon-rose">
                            {log.confidence != null ? `${Math.round(log.confidence * 100)}%` : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
