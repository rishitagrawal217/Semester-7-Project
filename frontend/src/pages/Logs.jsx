import { useEffect, useMemo, useState } from 'react'
import { getLogs, getQrLogs } from '../api/client.js'
import { useAuth } from '../auth/AuthContext.jsx'
import AuthGate from '../components/AuthGate.jsx'
import SourceTabs from '../components/SourceTabs.jsx'
import Icon from '../components/Icons.jsx'

function formatTime(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  return isNaN(d.getTime()) ? ts : d.toLocaleString()
}

function Pill({ tone, children }) {
  const tones = {
    rose: 'bg-neon-rose/15 text-neon-rose ring-neon-rose/30',
    green: 'bg-neon-green/15 text-neon-green ring-neon-green/30',
    amber: 'bg-neon-amber/15 text-neon-amber ring-neon-amber/30',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${tones[tone]}`}>
      {children}
    </span>
  )
}

export default function Logs() {
  const { isAuthenticated, logout } = useAuth()
  const [source, setSource] = useState('url') // 'url' | 'qr'
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all') // all | phishing | safe

  async function load() {
    setLoading(true)
    setError('')
    try {
      setLogs(source === 'url' ? await getLogs(200) : await getQrLogs(200))
    } catch (err) {
      const status = err?.response?.status
      if (status === 401 || status === 403) {
        // Token invalid/expired — drop it so the login form reappears.
        logout()
        setLogs([])
      } else {
        setError(err.message || 'Failed to load logs.')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAuthenticated) load()
    else setLogs([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, source])

  const filtered = useMemo(() => {
    return logs.filter((log) => {
      const identifier = source === 'url' ? log.url : log.decoded_url ?? log.filename
      if (filter === 'phishing' && !log.is_phishing) return false
      if (filter === 'safe' && log.is_phishing) return false
      if (search && !identifier?.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [logs, filter, search, source])

  // Not signed in → show the login gate.
  if (!isAuthenticated) {
    return <AuthGate message="view the detection logs" />
  }

  return (
    <div>
      <div className="reveal mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Detection <span className="text-gradient">logs</span>
          </h1>
          <p className="mt-1 text-slate-400">
            History of every {source === 'url' ? 'URL' : 'QR code'} checked.
          </p>
        </div>
        <button onClick={load} className="btn-ghost">
          <Icon name="refresh" className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="reveal mb-4" style={{ animationDelay: '60ms' }}>
        <SourceTabs value={source} onChange={setSource} />
      </div>

      <div className="reveal mb-4 flex flex-col gap-3 sm:flex-row" style={{ animationDelay: '120ms' }}>
        <div className="relative flex-1">
          <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={source === 'url' ? 'Search URL…' : 'Search decoded URL…'}
            className="input-field !py-2.5 !pl-10 text-sm"
          />
        </div>
        <div className="flex gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
          {[
            { key: 'all', label: 'All' },
            { key: 'phishing', label: 'Phishing' },
            { key: 'safe', label: 'Safe' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-all ${
                filter === key
                  ? 'bg-gradient-to-r from-neon-cyan/20 to-neon-violet/20 text-white shadow-[inset_0_0_0_1px_rgba(34,211,238,0.35)]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-neon-rose/30 bg-neon-rose/10 px-4 py-3 text-sm text-neon-rose">
          {error}
        </div>
      )}

      <div className="glass reveal overflow-hidden" style={{ animationDelay: '180ms' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-white/5 bg-white/[0.03] text-left text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">{source === 'url' ? 'URL' : 'Decoded URL'}</th>
                <th className="px-4 py-3 font-medium">Confidence</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                    No logs to show.
                  </td>
                </tr>
              ) : (
                filtered.map((log) => (
                  <tr key={log.id} className="transition-colors hover:bg-white/[0.04]">
                    <td className="px-4 py-3">
                      {source === 'qr' && !log.qr_readable ? (
                        <Pill tone="amber">Unreadable</Pill>
                      ) : log.is_phishing ? (
                        <Pill tone="rose">Phishing</Pill>
                      ) : (
                        <Pill tone="green">Safe</Pill>
                      )}
                    </td>
                    <td
                      className="max-w-md truncate px-4 py-3 font-mono text-[13px] text-slate-300"
                      title={source === 'url' ? log.url : log.decoded_url ?? log.filename}
                    >
                      {source === 'url' ? log.url : log.decoded_url ?? `(${log.filename})`}
                    </td>
                    <td className="px-4 py-3">
                      {log.confidence != null ? (
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
                            <div
                              className={`h-full rounded-full ${log.is_phishing ? 'bg-neon-rose' : 'bg-neon-green'}`}
                              style={{ width: `${Math.round(log.confidence * 100)}%` }}
                            />
                          </div>
                          <span className="tabular-nums text-slate-400">
                            {Math.round(log.confidence * 100)}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                      {formatTime(log.timestamp)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {!loading && (
        <p className="mt-3 text-xs text-slate-500">
          Showing {filtered.length} of {logs.length} records.
        </p>
      )}
    </div>
  )
}
