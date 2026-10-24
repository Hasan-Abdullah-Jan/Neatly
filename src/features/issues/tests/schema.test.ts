import { describe, expect, it } from 'vitest'
import {
  ISSUE_PHOTO_GUIDANCE,
  MAX_ISSUE_PHOTOS,
  deriveIssueTitle,
  isOpenIssueStatus,
  issueAssignSchema,
  issueCategoryLabel,
  issueCommentSchema,
  issueReportSchema,
  issueStatusLabels,
  openIssueStatuses,
  type IssueReportInput,
} from '../api/schema'

function report(overrides: Partial<IssueReportInput> = {}): IssueReportInput {
  return {
    areaId: null,
    category: 'cleanliness',
    customCategory: '',
    description: 'Spill near the kitchen sink',
    priority: 'medium',
    dueAt: null,
    ...overrides,
  }
}

describe('issueReportSchema', () => {
  it('accepts a minimal report with no area', () => {
    const parsed = issueReportSchema.safeParse(report())
    expect(parsed.success).toBe(true)
    expect(parsed.success && parsed.data.areaId).toBeNull()
  })

  it('requires a description long enough to be useful', () => {
    const parsed = issueReportSchema.safeParse(report({ description: '  ' }))
    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toContain('few words')
    }
  })

  it('requires a name when the category is custom', () => {
    const parsed = issueReportSchema.safeParse(report({ category: 'custom', customCategory: '  ' }))
    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(parsed.error.issues.some((entry) => entry.path[0] === 'customCategory')).toBe(true)
    }
  })

  it('accepts a custom category with a name', () => {
    const parsed = issueReportSchema.safeParse(
      report({ category: 'custom', customCategory: 'Lighting' })
    )
    expect(parsed.success).toBe(true)
  })

  it('rejects an invalid due date', () => {
    const parsed = issueReportSchema.safeParse(report({ dueAt: 'not-a-date' }))
    expect(parsed.success).toBe(false)
  })
})

describe('issueAssignSchema', () => {
  const base = {
    type: 'person' as const,
    personId: null,
    teamId: null,
    externalService: '',
    dueDate: null,
    note: '',
  }

  it('requires a person when assigning to a person', () => {
    expect(issueAssignSchema.safeParse(base).success).toBe(false)
    expect(
      issueAssignSchema.safeParse({
        ...base,
        personId: '11111111-1111-4111-8111-111111111111',
      }).success
    ).toBe(true)
  })

  it('requires a team when assigning to a team', () => {
    expect(issueAssignSchema.safeParse({ ...base, type: 'team' }).success).toBe(false)
    expect(
      issueAssignSchema.safeParse({
        ...base,
        type: 'team',
        teamId: '22222222-2222-4222-8222-222222222222',
      }).success
    ).toBe(true)
  })

  it('requires a service name for an external assignment', () => {
    expect(issueAssignSchema.safeParse({ ...base, type: 'external' }).success).toBe(false)
    expect(
      issueAssignSchema.safeParse({
        ...base,
        type: 'external',
        externalService: 'Window repair company',
      }).success
    ).toBe(true)
  })

  it('accepts an unassigned issue and an ISO date', () => {
    expect(
      issueAssignSchema.safeParse({
        ...base,
        type: 'unassigned',
        dueDate: '2026-10-30',
      }).success
    ).toBe(true)
    expect(
      issueAssignSchema.safeParse({
        ...base,
        type: 'unassigned',
        dueDate: '30/10/2026',
      }).success
    ).toBe(false)
  })
})

describe('issue note and comment schemas', () => {
  it('requires a meaningful resolution or reopen note', () => {
    expect(issueCommentSchema.safeParse('  ').success).toBe(false)
    expect(issueCommentSchema.safeParse('Checked the repair').success).toBe(true)
  })

  it('keeps comments under the limit', () => {
    expect(issueCommentSchema.safeParse('a'.repeat(2001)).success).toBe(false)
    expect(issueCommentSchema.safeParse('a'.repeat(2000)).success).toBe(true)
  })
})

describe('issue labels and titles', () => {
  it('uses the custom name for a custom category', () => {
    expect(issueCategoryLabel('custom', 'Lighting')).toBe('Lighting')
    expect(issueCategoryLabel('custom', null)).toBe('Custom')
    expect(issueCategoryLabel('facility', null)).toBe('Facility / Maintenance')
  })

  it('maps reported and acknowledged to the UI labels', () => {
    expect(issueStatusLabels.reported).toBe('Open')
    expect(issueStatusLabels.acknowledged).toBe('Assigned')
    expect(issueStatusLabels.closed).toBe('Verified / Closed')
  })

  it('treats reopened as open and closed as closed', () => {
    expect(openIssueStatuses).toContain('reopened')
    expect(isOpenIssueStatus('reopened')).toBe(true)
    expect(isOpenIssueStatus('in_progress')).toBe(true)
    expect(isOpenIssueStatus('resolved')).toBe(false)
    expect(isOpenIssueStatus('closed')).toBe(false)
  })

  it('derives a short title from the first description line', () => {
    expect(
      deriveIssueTitle(report({ description: 'Broken handle on the east door\nIt sticks.' }), null)
    ).toBe('Broken handle on the east door')
  })

  it('exposes stable photo guidance and limits', () => {
    expect(ISSUE_PHOTO_GUIDANCE).toBe('Avoid including people or identifying details.')
    expect(MAX_ISSUE_PHOTOS).toBe(5)
  })
})
