import { Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import UrlChecker from './pages/UrlChecker.jsx'
import QRChecker from './pages/QRChecker.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Logs from './pages/Logs.jsx'

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <Routes>
          <Route path="/" element={<UrlChecker />} />
          <Route path="/qr-checker" element={<QRChecker />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/logs" element={<Logs />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-400">
        Phishing URL Detector · React + FastAPI
      </footer>
    </div>
  )
}
