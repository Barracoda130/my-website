import apiClient from './client'

const buildQuery = (params = {}) => {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, value)
    }
  })
  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

export const bootstrapBudgetDefaults = async () => {
  const response = await apiClient.post('/budget/bootstrap-defaults/')
  return response.data
}

export const getBudgetSummary = async (month) => {
  const response = await apiClient.get(`/budget/summary/${buildQuery({ month })}`)
  return response.data
}

export const getYearlyBudgetPlan = async (start) => {
  const response = await apiClient.get(`/budget/yearly-plan/${buildQuery({ start })}`)
  return response.data
}

export const saveYearlyBudgetPlan = async (payload) => {
  const response = await apiClient.post('/budget/yearly-plan/', payload)
  return response.data
}

export const getCategoryGroups = async () => {
  const response = await apiClient.get('/budget/category-groups/')
  return response.data
}

export const createCategoryGroup = async (payload) => {
  const response = await apiClient.post('/budget/category-groups/', payload)
  return response.data
}

export const deleteCategoryGroup = async (id) => {
  await apiClient.delete(`/budget/category-groups/${id}/`)
}

export const getCategories = async () => {
  const response = await apiClient.get('/budget/categories/')
  return response.data
}

export const createCategory = async (payload) => {
  const response = await apiClient.post('/budget/categories/', payload)
  return response.data
}

export const deleteCategory = async (id) => {
  await apiClient.delete(`/budget/categories/${id}/`)
}

export const getAccounts = async () => {
  const response = await apiClient.get('/budget/accounts/')
  return response.data
}

export const createAccount = async (payload) => {
  const response = await apiClient.post('/budget/accounts/', payload)
  return response.data
}

export const getTransactions = async (filters = {}) => {
  const response = await apiClient.get(`/budget/transactions/${buildQuery(filters)}`)
  return response.data
}

export const createTransaction = async (payload) => {
  const response = await apiClient.post('/budget/transactions/', payload)
  return response.data
}

export const updateTransaction = async (id, payload) => {
  const response = await apiClient.patch(`/budget/transactions/${id}/`, payload)
  return response.data
}

export const deleteTransaction = async (id) => {
  await apiClient.delete(`/budget/transactions/${id}/`)
}

export const getBudgets = async (month) => {
  const response = await apiClient.get(`/budget/budgets/${buildQuery({ month })}`)
  return response.data
}

export const createBudget = async (payload) => {
  const response = await apiClient.post('/budget/budgets/', payload)
  return response.data
}

export const updateBudget = async (id, payload) => {
  const response = await apiClient.patch(`/budget/budgets/${id}/`, payload)
  return response.data
}

export const getRecurringItems = async () => {
  const response = await apiClient.get('/budget/recurring-items/')
  return response.data
}

export const createRecurringItem = async (payload) => {
  const response = await apiClient.post('/budget/recurring-items/', payload)
  return response.data
}