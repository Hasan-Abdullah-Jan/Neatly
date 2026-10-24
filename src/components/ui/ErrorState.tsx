import { type ReactNode } from 'react'
import { cn } from '@lib/utils'
import { Button } from './Button'
import { AlertCircle, WifiOff, Server, RefreshCw } from 'lucide-react'

export type ErrorType = 'generic' | 'network' | 'server' | 'not_found' | 'unauthorized' | 'forbidden'

export interface ErrorStateProps {
  type?: ErrorType
  title?: string
  message?: string
  error?: Error | null
  onRetry?: () => void
  onDismiss?: () => void
  showDetails?: boolean
  className?: string
}

const errorConfig: Record<ErrorType, { icon: ReactNode; defaultTitle: string; defaultMessage: string }> = {
  generic: {
    icon: <AlertCircle className="w-8 h-8" />,
    defaultTitle: 'Something went wrong',
    defaultMessage: 'An unexpected error occurred. Please try again.',
  },
  network: {
    icon: <WifiOff className="w-8 h-8" />,
    defaultTitle: 'Connection lost',
    defaultMessage: 'Please check your internet connection and try again.',
  },
  server: {
    icon: <Server className="w-8 h-8" />,
    defaultTitle: 'Server error',
    defaultMessage: 'Our servers are having trouble. Please try again in a moment.',
  },
  not_found: {
    icon: <AlertCircle className="w-8 h-8" />,
    defaultTitle: 'Not found',
    defaultMessage: 'The requested resource could not be found.',
  },
  unauthorized: {
    icon: <AlertCircle className="w-8 h-8" />,
    defaultTitle: 'Please sign in',
    defaultMessage: 'You need to be signed in to access this page.',
  },
  forbidden: {
    icon: <AlertCircle className="w-8 h-8" />,
    defaultTitle: 'Access denied',
    defaultMessage: 'You don\'t have permission to access this resource.',
  },
}

export function ErrorState({
  type = 'generic',
  title,
  message,
  error,
  onRetry,
  onDismiss,
  showDetails = false,
  className,
}: ErrorStateProps) {
  const config = errorConfig[type]

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center py-12 px-4',
        'bg-surface border border-border rounded-xl',
        className
      )}
      role="alert"
      aria-live="assertive"
    >
      <div className="w-16 h-16 rounded-full bg-destructive-50 dark:bg-destructive-900/20 flex items-center justify-center mb-4 text-destructive-600 dark:text-destructive-400">
        {config.icon}
      </div>
      <h3 className="text-heading-md font-semibold text-text mb-2">{title || config.defaultTitle}</h3>
      <p className="text-body text-text-muted max-w-sm mb-6">{message || config.defaultMessage}</p>
      
      {error && showDetails && (
        <details className="mb-4 w-full max-w-sm text-left">
          <summary className="text-sm text-text-muted cursor-pointer mb-2">Error details</summary>
          <pre className="text-xs bg-neutral-100 dark:bg-neutral-800 p-3 rounded overflow-auto text-text-muted">
            {error.message}
            {error.stack && `\n\n${error.stack}`}
          </pre>
        </details>
      )}

      <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-sm">
        {onRetry && (
          <Button variant="primary" className="w-full sm:w-auto" onClick={onRetry} leftIcon={<RefreshCw className="w-4 h-4" />}>
            Try again
          </Button>
        )}
        {onDismiss && (
          <Button variant="ghost" className="w-full sm:w-auto" onClick={onDismiss}>
            Dismiss
          </Button>
        )}
      </div>
    </div>
  )
}

export function NetworkErrorState({ onRetry }: { onRetry?: () => void }) {
  return <ErrorState type="network" onRetry={onRetry} />
}

export function ServerErrorState({ onRetry }: { onRetry?: () => void }) {
  return <ErrorState type="server" onRetry={onRetry} />
}

export function NotFoundErrorState({ onRetry }: { onRetry?: () => void }) {
  return <ErrorState type="not_found" onRetry={onRetry} />
}

export function UnauthorizedErrorState({ onRetry }: { onRetry?: () => void }) {
  return <ErrorState type="unauthorized" onRetry={onRetry} />
}

export function ForbiddenErrorState({ onRetry }: { onRetry?: () => void }) {
  return <ErrorState type="forbidden" onRetry={onRetry} />
}