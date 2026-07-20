import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { storage } from '../lib/storage'

interface AuthContextValue {
  token: string | null
  email: string | null
  isAuthenticated: boolean
  setSession: (token: string, email: string) => void
  clearSession: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => storage.getToken())
  const [email, setEmail] = useState<string | null>(() => storage.getEmail())

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      email,
      isAuthenticated: Boolean(token),
      setSession: (nextToken: string, nextEmail: string) => {
        storage.setToken(nextToken)
        storage.setEmail(nextEmail)
        setToken(nextToken)
        setEmail(nextEmail)
      },
      clearSession: () => {
        storage.clearToken()
        storage.clearEmail()
        storage.clearMachineName()
        setToken(null)
        setEmail(null)
      },
    }),
    [token, email],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
