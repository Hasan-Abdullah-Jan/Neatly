import { Component, type ErrorInfo, type ReactNode } from 'react'
import { ErrorState } from '@components/ui/ErrorState'
import { reportClientError } from '@lib/errorReporting'

interface AppErrorBoundaryState {
  hasError: boolean
}

export class AppErrorBoundary extends Component<{ children: ReactNode }, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, _errorInfo: ErrorInfo): void {
    reportClientError(error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="min-h-screen bg-background p-4 pt-12">
          <div className="mx-auto max-w-xl">
            <ErrorState
              title="Neatly could not open this page"
              message="Your data has not been changed. Reload the page, or return and try again."
              onRetry={() => window.location.reload()}
              onDismiss={() => window.location.assign('/')}
            />
          </div>
        </main>
      )
    }
    return this.props.children
  }
}
