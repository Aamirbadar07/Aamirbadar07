import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

// Seeded accounts that share one board, so each role can be tried in a click.
const DEMO_PASSWORD = 'taskboard-demo'
const DEMO_USERS = [
  { role: 'Owner', email: 'owner@taskboard.demo', hint: 'everything, incl. members' },
  { role: 'Member', email: 'member@taskboard.demo', hint: 'edit lists and cards' },
  { role: 'Viewer', email: 'viewer@taskboard.demo', hint: 'read-only' },
]

export function AuthPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function signIn(email: string, password: string) {
    setBusy(true)
    setError('')
    setNotice('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setBusy(false)
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (mode === 'signin') return signIn(email, password)

    setBusy(true)
    setError('')
    setNotice('')
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: name.trim() } },
    })
    if (error) setError(error.message)
    // No session means the project requires confirming the email first.
    else if (!data.session) setNotice('Check your inbox to confirm your email, then sign in.')
    setBusy(false)
  }

  return (
    <main className="auth">
      <div className="auth-card">
        <h1>
          <img src="/favicon.svg" alt="" width="28" height="28" /> Taskboard
        </h1>
        <p className="muted">Boards, lists and cards for small teams.</p>

        <section className="demo">
          <h2>Try a demo account</h2>
          <div className="demo-buttons">
            {DEMO_USERS.map((demo) => (
              <button
                key={demo.email}
                className="btn"
                disabled={busy}
                onClick={() => signIn(demo.email, DEMO_PASSWORD)}
              >
                <strong>{demo.role}</strong>
                <small>{demo.hint}</small>
              </button>
            ))}
          </div>
        </section>

        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={mode === 'signin'} onClick={() => setMode('signin')}>
            Sign in
          </button>
          <button role="tab" aria-selected={mode === 'signup'} onClick={() => setMode('signup')}>
            Create account
          </button>
        </div>

        <form onSubmit={onSubmit}>
          {mode === 'signup' && (
            <label>
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} />
            </label>
          )}
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              minLength={6}
              required
            />
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          {notice && <p className="notice" role="status">{notice}</p>}
          <button className="btn primary" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </div>
    </main>
  )
}
