import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { login as apiLogin, logout as apiLogout, getMe, getMyModules } from '../api/auth'

// Create the context
const AuthContext = createContext(null)

// AuthProvider wraps the whole app and provides auth state to all components
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)         // The logged-in user's data
  const [modules, setModules] = useState([])     // Modules the user has access to
  const [loading, setLoading] = useState(true)   // True while checking if user is already logged in

  // On app load, check if there's a stored token and fetch user data
  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (token) {
      getMe()
        .then((userData) => {
          setUser(userData)
          return getMyModules()
        })
        .then((moduleData) => {
          setModules(moduleData)
        })
        .catch(() => {
          // Token is invalid or expired — clear it
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
        })
        .finally(() => setLoading(false))
    } else {
      queueMicrotask(() => setLoading(false))
    }
  }, [])

  // Log in: call the API, store tokens, fetch user data
  const login = useCallback(async (username, password) => {
    const data = await apiLogin(username, password)
    localStorage.setItem('access_token', data.access)
    localStorage.setItem('refresh_token', data.refresh)
    const userData = await getMe()
    setUser(userData)
    const moduleData = await getMyModules()
    setModules(moduleData)
    return userData
  }, [])

  // Log out: call the API to blacklist the token, then clear local state
  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem('refresh_token')
    try {
      if (refreshToken) await apiLogout(refreshToken)
    } catch {
      // Even if the API call fails, we still clear local state
    }
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    setUser(null)
    setModules([])
  }, [])

  // Check if the user has access to a specific module by its slug
  const hasModuleAccess = useCallback(
    (moduleSlug) => modules.some((m) => m.module === moduleSlug),
    [modules]
  )

  const value = {
    user,
    modules,
    loading,
    login,
    logout,
    hasModuleAccess,
    isAuthenticated: !!user,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// Custom hook — use this in any component to access auth state
// e.g. const { user, login, logout, hasModuleAccess } = useAuth()
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
