import LoginForm from './LoginForm.jsx'

/** Shown when the visitor is not a signed-in admin. */
export default function AuthGate({ message = 'view this page' }) {
  return (
    <div className="max-w-sm mx-auto mt-10 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-2xl">
        🔒
      </div>
      <h1 className="text-2xl font-bold text-slate-800">Admin access only</h1>
      <p className="mt-2 text-slate-500">Sign in with your admin credentials to {message}.</p>
      <LoginForm />
    </div>
  )
}
