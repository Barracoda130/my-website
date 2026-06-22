import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * ProtectedRoute — wraps any route that requires the user to be logged in.
 * If not authenticated, redirects to /login and remembers where they were
 * trying to go (so we can redirect back after login).
 */
export function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()

  // While we're checking if the user is logged in, show nothing (or a spinner)
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500 text-lg">Loading...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    // Redirect to login, saving the current location so we can return after login
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return children
}

/**
 * ModuleRoute — wraps any route that requires access to a specific module.
 * Must be used inside a ProtectedRoute (assumes user is already authenticated).
 * If the user doesn't have access to the module, redirects to /unauthorized.
 */
export function ModuleRoute({ moduleSlug, children }) {
  const { hasModuleAccess } = useAuth()

  if (!hasModuleAccess(moduleSlug)) {
    return <Navigate to="/unauthorized" replace />
  }

  return children
}
