/** Segmented control switching a page between URL-check data and QR-check data. */
export default function SourceTabs({ value, onChange }) {
  return (
    <div className="inline-flex gap-1 rounded-lg bg-slate-100 p-1">
      {[
        { key: 'url', label: 'URL Checks' },
        { key: 'qr', label: 'QR Codes' },
      ].map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            value === key
              ? 'bg-white text-slate-800 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
