import { FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { ApiError, loginAccount, registerAccount } from '../lib/api'
import './AuthPage.css'

export default function AuthPage() {
  const navigate = useNavigate()
  const { setSession } = useAuth()
  const [accessCode, setAccessCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAutoLoggingIn, setIsAutoLoggingIn] = useState(false)

  // Portfolio access code
  const PORTFOLIO_PASSWORD = 'hireme'

  useEffect(() => {
    const referrer = document.referrer
    if (referrer.includes('jahanzebahmed.xyz') || referrer.includes('jahanzebahmed.netlify.app')) {
      handleAutoGuestLogin()
    }
  }, [])

  async function handleAutoGuestLogin() {
    setIsAutoLoggingIn(true)
    setError(null)
    try {
      const randomId = Math.random().toString(36).substring(2, 10)
      const email = `guest-${randomId}@portfolio.codepilot`
      const password = `guest-${randomId}-pass`
      
      await registerAccount(email, password)
      const session = await loginAccount(email, password)
      
      setSession(session.access_token, email)
      navigate('/workspace', { replace: true })
    } catch (err) {
      setIsAutoLoggingIn(false)
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Failed to auto-generate guest session. Please use the access code.')
      }
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (accessCode.toLowerCase() !== PORTFOLIO_PASSWORD) {
      setError('Invalid access code.')
      return
    }

    setIsSubmitting(true)
    await handleAutoGuestLogin()
    setIsSubmitting(false)
  }

  if (isAutoLoggingIn) {
    return (
      <div className="auth-shell">
        <section className="auth-brand" style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
          <div style={{ textAlign: 'center' }}>
            <div className="auth-brand-mark" style={{ justifyContent: 'center', marginBottom: '2rem' }}>
              <span className="auth-brand-glyph" aria-hidden="true">&#9670;</span>
              <span className="auth-brand-name">Codepilot</span>
            </div>
            <h1 className="auth-brand-heading">Preparing your guest workspace...</h1>
            <p className="auth-brand-copy" style={{ marginTop: '1rem' }}>This may take a few seconds.</p>
          </div>
        </section>
      </div>
    )
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
            <dt>Portfolio Access</dt>
            <dd>This is a portfolio demonstration. You need an access code to enter.</dd>
          </div>
          <div className="auth-brand-fact">
            <dt>Isolation</dt>
            <dd>One dedicated machine per workspace, never shared between sessions.</dd>
          </div>
        </dl>
      </section>

      <section className="auth-panel">
        <form className="auth-card" onSubmit={handleSubmit} noValidate>
          <div className="auth-card-header">
            <h2>Portfolio Access</h2>
            <p>Enter the access code provided by Jahanzeb.</p>
          </div>

          {error && (
            <div className="auth-error" role="alert">
              {error}
            </div>
          )}

          <label className="auth-field">
            <span>Access Code</span>
            <input
              type="text"
              required
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
              placeholder="Enter access code"
            />
          </label>

          <button className="auth-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Please wait…' : 'Enter Workspace'}
          </button>
        </form>
      </section>
    </div>
  )
}
