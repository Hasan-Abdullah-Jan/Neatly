import { type ReactNode } from 'react'
import { cn } from '@lib/utils'
import { Button } from './Button'

export interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
    variant?: 'primary' | 'secondary' | 'outline'
  }
  secondaryAction?: {
    label: string
    onClick: () => void
  }
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center py-12 px-4',
        'bg-surface border border-border rounded-xl',
        className
      )}
      role="status"
      aria-live="polite"
    >
      {icon && (
        <div className="w-16 h-16 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-4 text-text-muted">
          {icon}
        </div>
      )}
      <h3 className="text-heading-md font-semibold text-text mb-2">{title}</h3>
      {description && (
        <p className="text-body text-text-muted max-w-sm mb-6">{description}</p>
      )}
      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-sm">
          {action && (
            <Button variant={action.variant || 'primary'} className="w-full sm:w-auto" onClick={action.onClick}>
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button variant="ghost" className="w-full sm:w-auto" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

export function NoTasksEmptyState({
  onCreateTask,
  onBrowseTemplates,
}: {
  onCreateTask?: () => void
  onBrowseTemplates?: () => void
}) {
  return (
    <EmptyState
      icon={
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      }
      title="No tasks yet"
      description="Get started by creating your first task or browse templates."
      action={onCreateTask ? { label: 'Create task', onClick: onCreateTask } : undefined}
      secondaryAction={onBrowseTemplates ? { label: 'Browse templates', onClick: onBrowseTemplates } : undefined}
    />
  )
}

export function NoSpacesEmptyState({
  onCreateSpace,
}: {
  onCreateSpace?: () => void
}) {
  return (
    <EmptyState
      icon={
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      }
      title="No spaces yet"
      description="Create a space to organize your tasks, areas, and supplies."
      action={onCreateSpace ? { label: 'Create space', onClick: onCreateSpace } : undefined}
    />
  )
}

export function NoIssuesEmptyState({
  onReportIssue,
}: {
  onReportIssue?: () => void
}) {
  return (
    <EmptyState
      icon={
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      }
      title="No issues reported"
      description="Everything looks good! Report an issue if something needs attention."
      action={onReportIssue ? { label: 'Report issue', onClick: onReportIssue } : undefined}
    />
  )
}

export function NoSuppliesEmptyState({
  onAddSupply,
}: {
  onAddSupply?: () => void
}) {
  return (
    <EmptyState
      icon={
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      }
      title="No supplies tracked"
      description="Add supplies to keep track of what you have and what needs restocking."
      action={onAddSupply ? { label: 'Add supply', onClick: onAddSupply } : undefined}
    />
  )
}

export function NoResultsEmptyState({
  title = 'No results found',
  description = 'Try adjusting your search or filters.',
  onClearFilters,
}: {
  title?: string
  description?: string
  onClearFilters?: () => void
}) {
  return (
    <EmptyState
      icon={
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      }
      title={title}
      description={description}
      action={onClearFilters ? { label: 'Clear filters', variant: 'outline', onClick: onClearFilters } : undefined}
    />
  )
}