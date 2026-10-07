import LoginForm from './LoginForm.jsx'
import Icon from './Icons.jsx'

/** Shown when the visitor is not a signed-in admin. */
export default function AuthGate({ message = 'view this page' }) {
  return (
    <div className="glass reveal mx-auto mt-8 max-w-sm p-8 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-neon-cyan/20 to-neon-violet/20 text-neon-cyan shadow-[0_0_30px_rgba(34,211,238,0.2)]">
        <Icon name="lock" className="h-6 w-6" />
      </div>
      <h1 className="text-2xl font-bold text-white">Admin access only</h1>
      <p className="mt-2 text-sm text-slate-400">
        Sign in with your admin credentials to {message}.
      </p>
      <LoginForm />
    </div>
  )
}
