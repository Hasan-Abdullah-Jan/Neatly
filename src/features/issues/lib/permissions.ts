import type { Issue, MembershipRole, SpaceType } from '@/types/database'
import { isOpenIssueStatus } from '../api/schema'

export const ISSUE_MANAGER_ROLES: MembershipRole[] = ['owner', 'admin', 'supervisor']

type IssuePermissionFields = Pick<
  Issue,
  | 'reported_by'
  | 'assigned_to'
  | 'assigned_team_id'
  | 'external_service'
  | 'status'
  | 'due_at'
>

export interface IssuePermissionContext {
  issue: IssuePermissionFields
  userId: string | null
  role: MembershipRole | null
  /** Teams the current user belongs to, used for team assignment. */
  teamIds: string[]
}

export function isIssueManager(role: MembershipRole | null): boolean {
  return role !== null && ISSUE_MANAGER_ROLES.includes(role)
}

export function isIssueUnassigned(issue: IssuePermissionFields): boolean {
  return (
    issue.assigned_to === null &&
    issue.assigned_team_id === null &&
    (issue.external_service === null || issue.external_service.trim() === '')
  )
}

export function isIssueAssignee(
  issue: IssuePermissionFields,
  userId: string | null,
  teamIds: string[]
): boolean {
  if (!userId) return false
  if (issue.assigned_to === userId) return true
  return issue.assigned_team_id !== null && teamIds.includes(issue.assigned_team_id)
}

export function canAssignIssue(role: MembershipRole | null): boolean {
  return isIssueManager(role)
}

export function canStartIssue(context: IssuePermissionContext): boolean {
  const { issue, userId, role, teamIds } = context
  if (!userId) return false
  if (isIssueManager(role)) return true
  if (isIssueAssignee(issue, userId, teamIds)) return true
  return isIssueUnassigned(issue) && issue.reported_by === userId
}

export function canResolveIssue(context: IssuePermissionContext): boolean {
  const { issue, userId, role, teamIds } = context
  if (!userId) return false
  if (isIssueManager(role)) return true
  if (isIssueAssignee(issue, userId, teamIds)) return true
  return isIssueUnassigned(issue) && issue.reported_by === userId
}

export function canVerifyIssue(context: IssuePermissionContext): boolean {
  const { issue, userId, role } = context
  if (!userId) return false
  return isIssueManager(role) || issue.reported_by === userId
}

export function canReopenIssue(context: IssuePermissionContext): boolean {
  const { issue, userId, role } = context
  if (!userId) return false
  return isIssueManager(role) || issue.reported_by === userId
}

export function canCommentOnIssue(role: MembershipRole | null): boolean {
  return role !== null
}

export function canAttachIssuePhotos(context: IssuePermissionContext): boolean {
  const { issue, userId, role } = context
  if (!userId) return false
  return isIssueManager(role) || issue.reported_by === userId
}

export function canConvertIssueToTask(
  role: MembershipRole | null,
  spaceType: SpaceType
): boolean {
  if (spaceType === 'personal') return role !== null
  return isIssueManager(role)
}

/**
 * The supervisor queue is a working view, not a score. It surfaces issues that
 * have no owner, have passed their due date, or came back after verification.
 */
export function isIssueInQueue(
  issue: IssuePermissionFields,
  now: Date = new Date()
): boolean {
  if (!isOpenIssueStatus(issue.status)) return false
  if (issue.status === 'reopened') return true
  if (isIssueUnassigned(issue)) return true
  if (!issue.due_at) return false
  return new Date(issue.due_at).getTime() < now.getTime()
}
