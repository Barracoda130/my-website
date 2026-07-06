import apiClient from './client'

export const getFamilyContext = () => apiClient.get('/family/current/').then((res) => res.data)
export const getFamilyOptions = () => apiClient.get('/family/options/').then((res) => res.data)
export const getFamilyDashboard = () => apiClient.get('/family/dashboard/').then((res) => res.data)
export const getFamilyFairness = () => apiClient.get('/family/fairness/').then((res) => res.data)

export const getChildren = () => apiClient.get('/family/children/').then((res) => res.data)
export const createChild = (data) => apiClient.post('/family/children/', data).then((res) => res.data)
export const updateChild = (id, data) => apiClient.patch(`/family/children/${id}/`, data).then((res) => res.data)
export const activateChild = (id) => updateChild(id, { active: true })
export const deactivateChild = (id) => updateChild(id, { active: false })
export const deleteChild = (id) => apiClient.delete(`/family/children/${id}/`)

export const getTransactions = (params = {}) => apiClient.get('/family/transactions/', { params }).then((res) => res.data)
export const getChildPaidTransactions = () => getTransactions({ child_paid: 'true' })
export const createTransaction = (data) => apiClient.post('/family/transactions/', data).then((res) => res.data)
export const updateTransaction = (id, data) => apiClient.patch(`/family/transactions/${id}/`, data).then((res) => res.data)
export const deleteTransaction = (id) => apiClient.delete(`/family/transactions/${id}/`)
export const duplicateTransaction = (id) => apiClient.post(`/family/transactions/${id}/duplicate/`).then((res) => res.data)
export const generateRecurringTransactions = (data) => apiClient.post('/family/recurring/generate/', data).then((res) => res.data)