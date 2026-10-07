import AnimatedNumber from './AnimatedNumber.jsx'
import Icon from './Icons.jsx'

/** Headline facts about the model. Figures come from train_model_calibrated.py / feature_extractor.py. */
export function StatsStrip() {
  const stats = [
    { value: 35, suffix: '', label: 'Lexical features' },
    { value: 235, suffix: 'K', label: 'Training URLs' },
    { value: 100, suffix: '', label: 'Calibrated trees' },
    { value: 0, suffix: '', label: 'Pages fetched' },
  ]
  return (
    <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((s, i) => (
        <div
          key={s.label}
          className="glass reveal px-4 py-5 text-center"
          style={{ animationDelay: `${i * 90}ms` }}
        >
          <p className="text-gradient text-3xl font-bold tabular-nums">
            <AnimatedNumber value={s.value} suffix={s.suffix} />
          </p>
          <p className="mt-1 text-xs uppercase tracking-wider text-slate-400">{s.label}</p>
        </div>
      ))}
    </div>
  )
}

const STEPS = [
  {
    icon: 'link',
    title: 'Parse',
    text: 'The URL is split into hostname, registrable domain, subdomains and TLD.',
  },
  {
    icon: 'layers',
    title: 'Extract',
    text: '35 lexical signals are computed: length, hyphens, digits, keywords, punycode and more.',
  },
  {
    icon: 'cpu',
    title: 'Classify',
    text: 'A random forest, calibrated so a "90%" means roughly nine in ten, scores the result.',
  },
  {
    icon: 'eye',
    title: 'Explain',
    text: 'SHAP shows which features pushed the verdict toward phishing or legitimate.',
  },
]

export function HowItWorks() {
  return (
    <section className="mt-16">
      <h2 className="text-center text-2xl font-bold text-white">How it works</h2>
      <p className="mx-auto mt-2 max-w-xl text-center text-sm text-slate-400">
        Detection runs on the address alone — nothing is visited, downloaded or sent to a third party.
      </p>
      <div className="relative mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="pointer-events-none absolute left-[12%] right-[12%] top-[34px] hidden h-px bg-gradient-to-r from-neon-cyan/0 via-neon-cyan/50 to-neon-violet/0 lg:block" />
        {STEPS.map((s, i) => (
          <div
            key={s.title}
            className="glass glass-hover reveal p-5 text-center"
            style={{ animationDelay: `${i * 110}ms` }}
          >
            <div className="relative mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-neon-cyan/20 to-neon-violet/20 text-neon-cyan shadow-[0_0_24px_rgba(34,211,238,0.2)]">
              <Icon name={s.icon} className="h-6 w-6" />
              <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-ink-900 font-mono text-[10px] text-slate-300 ring-1 ring-white/15">
                {i + 1}
              </span>
            </div>
            <h3 className="mt-4 font-semibold text-white">{s.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{s.text}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

const FLAGS = [
  { icon: 'globe', title: 'Raw IP as the host', text: 'Legitimate services almost always use a domain name, e.g. http://192.168.4.7/login.' },
  { icon: 'alert', title: 'Keyword-stuffed domains', text: 'Hostnames packed with login, verify, secure or account and several hyphens.' },
  { icon: 'link', title: '"@" inside the URL', text: 'Anything before an @ is ignored by the browser and can disguise the real destination.' },
  { icon: 'layers', title: 'Deep subdomain chains', text: 'paypal.com.account.evil.tk is hosted by evil.tk, not PayPal. Read the domain right-to-left.' },
  { icon: 'bolt', title: 'Abused TLDs & shorteners', text: 'Cheap TLDs such as .tk or .xyz, and short links, hide who really owns the page.' },
  { icon: 'eye', title: 'Look-alike (punycode) names', text: 'Hostnames starting with xn-- can swap in characters that imitate Latin letters.' },
]

export function RedFlags() {
  return (
    <section className="mt-16">
      <h2 className="text-center text-2xl font-bold text-white">Good to know: common red flags</h2>
      <p className="mx-auto mt-2 max-w-xl text-center text-sm text-slate-400">
        The same patterns the model weighs — handy for a quick manual check.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FLAGS.map((f, i) => (
          <div
            key={f.title}
            className="glass glass-hover reveal flex gap-4 p-5"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neon-amber/10 text-neon-amber">
              <Icon name={f.icon} className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-semibold text-white">{f.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-400">{f.text}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="glass reveal mt-6 flex gap-4 border-neon-cyan/20 p-5" style={{ animationDelay: '200ms' }}>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neon-cyan/10 text-neon-cyan">
          <Icon name="help" className="h-5 w-5" />
        </span>
        <p className="text-sm leading-relaxed text-slate-400">
          <span className="font-semibold text-slate-200">Limits worth knowing: </span>
          the model reads the address only, so it can't see a page's content, and the padlock (HTTPS) only means
          the connection is encrypted — phishing sites use it too. Treat a "safe" result as one signal, not a guarantee.
        </p>
      </div>
    </section>
  )
}
