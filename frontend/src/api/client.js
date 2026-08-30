import axios from 'axios'

// Base URL comes from VITE_API_BASE_URL (see .env).
// Local: http://localhost:8000  |  Deployed: your Render URL.
const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
})

// Attach the admin JWT (if signed in) to every request.
// Public endpoints ignore it; /api/logs requires it.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('phishing_admin_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

/** POST /api/predict — classify a single URL.
 * `explain: true` also runs the SHAP explanation (~0.7s extra) — only pass
 * it from user-initiated checks, never from anything on a hot path. */
export async function predictUrl(url, { explain = false } = {}) {
  const { data } = await api.post('/api/predict', { url, explain })
  return data // { url, is_phishing, confidence, message, explanation: [...] }
}

/** GET /api/metrics — aggregate dashboard stats. */
export async function getMetrics() {
  const { data } = await api.get('/api/metrics')
  return data // { total_checks, phishing_detected, detection_rate }
}

/** GET /api/logs — recent detection history. */
export async function getLogs(limit = 100) {
  const { data } = await api.get('/api/logs', { params: { limit } })
  return data // [{ id, url, is_phishing, confidence, message, timestamp }]
}

export { baseURL }
export default api
