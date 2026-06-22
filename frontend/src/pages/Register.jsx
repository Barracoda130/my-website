import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { validateInvite, register } from '../api/auth'

export default function Register() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Read the invite token from the URL: /register?invite=<token>
  const inviteToken = searchParams.get('invite') || ''

  const [inviteValid, setInviteValid] = useState(null) // null = checking, true/false = result
  const [inviteError, setInviteError] = useState('')

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    password_confirm: '',
    first_name: '',
    last_name: '',
  })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  // Validate the invite token as soon as the page loads
  useEffect(() => {
    if (!inviteToken) {
      setInviteValid(false)
      setInviteError('No invite token found. You need a valid invite link to register.')
      return
    }

    validateInvite(inviteToken)
      .then(() => setInviteValid(true))
      .catch(() => {
        setInviteValid(false)
        setInviteError('This invite link is invalid or has already been used.')
      })
  }, [inviteToken])

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }))
    // Clear the error for this field when the user starts typing
    setErrors((prev) => ({ ...prev, [e.target.name]: '' }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrors({})
    setLoading(true)

    try {
      await register({ ...formData, invite_token: inviteToken })
      // Log in automatically after successful registration
      await login(formData.username, formData.password)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      const data = err.response?.data
      if (data && typeof data === 'object') {
        setErrors(data)
      } else {
        setErrors({ non_field_errors: 'Registration failed. Please try again.' })
      }
    } finally {
      setLoading(false)
    }
  }

  // Show a message while we check the invite token
  if (inviteValid === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Validating your invite link...</div>
      </div>
    )
  }

  // Show an error if the invite is invalid
  if (inviteValid === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Invalid Invite Link</h1>
          <p className="text-gray-500 mb-6">{inviteError}</p>
          <Link to="/login" className="text-blue-600 hover:underline text-sm">
            Back to login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Create your account</h1>
          <p className="text-gray-500 mb-8">You&apos;ve been invited — fill in your details below.</p>

          {errors.non_field_errors && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {errors.non_field_errors}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="first_name" className="block text-sm font-medium text-gray-700 mb-1">
                  First name
                </label>
                <input
                  id="first_name"
                  name="first_name"
                  type="text"
                  value={formData.first_name}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Jane"
                />
              </div>
              <div>
                <label htmlFor="last_name" className="block text-sm font-medium text-gray-700 mb-1">
                  Last name
                </label>
                <input
                  id="last_name"
                  name="last_name"
                  type="text"
                  value={formData.last_name}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Smith"
                />
              </div>
            </div>

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                Username <span className="text-red-500">*</span>
              </label>
              <input
                id="username"
                name="username"
                type="text"
                value={formData.username}
                onChange={handleChange}
                required
                autoComplete="username"
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.username ? 'border-red-400' : 'border-gray-300'}`}
                placeholder="Choose a username"
              />
              {errors.username && <p className="mt-1 text-xs text-red-600">{errors.username}</p>}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password <span className="text-red-500">*</span>
              </label>
              <input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                required
                autoComplete="new-password"
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.password ? 'border-red-400' : 'border-gray-300'}`}
                placeholder="At least 8 characters"
              />
              {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
            </div>

            <div>
              <label htmlFor="password_confirm" className="block text-sm font-medium text-gray-700 mb-1">
                Confirm password <span className="text-red-500">*</span>
              </label>
              <input
                id="password_confirm"
                name="password_confirm"
                type="password"
                value={formData.password_confirm}
                onChange={handleChange}
                required
                autoComplete="new-password"
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.password_confirm ? 'border-red-400' : 'border-gray-300'}`}
                placeholder="Repeat your password"
              />
              {errors.password_confirm && (
                <p className="mt-1 text-xs text-red-600">{errors.password_confirm}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors"
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
