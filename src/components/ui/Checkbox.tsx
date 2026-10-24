import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@lib/utils'

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode
  description?: string
  error?: boolean
  onCheckedChange?: (checked: boolean) => void
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, description, error = false, id, disabled, required, onCheckedChange, onChange, ...props }, ref) => {
    const generatedId = useId()
    const checkboxId = id || `checkbox-${generatedId}`

    return (
      <div className="flex items-start gap-3">
        <input
          ref={ref}
          type="checkbox"
          id={checkboxId}
          className={cn(
            'mt-0.5 h-5 w-5 rounded border-gray-300',
            'text-primary-600 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'transition-colors duration-150',
            error && 'border-destructive-500 text-destructive-600 focus:ring-destructive-500',
            className
          )}
          disabled={disabled}
          required={required}
          aria-describedby={description ? `${checkboxId}-desc` : undefined}
          onChange={(event) => {
            onChange?.(event)
            onCheckedChange?.(event.target.checked)
          }}
          {...props}
        />
        {(label || description) && (
          <div className="flex flex-col">
            {label && (
              <label
                htmlFor={checkboxId}
                className={cn(
                  'text-sm font-medium text-text cursor-pointer',
                  disabled && 'opacity-50 cursor-not-allowed'
                )}
              >
                {label}
              </label>
            )}
            {description && (
              <p id={`${checkboxId}-desc`} className="text-sm text-text-muted mt-0.5">
                {description}
              </p>
            )}
          </div>
        )}
      </div>
    )
  }
)

Checkbox.displayName = 'Checkbox'

export interface CheckboxGroupProps {
  label?: string
  description?: string
  error?: string
  options: Array<{ value: string; label: string; description?: string; disabled?: boolean }>
  value: string[]
  onChange: (value: string[]) => void
  name: string
  required?: boolean
  orientation?: 'vertical' | 'horizontal'
}

export function CheckboxGroup({
  label,
  description,
  error,
  options,
  value,
  onChange,
  name,
  required,
  orientation = 'vertical',
}: CheckboxGroupProps) {
  const generatedId = useId()
  const groupId = `checkbox-group-${generatedId}`
  const errorId = error ? `${groupId}-error` : undefined
  const descId = description ? `${groupId}-desc` : undefined

  const handleChange = (optionValue: string, checked: boolean) => {
    const newValue = checked ? [...value, optionValue] : value.filter((v) => v !== optionValue)
    onChange(newValue)
  }

  return (
    <fieldset className="w-full" aria-describedby={[descId, errorId].filter(Boolean).join(' ') || undefined}>
      {(label || description) && (
        <div className="mb-2">
          {label && <legend className="text-sm font-medium text-text mb-1">{label}</legend>}
          {description && <p id={descId} className="text-sm text-text-muted">{description}</p>}
        </div>
      )}
      <div
        className={cn(
          'flex flex-wrap gap-3',
          orientation === 'horizontal' ? 'items-center' : 'flex-col'
        )}
        role="group"
        aria-labelledby={label ? groupId : undefined}
      >
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              'flex items-start gap-3 cursor-pointer',
              option.disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            <input
              type="checkbox"
              name={name}
              value={option.value}
              checked={value.includes(option.value)}
              onChange={(e) => handleChange(option.value, e.target.checked)}
              disabled={option.disabled}
              required={required}
              className={cn(
                'mt-0.5 h-5 w-5 rounded border-gray-300',
                'text-primary-600 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'transition-colors duration-150'
              )}
            />
            <div className="flex flex-col">
              <span className="text-sm font-medium text-text">{option.label}</span>
              {option.description && (
                <span className="text-sm text-text-muted">{option.description}</span>
              )}
            </div>
          </label>
        ))}
      </div>
      {error && <p id={errorId} className="mt-1.5 text-sm text-destructive-600" role="alert">{error}</p>}
    </fieldset>
  )
}