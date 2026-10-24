import { cn } from '@lib/utils'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@components/ui/Card'
import { Badge } from '@components/ui/Badge'
import { Checkbox } from '@components/ui/Checkbox'
import {
  Package,
  Leaf,
  Wrench,
  Recycle,
  BarChart,
  Users,
  RotateCcw,
  AlertTriangle,
  Sparkles,
  LayoutGrid,
} from 'lucide-react'
import type { SpaceModules } from '@/types/database'
import type { OnboardingActions } from '../hooks/useOnboarding'

interface StepModulesProps {
  onboarding: OnboardingActions
}

interface ModuleDefinition {
  key: keyof SpaceModules
  label: string
  description: string
  icon: React.ReactNode
  required?: boolean
}

const moduleDefinitions: ModuleDefinition[] = [
  {
    key: 'tasks',
    label: 'Tasks',
    description: 'Core task scheduling and completion',
    icon: <Sparkles className="w-5 h-5" />,
    required: true,
  },
  {
    key: 'areas',
    label: 'Areas',
    description: 'Rooms and zones, with QR codes later',
    icon: <LayoutGrid className="w-5 h-5" />,
    required: true,
  },
  {
    key: 'supplies',
    label: 'Supplies',
    description: 'Track stock and restock requests',
    icon: <Package className="w-5 h-5" />,
  },
  {
    key: 'issues',
    label: 'Issues',
    description: 'Report problems and follow them to resolution',
    icon: <AlertTriangle className="w-5 h-5" />,
  },
  {
    key: 'plants',
    label: 'Plants',
    description: 'Watering schedules and plant care notes',
    icon: <Leaf className="w-5 h-5" />,
  },
  {
    key: 'inventory',
    label: 'Inventory',
    description: 'Track equipment and assets',
    icon: <Package className="w-5 h-5" />,
  },
  {
    key: 'maintenance',
    label: 'Maintenance',
    description: 'Equipment maintenance schedules',
    icon: <Wrench className="w-5 h-5" />,
  },
  {
    key: 'decluttering',
    label: 'Decluttering',
    description: 'Decluttering projects and donations',
    icon: <Recycle className="w-5 h-5" />,
  },
  {
    key: 'reports',
    label: 'Reports',
    description: 'Operational summaries and trends',
    icon: <BarChart className="w-5 h-5" />,
  },
  {
    key: 'teams',
    label: 'Teams',
    description: 'Group people and share responsibilities',
    icon: <Users className="w-5 h-5" />,
  },
  {
    key: 'rotation',
    label: 'Fair rotation',
    description: 'Take turns on recurring tasks',
    icon: <RotateCcw className="w-5 h-5" />,
  },
]

export function StepModules({ onboarding }: StepModulesProps) {
  const { state } = onboarding
  const coreModules = moduleDefinitions.filter((module) => module.required)
  const optionalModules = moduleDefinitions.filter((module) => !module.required)
  const enabledOptional = optionalModules.filter((module) => state.modules[module.key])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-heading-sm font-medium text-text">Optional modules</h3>
          <p className="text-sm text-text-muted mt-1">
            Suggested defaults come from your profile. Everything can change later.
          </p>
        </div>
        <Badge variant="outline">{enabledOptional.length} optional on</Badge>
      </div>

      <Card variant="outlined" className="border-primary-200 dark:border-primary-800">
        <CardHeader>
          <CardTitle>Core modules</CardTitle>
          <CardDescription>These keep the space running and cannot be turned off.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {coreModules.map((module) => (
              <ModuleCard
                key={module.key}
                module={module}
                enabled
                disabled
                onChange={() => undefined}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardHeader>
          <CardTitle>Add what fits</CardTitle>
          <CardDescription>
            Optional features never change how core tasks work. Off is a perfectly good choice.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {optionalModules.map((module) => (
              <ModuleCard
                key={module.key}
                module={module}
                enabled={Boolean(state.modules[module.key])}
                onChange={() => onboarding.toggleModule(module.key)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="rounded-lg border border-border bg-neutral-50 p-4 dark:bg-neutral-900/40">
        <p className="text-sm text-text-muted">
          <strong>A note on healthcare:</strong> suggested procedures are starting points only.
          Your organization must approve clinical and cleaning procedures before use.
        </p>
      </div>
    </div>
  )
}

function ModuleCard({
  module,
  enabled,
  onChange,
  disabled = false,
}: {
  module: ModuleDefinition
  enabled: boolean
  onChange: () => void
  disabled?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-lg border p-4 transition-colors',
        enabled
          ? 'border-primary-300 bg-primary-50 dark:border-primary-700 dark:bg-primary-900/20'
          : 'border-border bg-surface',
        disabled && 'opacity-90'
      )}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          checked={enabled}
          onCheckedChange={onChange}
          disabled={disabled}
          aria-label={`${module.label} module`}
          className="mt-1"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-primary-600 dark:text-primary-400" aria-hidden="true">
              {module.icon}
            </span>
            <span className="font-medium text-text">{module.label}</span>
            {disabled && <Badge variant="primary" size="sm">Core</Badge>}
          </div>
          <p className="mt-1 text-sm text-text-muted">{module.description}</p>
        </div>
      </div>
    </div>
  )
}
