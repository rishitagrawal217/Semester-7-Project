import AnimatedNumber from './AnimatedNumber.jsx'
import Icon from './Icons.jsx'

const ACCENTS = {
  blue: { text: 'text-neon-cyan', bar: 'from-neon-cyan', glow: 'rgba(34,211,238,0.25)' },
  red: { text: 'text-neon-rose', bar: 'from-neon-rose', glow: 'rgba(251,113,133,0.25)' },
  green: { text: 'text-neon-green', bar: 'from-neon-green', glow: 'rgba(52,211,153,0.25)' },
  amber: { text: 'text-neon-amber', bar: 'from-neon-amber', glow: 'rgba(251,191,36,0.25)' },
  violet: { text: 'text-neon-violet', bar: 'from-neon-violet', glow: 'rgba(139,92,246,0.3)' },
}

/** KPI tile with a count-up number. `value` must be numeric; use `suffix` for "%" etc. */
export default function StatCard({
  label,
  value,
  suffix = '',
  decimals = 0,
  sub,
  accent = 'blue',
  icon = 'chart',
  delay = 0,
}) {
  const a = ACCENTS[accent] || ACCENTS.blue
  return (
    <div className="glass glass-hover reveal overflow-hidden p-5" style={{ animationDelay: `${delay}ms` }}>
      <div
        className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${a.bar} via-transparent to-transparent`}
      />
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full blur-2xl"
        style={{ background: a.glow }}
      />
      <div className="relative flex items-center justify-between">
        <p className="text-sm font-medium text-slate-400">{label}</p>
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 ${a.text}`}>
          <Icon name={icon} className="h-4 w-4" />
        </span>
      </div>
      <p className="relative mt-3 text-3xl font-bold tabular-nums text-white">
        <AnimatedNumber value={value} suffix={suffix} decimals={decimals} />
      </p>
      {sub && <p className="relative mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  )
}
