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
import ConfidenceRing from './ConfidenceRing.jsx'
import Icon from './Icons.jsx'

const ROSE = '#fb7185'
const GREEN = '#34d399'

/** Verdict card + SHAP "Why?" breakdown, shared by UrlChecker and QRChecker. */
export default function PredictionResult({ isPhishing, confidence, subtitle, explanation = [] }) {
  const pct = Math.round(confidence * 100)
  const chartData = [...explanation].reverse()
  const color = isPhishing ? ROSE : GREEN

  return (
    <>
      <div
        className={`glass reveal mt-8 overflow-hidden p-6 sm:p-8 ${
          isPhishing
            ? '!border-neon-rose/40 shadow-[0_0_60px_rgba(251,113,133,0.15)]'
            : '!border-neon-green/40 shadow-[0_0_60px_rgba(52,211,153,0.12)]'
        }`}
      >
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full blur-3xl"
          style={{ background: isPhishing ? 'rgba(251,113,133,0.25)' : 'rgba(52,211,153,0.2)' }}
        />
        <div className="relative flex flex-col items-center gap-6 sm:flex-row sm:items-center">
          <ConfidenceRing percent={pct} color={color} />
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <span
              className={`animate-pop inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${
                isPhishing ? 'bg-neon-rose/15 text-neon-rose' : 'bg-neon-green/15 text-neon-green'
              }`}
            >
              <Icon name={isPhishing ? 'alert' : 'check'} className="h-3.5 w-3.5" strokeWidth={2.4} />
              {isPhishing ? 'Threat detected' : 'No threat found'}
            </span>
            <h2 className="mt-3 text-2xl font-bold text-white sm:text-3xl">
              {isPhishing ? 'Phishing detected' : 'Looks safe'}
            </h2>
            <p className="mt-1 break-all font-mono text-sm text-slate-400">{subtitle}</p>
            <p className="mt-3 text-sm text-slate-400">
              {isPhishing
                ? 'Do not enter passwords, card details or personal information on this site.'
                : 'No strong phishing signals in the address itself. A safe verdict is not a guarantee — stay alert on login pages.'}
            </p>
          </div>
        </div>
      </div>

      {explanation.length > 0 && (
        <div className="glass reveal mt-6 p-6" style={{ animationDelay: '150ms' }}>
          <div className="flex items-center gap-2">
            <Icon name="cpu" className="h-5 w-5 text-neon-violet" />
            <h2 className="text-lg font-semibold text-white">Why this verdict?</h2>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            The features that most influenced this prediction, measured with SHAP —{' '}
            <span className="text-neon-rose">rose</span> bars pushed toward phishing,{' '}
            <span className="text-neon-green">green</span> bars toward legitimate.
          </p>

          <div className="mt-4" style={{ height: Math.max(160, chartData.length * 44) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 4, right: 24, bottom: 4, left: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.08)" />
                <XAxis type="number" tick={{ fontSize: 12, fill: '#94a3b8' }} stroke="rgba(255,255,255,0.1)" />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={160}
                  tick={{ fontSize: 12, fill: '#cbd5e1' }}
                  stroke="rgba(255,255,255,0.1)"
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  contentStyle={{
                    background: '#0f1526',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 10,
                    color: '#e2e8f0',
                  }}
                  itemStyle={{ color: '#e2e8f0' }}
                  formatter={(value) => [Number(value).toFixed(3), 'SHAP contribution']}
                />
                {/* isAnimationActive={false}: React 18 StrictMode's double-mount
                    breaks Recharts' enter animation, same as the Dashboard donut. */}
                <Bar dataKey="contribution" radius={4} isAnimationActive={false}>
                  {chartData.map((entry) => (
                    <Cell
                      key={entry.feature}
                      fill={entry.direction === 'phishing' ? ROSE : GREEN}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <ul className="mt-4 space-y-2 text-sm">
            {explanation.map((item, i) => (
              <li
                key={item.feature}
                className="reveal flex items-start gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2"
                style={{ animationDelay: `${250 + i * 70}ms` }}
              >
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    item.direction === 'phishing'
                      ? 'bg-neon-rose shadow-[0_0_8px_#fb7185]'
                      : 'bg-neon-green shadow-[0_0_8px_#34d399]'
                  }`}
                />
                <span className="text-slate-300">
                  {item.detail}{' '}
                  <span
                    className={`whitespace-nowrap font-medium ${
                      item.direction === 'phishing' ? 'text-neon-rose' : 'text-neon-green'
                    }`}
                  >
                    → {item.direction}
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
