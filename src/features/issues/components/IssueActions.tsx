import { Button } from '@components/ui/Button'
import {
  BadgeCheck,
  CheckCircle,
  ListPlus,
  Play,
  RotateCcw,
  UserPlus,
} from 'lucide-react'
import type { Issue, MembershipRole, SpaceType } from '@/types/database'
import { isOpenIssueStatus } from '../api/schema'
import {
  canAssignIssue,
  canConvertIssueToTask,
  canReopenIssue,
  canResolveIssue,
  canStartIssue,
  canVerifyIssue,
} from '../lib/permissions'
import type { IssueActionMode } from './IssueActionModal'

export function IssueActions({
  issue,
  role,
  userId,
  teamIds,
  spaceType,
  busy,
  onAssign,
  onAction,
  onConvert,
}: {
  issue: Issue
  role: MembershipRole | null
  userId: string | null
  teamIds: string[]
  spaceType: SpaceType
  busy: boolean
  onAssign: () => void
  onAction: (mode: IssueActionMode) => void
  onConvert: () => void
}) {
  const context = { issue, userId, role, teamIds }
  const canAssign = canAssignIssue(role) && !['resolved', 'closed'].includes(issue.status)
  const canStart =
    canStartIssue(context) && ['reported', 'acknowledged', 'reopened'].includes(issue.status)
  const canResolve =
    canResolveIssue(context) &&
    ['reported', 'acknowledged', 'in_progress', 'reopened'].includes(issue.status)
  const canVerify = canVerifyIssue(context) && issue.status === 'resolved'
  const canReopen =
    canReopenIssue(context) && ['resolved', 'closed'].includes(issue.status)
  const canConvert =
    canConvertIssueToTask(role, spaceType) &&
    issue.follow_up_task_id === null &&
    isOpenIssueStatus(issue.status)
  const hasAction = canAssign || canStart || canResolve || canVerify || canReopen || canConvert

  return (
    <div>
      <h2 className="text-heading-sm font-semibold text-text">Actions</h2>
      <p className="mt-1 text-sm text-text-muted">
        Every action records who changed the issue, when, and why.
      </p>
      {hasAction ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {canAssign && (
            <Button
              variant="outline"
              size="sm"
              onClick={onAssign}
              disabled={busy}
              leftIcon={<UserPlus className="h-4 w-4" />}
            >
              {issue.assigned_to || issue.assigned_team_id || issue.external_service
                ? 'Reassign'
                : 'Assign'}
            </Button>
          )}
          {canStart && (
            <Button
              size="sm"
              onClick={() => onAction('start')}
              disabled={busy}
              leftIcon={<Play className="h-4 w-4" />}
            >
              Start work
            </Button>
          )}
          {canResolve && (
            <Button
              size="sm"
              variant="success"
              onClick={() => onAction('resolve')}
              disabled={busy}
              leftIcon={<CheckCircle className="h-4 w-4" />}
            >
              Resolve
            </Button>
          )}
          {canVerify && (
            <Button
              size="sm"
              variant="success"
              onClick={() => onAction('verify')}
              disabled={busy}
              leftIcon={<BadgeCheck className="h-4 w-4" />}
            >
              Verify &amp; close
            </Button>
          )}
          {canReopen && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onAction('reopen')}
              disabled={busy}
              leftIcon={<RotateCcw className="h-4 w-4" />}
            >
              Reopen
            </Button>
          )}
          {canConvert && (
            <Button
              variant="outline"
              size="sm"
              onClick={onConvert}
              disabled={busy}
              leftIcon={<ListPlus className="h-4 w-4" />}
            >
              {spaceType === 'personal' ? 'Convert to task' : 'Create follow-up task'}
            </Button>
          )}
        </div>
      ) : (
        <p className="mt-3 rounded-lg border border-border bg-background p-3 text-sm text-text-muted">
          No actions are available for your role at this status. You can still read the timeline
          and add a comment.
        </p>
      )}
    </div>
  )
}
