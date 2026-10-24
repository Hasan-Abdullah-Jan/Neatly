import { useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@lib/utils'
import { Button } from '@components/ui/Button'
import { useAuth } from '@contexts/AuthContext'
import { ChevronDown, Plus, Building2, Home, Briefcase, Hospital, Settings } from 'lucide-react'

interface SpaceSelectorProps {
  compact?: boolean
}

const spaceTypeIcons = {
  personal: Home,
  shared_home: Building2,
  workplace: Briefcase,
  institution: Settings,
  healthcare: Hospital,
  custom: Settings,
}

const spaceTypeLabels = {
  personal: 'Personal',
  shared_home: 'Shared Home',
  workplace: 'Workplace',
  institution: 'Institution',
  healthcare: 'Healthcare',
  custom: 'Custom',
}

export function SpaceSelector({ compact = false }: SpaceSelectorProps) {
  const { spaces, currentSpace, setCurrentSpace } = useAuth()
  const [isOpen, setIsOpen] = useState(false)

  if (spaces.length === 0) {
    return (
      <Button variant="outline" size={compact ? 'sm' : 'md'} className="w-full justify-between">
        <span className="truncate">No spaces</span>
        <ChevronDown className="w-4 h-4 flex-shrink-0" />
      </Button>
    )
  }

  const currentSpaceType = currentSpace?.type || 'personal'
  const CurrentSpaceIcon = spaceTypeIcons[currentSpaceType] || Home

  const handleSelectSpace = (spaceId: string) => {
    const space = spaces.find((s) => s.id === spaceId)
    if (space) {
      setCurrentSpace(space)
      setIsOpen(false)
    }
  }

  const dropdownContent = (
    <div className="absolute right-0 top-full mt-1 w-64 bg-surface border border-border rounded-lg shadow-surface-elevated py-1 z-50 animate-in fade-in-0 zoom-in-95 duration-150">
      {spaces.map((space) => {
        const SpaceIcon = spaceTypeIcons[space.type] || Home
        const isCurrent = currentSpace?.id === space.id
        return (
          <button
            key={space.id}
            onClick={() => handleSelectSpace(space.id)}
            className={cn(
              'w-full px-3 py-2.5 flex items-center gap-3 text-left',
              'hover:bg-neutral-100 dark:hover:bg-neutral-800',
              isCurrent && 'bg-primary-50 dark:bg-primary-900/30'
            )}
          >
            <span className={cn(
              'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0',
              isCurrent ? 'bg-primary-100 text-primary-700' : 'bg-neutral-100 text-text-muted dark:bg-neutral-800'
            )}>
              <SpaceIcon className="w-4 h-4" />
            </span>
            <div className="flex-1 min-w-0">
              <p className={cn('text-sm font-medium truncate', isCurrent ? 'text-text' : 'text-text')}>
                {space.name}
              </p>
              <p className="text-xs text-text-muted">{spaceTypeLabels[space.type]}</p>
            </div>
            {isCurrent && <span className="text-primary-600">✓</span>}
          </button>
        )
      })}
      <hr className="my-1 border-border" />
      <button
        onClick={() => {}}
        className="w-full px-3 py-2.5 flex items-center gap-3 text-left text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20"
      >
        <Plus className="w-5 h-5" />
        <span>Create new space</span>
      </button>
    </div>
  )

  if (compact) {
    return (
      <div className="relative">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-between gap-2"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-haspopup="true"
        >
          <div className="flex items-center gap-1.5">
            <CurrentSpaceIcon className="w-4 h-4" />
            <span className="truncate max-w-[120px]">{currentSpace?.name || 'Select space'}</span>
          </div>
          <ChevronDown className={cn('w-4 h-4 flex-shrink-0 transition-transform', isOpen && 'rotate-180')} />
        </Button>
        {isOpen && createPortal(dropdownContent, document.body)}
      </div>
    )
  }

  return (
    <div className="relative">
      <Button
        variant="outline"
        className="w-full justify-between gap-2"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <div className="flex items-center gap-2">
          <CurrentSpaceIcon className="w-5 h-5" />
          <span className="truncate max-w-[200px]">{currentSpace?.name || 'Select space'}</span>
        </div>
        <ChevronDown className={cn('w-4 h-4 flex-shrink-0 transition-transform', isOpen && 'rotate-180')} />
      </Button>
      {isOpen && createPortal(dropdownContent, document.body)}
    </div>
  )
}