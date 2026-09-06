import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'

const links = [
  { to: '/', label: 'URL Checker', end: true },
  { to: '/qr-checker', label: 'QR Checker' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/logs', label: 'Logs' },
]

export default function Navbar() {
  const { isAuthenticated, user, logout } = useAuth()

  return (
    <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 font-semibold text-slate-800">
          <img src="/shield.svg" alt="" className="w-6 h-6" />
          <span>Phishing Detector</span>
        </div>

        <div className="flex items-center gap-4">
          <nav className="flex items-center gap-1">
            {links.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>

          {isAuthenticated && (
            <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700 uppercase">
                {(user?.sub || '?').charAt(0)}
              </span>
              <span className="hidden sm:block text-sm text-slate-600 max-w-[140px] truncate">
                {user?.sub}
              </span>
              <button
                onClick={logout}
                className="text-sm font-medium text-slate-500 hover:text-rose-600"
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
