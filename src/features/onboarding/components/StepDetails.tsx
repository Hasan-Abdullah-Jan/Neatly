import { Input } from '@components/ui/Input'
import { Select } from '@components/ui/Select'
import { Button } from '@components/ui/Button'
import { MapPin, Clock } from 'lucide-react'
import { detectTimezone, getTimezoneOptions, isValidTimezone } from '../data/timezones'
import type { OnboardingProfile } from '../hooks/useOnboarding'

interface StepDetailsProps {
  profile: OnboardingProfile
  updateProfile: (updates: Partial<OnboardingProfile>) => void
}

export function StepDetails({ profile, updateProfile }: StepDetailsProps) {
  const detected = detectTimezone()
  const timezoneOptions = getTimezoneOptions(profile.timezone)
  const timezoneValid = isValidTimezone(profile.timezone)

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Space name"
          placeholder="My home, Office, Clinic..."
          value={profile.name}
          onChange={(event) => updateProfile({ name: event.target.value })}
          autoFocus
          maxLength={80}
        />
        <Select
          label="Timezone"
          options={timezoneOptions}
          value={profile.timezone}
          onChange={(timezone) => updateProfile({ timezone })}
          error={!timezoneValid ? 'Choose a valid timezone' : undefined}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
        <Clock className="w-4 h-4" aria-hidden="true" />
        <span>Detected timezone: {detected}</span>
        {profile.timezone !== detected && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="underline"
            onClick={() => updateProfile({ timezone: detected })}
          >
            Use detected
          </Button>
        )}
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <MapPin className="w-4 h-4 text-text-muted" aria-hidden="true" />
          <h3 className="text-sm font-medium text-text">Location hierarchy (optional)</h3>
        </div>
        <p className="text-sm text-text-muted mb-4">
          Use these when one space spans a building, floor, or zone. They appear in reports and
          area labels.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Input
            label="Building"
            placeholder="e.g. Building A"
            value={profile.building}
            onChange={(event) => updateProfile({ building: event.target.value })}
            maxLength={60}
          />
          <Input
            label="Floor"
            placeholder="e.g. Floor 2"
            value={profile.floor}
            onChange={(event) => updateProfile({ floor: event.target.value })}
            maxLength={60}
          />
          <Input
            label="Zone"
            placeholder="e.g. East wing"
            value={profile.zone}
            onChange={(event) => updateProfile({ zone: event.target.value })}
            maxLength={60}
          />
        </div>
      </div>

      <div className="p-4 bg-info-50 dark:bg-info-900/20 border border-info-200 dark:border-info-800 rounded-lg">
        <p className="text-sm text-info-800 dark:text-info-200">
          <strong>How due dates work:</strong> tasks use this space&apos;s timezone. If you manage
          several locations, each space keeps its own local time.
        </p>
      </div>
    </div>
  )
}
