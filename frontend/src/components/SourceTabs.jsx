/** Segmented control switching a page between URL-check data and QR-check data. */
export default function SourceTabs({ value, onChange }) {
  return (
    <div className="inline-flex gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
      {[
        { key: 'url', label: 'URL Checks' },
        { key: 'qr', label: 'QR Codes' },
      ].map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-all ${
            value === key
              ? 'bg-gradient-to-r from-neon-cyan/20 to-neon-violet/20 text-white shadow-[inset_0_0_0_1px_rgba(34,211,238,0.35)]'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
