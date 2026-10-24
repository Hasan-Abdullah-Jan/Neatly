import { useState } from 'react'
import { cn } from '@lib/utils'
import { Button } from '@components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '@components/ui/Card'
import { Badge } from '@components/ui/Badge'
import { AlertTriangle, CheckCircle, Clock, AlertCircle, Grid, Settings, ChevronRight, Pencil } from 'lucide-react'
import type { OnboardingActions, OnboardingArea } from '../hooks/useOnboarding'
import { areaWeeklyMinutes, formatMinutes, planWeeklyMinutes } from '../lib/plan'

interface StepReviewProps {
  onboarding: OnboardingActions
}

const moduleLabels: Record<string, string> = {
  tasks: 'Tasks',
  areas: 'Areas',
  supplies: 'Supplies',
  issues: 'Issues',
  plants: 'Plants',
  inventory: 'Inventory',
  maintenance: 'Maintenance',
  decluttering: 'Decluttering',
  reports: 'Reports',
  teams: 'Teams',
  rotation: 'Fair rotation',
}

export function StepReview({ onboarding }: StepReviewProps) {
  const { state, activeAreas } = onboarding
  const [expandedArea, setExpandedArea] = useState<string | null>(null)

  const selectedTotal = activeAreas.reduce((sum, area) => sum + area.selectedTasks.length, 0)
  const weeklyTotal = planWeeklyMinutes(activeAreas)
  const enabledModules = Object.entries(state.modules).filter(([, enabled]) => enabled)
  const warnings: Array<{ type: 'warning' | 'error'; message: string }> = []

  if (selectedTotal === 0) {
    warnings.push({
      type: 'warning',
      message: 'No tasks are turned on. The space will be created with areas but no routine.',
    })
  }
  if (weeklyTotal > 600) {
    warnings.push({
      type: 'warning',
      message: `The plan is about ${formatMinutes(weeklyTotal)} per week. Consider turning off a few tasks or lowering their frequency.`,
    })
  }
  if (!state.profile.name.trim()) {
    warnings.push({ type: 'error', message: 'Add a space name before activating.' })
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Areas" value={activeAreas.length} icon={<Grid className="w-5 h-5" />} color="primary" />
        <StatCard label="Tasks" value={selectedTotal} icon={<CheckCircle className="w-5 h-5" />} color="success" />
        <StatCard label="Per week" value={formatMinutes(weeklyTotal)} icon={<Clock className="w-5 h-5" />} color="info" />
        <StatCard label="Modules" value={enabledModules.length} icon={<Settings className="w-5 h-5" />} color="amber" />
      </div>

      {warnings.length > 0 && (
        <Card variant="outlined" className="border-amber-200 dark:border-amber-800">
          <CardContent className="p-4 space-y-2">
            {warnings.map((warning, index) => (
              <div
                key={`${warning.type}-${index}`}
                className={cn(
                  'flex items-start gap-2 rounded-lg border p-3',
                  warning.type === 'error'
                    ? 'border-destructive-200 bg-destructive-50 dark:border-destructive-800 dark:bg-destructive-900/20'
                    : 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20'
                )}
              >
                {warning.type === 'error' ? (
                  <AlertCircle className="w-5 h-5 text-destructive-600 flex-shrink-0" aria-hidden="true" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" aria-hidden="true" />
                )}
                <p className="text-sm text-text">{warning.message}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card variant="outlined">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Space details</CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onboarding.goToStep(2)}
              leftIcon={<Pencil className="w-4 h-4" />}
            >
              Edit details
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <DetailRow label="Name" value={state.profile.name || 'Not set'} />
          <DetailRow label="Profile" value={state.templatePack?.label ?? state.profile.spaceType ?? 'Not set'} />
          <DetailRow label="Timezone" value={state.profile.timezone} />
          {state.profile.building && <DetailRow label="Building" value={state.profile.building} />}
          {state.profile.floor && <DetailRow label="Floor" value={state.profile.floor} />}
          {state.profile.zone && <DetailRow label="Zone" value={state.profile.zone} />}
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CardTitle>Areas & tasks</CardTitle>
              <Badge variant="outline">
                {activeAreas.length} areas · {selectedTotal} tasks
              </Badge>
            </div>
            <div className="flex gap-1">
              <Button type="button" variant="ghost" size="sm" onClick={() => onboarding.goToStep(3)}>
                Edit areas
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => onboarding.goToStep(4)}>
                Edit plan
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {activeAreas.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-8 text-center">
              <p className="font-medium text-text">No areas in this plan</p>
              <p className="text-sm text-text-muted mt-1">Add areas before activating the space.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeAreas.map((area) => (
                <AreaReviewCard
                  key={area.id}
                  area={area}
                  isExpanded={expandedArea === area.id}
                  onToggle={() =>
                    setExpandedArea(expandedArea === area.id ? null : area.id)
                  }
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card variant="outlined">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Invitations</CardTitle>
              <Button type="button" variant="ghost" size="sm" onClick={() => onboarding.goToStep(6)}>
                Edit
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {state.invitations.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border py-6 text-center">
                <p className="text-sm font-medium text-text">No one invited yet</p>
                <p className="text-xs text-text-muted mt-1">Optional. You can invite people later.</p>
              </div>
            ) : (
              <ul className="space-y-2" role="list">
                {state.invitations.map((invitation) => (
                  <li
                    key={invitation.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-surface p-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-text truncate">{invitation.email}</p>
                      <p className="text-xs text-text-muted capitalize">{invitation.role}</p>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {invitation.role}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Modules</CardTitle>
              <Button type="button" variant="ghost" size="sm" onClick={() => onboarding.goToStep(7)}>
                Edit
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {enabledModules.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border py-6 text-center">
                <p className="text-sm font-medium text-text">Core tasks only</p>
                <p className="text-xs text-text-muted mt-1">Optional modules are off.</p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {enabledModules.map(([key]) => (
                  <Badge key={key} variant="success">
                    {moduleLabels[key] ?? key}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="rounded-lg border border-primary-200 bg-primary-50 dark:border-primary-800 dark:bg-primary-900/20 p-4">
        <p className="text-sm text-primary-800 dark:text-primary-200">
          <strong>Nothing is scheduled until you confirm.</strong> On the next screen, activating
          creates the space, areas, task templates, and the first 30 days of recurring work. You can
          change any of it later in Space Settings and Tasks &amp; schedules.
        </p>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string
  value: string | number
  icon: React.ReactNode
  color: 'primary' | 'success' | 'amber' | 'info'
}) {
  const colorClasses = {
    primary: 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400',
    success: 'bg-success-100 dark:bg-success-900/30 text-success-600 dark:text-success-400',
    amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
    info: 'bg-info-100 dark:bg-info-900/30 text-info-600 dark:text-info-400',
  }

  return (
    <Card padding="md">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm text-text-muted">{label}</p>
          <p className="text-2xl font-bold text-text mt-1 truncate">{value}</p>
        </div>
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', colorClasses[color])}>
          {icon}
        </div>
      </div>
    </Card>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/50 py-2 last:border-0">
      <span className="text-sm text-text-muted">{label}</span>
      <span className="text-sm font-medium text-text text-right break-words">{value}</span>
    </div>
  )
}

function AreaReviewCard({
  area,
  isExpanded,
  onToggle,
}: {
  area: OnboardingArea
  isExpanded: boolean
  onToggle: () => void
}) {
  const selected = new Set(area.selectedTasks)
  const tasks = area.suggestedTasks.filter((task) => selected.has(task.id))

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
        aria-expanded={isExpanded}
      >
        <div className="min-w-0">
          <p className="font-medium text-text">{area.name}</p>
          <p className="text-sm text-text-muted">
            {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'} · about{' '}
            {formatMinutes(areaWeeklyMinutes(area))}/week
          </p>
        </div>
        <ChevronRight
          className={cn('w-5 h-5 flex-shrink-0 text-text-muted transition-transform', isExpanded && 'rotate-90')}
          aria-hidden="true"
        />
      </button>

      {isExpanded && (
        <div className="border-t border-border bg-neutral-50 p-4 dark:bg-neutral-900/50">
          {tasks.length === 0 ? (
            <p className="py-3 text-center text-sm text-text-muted">No tasks selected for this area</p>
          ) : (
            <ul className="space-y-2" role="list">
              {tasks.map((task) => (
                <li
                  key={task.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-border bg-surface p-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle className="w-4 h-4 flex-shrink-0 text-success-600" aria-hidden="true" />
                    <span className="text-sm font-medium text-text">{task.name}</span>
                  </div>
                  <span className="text-xs text-text-muted">
                    {task.frequency === 'custom'
                      ? `every ${task.customFrequencyDays ?? 7} days`
                      : task.frequency}{' '}
                    · {task.estimatedMinutes} min
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
