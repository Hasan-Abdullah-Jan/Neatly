import { Badge, type BadgeProps } from '@components/ui/Badge'
import type { IssuePriority } from '@/types/database'
import { issuePriorityLabels } from '../api/schema'

const variants: Record<IssuePriority, BadgeProps['variant']> = {
  low: 'default',
  medium: 'info',
  high: 'amber',
  urgent: 'destructive',
}

export function IssuePriorityBadge({
  priority,
  size = 'sm',
}: {
  priority: IssuePriority
  size?: BadgeProps['size']
}) {
  return (
    <Badge variant={variants[priority]} size={size}>
      {issuePriorityLabels[priority]} priority
    </Badge>
  )
}
