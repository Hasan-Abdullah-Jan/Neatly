import { describe, expect, it } from 'vitest'
import type { Task, TaskInstance } from '@/types/database'
import { calculateWeeklyWorkload, findUnequalLoadSuggestion } from './workload'

const makeTask = (id: string, minutes: number): Task =>
  ({ id, estimated_minutes: minutes }) as Task

const makeInstance = (
  id: string,
  taskId: string,
  assigneeId: string | null,
  status: TaskInstance['status'] = 'pending'
): TaskInstance =>
  ({ id, task_id: taskId, assignee_id: assigneeId, status, deleted_at: null }) as TaskInstance

describe('calculateWeeklyWorkload', () => {
  it('sums estimated minutes per person without sorting or ranking members', () => {
    const result = calculateWeeklyWorkload(
      [
        makeInstance('1', 'task-a', 'member-b'),
        makeInstance('2', 'task-a', 'member-b', 'completed'),
        makeInstance('3', 'task-b', 'member-a'),
      ],
      [makeTask('task-a', 15), makeTask('task-b', 25)]
    )
    expect(result.members).toEqual([
      { userId: 'member-b', minutes: 30, taskCount: 2 },
      { userId: 'member-a', minutes: 25, taskCount: 1 },
    ])
  })

  it('counts unassigned minutes and excludes skipped work', () => {
    const result = calculateWeeklyWorkload(
      [
        makeInstance('1', 'task-a', null),
        makeInstance('2', 'task-a', 'member-a', 'skipped'),
        makeInstance('3', 'task-b', '   '),
      ],
      [makeTask('task-a', 20), makeTask('task-b', 10)]
    )
    expect(result).toEqual({ members: [], unassignedMinutes: 30 })
  })

  it('suggests rebalancing only when a member carries a clearly larger share for four weeks', () => {
    const weeks = Array.from({ length: 4 }, () => ({
      minutesByMember: new Map([
        ['member-a', 180],
        ['member-b', 100],
        ['member-c', 80],
      ]),
      availableMemberIds: ['member-a', 'member-b', 'member-c'],
    }))
    expect(findUnequalLoadSuggestion(weeks)).toEqual({
      userId: 'member-a',
      memberMinutes: [180, 180, 180, 180],
      peerAverageMinutes: [90, 90, 90, 90],
    })
  })

  it('does not treat an away week or a single high week as a sustained imbalance', () => {
    const ordinary = {
      minutesByMember: new Map([['member-a', 180], ['member-b', 100]]),
      availableMemberIds: ['member-a', 'member-b'],
    }
    const away = {
      minutesByMember: new Map([['member-a', 180], ['member-b', 100]]),
      availableMemberIds: ['member-b'],
    }
    expect(findUnequalLoadSuggestion([ordinary, ordinary, ordinary, away])).toBeNull()
    expect(findUnequalLoadSuggestion([ordinary, ordinary, ordinary, {
      minutesByMember: new Map([['member-a', 100], ['member-b', 100]]),
      availableMemberIds: ['member-a', 'member-b'],
    }])).toBeNull()
  })
})
