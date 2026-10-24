import { type HTMLAttributes, type ReactNode } from 'react'
import { cn } from '@lib/utils'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'primary' | 'amber' | 'success' | 'info' | 'destructive' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  dot?: boolean
}

const variantStyles = {
  default: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
  primary: 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  success: 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300',
  info: 'bg-info-100 text-info-700 dark:bg-info-900/30 dark:text-info-300',
  destructive: 'bg-destructive-100 text-destructive-700 dark:bg-destructive-900/30 dark:text-destructive-300',
  outline: 'bg-transparent border border-border text-text',
}

const sizeStyles = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
  lg: 'px-3 py-1.5 text-base',
}

export function Badge({
  className,
  variant = 'default',
  size = 'md',
  dot = false,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium rounded-full',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn(
            'rounded-full',
            variant === 'default' && 'bg-neutral-400',
            variant === 'primary' && 'bg-primary-500',
            variant === 'amber' && 'bg-amber-500',
            variant === 'success' && 'bg-success-500',
            variant === 'info' && 'bg-info-500',
            variant === 'destructive' && 'bg-destructive-500',
            variant === 'outline' && 'bg-text',
            size === 'sm' && 'w-1.5 h-1.5',
            size === 'md' && 'w-2 h-2',
            size === 'lg' && 'w-2.5 h-2.5'
          )}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  )
}

export interface StatusPillProps extends HTMLAttributes<HTMLSpanElement> {
  status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'overdue' | 'reported' | 'acknowledged' | 'reopened' | 'resolved' | 'closed' | 'available' | 'low' | 'out_of_stock' | 'ordered' | 'active' | 'inactive'
  size?: 'sm' | 'md' | 'lg'
  showIcon?: boolean
}

const statusConfig: Record<string, { variant: BadgeProps['variant']; label: string; icon?: ReactNode }> = {
  pending: { variant: 'amber', label: 'Pending' },
  in_progress: { variant: 'info', label: 'In Progress' },
  completed: { variant: 'success', label: 'Completed' },
  skipped: { variant: 'default', label: 'Skipped' },
  overdue: { variant: 'destructive', label: 'Overdue' },
  reported: { variant: 'info', label: 'Reported' },
  acknowledged: { variant: 'amber', label: 'Acknowledged' },
  reopened: { variant: 'destructive', label: 'Reopened' },
  resolved: { variant: 'success', label: 'Resolved' },
  closed: { variant: 'default', label: 'Closed' },
  available: { variant: 'success', label: 'Available' },
  low: { variant: 'amber', label: 'Low Stock' },
  out_of_stock: { variant: 'destructive', label: 'Out of Stock' },
  ordered: { variant: 'info', label: 'Ordered' },
  active: { variant: 'success', label: 'Active' },
  inactive: { variant: 'default', label: 'Inactive' },
}

export function StatusPill({ status, size = 'md', showIcon = true, className, ...props }: StatusPillProps) {
  const config = statusConfig[status] || { variant: 'default', label: status }
  
  return (
    <Badge variant={config.variant} size={size} dot={showIcon} className={className} {...props}>
      {config.label}
    </Badge>
  )
}