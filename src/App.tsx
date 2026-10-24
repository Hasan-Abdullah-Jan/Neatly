import type { ReactNode } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from '@components/layout/AppShell'
import { ProtectedRoute } from '@components/auth/ProtectedRoute'
import { LoginPage } from '@features/auth/pages/LoginPage'
import { RegisterPage } from '@features/auth/pages/RegisterPage'
import { ForgotPasswordPage } from '@features/auth/pages/ForgotPasswordPage'
import { TodayPage } from '@features/tasks/pages/TodayPage'
import { TasksPage } from '@features/tasks/pages/TasksPage'
import { HistoryPage } from '@features/tasks/pages/HistoryPage'
import { SettingsPage } from '@features/settings/pages/SettingsPage'
import { OnboardingPage } from '@features/onboarding/pages/OnboardingPage'
import { AreasPage } from '@features/areas/pages/AreasPage'
import { AreaPage } from '@features/areas/pages/AreaPage'
import { IssuesPage } from '@features/issues/pages/IssuesPage'
import { IssueDetailPage } from '@features/issues/pages/IssueDetailPage'
import { SpaceSettingsPage } from '@features/spaces/pages/SpaceSettingsPage'
import { useAuth } from '@contexts/AuthContext'

function RequireSpace({ children }: { children: ReactNode }) {
  const { currentSpace } = useAuth()
  if (!currentSpace) {
    return <Navigate to="/onboarding" replace />
  }
  return <>{children}</>
}

function AppRoutes() {
  const { loading, currentSpace } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent" aria-label="Loading" />
      </div>
    )
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />

      {/* Onboarding has its own full-screen layout. */}
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <OnboardingPage />
          </ProtectedRoute>
        }
      />

      {/* Everything else needs an authenticated user and an active space. */}
      <Route
        element={
          <ProtectedRoute>
            <RequireSpace>
              <AppShell />
            </RequireSpace>
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Navigate to="/today" replace />} />
        <Route path="/today" element={<TodayPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/tasks-schedule" element={<TasksPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/rooms" element={<AreasPage />} />
        <Route path="/areas" element={<AreasPage />} />
        <Route path="/areas/:areaId" element={<AreaPage />} />
        <Route path="/issues" element={<IssuesPage />} />
        <Route path="/issues/:issueId" element={<IssueDetailPage />} />
        <Route path="/space-settings" element={<SpaceSettingsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      {/* Unknown paths respect whether a space exists yet. */}
      <Route
        path="*"
        element={<Navigate to={currentSpace ? '/today' : '/onboarding'} replace />}
      />
    </Routes>
  )
}

export function App() {
  return <AppRoutes />
}
