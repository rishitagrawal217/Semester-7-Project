import { useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { predictUrl } from '../api/client.js'

export default function UrlChecker() {
  const [url, setUrl] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmed = url.trim()
    if (!trimmed) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const data = await predictUrl(trimmed, { explain: true })
      setResult(data)
    } catch (err) {
      setError(
        err?.response?.data?.detail
          ? JSON.stringify(err.response.data.detail)
          : err.message || 'Request failed. Is the backend running?'
      )
    } finally {
      setLoading(false)
    }
  }

  const pct = result ? Math.round(result.confidence * 100) : 0
  const explanation = result?.explanation ?? []
  const chartData = [...explanation].reverse()

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-slate-800">Check a URL</h1>
        <p className="mt-2 text-slate-500">
          Enter any URL to check whether it looks like a phishing site.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/login"
          className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-800 placeholder-slate-400 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
        />
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Checking…' : 'Check'}
        </button>
      </form>

      {error && (
        <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {result && (
        <div
          className={`mt-8 rounded-2xl border p-6 shadow-sm ${
            result.is_phishing
              ? 'border-rose-200 bg-rose-50'
              : 'border-emerald-200 bg-emerald-50'
          }`}
        >
          <div className="flex items-center gap-3">
            <span
              className={`flex h-11 w-11 items-center justify-center rounded-full text-white text-xl ${
                result.is_phishing ? 'bg-rose-500' : 'bg-emerald-500'
              }`}
            >
              {result.is_phishing ? '⚠' : '✓'}
            </span>
            <div>
              <p
                className={`text-lg font-bold ${
                  result.is_phishing ? 'text-rose-700' : 'text-emerald-700'
                }`}
              >
                {result.is_phishing ? 'Phishing detected!' : 'Looks safe'}
              </p>
              <p className="text-sm text-slate-500 break-all">{result.url}</p>
            </div>
          </div>

          <div className="mt-5">
            <div className="flex justify-between text-sm font-medium text-slate-600">
              <span>Confidence</span>
              <span className="tabular-nums">{pct}%</span>
            </div>
            <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-white/70">
              <div
                className={`h-full rounded-full ${
                  result.is_phishing ? 'bg-rose-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {result && explanation.length > 0 && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800">Why?</h2>
          <p className="mt-1 text-sm text-slate-500">
            The features that most influenced this prediction, via SHAP — rose bars pushed
            toward phishing, emerald bars pushed toward legitimate.
          </p>

          <div className="mt-4" style={{ height: Math.max(160, chartData.length * 44) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 4, right: 24, bottom: 4, left: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={150}
                  tick={{ fontSize: 12, fill: '#334155' }}
                />
                <Tooltip
                  cursor={{ fill: '#f8fafc' }}
                  formatter={(value) => [Number(value).toFixed(3), 'SHAP contribution']}
                />
                <Bar dataKey="contribution" radius={4}>
                  {chartData.map((entry) => (
                    <Cell
                      key={entry.feature}
                      fill={entry.direction === 'phishing' ? '#f43f5e' : '#10b981'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <ul className="mt-4 space-y-1.5 text-sm">
            {explanation.map((item) => (
              <li key={item.feature} className="flex items-start gap-2">
                <span
                  className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                    item.direction === 'phishing' ? 'bg-rose-500' : 'bg-emerald-500'
                  }`}
                />
                <span className="text-slate-600">
                  {item.detail} — pushed toward{' '}
                  <span
                    className={
                      item.direction === 'phishing'
                        ? 'font-medium text-rose-700'
                        : 'font-medium text-emerald-700'
                    }
                  >
                    {item.direction}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
