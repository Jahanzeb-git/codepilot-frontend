import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import {
  ApiError,
  deleteMachine,
  getConnectTicket,
  getMachineStatus,
  launchMachine,
} from '../lib/api'
import { storage } from '../lib/storage'
import './WorkspacePage.css'

type WorkspaceState = 'idle' | 'launching' | 'provisioning' | 'suspended' | 'resuming' | 'ready' | 'error'

const POLL_INTERVAL_MS = 4000

export default function WorkspacePage() {
  const { token, email, clearSession } = useAuth()
  const [state, setState] = useState<WorkspaceState>('idle')
  const [machineName, setMachineName] = useState<string | null>(() => storage.getMachineName())
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [showFirstLaunchNotice, setShowFirstLaunchNotice] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Distinguishes a user-initiated "wake it up" poll (keep polling through
  // suspended/stopped) from a passive status check (stop and show the resume
  // button instead of hammering /status forever).
  const resumingRef = useRef(false)

  const stopPolling = useCallback(() => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current)
      pollTimeoutRef.current = null
    }
  }, [])

  useEffect(() => stopPolling, [stopPolling])

  const pollStatus = useCallback(() => {
    if (!token) return
    const tick = async () => {
      try {
        const result = await getMachineStatus(token)
        if (result.machine_name) {
          storage.setMachineName(result.machine_name)
          setMachineName(result.machine_name)
        }

        if (result.status === 'ready') {
          resumingRef.current = false
          setState('ready')
          return
        }

        if (result.status === 'suspended' || result.status === 'stopped') {
          if (resumingRef.current) {
            setState('resuming')
            pollTimeoutRef.current = setTimeout(tick, POLL_INTERVAL_MS)
          } else {
            setState('suspended')
          }
          return
        }

        setState('provisioning')
        pollTimeoutRef.current = setTimeout(tick, POLL_INTERVAL_MS)
      } catch (err) {
        resumingRef.current = false
        if (err instanceof ApiError && err.status === 404) {
          storage.clearMachineName()
          setMachineName(null)
          setState('idle')
          return
        }
        setState('error')
        setErrorMessage(err instanceof ApiError ? err.message : 'Lost contact with the workspace service.')
      }
    }
    tick()
  }, [token])

  // Fresh page load: check the machine's real status once instead of assuming
  // it's still running or still provisioning from stale local state.
  useEffect(() => {
    if (machineName && state === 'idle') {
      pollStatus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Tab reactivated: re-check status rather than trusting whatever we last
  // rendered, since the machine may have been suspended (or removed) while
  // this tab was hidden. Skip while a poll loop is already in flight.
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible' && machineName && pollTimeoutRef.current === null && state !== 'launching') {
        pollStatus()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [machineName, state, pollStatus])

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
      pollStatus()
    } catch (err) {
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
      pollStatus()
    } catch (err) {
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
      stopPolling()
      resumingRef.current = false
      storage.clearMachineName()
      setMachineName(null)
      setState('idle')
      setConfirmingDelete(false)
    } catch (err) {
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

        {errorMessage && (
          <div className="workspace-error" role="alert">
            {errorMessage}
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
  }
}

function StatusDot({ state }: { state: WorkspaceState }) {
  return <span className={`workspace-status-dot workspace-status-dot--${state}`} aria-hidden="true" />
}
