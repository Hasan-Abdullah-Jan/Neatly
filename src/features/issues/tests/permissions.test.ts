import { describe, expect, it } from 'vitest'
import {
  canAssignIssue,
  canAttachIssuePhotos,
  canCommentOnIssue,
  canConvertIssueToTask,
  canReopenIssue,
  canResolveIssue,
  canStartIssue,
  canVerifyIssue,
  isIssueAssignee,
  isIssueInQueue,
  isIssueManager,
  isIssueUnassigned,
  type IssuePermissionContext,
} from '../lib/permissions'

type IssueFields = IssuePermissionContext['issue']

function issue(overrides: Partial<IssueFields> = {}): IssueFields {
  return {
    reported_by: 'reporter',
    assigned_to: null,
    assigned_team_id: null,
    external_service: null,
    status: 'reported',
    due_at: null,
    ...overrides,
  }
}

function context(overrides: Partial<IssuePermissionContext> = {}): IssuePermissionContext {
  return {
    issue: issue(),
    userId: 'member-1',
    role: 'member',
    teamIds: [],
    ...overrides,
  }
}

describe('issue assignment permissions', () => {
  it('lets owners, admins, and supervisors assign issues', () => {
    expect(canAssignIssue('owner')).toBe(true)
    expect(canAssignIssue('admin')).toBe(true)
    expect(canAssignIssue('supervisor')).toBe(true)
    expect(canAssignIssue('member')).toBe(false)
    expect(canAssignIssue(null)).toBe(false)
    expect(isIssueManager('supervisor')).toBe(true)
    expect(isIssueManager('member')).toBe(false)
  })

  it('recognises person and team assignees', () => {
    expect(isIssueAssignee(issue({ assigned_to: 'member-1' }), 'member-1', [])).toBe(true)
    expect(isIssueAssignee(issue({ assigned_team_id: 'team-1' }), 'member-1', ['team-1'])).toBe(
      true
    )
    expect(isIssueAssignee(issue({ assigned_team_id: 'team-1' }), 'member-1', ['team-2'])).toBe(
      false
    )
    expect(isIssueAssignee(issue(), null, [])).toBe(false)
  })

  it('treats external services as assigned but not as a person or team', () => {
    const external = issue({ external_service: 'Repair company' })
    expect(isIssueUnassigned(external)).toBe(false)
    expect(isIssueAssignee(external, 'member-1', [])).toBe(false)
    expect(canStartIssue(context({ issue: external }))).toBe(false)
  })
})

describe('issue lifecycle permissions', () => {
  it('lets a manager start, resolve, verify, and reopen at the right statuses', () => {
    expect(
      canStartIssue(context({ role: 'supervisor', issue: issue({ status: 'reported' }) }))
    ).toBe(true)
    expect(
      canResolveIssue(context({ role: 'supervisor', issue: issue({ status: 'in_progress' }) }))
    ).toBe(true)
    expect(
      canVerifyIssue(context({ role: 'supervisor', issue: issue({ status: 'resolved' }) }))
    ).toBe(true)
    expect(
      canReopenIssue(context({ role: 'supervisor', issue: issue({ status: 'closed' }) }))
    ).toBe(true)
  })

  it('lets a person assignee start and resolve but not verify or reopen', () => {
    const assigned = issue({ assigned_to: 'member-1', status: 'acknowledged' })
    const member = context({ issue: assigned })
    expect(canStartIssue(member)).toBe(true)
    expect(canResolveIssue(member)).toBe(true)
    expect(canVerifyIssue(context({ issue: { ...assigned, status: 'resolved' } }))).toBe(false)
    expect(canReopenIssue(context({ issue: { ...assigned, status: 'closed' } }))).toBe(false)
  })

  it('lets a team member act for the team', () => {
    const assigned = issue({ assigned_team_id: 'team-1', status: 'acknowledged' })
    const member = context({ issue: assigned, teamIds: ['team-1'] })
    expect(canStartIssue(member)).toBe(true)
    expect(canResolveIssue(member)).toBe(true)
    expect(canStartIssue(context({ issue: assigned, teamIds: [] }))).toBe(false)
  })

  it('lets an unassigned reporter start and resolve their own issue', () => {
    const reporter = context({ userId: 'reporter', issue: issue({ reported_by: 'reporter' }) })
    expect(canStartIssue(reporter)).toBe(true)
    expect(canResolveIssue(reporter)).toBe(true)

    const assignedToSomeoneElse = issue({
      reported_by: 'reporter',
      assigned_to: 'member-1',
    })
    expect(canStartIssue(context({ userId: 'reporter', issue: assignedToSomeoneElse }))).toBe(false)
    expect(canResolveIssue(context({ userId: 'reporter', issue: assignedToSomeoneElse }))).toBe(
      false
    )
  })

  it('lets the reporter or a manager verify and reopen', () => {
    const resolved = issue({ reported_by: 'reporter', status: 'resolved' })
    expect(canVerifyIssue(context({ userId: 'reporter', issue: resolved }))).toBe(true)
    expect(canVerifyIssue(context({ userId: 'member-1', issue: resolved }))).toBe(false)

    const closed = issue({ reported_by: 'reporter', status: 'closed' })
    expect(canReopenIssue(context({ userId: 'reporter', issue: closed }))).toBe(true)
    expect(canReopenIssue(context({ userId: 'member-1', issue: closed }))).toBe(false)
  })

  it('lets any space member comment but only the reporter or manager attach photos', () => {
    expect(canCommentOnIssue('member')).toBe(true)
    expect(canCommentOnIssue(null)).toBe(false)

    const reported = issue({ reported_by: 'reporter' })
    expect(
      canAttachIssuePhotos({
        issue: reported,
        userId: 'reporter',
        role: 'member',
        teamIds: [],
      })
    ).toBe(true)
    expect(
      canAttachIssuePhotos({
        issue: reported,
        userId: 'member-1',
        role: 'member',
        teamIds: [],
      })
    ).toBe(false)
    expect(
      canAttachIssuePhotos({
        issue: reported,
        userId: 'member-1',
        role: 'supervisor',
        teamIds: [],
      })
    ).toBe(true)
  })

  it('converts in personal spaces for any member and in organizations for managers', () => {
    expect(canConvertIssueToTask('member', 'personal')).toBe(true)
    expect(canConvertIssueToTask(null, 'personal')).toBe(false)
    expect(canConvertIssueToTask('member', 'workplace')).toBe(false)
    expect(canConvertIssueToTask('admin', 'workplace')).toBe(true)
  })
})

describe('supervisor queue', () => {
  const NOW = new Date('2026-10-25T12:00:00.000Z')

  it('includes unassigned open issues', () => {
    expect(isIssueInQueue(issue({ status: 'reported' }), NOW)).toBe(true)
  })

  it('includes past-due assigned issues', () => {
    expect(
      isIssueInQueue(
        issue({
          assigned_to: 'member-1',
          status: 'in_progress',
          due_at: '2026-10-24T12:00:00.000Z',
        }),
        NOW
      )
    ).toBe(true)
  })

  it('includes reopened issues even when they are assigned and not past due', () => {
    expect(
      isIssueInQueue(
        issue({
          assigned_to: 'member-1',
          status: 'reopened',
          due_at: '2026-10-30T12:00:00.000Z',
        }),
        NOW
      )
    ).toBe(true)
  })

  it('excludes assigned issues that are on time or already closed', () => {
    expect(
      isIssueInQueue(
        issue({
          assigned_to: 'member-1',
          status: 'acknowledged',
          due_at: '2026-10-30T12:00:00.000Z',
        }),
        NOW
      )
    ).toBe(false)
    expect(
      isIssueInQueue(
        issue({ assigned_to: 'member-1', status: 'closed', due_at: '2026-10-01T12:00:00.000Z' }),
        NOW
      )
    ).toBe(false)
  })
})
