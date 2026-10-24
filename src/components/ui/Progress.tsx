import { cn } from '@lib/utils'

export interface ProgressProps {
  value: number
  className?: string
  showLabel?: boolean
  label?: string
  size?: 'sm' | 'md' | 'lg'
}

export function Progress({ value, className, showLabel = false, label, size = 'md' }: ProgressProps) {
  const clampedValue = Math.max(0, Math.min(100, value))
  const height = size === 'sm' ? 'h-1' : size === 'md' ? 'h-2' : 'h-3'

  return (
    <div className={cn('w-full', className)}>
      <div className={cn('relative w-full bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden', height)}>
        <div
          className={cn(
            'bg-primary-600 h-full rounded-full transition-all duration-300 ease-out',
            height
          )}
          style={{ width: `${clampedValue}%` }}
          role="progressbar"
          aria-valuenow={clampedValue}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={label || `Progress: ${clampedValue}%`}
        />
      </div>
      {showLabel && (
        <div className="flex justify-between text-xs text-text-muted mt-1">
          <span>{label || 'Progress'}</span>
          <span>{clampedValue}%</span>
        </div>
      )}
    </div>
  )
}