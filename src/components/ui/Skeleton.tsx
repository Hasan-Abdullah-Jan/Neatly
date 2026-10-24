import { cn } from '@lib/utils'

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular' | 'card'
  width?: string | number
  height?: string | number
  lines?: number
}

export function Skeleton({
  className,
  variant = 'text',
  width,
  height,
  lines = 1,
  ...props
}: SkeletonProps) {
  const baseStyles = 'animate-pulse bg-neutral-200 dark:bg-neutral-700 rounded'

  if (variant === 'circular') {
    return (
      <div
        className={cn(baseStyles, 'rounded-full', className)}
        style={{ width: width || '1rem', height: height || '1rem' }}
        {...props}
      />
    )
  }

  if (variant === 'rectangular') {
    return (
      <div
        className={cn(baseStyles, className)}
        style={{ width: width || '100%', height: height || '1rem' }}
        {...props}
      />
    )
  }

  if (variant === 'card') {
    return (
      <div className={cn('space-y-3', className)} {...props}>
        <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-3/4" />
        <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-1/2" />
        <div className="h-12 bg-neutral-200 dark:bg-neutral-700 rounded" />
      </div>
    )
  }

  // text variant - multiple lines
  return (
    <div className={cn('space-y-2', className)} {...props}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={cn(baseStyles, 'h-4')}
          style={{
            width:
              i === lines - 1 && lines > 1
                ? '60%'
                : width || '100%',
          }}
        />
      ))}
    </div>
  )
}

export function TaskCardSkeleton() {
  return (
    <div className="bg-surface border border-border rounded-xl p-4 animate-pulse">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="h-5 bg-neutral-200 dark:bg-neutral-700 rounded w-3/4" />
          <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-1/2" />
        </div>
        <div className="w-8 h-8 bg-neutral-200 dark:bg-neutral-700 rounded-full flex-shrink-0" />
      </div>
      <div className="mt-3 flex items-center gap-2">
        <div className="h-5 bg-neutral-200 dark:bg-neutral-700 rounded-full w-20" />
        <div className="h-5 bg-neutral-200 dark:bg-neutral-700 rounded-full w-16" />
      </div>
    </div>
  )
}

export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3" role="list" aria-label="Loading items">
      {Array.from({ length: count }).map((_, i) => (
        <TaskCardSkeleton key={i} />
      ))}
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-surface border border-border rounded-xl p-4">
            <div className="h-5 bg-neutral-200 dark:bg-neutral-700 rounded w-1/3 mb-2" />
            <div className="h-10 bg-neutral-200 dark:bg-neutral-700 rounded w-1/2" />
          </div>
        ))}
      </div>
      <div className="bg-surface border border-border rounded-xl p-4">
        <div className="h-5 bg-neutral-200 dark:bg-neutral-700 rounded w-1/4 mb-4" />
        <ListSkeleton count={3} />
      </div>
    </div>
  )
}