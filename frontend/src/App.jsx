import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import UrlChecker from './pages/UrlChecker.jsx'
import QRChecker from './pages/QRChecker.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Logs from './pages/Logs.jsx'

/** Fixed, non-interactive backdrop: faint grid + slowly drifting colour orbs. */
function Backdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(148,163,184,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,.07) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse at 50% 20%, black 30%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at 50% 20%, black 30%, transparent 75%)',
        }}
      />
      <div className="absolute -left-40 -top-40 h-[34rem] w-[34rem] animate-float rounded-full bg-neon-cyan/20 blur-[120px]" />
      <div
        className="absolute -right-40 top-1/4 h-[30rem] w-[30rem] animate-float rounded-full bg-neon-violet/25 blur-[120px]"
        style={{ animationDelay: '-5s' }}
      />
      <div
        className="absolute -bottom-40 left-1/3 h-[28rem] w-[28rem] animate-float rounded-full bg-neon-pink/15 blur-[120px]"
        style={{ animationDelay: '-9s' }}
      />
    </div>
  )
}

export default function App() {
  const location = useLocation()
  return (
    <div className="relative flex min-h-screen flex-col">
      <Backdrop />
      <Navbar />
      {/* key= re-mounts on navigation so each page replays its entrance animation */}
      <main key={location.pathname} className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <Routes>
          <Route path="/" element={<UrlChecker />} />
          <Route path="/qr-checker" element={<QRChecker />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/logs" element={<Logs />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer className="border-t border-white/5 py-5 text-center text-xs text-slate-500">
        Phishing Detector · FastAPI · scikit-learn · SHAP · React
      </footer>
    </div>
  )
}
