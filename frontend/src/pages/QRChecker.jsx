import { useRef, useState } from 'react'
import { predictQr } from '../api/client.js'
import PredictionResult from '../components/PredictionResult.jsx'
import ScanLoader from '../components/ScanLoader.jsx'
import Icon from '../components/Icons.jsx'

const QR_STEPS = [
  'Locating the QR code in the image…',
  'Decoding the payload…',
  'Extracting the embedded URL…',
  'Scoring it with the random forest…',
]

const TIPS = [
  { icon: 'scan', title: 'What is quishing?', text: 'Phishing delivered as a QR code, so the malicious link never appears as readable text.' },
  { icon: 'eye', title: 'Preview before you open', text: 'Scan with a reader that shows the destination first, and check the domain before tapping.' },
  { icon: 'help', title: 'Decoding is best-effort', text: 'OpenCV can fail on roughly 4–6% of valid codes. Unreadable images are reported, never guessed.' },
]

function Corner({ className }) {
  return <span className={`absolute h-5 w-5 border-neon-cyan ${className}`} />
}

export default function QRChecker() {
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef(null)

  function pickFile(selected) {
    if (!selected || !selected.type.startsWith('image/')) return
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(selected)
    setPreviewUrl(URL.createObjectURL(selected))
    setResult(null)
    setError('')
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragActive(false)
    pickFile(e.dataTransfer.files?.[0])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!file) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const data = await predictQr(file)
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

  return (
    <div className="mx-auto max-w-2xl">
      <div className="text-center">
        <span className="chip reveal">
          <Icon name="scan" className="h-3.5 w-3.5 text-neon-cyan" />
          Quishing protection
        </span>
        <h1 className="reveal mt-5 text-4xl font-extrabold tracking-tight text-white" style={{ animationDelay: '80ms' }}>
          Check a <span className="text-gradient">QR code</span>
        </h1>
        <p className="reveal mt-3 text-slate-400" style={{ animationDelay: '160ms' }}>
          Upload a QR image and we'll decode it, then check whether the link it hides is phishing.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="reveal mt-8" style={{ animationDelay: '240ms' }}>
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragActive(true)
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`glass relative flex min-h-64 cursor-pointer flex-col items-center justify-center gap-4 border-dashed p-8 text-center transition-all ${
            dragActive
              ? '!border-neon-cyan bg-neon-cyan/5 shadow-[0_0_40px_rgba(34,211,238,0.2)]'
              : 'hover:!border-neon-cyan/50'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
          {previewUrl ? (
            <div className="relative rounded-xl bg-white p-3">
              <img src={previewUrl} alt="QR preview" className="h-44 w-44 object-contain" />
              <Corner className="-left-2 -top-2 rounded-tl-lg border-l-2 border-t-2" />
              <Corner className="-right-2 -top-2 rounded-tr-lg border-r-2 border-t-2" />
              <Corner className="-bottom-2 -left-2 rounded-bl-lg border-b-2 border-l-2" />
              <Corner className="-bottom-2 -right-2 rounded-br-lg border-b-2 border-r-2" />
              {loading && (
                <div className="absolute left-0 right-0 h-0.5 animate-scan bg-neon-cyan shadow-[0_0_18px_4px_rgba(34,211,238,0.7)]" />
              )}
            </div>
          ) : (
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-neon-cyan/20 to-neon-violet/20 text-neon-cyan shadow-[0_0_30px_rgba(34,211,238,0.15)]">
              <Icon name="upload" className="h-7 w-7" />
            </span>
          )}
          <p className="text-sm text-slate-400">
            {file ? (
              <span className="font-mono text-slate-200">{file.name}</span>
            ) : (
              <>
                <span className="font-medium text-slate-200">Drop a QR image here</span>, or click to browse
              </>
            )}
          </p>
        </div>

        <button type="submit" disabled={loading || !file} className="btn-primary mt-4 w-full !py-3.5">
          <Icon name="bolt" className="h-4 w-4" strokeWidth={2.4} />
          {loading ? 'Scanning…' : 'Scan QR code'}
        </button>
      </form>

      {error && (
        <div className="mt-6 rounded-xl border border-neon-rose/30 bg-neon-rose/10 px-4 py-3 text-sm text-neon-rose animate-fade-in">
          {error}
        </div>
      )}

      {loading && <ScanLoader steps={QR_STEPS} />}

      {result && !loading && !result.qr_readable && (
        <div className="glass reveal mt-8 !border-neon-amber/40 p-6">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-neon-amber/15 text-neon-amber">
              <Icon name="help" className="h-6 w-6" />
            </span>
            <div>
              <p className="text-lg font-bold text-neon-amber">Couldn't read this QR code</p>
              <p className="text-sm text-slate-400">{result.message}</p>
            </div>
          </div>
        </div>
      )}

      {result && !loading && result.qr_readable && (
        <PredictionResult
          isPhishing={result.is_phishing}
          confidence={result.confidence}
          subtitle={`This QR code points to: ${result.decoded_url}`}
          explanation={result.explanation}
        />
      )}

      {!result && !loading && (
        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {TIPS.map((t, i) => (
            <div key={t.title} className="glass glass-hover reveal p-5" style={{ animationDelay: `${i * 100}ms` }}>
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-neon-violet/15 text-neon-violet">
                <Icon name={t.icon} className="h-5 w-5" />
              </span>
              <h3 className="mt-3 font-semibold text-white">{t.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-400">{t.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
