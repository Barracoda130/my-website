import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getAccounts,
  getBudgetSummary,
  getBudgets,
  getCategories,
  getCategoryGroups,
  getRecurringItems,
  getTransactions,
} from '../../../api/budget'
import { currentMonth } from './helpers'

export default function useBudgetData() {
  const [month, setMonth] = useState(currentMonth())
  const [summary, setSummary] = useState(null)
  const [groups, setGroups] = useState([])
  const [categories, setCategories] = useState([])
  const [accounts, setAccounts] = useState([])
  const [transactions, setTransactions] = useState([])
  const [budgets, setBudgets] = useState([])
  const [recurringItems, setRecurringItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadBudgetData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [summaryData, groupData, categoryData, accountData, transactionData, budgetData, recurringData] = await Promise.all([
        getBudgetSummary(month),
        getCategoryGroups(),
        getCategories(),
        getAccounts(),
        getTransactions({ month }),
        getBudgets(month),
        getRecurringItems(),
      ])
      setSummary(summaryData)
      setGroups(groupData)
      setCategories(categoryData)
      setAccounts(accountData)
      setTransactions(transactionData)
      setBudgets(budgetData)
      setRecurringItems(recurringData)
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not load your budget data.')
    } finally {
      setLoading(false)
    }
  }, [month])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadBudgetData()
    }, 0)
    return () => clearTimeout(timeoutId)
  }, [loadBudgetData])

  const hasSetup = groups.length > 0 && categories.length > 0 && accounts.length > 0

  const expenseCategories = useMemo(
    () => categories.filter((category) => category.type === 'expense' && !category.is_archived),
    [categories]
  )

  return {
    month,
    setMonth,
    summary,
    groups,
    categories,
    accounts,
    transactions,
    budgets,
    recurringItems,
    loading,
    error,
    setError,
    loadBudgetData,
    hasSetup,
    expenseCategories,
  }
}