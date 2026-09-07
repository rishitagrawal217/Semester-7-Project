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

/** Verdict card + SHAP "Why?" breakdown, shared by UrlChecker and QRChecker. */
export default function PredictionResult({ isPhishing, confidence, subtitle, explanation = [] }) {
  const pct = Math.round(confidence * 100)
  const chartData = [...explanation].reverse()

  return (
    <>
      <div
        className={`mt-8 rounded-2xl border p-6 shadow-sm ${
          isPhishing ? 'border-rose-200 bg-rose-50' : 'border-emerald-200 bg-emerald-50'
        }`}
      >
        <div className="flex items-center gap-3">
          <span
            className={`flex h-11 w-11 items-center justify-center rounded-full text-white text-xl ${
              isPhishing ? 'bg-rose-500' : 'bg-emerald-500'
            }`}
          >
            {isPhishing ? '⚠' : '✓'}
          </span>
          <div>
            <p
              className={`text-lg font-bold ${
                isPhishing ? 'text-rose-700' : 'text-emerald-700'
              }`}
            >
              {isPhishing ? 'Phishing detected!' : 'Looks safe'}
            </p>
            <p className="text-sm text-slate-500 break-all">{subtitle}</p>
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
                isPhishing ? 'bg-rose-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {explanation.length > 0 && (
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
                {/* isAnimationActive={false}: React 18 StrictMode's double-mount
                    breaks Recharts' enter animation, same as the Dashboard donut. */}
                <Bar dataKey="contribution" radius={4} isAnimationActive={false}>
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
    </>
  )
}
