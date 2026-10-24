import { describe, expect, it } from 'vitest'
import type { TaskInstance } from '@/types/database'
import { deriveAreaStatus, instancesForArea, type AreaStatusSource } from './areaStatus'

const NOW = new Date('2026-10-24T12:00:00.000Z')

function instance(
  status: TaskInstance['status'],
  dueAt: string,
  completedAt: string | null = null
): Pick<TaskInstance, 'status' | 'due_at' | 'completed_at'> {
  return { status, due_at: dueAt, completed_at: completedAt }
}

function source(
  instances: AreaStatusSource['instances'],
  overrides: Partial<AreaStatusSource> = {}
): AreaStatusSource {
  return { active: true, timezone: 'UTC', instances, ...overrides }
}

describe('deriveAreaStatus', () => {
  it('reports archived areas without looking at task records', () => {
    const status = deriveAreaStatus(
      source([instance('pending', '2026-10-24T09:00:00.000Z')], { active: false }),
      NOW
    )
    expect(status.key).toBe('archived')
    expect(status.tone).toBe('default')
  })

  it('reports an unscheduled area honestly', () => {
    const status = deriveAreaStatus(source([]), NOW)
    expect(status.key).toBe('not_scheduled')
    expect(status.reason).toContain('No task instances')
  })

  it('surfaces open issues before task labels and keeps task counts in the reason', () => {
    const status = deriveAreaStatus(
      source([instance('pending', '2026-10-24T09:00:00.000Z')], {
        openIssueCount: 2,
        recurringIssueCount: 1,
      }),
      NOW
    )
    expect(status.key).toBe('issue_open')
    expect(status.label).toBe('2 issues open')
    expect(status.reason).toContain('2 open issues')
    expect(status.reason).toContain('1 category has repeated')
    expect(status.reason).toContain('1 task is due today')
    expect(status.dueTodayCount).toBe(1)
    expect(status.openIssueCount).toBe(2)
    expect(status.recurringIssueCount).toBe(1)
  })

  it('shows an open issue even when the area has no task schedule', () => {
    const status = deriveAreaStatus(source([], { openIssueCount: 1 }), NOW)
    expect(status.key).toBe('issue_open')
    expect(status.label).toBe('Issue open')
    expect(status.reason).toContain('Open the issues list')
  })

  it('prioritises overdue work without shaming copy', () => {
    const status = deriveAreaStatus(
      source([
        instance('pending', '2026-10-22T09:00:00.000Z'),
        instance('pending', '2026-10-24T09:00:00.000Z'),
      ]),
      NOW
    )
    expect(status.key).toBe('needs_attention')
    expect(status.label).toBe('1 overdue')
    expect(status.overdueCount).toBe(1)
    expect(status.dueTodayCount).toBe(1)
    expect(status.reason).toContain('Nothing is penalised')
  })

  it('reports due-today work when nothing is overdue', () => {
    const status = deriveAreaStatus(
      source([
        instance('pending', '2026-10-24T09:00:00.000Z'),
        instance('pending', '2026-10-24T15:00:00.000Z'),
      ]),
      NOW
    )
    expect(status.key).toBe('due_today')
    expect(status.label).toBe('2 due today')
  })

  it('reports recent completions when there is no open work', () => {
    const status = deriveAreaStatus(
      source([
        instance('completed', '2026-10-23T09:00:00.000Z', '2026-10-23T10:00:00.000Z'),
        instance('skipped', '2026-10-24T09:00:00.000Z'),
      ]),
      NOW
    )
    expect(status.key).toBe('recent_progress')
    expect(status.recentCompletionCount).toBe(1)
  })

  it('reports upcoming work with the next due date', () => {
    const status = deriveAreaStatus(
      source([instance('pending', '2026-10-26T09:00:00.000Z')]),
      NOW
    )
    expect(status.key).toBe('upcoming')
    expect(status.reason).toContain('Mon, Oct 26')
  })

  it('reports quiet when all records are older than the recent window', () => {
    const status = deriveAreaStatus(
      source([instance('completed', '2026-10-01T09:00:00.000Z', '2026-10-01T10:00:00.000Z')]),
      NOW
    )
    expect(status.key).toBe('quiet')
  })

  it('uses the space timezone for local day boundaries', () => {
    const dueNearUtcMidnight = [instance('pending', '2026-10-25T02:00:00.000Z')]
    expect(deriveAreaStatus(source(dueNearUtcMidnight, { timezone: 'UTC' }), NOW).key).toBe(
      'upcoming'
    )
    expect(
      deriveAreaStatus(source(dueNearUtcMidnight, { timezone: 'America/Los_Angeles' }), NOW).key
    ).toBe('due_today')
  })
})

describe('instancesForArea', () => {
  it('selects instances through their task area', () => {
    const tasks = [
      { id: 'task-1', area_id: 'area-1' },
      { id: 'task-2', area_id: 'area-2' },
    ]
    const instances = [
      { id: 'i-1', task_id: 'task-1' },
      { id: 'i-2', task_id: 'task-2' },
      { id: 'i-3', task_id: 'task-3' },
    ] as TaskInstance[]

    expect(instancesForArea('area-1', tasks, instances).map((item) => item.id)).toEqual(['i-1'])
    expect(instancesForArea('area-2', tasks, instances).map((item) => item.id)).toEqual(['i-2'])
  })
})
