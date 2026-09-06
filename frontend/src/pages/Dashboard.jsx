import { useEffect, useState } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts'
import StatCard from '../components/StatCard.jsx'
import AuthGate from '../components/AuthGate.jsx'
import SourceTabs from '../components/SourceTabs.jsx'
import { useAuth } from '../auth/AuthContext.jsx'
import { getMetrics, getQrMetrics } from '../api/client.js'

export default function Dashboard() {
  const { isAuthenticated, logout } = useAuth()
  const [source, setSource] = useState('url') // 'url' | 'qr'
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      setMetrics(source === 'url' ? await getMetrics() : await getQrMetrics())
    } catch (err) {
      const status = err?.response?.status
      if (status === 401 || status === 403) {
        logout()
        setMetrics(null)
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

  if (!isAuthenticated) {
    return <AuthGate message="view the dashboard" />
  }

  const total = metrics?.total_checks ?? 0
  const phishing = metrics?.phishing_detected ?? 0
  const safe = Math.max(0, total - phishing - (metrics?.unreadable_count ?? 0))
  const rate = metrics?.detection_rate ?? 0

  const pieData =
    source === 'url'
      ? [
          { name: 'Safe', value: safe },
          { name: 'Phishing', value: phishing },
        ]
      : [
          { name: 'Safe', value: safe },
          { name: 'Phishing', value: phishing },
          { name: 'Unreadable', value: metrics?.unreadable_count ?? 0 },
        ]
  const COLORS = ['#10b981', '#f43f5e', '#f59e0b']

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Dashboard</h1>
          <p className="mt-1 text-slate-500">
            Overview of all {source === 'url' ? 'URL' : 'QR code'} checks.
          </p>
        </div>
        <button
          onClick={load}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          ↻ Refresh
        </button>
      </div>

      <div className="mb-6">
        <SourceTabs value={source} onChange={setSource} />
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-slate-400">Loading…</p>
      ) : (
        <>
          <div className={`grid grid-cols-1 gap-4 ${source === 'url' ? 'sm:grid-cols-3' : 'sm:grid-cols-4'}`}>
            <StatCard label="Total Checked" value={total} accent="blue" />
            <StatCard
              label="Phishing Detected"
              value={phishing}
              accent="red"
              sub={`${safe} marked safe`}
            />
            <StatCard
              label="Detection Rate"
              value={`${rate}%`}
              accent="amber"
              sub={source === 'url' ? 'of all checks flagged' : 'of readable checks flagged'}
            />
            {source === 'qr' && (
              <StatCard
                label="Readable Rate"
                value={`${metrics?.readable_rate ?? 0}%`}
                accent="blue"
                sub={`${metrics?.unreadable_count ?? 0} unreadable`}
              />
            )}
          </div>

          <div className="mt-6 rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">
              {source === 'url' ? 'Safe vs Phishing' : 'Safe vs Phishing vs Unreadable'}
            </h2>
            {total === 0 ? (
              <p className="text-slate-400 text-sm">
                No checks yet — run a {source === 'url' ? 'URL' : 'QR code'} on the{' '}
                {source === 'url' ? 'Checker' : 'QR Checker'} page first.
              </p>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      isAnimationActive={false}
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={COLORS[i]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
