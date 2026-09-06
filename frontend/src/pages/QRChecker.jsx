import { useRef, useState } from 'react'
import { predictQr } from '../api/client.js'
import PredictionResult from '../components/PredictionResult.jsx'

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
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-slate-800">Check a QR Code</h1>
        <p className="mt-2 text-slate-500">
          Upload a QR code image to check whether the link it points to is phishing.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragActive(true)
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
            dragActive
              ? 'border-blue-500 bg-blue-50'
              : 'border-slate-300 bg-white hover:bg-slate-50'
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
            <img src={previewUrl} alt="QR preview" className="h-40 w-40 object-contain" />
          ) : (
            <div className="text-slate-400 text-4xl">📷</div>
          )}
          <p className="text-sm text-slate-500">
            {file ? file.name : 'Drag & drop a QR code image here, or click to choose one'}
          </p>
        </div>

        <button
          type="submit"
          disabled={loading || !file}
          className="mt-4 w-full rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Checking…' : 'Check QR Code'}
        </button>
      </form>

      {error && (
        <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {result && !result.qr_readable && (
        <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-500 text-white text-xl">
              ?
            </span>
            <div>
              <p className="text-lg font-bold text-amber-700">Couldn't read this QR code</p>
              <p className="text-sm text-slate-600">{result.message}</p>
            </div>
          </div>
        </div>
      )}

      {result && result.qr_readable && (
        <PredictionResult
          isPhishing={result.is_phishing}
          confidence={result.confidence}
          subtitle={`This QR code points to: ${result.decoded_url}`}
          explanation={result.explanation}
        />
      )}
    </div>
  )
}
