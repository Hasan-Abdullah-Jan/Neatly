import { useState } from 'react'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { Select } from '@components/ui/Select'
import { Card, CardHeader, CardTitle, CardContent } from '@components/ui/Card'
import { Checkbox } from '@components/ui/Checkbox'
import { Plus, Trash2, Clock } from 'lucide-react'
import type { OnboardingActions, OnboardingArea, OnboardingTask } from '../hooks/useOnboarding'
import { areaWeeklyMinutes, formatMinutes, planWeeklyMinutes } from '../lib/plan'

interface StepPlanProps {
  onboarding: OnboardingActions
}

const frequencyOptions: Array<{ value: OnboardingTask['frequency']; label: string }> = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'custom', label: 'Custom interval' },
]

const categoryEmoji: Record<string, string> = {
  kitchen: '🍳',
  bathroom: '🚿',
  bedroom: '🛏️',
  living: '🛋️',
  dining: '🍽️',
  office: '💻',
  laundry: '🧺',
  entry: '🚪',
  hallway: '🚶',
  storage: '📦',
  garden: '🌿',
  reception: '🏢',
  meeting: '🤝',
  waiting: '🏥',
  exam: '🩺',
  classroom: '🏫',
  common: '📍',
  custom: '✨',
}

export function StepPlan({ onboarding }: StepPlanProps) {
  const { activeAreas } = onboarding
  const [addingFor, setAddingFor] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newFrequency, setNewFrequency] = useState<OnboardingTask['frequency']>('weekly')
  const [newMinutes, setNewMinutes] = useState(15)

  const selectedTotal = activeAreas.reduce(
    (sum, area) => sum + area.selectedTasks.length,
    0
  )
  const weeklyTotal = planWeeklyMinutes(activeAreas)

  const startAdding = (areaId: string) => {
    setAddingFor(areaId)
    setNewName('')
    setNewFrequency('weekly')
    setNewMinutes(15)
  }

  const submitTask = (area: OnboardingArea) => {
    if (!newName.trim()) return
    onboarding.addTask(area.id, {
      name: newName.trim(),
      frequency: newFrequency,
      estimatedMinutes: newMinutes > 0 ? newMinutes : 15,
    })
    setAddingFor(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-heading-sm font-medium text-text">Starter plan</h3>
          <p className="text-sm text-text-muted mt-1">
            Turn tasks on or off and adjust the timing. Nothing is scheduled yet.
          </p>
        </div>
        <p className="text-sm text-text-muted flex items-center gap-2">
          <Clock className="w-4 h-4" aria-hidden="true" />
          <span>
            {selectedTotal} tasks · about {formatMinutes(weeklyTotal)} per week
          </span>
        </p>
      </div>

      {activeAreas.length === 0 ? (
        <Card variant="outlined" className="border-dashed">
          <CardContent className="py-10 text-center">
            <p className="font-medium text-text">No areas to plan yet</p>
            <p className="text-sm text-text-muted mt-1">Go back to Areas and add at least one.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {activeAreas.map((area) => {
            const selected = new Set(area.selectedTasks)
            const areaMinutes = areaWeeklyMinutes(area)
            return (
              <Card key={area.id} variant="outlined">
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl" aria-hidden="true">
                        {categoryEmoji[area.category] ?? '📍'}
                      </span>
                      <CardTitle className="text-heading-sm">{area.name}</CardTitle>
                      <span className="text-sm text-text-muted">
                        {selected.size} of {area.suggestedTasks.length}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-text-muted">{formatMinutes(areaMinutes)}/week</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => startAdding(area.id)}
                        leftIcon={<Plus className="w-4 h-4" />}
                      >
                        Add task
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {addingFor === area.id && (
                    <div className="mb-4 space-y-3 rounded-lg border border-border bg-neutral-50 dark:bg-neutral-900/40 p-4">
                      <div className="grid gap-3 sm:grid-cols-[1fr_10rem_8rem]">
                        <Input
                          label="Task name"
                          placeholder="e.g. Wipe coffee machine"
                          value={newName}
                          onChange={(event) => setNewName(event.target.value)}
                          autoFocus
                        />
                        <Select
                          label="How often"
                          options={frequencyOptions}
                          value={newFrequency}
                          onChange={(value) => setNewFrequency(value as OnboardingTask['frequency'])}
                        />
                        <Input
                          label="Minutes"
                          type="number"
                          min={1}
                          max={1440}
                          value={newMinutes}
                          onChange={(event) => setNewMinutes(Number(event.target.value))}
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="ghost" size="sm" onClick={() => setAddingFor(null)}>
                          Cancel
                        </Button>
                        <Button type="button" size="sm" onClick={() => submitTask(area)} disabled={!newName.trim()}>
                          Add task
                        </Button>
                      </div>
                    </div>
                  )}

                  {area.suggestedTasks.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
                      <p className="text-sm font-medium text-text">No tasks in this area yet</p>
                      <p className="text-sm text-text-muted mt-1">
                        Add a task above, or leave it empty for now.
                      </p>
                    </div>
                  ) : (
                    <ul className="space-y-2" role="list">
                      {area.suggestedTasks.map((task) => {
                        const isSelected = selected.has(task.id)
                        return (
                          <li
                            key={task.id}
                            className="rounded-lg border border-border bg-surface p-3"
                          >
                            <div className="flex flex-wrap items-start gap-3">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => onboarding.toggleTask(area.id, task.id)}
                                aria-label={`Include ${task.name}`}
                                className="mt-1"
                              />
                              <div className="flex-1 min-w-[160px]">
                                <p className={isSelected ? 'font-medium text-text' : 'font-medium text-text-muted'}>
                                  {task.name}
                                </p>
                                {task.instructions && (
                                  <p className="text-xs text-text-muted mt-0.5">{task.instructions}</p>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <Select
                                  aria-label={`Frequency for ${task.name}`}
                                  options={frequencyOptions}
                                  value={task.frequency}
                                  onChange={(value) =>
                                    onboarding.updateTask(area.id, task.id, {
                                      frequency: value as OnboardingTask['frequency'],
                                    })
                                  }
                                  className="w-auto min-w-[8.5rem] py-1.5 text-sm"
                                  fullWidth={false}
                                />
                                {task.frequency === 'custom' && (
                                  <Input
                                    aria-label={`Custom interval in days for ${task.name}`}
                                    type="number"
                                    min={1}
                                    max={365}
                                    value={task.customFrequencyDays ?? 7}
                                    onChange={(event) =>
                                      onboarding.updateTask(area.id, task.id, {
                                        customFrequencyDays: Math.max(1, Number(event.target.value)),
                                      })
                                    }
                                    className="w-20"
                                    fullWidth={false}
                                  />
                                )}
                                <div className="flex items-center gap-1">
                                  <Input
                                    aria-label={`Estimated minutes for ${task.name}`}
                                    type="number"
                                    min={1}
                                    max={1440}
                                    value={task.estimatedMinutes}
                                    onChange={(event) =>
                                      onboarding.updateTask(area.id, task.id, {
                                        estimatedMinutes: Math.max(1, Number(event.target.value)),
                                      })
                                    }
                                    className="w-20"
                                    fullWidth={false}
                                  />
                                  <span className="text-xs text-text-muted">min</span>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => onboarding.removeTask(area.id, task.id)}
                                  className="text-destructive-600"
                                  aria-label={`Remove ${task.name}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <div className="rounded-lg border border-border bg-neutral-50 dark:bg-neutral-900/40 p-4">
        <p className="text-sm text-text-muted">
          <strong>Weekly estimate:</strong> daily tasks count seven times, weekly once, and monthly
          tasks are averaged across the year. This is a guide, not a target.
        </p>
      </div>
    </div>
  )
}
