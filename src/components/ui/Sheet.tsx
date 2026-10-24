import { type ReactNode, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@lib/utils'

export interface SheetProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  description?: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'full'
  showHandle?: boolean
  closeOnOverlayClick?: boolean
  closeOnEscape?: boolean
}

const sizeStyles = {
  sm: 'max-h-[40vh]',
  md: 'max-h-[60vh]',
  lg: 'max-h-[80vh]',
  full: 'max-h-[95vh]',
}

export function Sheet({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'md',
  showHandle = true,
  closeOnOverlayClick = true,
  closeOnEscape = true,
}: SheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const previousActiveElement = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement
      document.body.style.overflow = 'hidden'
      sheetRef.current?.focus()
    } else {
      document.body.style.overflow = ''
      previousActiveElement.current?.focus()
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!isOpen || !closeOnEscape) return
      if (e.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, closeOnEscape, onClose])

  if (!isOpen) return null

  const sheetContent = (
    <div
      className="fixed inset-0 z-[var(--z-sheet)] flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'sheet-title' : undefined}
      aria-describedby={description ? 'sheet-description' : undefined}
    >
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        aria-hidden="true"
        onClick={closeOnOverlayClick ? onClose : undefined}
      />
      <div
        ref={sheetRef}
        tabIndex={-1}
        className={cn(
          'relative w-full bg-surface rounded-t-2xl shadow-surface-elevated',
          'animate-in slide-in-from-bottom-full duration-300',
          'data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom-full',
          sizeStyles[size],
          'flex flex-col max-h-full'
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
          <div className="flex-1">
            {showHandle && (
              <div
                className="w-10 h-1.5 bg-neutral-300 rounded-full mx-auto mb-3 dark:bg-neutral-600"
                aria-hidden="true"
              />
            )}
            {title && (
              <h2 id="sheet-title" className="text-heading-md font-semibold text-text text-center">
                {title}
              </h2>
            )}
            {description && (
              <p id="sheet-description" className="text-body-sm text-text-muted mt-1 text-center">
                {description}
              </p>
            )}
          </div>
        </div>
        <div className="p-4 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  )

  if (typeof window === 'undefined') return null
  return createPortal(sheetContent, document.body)
}