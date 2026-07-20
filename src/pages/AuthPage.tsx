import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { ApiError, loginAccount, registerAccount } from '../lib/api'
import './AuthPage.css'

interface AuthPageProps {
  mode: 'login' | 'register'
}

export default function AuthPage({ mode }: AuthPageProps) {
  const navigate = useNavigate()
  const { setSession } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isRegister = mode === 'register'

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (isRegister && password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setIsSubmitting(true)
    try {
      if (isRegister) {
        await registerAccount(email, password)
      }
      const session = await loginAccount(email, password)
      setSession(session.access_token, email)
      navigate('/workspace', { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Something went wrong. Check your connection and try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="auth-shell">
      <section className="auth-brand">
        <div className="auth-brand-mark">
          <span className="auth-brand-glyph" aria-hidden="true">
            &#9670;
          </span>
          <span className="auth-brand-name">Codepilot</span>
        </div>

        <h1 className="auth-brand-heading">
          A dedicated runtime for
          <br />
          agentic coding sessions.
        </h1>

        <p className="auth-brand-copy">
          Every workspace runs on an isolated MicroVM with its own filesystem,
          shell, and language servers &mdash; started on demand and suspended
          automatically when you close it.
        </p>

        <dl className="auth-brand-facts">
          <div className="auth-brand-fact">
            <dt>Isolation</dt>
            <dd>One dedicated machine per workspace, never shared between sessions.</dd>
          </div>
          <div className="auth-brand-fact">
            <dt>Provisioning</dt>
            <dd>Cold starts typically finish in under two minutes on first launch.</dd>
          </div>
          <div className="auth-brand-fact">
            <dt>Access</dt>
            <dd>Short-lived connection tickets keep credentials off the wire.</dd>
          </div>
        </dl>
      </section>

      <section className="auth-panel">
        <form className="auth-card" onSubmit={handleSubmit} noValidate>
          <div className="auth-card-header">
            <h2>{isRegister ? 'Create your account' : 'Sign in'}</h2>
            <p>
              {isRegister
                ? 'Set up access to your agentic coding workspace.'
                : 'Continue to your agentic coding workspace.'}
            </p>
          </div>

          {error && (
            <div className="auth-error" role="alert">
              {error}
            </div>
          )}

          <label className="auth-field">
            <span>Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </label>

          <label className="auth-field">
            <span>Password</span>
            <input
              type="password"
              required
              minLength={8}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
          </label>

          {isRegister && (
            <label className="auth-field">
              <span>Confirm password</span>
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
              />
            </label>
          )}

          <button className="auth-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}
          </button>

          <p className="auth-switch">
            {isRegister ? (
              <>
                Already have an account? <Link to="/login">Sign in</Link>
              </>
            ) : (
              <>
                New to Codepilot? <Link to="/register">Create an account</Link>
              </>
            )}
          </p>
        </form>
      </section>
    </div>
  )
}
