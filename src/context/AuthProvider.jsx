import { useCallback, useEffect, useMemo, useState } from 'react'
import { getToken, setToken, UNAUTHORIZED_EVENT } from '../services/api'
import { authService } from '../services/authService'
import { AuthContext } from './contexts'

// status: "checking" while a stored token is verified, then "authenticated" or "anonymous".
export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState(() => (getToken() ? 'checking' : 'anonymous'))
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!getToken()) return undefined
    let active = true
    authService
      .me()
      .then((me) => {
        if (!active) return
        setUser(me)
        setStatus('authenticated')
      })
      .catch(() => {
        if (!active) return
        setToken(null)
        setStatus('anonymous')
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const onUnauthorized = (event) => {
      setToken(null)
      setUser(null)
      setStatus('anonymous')
      setNotice(event.detail || 'Your session has expired. Please log in again.')
    }
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
  }, [])

  const startSession = useCallback(({ access_token: accessToken, user: sessionUser }) => {
    setToken(accessToken)
    setUser(sessionUser)
    setStatus('authenticated')
    setNotice('')
  }, [])

  const login = useCallback(
    async (email, password) => startSession(await authService.login(email, password)),
    [startSession],
  )

  const signup = useCallback(async (data) => startSession(await authService.signup(data)), [startSession])

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
    setStatus('anonymous')
    setNotice('You have been logged out.')
  }, [])

  const value = useMemo(
    () => ({ user, status, notice, login, signup, logout, startSession, setUser, clearNotice: () => setNotice('') }),
    [user, status, notice, login, signup, logout, startSession],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
