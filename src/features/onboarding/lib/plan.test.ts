import { describe, expect, it } from 'vitest'
import type { OnboardingArea, OnboardingTask } from '../hooks/useOnboarding'
import {
  areaWeeklyMinutes,
  formatMinutes,
  planWeeklyMinutes,
  selectedTaskCount,
  taskWeeklyMinutes,
} from './plan'

function makeTask(overrides: Partial<OnboardingTask> = {}): OnboardingTask {
  return {
    id: 'task-1',
    name: 'Test task',
    frequency: 'weekly',
    estimatedMinutes: 10,
    ...overrides,
  }
}

function makeArea(overrides: Partial<OnboardingArea> = {}): OnboardingArea {
  const tasks = overrides.suggestedTasks ?? [makeTask()]
  return {
    id: 'area-1',
    name: 'Test area',
    category: 'custom',
    description: '',
    parentId: null,
    sortOrder: 1,
    isCustom: false,
    archived: false,
    suggestedTasks: tasks,
    selectedTasks: tasks.map((task) => task.id),
    ...overrides,
  }
}

describe('taskWeeklyMinutes', () => {
  it('counts daily tasks seven times per week', () => {
    expect(taskWeeklyMinutes(makeTask({ frequency: 'daily', estimatedMinutes: 10 }))).toBe(70)
  })

  it('counts weekly tasks once', () => {
    expect(taskWeeklyMinutes(makeTask({ frequency: 'weekly', estimatedMinutes: 15 }))).toBe(15)
  })

  it('averages biweekly tasks', () => {
    expect(taskWeeklyMinutes(makeTask({ frequency: 'biweekly', estimatedMinutes: 10 }))).toBe(5)
  })

  it('averages monthly tasks across the year', () => {
    expect(taskWeeklyMinutes(makeTask({ frequency: 'monthly', estimatedMinutes: 30 }))).toBeCloseTo(
      6.923,
      3
    )
  })

  it('uses custom frequency days', () => {
    expect(
      taskWeeklyMinutes(
        makeTask({ frequency: 'custom', customFrequencyDays: 3, estimatedMinutes: 10 })
      )
    ).toBeCloseTo(23.333, 3)
  })

  it('falls back to weekly when custom days are missing', () => {
    expect(taskWeeklyMinutes(makeTask({ frequency: 'custom', estimatedMinutes: 10 }))).toBe(10)
  })
})

describe('areaWeeklyMinutes', () => {
  it('only counts selected tasks', () => {
    const selected = makeTask({ id: 'a', frequency: 'weekly', estimatedMinutes: 10 })
    const unselected = makeTask({ id: 'b', frequency: 'daily', estimatedMinutes: 30 })
    const area = makeArea({
      suggestedTasks: [selected, unselected],
      selectedTasks: [selected.id],
    })

    expect(areaWeeklyMinutes(area)).toBe(10)
  })

  it('returns zero when nothing is selected', () => {
    const area = makeArea({ selectedTasks: [] })
    expect(areaWeeklyMinutes(area)).toBe(0)
  })
})

describe('planWeeklyMinutes', () => {
  it('sums active areas and ignores archived ones', () => {
    const first = makeArea({
      id: 'first',
      suggestedTasks: [makeTask({ id: 'a', frequency: 'weekly', estimatedMinutes: 10 })],
    })
    const second = makeArea({
      id: 'second',
      suggestedTasks: [makeTask({ id: 'b', frequency: 'daily', estimatedMinutes: 5 })],
    })
    const archived = makeArea({
      id: 'archived',
      archived: true,
      suggestedTasks: [makeTask({ id: 'c', frequency: 'daily', estimatedMinutes: 60 })],
    })

    expect(planWeeklyMinutes([first, second, archived])).toBe(45)
  })
})

describe('selectedTaskCount', () => {
  it('counts selected tasks in active areas only', () => {
    const active = makeArea({ selectedTasks: ['a', 'b'] })
    const archived = makeArea({ id: 'archived', archived: true, selectedTasks: ['c'] })

    expect(selectedTaskCount([active, archived])).toBe(2)
  })
})

describe('formatMinutes', () => {
  it('formats minutes, whole hours, and mixed values', () => {
    expect(formatMinutes(0)).toBe('0 min')
    expect(formatMinutes(45)).toBe('45 min')
    expect(formatMinutes(60)).toBe('1 hr')
    expect(formatMinutes(90)).toBe('1 hr 30 min')
  })

  it('never shows negative time', () => {
    expect(formatMinutes(-10)).toBe('0 min')
  })
})
