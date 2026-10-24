import { createContext, useContext, useState, type ReactNode, useCallback, useEffect } from 'react'
import { cn } from '@lib/utils'
import { Button } from './Button'
import { X, CheckCircle, AlertCircle, Info, Loader2 } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'info' | 'loading' | 'default'

export interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
  undo?: {
    label: string
    onClick: () => void
    duration?: number
  }
}

interface ToastContextValue {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => string
  removeToast: (id: string) => void
  dismissToast: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const newToast = { ...toast, id }
    setToasts((prev) => [...prev, newToast])
    return id
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, duration: 0 } : t)))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, dismissToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
  if (toasts.length === 0) return null

  return (
    <div
      className="fixed bottom-4 right-4 z-[var(--z-toast)] flex flex-col gap-2 pointer-events-none"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  )
}

interface ToastItemProps {
  toast: Toast
  onRemove: (id: string) => void
}

function ToastItem({ toast, onRemove }: ToastItemProps) {
  const [isExiting, setIsExiting] = useState(false)
  const [undoTimeLeft, setUndoTimeLeft] = useState(toast.undo?.duration || 0)

  useEffect(() => {
    if (toast.duration !== 0 && toast.duration !== undefined) {
      const timer = setTimeout(() => {
        setIsExiting(true)
        setTimeout(() => onRemove(toast.id), 200)
      }, toast.duration)
      return () => clearTimeout(timer)
    }
    return () => {}
  }, [toast.duration, toast.id, onRemove])

  useEffect(() => {
    if (toast.undo && toast.undo.duration) {
      const timer = setInterval(() => {
        setUndoTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer)
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(timer)
    }
    return () => {}
  }, [toast.undo])

  const handleAction = () => {
    toast.action?.onClick()
    onRemove(toast.id)
  }

  const handleUndo = () => {
    toast.undo?.onClick()
    onRemove(toast.id)
  }

  const typeStyles = {
    success: 'bg-success-50 border-success-200 dark:bg-success-900/20 dark:border-success-800',
    error: 'bg-destructive-50 border-destructive-200 dark:bg-destructive-900/20 dark:border-destructive-800',
    info: 'bg-info-50 border-info-200 dark:bg-info-900/20 dark:border-info-800',
    loading: 'bg-primary-50 border-primary-200 dark:bg-primary-900/20 dark:border-primary-800',
    default: 'bg-surface border-border',
  }

  const iconComponents = {
    success: <CheckCircle className="w-5 h-5 text-success-600" />,
    error: <AlertCircle className="w-5 h-5 text-destructive-600" />,
    info: <Info className="w-5 h-5 text-info-600" />,
    loading: <Loader2 className="w-5 h-5 text-primary-600 animate-spin" />,
    default: null,
  }

  return (
    <div
      className={cn(
        'pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-surface-elevated min-w-[300px] max-w-md',
        'animate-in slide-in-from-right-full duration-300',
        isExiting && 'animate-out slide-out-to-right-full duration-200',
        typeStyles[toast.type]
      )}
      role="alert"
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
    >
      {iconComponents[toast.type]}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-text">{toast.title}</p>
        {toast.message && (
          <p className="text-sm text-text-muted mt-0.5">{toast.message}</p>
        )}
        {(toast.action || toast.undo) && (
          <div className="flex items-center gap-2 mt-3">
            {toast.action && (
              <Button variant="outline" size="sm" onClick={handleAction}>
                {toast.action.label}
              </Button>
            )}
            {toast.undo && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleUndo}
                className="flex items-center gap-1.5"
              >
                {toast.undo.label}
                {undoTimeLeft > 0 && (
                  <span className="text-xs text-text-muted">({undoTimeLeft}s)</span>
                )}
              </Button>
            )}
          </div>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => {
          setIsExiting(true)
          setTimeout(() => onRemove(toast.id), 200)
        }}
        aria-label="Dismiss"
        className="text-text-muted hover:text-text flex-shrink-0"
      >
        <X className="w-4 h-4" />
      </Button>
    </div>
  )
}

// Convenience functions for common toast patterns
export function useToastHelpers() {
  const { addToast, removeToast } = useToast()

  const showSuccess = useCallback(
    (title: string, message?: string, undo?: Toast['undo']) =>
      addToast({ type: 'success', title, message, duration: undo ? 0 : 5000, undo }),
    [addToast]
  )

  const showError = useCallback(
    (title: string, message?: string, action?: Toast['action']) =>
      addToast({ type: 'error', title, message, duration: 8000, action }),
    [addToast]
  )

  const showInfo = useCallback(
    (title: string, message?: string) => addToast({ type: 'info', title, message, duration: 5000 }),
    [addToast]
  )

  const showLoading = useCallback(
    (title: string, message?: string) => addToast({ type: 'loading', title, message, duration: 0 }),
    [addToast]
  )

  const showWithUndo = useCallback(
    (title: string, message: string, undoLabel: string, onUndo: () => void, undoDuration = 10000) =>
      addToast({
        type: 'success',
        title,
        message,
        duration: 0,
        undo: { label: undoLabel, onClick: onUndo, duration: undoDuration },
      }),
    [addToast]
  )

  return { showSuccess, showError, showInfo, showLoading, showWithUndo, removeToast }
}