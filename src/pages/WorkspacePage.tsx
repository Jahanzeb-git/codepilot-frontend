import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  ApiError,
  deleteMachine,
  getConnectTicket,
  launchMachine,
  createStatusSocket,
} from '../lib/api'
import { storage } from '../lib/storage'
import './WorkspacePage.css'

type WorkspaceState = 'idle' | 'launching' | 'provisioning' | 'suspended' | 'resuming' | 'ready' | 'error' | 'quota_exceeded'

function formatQuotaMessage(baseMessage: string) {
  if (baseMessage.includes('90-hour')) {
    return 'You have consumed your 90-hour free tier limit.'
  }
  const now = new Date()
  const nextMidnightUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
  
  const formattedTime = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short', 
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short'
  }).format(nextMidnightUTC)
  
  return `You have consumed your 3-hour daily limit. Please come back after ${formattedTime}.`
}

export default function WorkspacePage() {
  const navigate = useNavigate()
  const { token, email, clearSession } = useAuth()
  const [state, setState] = useState<WorkspaceState>('idle')
  const [machineName, setMachineName] = useState<string | null>(() => storage.getMachineName())
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [quotaMessage, setQuotaMessage] = useState<string | null>(null)
  const [showFirstLaunchNotice, setShowFirstLaunchNotice] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  // Distinguishes a user-initiated "wake it up" poll (keep polling through
  // suspended/stopped) from a passive status check (stop and show the resume
  // button instead of hammering /status forever).
  const resumingRef = useRef(false)

  useEffect(() => {
    if (!token) return
    let ws: WebSocket | null = null

    function connect() {
      if (ws) ws.close()
      ws = createStatusSocket(token!)
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          
          if (data.status === 'idle') {
            storage.clearMachineName()
            setMachineName(null)
            setState('idle')
            resumingRef.current = false
            return
          }

          if (data.status === 'quota_exceeded') {
            setState('quota_exceeded')
            setQuotaMessage(formatQuotaMessage(data.message || ''))
            return
          }

          if (data.machine_name) {
            storage.setMachineName(data.machine_name)
            setMachineName(data.machine_name)
          }

          if (data.status === 'ready') {
            resumingRef.current = false
            setState('ready')
          } else if (data.status === 'suspended' || data.status === 'stopped') {
            if (resumingRef.current) {
              setState('resuming')
            } else {
              setState('suspended')
            }
          } else if (data.status === 'error') {
            setState('error')
            setErrorMessage(data.message || 'Lost contact with the workspace service.')
          } else {
            setState('provisioning')
          }
        } catch (e) {
          console.error("Failed to parse status WS message", e)
        }
      }

      ws.onclose = (event) => {
        if (event.code === 1008) {
          clearSession()
          navigate('/login', { replace: true })
        }
      }
    }

    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        connect()
      } else {
        if (ws) {
          ws.close()
          ws = null
        }
      }
    }

    if (document.visibilityState === 'visible') {
      connect()
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      if (ws) ws.close()
    }
  }, [token, navigate, clearSession])

  async function handleLaunch() {
    if (!token) return
    setErrorMessage(null)

    if (!storage.hasSeenFirstLaunchNotice()) {
      setShowFirstLaunchNotice(true)
      storage.markFirstLaunchNoticeSeen()
    }

    setState('launching')
    try {
      const result = await launchMachine(token)
      storage.setMachineName(result.machine_name)
      setMachineName(result.machine_name)
      setState('provisioning')
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearSession()
        navigate('/login', { replace: true })
        return
      }
      if (err instanceof ApiError && err.status === 403) {
        setState('quota_exceeded')
        setQuotaMessage(formatQuotaMessage(err.message))
        return
      }
      setState('error')
      setErrorMessage(err instanceof ApiError ? err.message : 'Could not launch a workspace machine.')
    }
  }

  async function handleResume() {
    if (!token) return
    setErrorMessage(null)
    resumingRef.current = true
    setState('resuming')
    
    try {
      await launchMachine(token)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearSession()
        navigate('/login', { replace: true })
        return
      }
      if (err instanceof ApiError && err.status === 403) {
        setState('quota_exceeded')
        setQuotaMessage(formatQuotaMessage(err.message))
        resumingRef.current = false
        return
      }
      setState('error')
      setErrorMessage(err instanceof ApiError ? err.message : 'Could not resume the workspace machine.')
      resumingRef.current = false
    }
  }

  async function handleConnect() {
    if (!token) return
    setIsConnecting(true)
    setErrorMessage(null)
    try {
      const { ticket } = await getConnectTicket(token)
      window.open(`https://codepilot-api.fly.dev/machines/connect?ticket=${encodeURIComponent(ticket)}`, '_blank', 'noopener')
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearSession()
        navigate('/login', { replace: true })
        return
      }
      setErrorMessage(err instanceof ApiError ? err.message : 'Could not create a connection ticket.')
    } finally {
      setIsConnecting(false)
    }
  }

  async function handleDelete() {
    if (!token) return
    setIsDeleting(true)
    setErrorMessage(null)
    try {
      await deleteMachine(token)
      resumingRef.current = false
      storage.clearMachineName()
      setMachineName(null)
      setState('idle')
      setConfirmingDelete(false)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearSession()
        navigate('/login', { replace: true })
        return
      }
      setErrorMessage(err instanceof ApiError ? err.message : 'Could not delete the workspace machine.')
    } finally {
      setIsDeleting(false)
    }
  }

  const isBusy = state === 'launching' || state === 'provisioning' || state === 'resuming'

  return (
    <div className="workspace-shell">
      <header className="workspace-header">
        <div className="workspace-brand">
          <span className="workspace-brand-glyph" aria-hidden="true">
            &#9670;
          </span>
          <span>Codepilot</span>
        </div>
        <div className="workspace-account">
          <span className="workspace-account-email">{email}</span>
          <button className="workspace-signout" onClick={clearSession}>
            Sign out
          </button>
        </div>
      </header>

      <main className="workspace-main">
        <section className="workspace-intro">
          <span className="workspace-eyebrow">Runtime status</span>
          <h1>Your agentic coding workspace</h1>
          <p>
            Launching a workspace boots a dedicated MicroVM running the Codepilot
            agent runtime &mdash; an isolated shell, filesystem, and language toolchain
            reserved for this session alone. Closing the workspace tab suspends the
            MicroVM automatically; opening the workspace again resumes it right where
            you left off.
          </p>
        </section>

        {showFirstLaunchNotice && (
          <div className="workspace-notice">
            <strong>Heads up:</strong> first-time provisioning spins up a new machine from
            scratch and can take about a minute. Subsequent launches are faster.
          </div>
        )}

        {errorMessage && state !== 'quota_exceeded' && (
          <div className="workspace-error" role="alert">
            {errorMessage}
          </div>
        )}

        {state === 'quota_exceeded' && quotaMessage && (
          <div className="workspace-quota-premium">
            <div className="workspace-quota-icon">⏳</div>
            <div className="workspace-quota-content">
              <h3>Quota Exhausted</h3>
              <p>{quotaMessage}</p>
            </div>
          </div>
        )}

        <section className="workspace-card">
          <div className="workspace-card-row">
            <div className="workspace-status-block">
              <span className="workspace-eyebrow">Machine</span>
              <div className="workspace-status-line">
                <StatusDot state={state} />
                <span className="workspace-status-label">{stateLabel(state)}</span>
              </div>
              {machineName && (
                <code className="workspace-machine-name" title="Machine identifier">
                  {machineName}
                </code>
              )}
              {!machineName && state === 'idle' && (
                <p className="workspace-status-empty">No workspace has been launched yet.</p>
              )}
            </div>

            <div className="workspace-actions">
              {state === 'idle' && (
                <button className="workspace-primary-btn" onClick={handleLaunch}>
                  Launch workspace
                </button>
              )}

              {isBusy && (
                <button className="workspace-primary-btn" disabled>
                  <span className="workspace-spinner" aria-hidden="true" />
                  {state === 'launching' && 'Requesting machine…'}
                  {state === 'provisioning' && 'Provisioning…'}
                  {state === 'resuming' && 'Waking workspace…'}
                </button>
              )}

              {state === 'suspended' && (
                <button className="workspace-primary-btn" onClick={handleResume}>
                  Open workspace
                </button>
              )}

              {state === 'ready' && (
                <button className="workspace-primary-btn" onClick={handleConnect} disabled={isConnecting}>
                  {isConnecting ? 'Preparing session…' : 'Open workspace'}
                </button>
              )}

              {state === 'error' && (
                <button className="workspace-primary-btn" onClick={handleLaunch}>
                  Retry launch
                </button>
              )}

              {state === 'quota_exceeded' && (
                <button className="workspace-ghost-btn" onClick={() => window.location.reload()}>
                  Refresh status
                </button>
              )}

              {machineName && (
                <button
                  className="workspace-danger-btn"
                  onClick={() => setConfirmingDelete(true)}
                  disabled={isDeleting}
                >
                  Delete workspace
                </button>
              )}
            </div>
          </div>

          {isBusy && (
            <div className="workspace-progress">
              <div className="workspace-progress-fill" />
            </div>
          )}
        </section>
      </main>

      {confirmingDelete && (
        <div className="workspace-modal-backdrop" role="presentation" onClick={() => setConfirmingDelete(false)}>
          <div className="workspace-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2>Delete this workspace?</h2>
            <p>
              This permanently stops and removes <code>{machineName}</code>. Anything not
              saved outside the workspace filesystem will be lost.
            </p>
            <div className="workspace-modal-actions">
              <button className="workspace-ghost-btn" onClick={() => setConfirmingDelete(false)} disabled={isDeleting}>
                Cancel
              </button>
              <button className="workspace-danger-btn" onClick={handleDelete} disabled={isDeleting}>
                {isDeleting ? 'Deleting…' : 'Delete workspace'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function stateLabel(state: WorkspaceState) {
  switch (state) {
    case 'idle':
      return 'Not running'
    case 'launching':
      return 'Requesting machine'
    case 'provisioning':
      return 'Provisioning'
    case 'suspended':
      return 'Suspended'
    case 'resuming':
      return 'Waking up'
    case 'ready':
      return 'Ready'
    case 'error':
      return 'Needs attention'
    case 'quota_exceeded':
      return 'Quota Limit Hit'
  }
}

function StatusDot({ state }: { state: WorkspaceState }) {
  return <span className={`workspace-status-dot workspace-status-dot--${state}`} aria-hidden="true" />
}
