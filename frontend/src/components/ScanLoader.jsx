import { useEffect, useState } from 'react'

const DEFAULT_STEPS = [
  'Parsing hostname and registrable domain…',
  'Extracting 35 lexical features…',
  'Querying the calibrated random forest…',
  'Computing SHAP attributions…',
]

/** Animated "analysis in progress" card with a sweeping scan line and rotating status text. */
export default function ScanLoader({ steps = DEFAULT_STEPS }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % steps.length), 900)
    return () => clearInterval(id)
  }, [steps.length])

  return (
    <div className="glass mt-8 overflow-hidden p-6 animate-fade-in">
      <div className="relative h-24 overflow-hidden rounded-xl border border-white/5 bg-ink-900/70">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'linear-gradient(rgba(34,211,238,.18) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,.18) 1px, transparent 1px)',
            backgroundSize: '22px 22px',
          }}
        />
        <div className="absolute left-0 right-0 h-0.5 animate-scan bg-neon-cyan shadow-[0_0_18px_4px_rgba(34,211,238,0.7)]" />
      </div>
      <p key={i} className="mt-4 text-center font-mono text-sm text-neon-cyan animate-fade-in">
        {steps[i]}
      </p>
    </div>
  )
}
