export const API_BASE = 'https://codepilot-api.fly.dev'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })

  if (!res.ok) {
    let message = `Request failed with status ${res.status}`
    try {
      const body = await res.json()
      message = body.detail || body.message || message
    } catch {
      // response had no JSON body
    }
    throw new ApiError(message, res.status)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export interface AuthResponse {
  access_token: string
  token_type?: string
}

export function registerAccount(email: string, password: string) {
  return request<{ id?: string; email?: string }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export function loginAccount(email: string, password: string) {
  return request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export interface MachineLaunchResponse {
  machine_name: string
  status?: string
}

export function launchMachine(token: string) {
  return request<MachineLaunchResponse>('/machines/launch', { method: 'POST' }, token)
}

export interface MachineStatusResponse {
  status: string
  machine_name?: string
}

export function getMachineStatus(token: string) {
  return request<MachineStatusResponse>('/machines/status', { method: 'GET' }, token)
}

export interface ConnectTicketResponse {
  ticket: string
}

export function getConnectTicket(token: string) {
  return request<ConnectTicketResponse>('/machines/connect-ticket', { method: 'POST' }, token)
}

export function deleteMachine(token: string) {
  return request<void>('/machines/delete', { method: 'DELETE' }, token)
}
