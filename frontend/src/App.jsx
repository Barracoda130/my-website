import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute, ModuleRoute } from './routes/ProtectedRoute'

import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import BudgetDashboard from './pages/modules/budget/BudgetDashboard'
import BudgetManage from './pages/modules/budget/BudgetManage'
import BudgetYearPlanner from './pages/modules/budget/BudgetYearPlanner'
import FamilyDashboard from './pages/modules/family/FamilyDashboard'
import FamilyChildren from './pages/modules/family/FamilyChildren'
import FamilyTransactions from './pages/modules/family/FamilyTransactions'
import FamilyChildPaidTransactions from './pages/modules/family/FamilyChildPaidTransactions'
import FamilyFairness from './pages/modules/family/FamilyFairness'
import Unauthorized from './pages/Unauthorized'
import NotFound from './pages/NotFound'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Redirect root to dashboard */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* Protected routes — require login */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          {/* Module routes — require login + module access */}
          <Route
            path="/budget"
            element={
              <ProtectedRoute>
                <ModuleRoute moduleSlug="budget_tracker">
                  <BudgetDashboard />
                </ModuleRoute>
              </ProtectedRoute>
            }
          />

          <Route
            path="/budget/manage"
            element={
              <ProtectedRoute>
                <ModuleRoute moduleSlug="budget_tracker">
                  <BudgetManage />
                </ModuleRoute>
              </ProtectedRoute>
            }
          />

          <Route
            path="/budget/yearly"
            element={
              <ProtectedRoute>
                <ModuleRoute moduleSlug="budget_tracker">
                  <BudgetYearPlanner />
                </ModuleRoute>
              </ProtectedRoute>
            }
          />

          <Route
            path="/family"
            element={
              <ProtectedRoute>
                <ModuleRoute moduleSlug="family_finances">
                  <FamilyDashboard />
                </ModuleRoute>
              </ProtectedRoute>
            }
          />

          {[
            ['/family/children', <FamilyChildren key="children" />],
            ['/family/transactions', <FamilyTransactions key="transactions" />],
            ['/family/child-paid', <FamilyChildPaidTransactions key="child-paid" />],
            ['/family/fairness', <FamilyFairness key="fairness" />],
          ].map(([path, element]) => (
            <Route
              key={path}
              path={path}
              element={
                <ProtectedRoute>
                  <ModuleRoute moduleSlug="family_finances">
                    {element}
                  </ModuleRoute>
                </ProtectedRoute>
              }
            />
          ))}

          {/* Utility pages */}
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
