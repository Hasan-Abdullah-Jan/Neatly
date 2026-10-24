import { cn } from '@lib/utils'
import { Card, CardContent } from '@components/ui/Card'
import { Check } from 'lucide-react'
import type { SpaceType } from '@/types/database'
import { getAllSpaceTypes } from '../data/templatePacks'
import type { OnboardingProfile } from '../hooks/useOnboarding'

interface StepProfileProps {
  profile: OnboardingProfile
  onSelect: (spaceType: SpaceType) => void
}

export function StepProfile({ profile, onSelect }: StepProfileProps) {
  const spaceTypes = getAllSpaceTypes()

  return (
    <div className="space-y-6">
      <p className="text-text-muted">
        Pick the closest fit. We&apos;ll suggest areas, tasks, and modules for that kind of
        space. You can change everything later.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-label="Space profile">
        {spaceTypes.map((type) => {
          const selected = profile.spaceType === type.type
          return (
            <button
              key={type.type}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onSelect(type.type)}
              className={cn(
                'text-left rounded-xl border p-5 transition-all',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
                selected
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 shadow-sm'
                  : 'border-border bg-surface hover:border-primary-300 dark:hover:border-primary-700'
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="text-4xl" aria-hidden="true">
                  {type.icon}
                </span>
                {selected && (
                  <span className="w-6 h-6 rounded-full bg-primary-600 text-white flex items-center justify-center">
                    <Check className="w-4 h-4" aria-hidden="true" />
                  </span>
                )}
              </div>
              <h3 className="text-heading-sm font-semibold text-text mt-3">{type.label}</h3>
              <p className="text-sm text-text-muted mt-1">{type.description}</p>
            </button>
          )
        })}
      </div>

      {profile.spaceType && (
        <Card variant="outlined" className="border-primary-200 dark:border-primary-800">
          <CardContent className="p-4">
            <p className="text-sm text-primary-800 dark:text-primary-200">
              <strong>Starter plan loaded.</strong> The next steps will suggest areas and tasks.
              Nothing is scheduled until you review and activate.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
