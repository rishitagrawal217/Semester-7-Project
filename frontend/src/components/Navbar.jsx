import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import { getHealth } from '../api/client.js'
import Icon from './Icons.jsx'

const links = [
  { to: '/', label: 'URL Checker', icon: 'link', end: true },
  { to: '/qr-checker', label: 'QR Checker', icon: 'scan' },
  { to: '/dashboard', label: 'Dashboard', icon: 'chart' },
  { to: '/logs', label: 'Logs', icon: 'list' },
]

/** Polls /health so visitors can see at a glance whether the detection API is reachable. */
function ApiStatus() {
  const [online, setOnline] = useState(null) // null = checking

  useEffect(() => {
    let cancelled = false
    async function check() {
      try {
        await getHealth()
        if (!cancelled) setOnline(true)
      } catch {
        if (!cancelled) setOnline(false)
      }
    }
    check()
    const id = setInterval(check, 30000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  const color = online === null ? 'bg-slate-500' : online ? 'bg-neon-green' : 'bg-neon-rose'
  const text = online === null ? 'Checking' : online ? 'API online' : 'API offline'

  return (
    <span className="chip hidden md:inline-flex" title="Detection API status">
      <span className={`h-2 w-2 rounded-full ${color} ${online ? 'animate-pulse-ring' : ''}`} />
      {text}
    </span>
  )
}

export default function Navbar() {
  const { isAuthenticated, user, logout } = useAuth()

  return (
    <header className="sticky top-0 z-20 border-b border-white/5 bg-ink-950/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-3 sm:gap-4 sm:px-6">
        <div className="flex shrink-0 items-center gap-2.5">
          <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-neon-cyan to-neon-violet text-ink-950 shadow-[0_0_20px_rgba(34,211,238,0.45)]">
            <Icon name="shield" className="h-5 w-5" strokeWidth={2.2} />
          </span>
          <div className="hidden leading-tight sm:block">
            <p className="font-semibold tracking-tight text-white">PhishGuard</p>
            <p className="hidden text-[10px] uppercase tracking-[0.18em] text-slate-500 sm:block">
              Real-time detection
            </p>
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-1.5 sm:gap-3">
          <nav className="flex items-center gap-0.5 sm:gap-1">
            {links.map(({ to, label, icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `group relative flex items-center gap-2 rounded-lg px-2.5 py-2 sm:px-3 text-sm font-medium transition-colors ${
                    isActive ? 'text-white' : 'text-slate-400 hover:text-white'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon name={icon} className="h-4 w-4" />
                    <span className="hidden lg:inline">{label}</span>
                    <span
                      className={`absolute inset-x-3 -bottom-[13px] h-0.5 rounded-full bg-gradient-to-r from-neon-cyan to-neon-violet shadow-[0_0_10px_rgba(34,211,238,0.8)] transition-all duration-300 ${
                        isActive ? 'opacity-100' : 'scale-x-0 opacity-0 group-hover:scale-x-100 group-hover:opacity-60'
                      }`}
                    />
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <ApiStatus />

          {isAuthenticated && (
            <div className="flex items-center gap-1.5 border-l border-white/10 pl-2 sm:gap-2 sm:pl-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-neon-violet to-neon-pink text-xs font-semibold uppercase text-white">
                {(user?.sub || '?').charAt(0)}
              </span>
              <span className="hidden max-w-[120px] truncate text-sm text-slate-300 sm:block">
                {user?.sub}
              </span>
              <button
                onClick={logout}
                className="whitespace-nowrap text-xs font-medium text-slate-500 transition-colors hover:text-neon-rose sm:text-sm"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
