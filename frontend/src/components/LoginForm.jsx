import { useState } from 'react'
import { useAuth } from '../auth/AuthContext.jsx'

export default function LoginForm() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await login(username.trim(), password)
    } catch (err) {
      const status = err?.response?.status
      setError(
        status === 401
          ? 'Invalid username or password.'
          : err.message || 'Login failed. Is the backend running?'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4 text-left">
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-400">
          Username
        </label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          className="input-field"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-400">
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          className="input-field"
        />
      </div>

      {error && (
        <div className="rounded-lg border border-neon-rose/30 bg-neon-rose/10 px-3 py-2 text-sm text-neon-rose animate-fade-in">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !username.trim() || !password}
        className="btn-primary w-full"
      >
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
