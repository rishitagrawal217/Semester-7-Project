import { useState } from 'react'
import { predictUrl } from '../api/client.js'
import PredictionResult from '../components/PredictionResult.jsx'
import ScanLoader from '../components/ScanLoader.jsx'
import Icon from '../components/Icons.jsx'
import { StatsStrip, HowItWorks, RedFlags } from '../components/InfoSections.jsx'

const EXAMPLES = [
  'https://www.github.com',
  'http://secure-paypal-login-verify.tk',
  'http://192.168.0.1/login',
]

export default function UrlChecker() {
  const [url, setUrl] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function check(value) {
    const trimmed = value.trim()
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

  function handleSubmit(e) {
    e.preventDefault()
    check(url)
  }

  return (
    <div>
      <div className="mx-auto max-w-2xl text-center">
        <span className="chip reveal">
          <span className="h-1.5 w-1.5 rounded-full bg-neon-green animate-pulse-ring" />
          Calibrated random forest · SHAP explainable
        </span>
        <h1 className="reveal mt-5 text-4xl font-extrabold tracking-tight text-white sm:text-5xl" style={{ animationDelay: '80ms' }}>
          Is that link <span className="text-gradient">safe to open?</span>
        </h1>
        <p className="reveal mt-4 text-slate-400" style={{ animationDelay: '160ms' }}>
          Paste any URL and get an instant verdict — with a plain-English breakdown of exactly why.
        </p>

        <form
          onSubmit={handleSubmit}
          className="reveal mt-8 flex flex-col gap-3 sm:flex-row"
          style={{ animationDelay: '240ms' }}
        >
          <div className="relative flex-1">
            <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/login"
              className="input-field !py-3.5 !pl-12 font-mono text-sm"
            />
          </div>
          <button type="submit" disabled={loading || !url.trim()} className="btn-primary !py-3.5">
            <Icon name="bolt" className="h-4 w-4" strokeWidth={2.4} />
            {loading ? 'Analyzing…' : 'Analyze'}
          </button>
        </form>

        <div className="reveal mt-4 flex flex-wrap items-center justify-center gap-2" style={{ animationDelay: '320ms' }}>
          <span className="text-xs text-slate-500">Try:</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              className="chip font-mono"
              onClick={() => {
                setUrl(ex)
                check(ex)
              }}
            >
              {ex.replace(/^https?:\/\//, '')}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-2xl">
        {error && (
          <div className="mt-6 rounded-xl border border-neon-rose/30 bg-neon-rose/10 px-4 py-3 text-sm text-neon-rose animate-fade-in">
            {error}
          </div>
        )}

        {loading && <ScanLoader />}

        {result && !loading && (
          <PredictionResult
            isPhishing={result.is_phishing}
            confidence={result.confidence}
            subtitle={result.url}
            explanation={result.explanation}
          />
        )}
      </div>

      {!result && !loading && (
        <>
          <StatsStrip />
          <HowItWorks />
          <RedFlags />
        </>
      )}
    </div>
  )
}
