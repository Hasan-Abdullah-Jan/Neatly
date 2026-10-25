import { forwardRef, useId, type InputHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@lib/utils'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  fullWidth?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      label,
      error,
      hint,
      leftIcon,
      rightIcon,
      fullWidth = true,
      id,
      disabled,
      required,
      'aria-describedby': ariaDescribedBy,
      ...props
    },
    ref
  ) => {
    const generatedId = useId()
    const inputId = id || `input-${generatedId}`
    const errorId = error ? `${inputId}-error` : undefined
    const hintId = hint ? `${inputId}-hint` : undefined
    const describedBy = [errorId, hintId, ariaDescribedBy].filter(Boolean).join(' ') || undefined

    return (
      <div className={cn('w-full', fullWidth && 'w-full')}>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-text mb-1.5"
          >
            {label}
            {required && <span className="text-destructive-500 ml-1" aria-hidden="true">*</span>}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div
              className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted"
              aria-hidden="true"
            >
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full rounded-lg border bg-surface text-text placeholder:text-text-muted',
              'border-border focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20',
              'transition-colors duration-150',
              'disabled:bg-neutral-100 disabled:cursor-not-allowed dark:disabled:bg-neutral-800',
              'touch-target',
              leftIcon ? 'pl-10' : 'px-4',
              rightIcon ? 'pr-10' : 'px-4',
              'py-2.5',
              error && 'border-destructive-500 focus:border-destructive-500 focus:ring-destructive-500/20',
              className
            )}
            disabled={disabled}
            required={required}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={describedBy}
            aria-required={required}
            {...props}
          />
          {rightIcon && (
            <div
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-text-muted"
            >
              {rightIcon}
            </div>
          )}
        </div>
        {error && (
          <p id={errorId} className="mt-1.5 text-sm text-destructive-600 dark:text-destructive-400" role="alert">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={hintId} className="mt-1.5 text-sm text-text-muted">
            {hint}
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

export interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  label?: string
  error?: string
  hint?: string
  fullWidth?: boolean
  rows?: number
  onChange?: (value: string) => void
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      label,
      error,
      hint,
      fullWidth = true,
      id,
      disabled,
      required,
      rows = 3,
      onChange,
      'aria-describedby': ariaDescribedBy,
      ...props
    },
    ref
  ) => {
    const generatedId = useId()
    const inputId = id || `textarea-${generatedId}`
    const errorId = error ? `${inputId}-error` : undefined
    const hintId = hint ? `${inputId}-hint` : undefined
    const describedBy = [errorId, hintId, ariaDescribedBy].filter(Boolean).join(' ') || undefined

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange?.(e.target.value)
    }

    return (
      <div className={cn('w-full', fullWidth && 'w-full')}>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-text mb-1.5"
          >
            {label}
            {required && <span className="text-destructive-500 ml-1" aria-hidden="true">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          rows={rows}
          className={cn(
            'w-full rounded-lg border bg-surface text-text placeholder:text-text-muted resize-y',
            'border-border focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20',
            'transition-colors duration-150',
            'disabled:bg-neutral-100 disabled:cursor-not-allowed dark:disabled:bg-neutral-800',
            'px-4 py-2.5 touch-target',
            error && 'border-destructive-500 focus:border-destructive-500 focus:ring-destructive-500/20',
            className
          )}
          disabled={disabled}
          required={required}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={describedBy}
          aria-required={required}
          onChange={handleChange}
          {...props}
        />
        {error && (
          <p id={errorId} className="mt-1.5 text-sm text-destructive-600 dark:text-destructive-400" role="alert">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={hintId} className="mt-1.5 text-sm text-text-muted">
            {hint}
          </p>
        )}
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'