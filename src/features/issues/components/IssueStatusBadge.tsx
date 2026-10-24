import { Badge, type BadgeProps } from '@components/ui/Badge'
import type { IssueStatus } from '@/types/database'
import { issueStatusLabels } from '../api/schema'

const variants: Record<IssueStatus, BadgeProps['variant']> = {
  reported: 'info',
  acknowledged: 'amber',
  in_progress: 'primary',
  resolved: 'success',
  closed: 'success',
  reopened: 'destructive',
}

export function IssueStatusBadge({
  status,
  size = 'sm',
}: {
  status: IssueStatus
  size?: BadgeProps['size']
}) {
  return (
    <Badge variant={variants[status]} size={size} dot>
      {issueStatusLabels[status]}
    </Badge>
  )
}
