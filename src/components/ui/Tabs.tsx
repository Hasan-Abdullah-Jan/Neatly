import { createContext, useContext, type ReactNode } from 'react'
import { cn } from '@lib/utils'

interface TabsContextValue {
  value: string
  onValueChange: (value: string) => void
}

const TabsContext = createContext<TabsContextValue | null>(null)

export function Tabs({ value, onValueChange, children, className }: {
  value: string
  onValueChange: (value: string) => void
  children: ReactNode
  className?: string
}) {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={cn(className)} data-value={value}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

export function TabsList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      role="tablist"
      aria-orientation="horizontal"
      className={cn('flex', className)}
    >
      {children}
    </div>
  )
}

export function TabsTrigger({ value, children, className, disabled }: {
  value: string
  children: ReactNode
  className?: string
  disabled?: boolean
}) {
  const context = useContext(TabsContext)
  if (!context) {
    throw new Error('TabsTrigger must be used within Tabs')
  }

  const isActive = context.value === value

  return (
    <button
      role="tab"
      aria-selected={isActive}
      aria-controls={`${value}-panel`}
      id={`${value}-trigger`}
      data-state={isActive ? 'active' : 'inactive'}
      data-disabled={disabled}
      onClick={() => !disabled && context.onValueChange(value)}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
        'transition-colors duration-150',
        'disabled:pointer-events-none disabled:opacity-50',
        isActive
          ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
          : 'text-text-muted hover:text-text hover:bg-neutral-100 dark:hover:bg-neutral-800',
        className
      )}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

export function TabsContent({ value, children, className }: {
  value: string
  children: ReactNode
  className?: string
}) {
  const context = useContext(TabsContext)
  if (!context) {
    throw new Error('TabsContent must be used within Tabs')
  }

  if (context.value !== value) {
    return null
  }

  return (
    <div
      role="tabpanel"
      id={`${value}-panel`}
      aria-labelledby={`${value}-trigger`}
      className={cn(
        'animate-in fade-in-0 duration-200',
        className
      )}
    >
      {children}
    </div>
  )
}