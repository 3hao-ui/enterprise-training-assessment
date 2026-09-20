import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { request, TOKEN_KEY, USER_KEY } from './api/client'
import type { WebUser } from './api/types'

interface AuthState {
  user: WebUser | null
  ready: boolean
  login: (username: string, password: string) => Promise<WebUser>
  logout: () => void
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthState>({
  user: null,
  ready: false,
  login: async () => {
    throw new Error('not ready')
  },
  logout: () => {},
  refresh: async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<WebUser | null>(null)
  const [ready, setReady] = useState(false)

  const refresh = async () => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      setUser(null)
      return
    }
    try {
      const me = await request<WebUser>('/auth/me')
      setUser(me)
      localStorage.setItem(USER_KEY, JSON.stringify(me))
    } catch {
      setUser(null)
    }
  }

  useEffect(() => {
    refresh().finally(() => setReady(true))
  }, [])

  const login = async (username: string, password: string) => {
    const data = await request<{ token: string; user: WebUser }>('/auth/login', {
      method: 'POST',
      data: { username, password },
    })
    localStorage.setItem(TOKEN_KEY, data.token)
    localStorage.setItem(USER_KEY, JSON.stringify(data.user))
    setUser(data.user)
    return data.user
  }

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, ready, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}
