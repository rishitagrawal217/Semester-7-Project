import { useEffect, useMemo, useState } from 'react'
import { getLogs, getQrLogs } from '../api/client.js'
import { useAuth } from '../auth/AuthContext.jsx'
import AuthGate from '../components/AuthGate.jsx'
import SourceTabs from '../components/SourceTabs.jsx'

function formatTime(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  return isNaN(d.getTime()) ? ts : d.toLocaleString()
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Detection Logs</h1>
          <p className="mt-1 text-slate-500">
            History of every {source === 'url' ? 'URL' : 'QR code'} checked.
          </p>
        </div>
        <button
          onClick={load}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          ↻ Refresh
        </button>
      </div>

      <div className="mb-4">
        <SourceTabs value={source} onChange={setSource} />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={source === 'url' ? 'Search URL…' : 'Search decoded URL…'}
          className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
        />
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
          {[
            { key: 'all', label: 'All' },
            { key: 'phishing', label: 'Phishing' },
            { key: 'safe', label: 'Safe' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                filter === key
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">{source === 'url' ? 'URL' : 'Decoded URL'}</th>
                <th className="px-4 py-3 font-medium">Confidence</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                    No logs to show.
                  </td>
                </tr>
              ) : (
                filtered.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      {source === 'qr' && !log.qr_readable ? (
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-700">
                          Unreadable
                        </span>
                      ) : (
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            log.is_phishing
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {log.is_phishing ? 'Phishing' : 'Safe'}
                        </span>
                      )}
                    </td>
                    <td
                      className="px-4 py-3 max-w-md truncate text-slate-700"
                      title={source === 'url' ? log.url : log.decoded_url ?? log.filename}
                    >
                      {source === 'url' ? log.url : log.decoded_url ?? `(${log.filename})`}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-600">
                      {log.confidence != null ? `${Math.round(log.confidence * 100)}%` : '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-500">
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
        <p className="mt-3 text-xs text-slate-400">
          Showing {filtered.length} of {logs.length} records.
        </p>
      )}
    </div>
  )
}
