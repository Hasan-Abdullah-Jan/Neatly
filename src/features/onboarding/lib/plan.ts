import type { OnboardingArea, OnboardingTask } from '../hooks/useOnboarding'

const WEEKS_PER_YEAR = 52

const frequencyWeeks: Record<OnboardingTask['frequency'], number> = {
  daily: 7,
  weekly: 1,
  biweekly: 0.5,
  monthly: 12 / WEEKS_PER_YEAR,
  quarterly: 4 / WEEKS_PER_YEAR,
  yearly: 1 / WEEKS_PER_YEAR,
  custom: 1,
}

/** Estimated minutes per week for one recurring task. */
export function taskWeeklyMinutes(task: OnboardingTask): number {
  if (task.frequency === 'custom') {
    const days = task.customFrequencyDays && task.customFrequencyDays > 0 ? task.customFrequencyDays : 7
    return (task.estimatedMinutes * 7) / days
  }
  return task.estimatedMinutes * frequencyWeeks[task.frequency]
}

export function areaWeeklyMinutes(area: OnboardingArea): number {
  return area.suggestedTasks
    .filter((task) => area.selectedTasks.includes(task.id))
    .reduce((sum, task) => sum + taskWeeklyMinutes(task), 0)
}

export function planWeeklyMinutes(areas: OnboardingArea[]): number {
  return areas
    .filter((area) => !area.archived)
    .reduce((sum, area) => sum + areaWeeklyMinutes(area), 0)
}

export function selectedTaskCount(areas: OnboardingArea[]): number {
  return areas
    .filter((area) => !area.archived)
    .reduce((sum, area) => sum + area.selectedTasks.length, 0)
}

export function formatMinutes(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes))
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest} min`
  if (rest === 0) return `${hours} hr`
  return `${hours} hr ${rest} min`
}
