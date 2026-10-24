import { describe, expect, it } from 'vitest'
import type { Task, TaskDependency, TaskInstance } from '@/types/database'
import {
  canCompleteInstance,
  countCompletedToday,
  dependencyBlockers,
  describeDue,
  isOverdueInstance,
  selectTodayFocus,
  selectTodayRemaining,
  selectUpcoming,
  type TaskInstanceView,
} from './taskViews'

const NOW = new Date('2026-10-24T12:00:00.000Z')

function makeTask(id: string, name: string): Task {
  return {
    id,
    space_id: 'space-1',
    template_id: null,
    area_id: 'area-1',
    name,
    description: null,
    estimated_minutes: 10,
    frequency: 'daily',
    custom_frequency_days: null,
    due_time: '09:00',
    schedule_anchor_at: '2026-10-01T09:00:00.000Z',
    assignee_id: null,
    assignee_role: null,
    required_skills: [],
    supplies_needed: [],
    instructions: null,
    is_active: true,
    is_one_off: false,
    created_by: 'user-1',
    created_at: '2026-10-01T09:00:00.000Z',
    updated_at: '2026-10-01T09:00:00.000Z',
    deleted_at: null,
  }
}

function makeInstance(
  id: string,
  taskId: string,
  dueAt: string,
  status: TaskInstance['status'] = 'pending',
  completedAt: string | null = null
): TaskInstance {
  return {
    id,
    task_id: taskId,
    space_id: 'space-1',
    assignee_id: null,
    due_at: dueAt,
    timezone: 'UTC',
    status,
    started_at: null,
    completed_at: completedAt,
    skipped_at: null,
    skip_reason: null,
    created_at: '2026-10-01T09:00:00.000Z',
    updated_at: '2026-10-01T09:00:00.000Z',
    deleted_at: null,
  }
}

function view(taskId: string, taskName: string, instance: TaskInstance): TaskInstanceView {
  return {
    instance,
    task: makeTask(taskId, taskName),
    areaName: 'Kitchen',
    assigneeName: null,
  }
}

const overdue = view('task-1', 'Wipe counters', makeInstance('i-1', 'task-1', '2026-10-22T09:00:00.000Z'))
const today = view('task-1', 'Wipe counters', makeInstance('i-2', 'task-1', '2026-10-24T09:00:00.000Z'))
const upcoming = view('task-1', 'Wipe counters', makeInstance('i-3', 'task-1', '2026-10-26T09:00:00.000Z'))
const completedToday = view(
  'task-1',
  'Wipe counters',
  makeInstance('i-4', 'task-1', '2026-10-24T08:00:00.000Z', 'completed', '2026-10-24T10:00:00.000Z')
)
const skippedToday = view(
  'task-1',
  'Wipe counters',
  makeInstance('i-5', 'task-1', '2026-10-24T07:00:00.000Z', 'skipped')
)
const all = [overdue, today, upcoming, completedToday, skippedToday]

describe('today selection', () => {
  it('puts overdue and due-today work in the focus list, oldest first', () => {
    expect(selectTodayFocus(all, NOW, 'UTC').map((item) => item.instance.id)).toEqual([
      'i-1',
      'i-2',
    ])
  })

  it('never promotes future work into the focus list', () => {
    expect(selectTodayFocus([upcoming], NOW, 'UTC')).toEqual([])
  })

  it('respects the maximum of three prominent tasks', () => {
    const many = [
      view('task-1', 'A', makeInstance('a', 'task-1', '2026-10-24T06:00:00.000Z')),
      view('task-1', 'B', makeInstance('b', 'task-1', '2026-10-24T07:00:00.000Z')),
      view('task-1', 'C', makeInstance('c', 'task-1', '2026-10-24T08:00:00.000Z')),
      view('task-1', 'D', makeInstance('d', 'task-1', '2026-10-24T09:00:00.000Z')),
    ]
    expect(selectTodayFocus(many, NOW, 'UTC')).toHaveLength(3)
  })

  it('keeps the remaining due work out of the focus cards', () => {
    const focus = selectTodayFocus(all, NOW, 'UTC')
    expect(selectTodayRemaining(all, NOW, 'UTC', focus)).toEqual([])
  })

  it('lists only future open work in the upcoming list', () => {
    expect(selectUpcoming(all, NOW, 'UTC', 7).map((item) => item.instance.id)).toEqual(['i-3'])
  })

  it('counts completions recorded on the local day', () => {
    expect(countCompletedToday(all, NOW, 'UTC')).toBe(1)
  })

  it('treats pending work before now as overdue and completed work as not overdue', () => {
    expect(isOverdueInstance(overdue.instance, NOW)).toBe(true)
    expect(isOverdueInstance(completedToday.instance, NOW)).toBe(false)
  })
})

describe('dependency blockers', () => {
  const dependency: TaskDependency = {
    id: 'dep-1',
    space_id: 'space-1',
    task_id: 'task-2',
    depends_on_task_id: 'task-1',
    created_by: 'user-1',
    created_at: '2026-10-01T09:00:00.000Z',
    updated_at: '2026-10-01T09:00:00.000Z',
    deleted_at: null,
  }

  const dependent = view(
    'task-2',
    'Mop floor',
    makeInstance('dependent', 'task-2', '2026-10-24T10:00:00.000Z')
  )

  it('blocks while the latest dependency occurrence is open', () => {
    const dependencyInstance = view(
      'task-1',
      'Wipe counters',
      makeInstance('dep-latest', 'task-1', '2026-10-24T09:00:00.000Z')
    )
    const blockers = dependencyBlockers(dependent, [dependent, dependencyInstance], [dependency])
    expect(blockers).toHaveLength(1)
    expect(blockers[0]?.taskName).toBe('Wipe counters')
  })

  it('does not stack older missed occurrences after the latest one is complete', () => {
    const oldPending = view(
      'task-1',
      'Wipe counters',
      makeInstance('dep-old', 'task-1', '2026-10-22T09:00:00.000Z')
    )
    const latestComplete = view(
      'task-1',
      'Wipe counters',
      makeInstance('dep-new', 'task-1', '2026-10-23T09:00:00.000Z', 'completed', '2026-10-23T10:00:00.000Z')
    )
    expect(dependencyBlockers(dependent, [dependent, oldPending, latestComplete], [dependency])).toEqual(
      []
    )
  })

  it('treats a skipped latest occurrence as satisfied', () => {
    const skipped = view(
      'task-1',
      'Wipe counters',
      makeInstance('dep-skip', 'task-1', '2026-10-24T09:00:00.000Z', 'skipped')
    )
    expect(dependencyBlockers(dependent, [dependent, skipped], [dependency])).toEqual([])
  })
})

describe('describeDue', () => {
  it('describes overdue, today, tomorrow, and later work', () => {
    expect(describeDue(overdue, NOW, 'UTC')).toBe('Overdue by 2 days')
    expect(describeDue(today, NOW, 'UTC')).toBe('Due today at 9:00 AM')
    expect(
      describeDue(
        view('task-1', 'Task', makeInstance('tomorrow', 'task-1', '2026-10-25T09:00:00.000Z')),
        NOW,
        'UTC'
      )
    ).toBe('Tomorrow at 9:00 AM')
    expect(describeDue(upcoming, NOW, 'UTC')).toBe('Mon, Oct 26 at 9:00 AM')
    expect(describeDue(completedToday, NOW, 'UTC')).toBe('Completed')
    expect(describeDue(skippedToday, NOW, 'UTC')).toBe('Skipped')
  })
})

describe('canCompleteInstance', () => {
  it('allows managers, the assignee, and anyone for unassigned work', () => {
    expect(canCompleteInstance('supervisor', 'user-1', { assignee_id: 'user-2' })).toBe(true)
    expect(canCompleteInstance('member', 'user-1', { assignee_id: 'user-1' })).toBe(true)
    expect(canCompleteInstance('member', 'user-1', { assignee_id: null })).toBe(true)
    expect(canCompleteInstance('member', 'user-1', { assignee_id: 'user-2' })).toBe(false)
    expect(canCompleteInstance(null, null, { assignee_id: null })).toBe(false)
  })
})
