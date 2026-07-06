import apiClient from './client'
import axios from 'axios'
import { API_BASE_URL } from './client'

// Log in with username + password. Returns access + refresh tokens.
export const login = async (username, password) => {
  const response = await axios.post(`${API_BASE_URL}/auth/login/`, { username, password })
  return response.data
}

// Register a new user with an invite token.
export const register = async (userData) => {
  const response = await axios.post(`${API_BASE_URL}/auth/register/`, userData)
  return response.data
}

// Check if an invite token is valid before showing the registration form.
export const validateInvite = async (inviteToken) => {
  const response = await axios.post(`${API_BASE_URL}/auth/invite/validate/`, {
    invite_token: inviteToken,
  })
  return response.data
}

// Log out by blacklisting the refresh token.
export const logout = async (refreshToken) => {
  await apiClient.post('/auth/logout/', { refresh: refreshToken })
}

// Get the current user's data.
export const getMe = async () => {
  const response = await apiClient.get('/auth/me/')
  return response.data
}

// Get the list of modules the current user has access to.
export const getMyModules = async () => {
  const response = await apiClient.get('/auth/me/modules/')
  return response.data
}

// Get the list of groups the current user belongs to.
export const getMyGroups = async () => {
  const response = await apiClient.get('/auth/me/groups/')
  return response.data
}
