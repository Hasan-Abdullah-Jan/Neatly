import { Check, X, MessageSquare } from 'lucide-react'
import { Button } from '@components/ui/Button'
import { Card } from '@components/ui/Card'
import { Badge } from '@components/ui/Badge'
import { EmptyState } from '@components/ui/EmptyState'
import { approveRequest, rejectRequest, markFulfilled } from '../api/supplies'
import type { SupplyRequest } from '@/types/database'
import { useState } from 'react'

interface RequestListProps {
  requests: SupplyRequest[]
  canManage: boolean
  onRefresh: () => void
}

export function RequestList({ requests, canManage, onRefresh }: RequestListProps) {
  const [loading, setLoading] = useState<Record<string, boolean>>({})

  const handleApprove = async (id: string) => {
    setLoading((prev) => ({ ...prev, [id]: true }))
    try {
      await approveRequest(id)
      onRefresh()
    } catch (err: any) {
      console.error('Failed to approve:', err)
      alert(err.message || 'Failed to approve request')
    } finally {
      setLoading((prev) => ({ ...prev, [id]: false }))
    }
  }

  const handleReject = async (id: string) => {
    if (!confirm('Reject this request?')) return

    setLoading((prev) => ({ ...prev, [id]: true }))
    try {
      await rejectRequest(id)
      onRefresh()
    } catch (err: any) {
      console.error('Failed to reject:', err)
      alert(err.message || 'Failed to reject request')
    } finally {
      setLoading((prev) => ({ ...prev, [id]: false }))
    }
  }

  const handleFulfill = async (id: string) => {
    setLoading((prev) => ({ ...prev, [id]: true }))
    try {
      await markFulfilled(id)
      onRefresh()
    } catch (err: any) {
      console.error('Failed to fulfill:', err)
      alert(err.message || 'Failed to fulfill request')
    } finally {
      setLoading((prev) => ({ ...prev, [id]: false }))
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="amber">Pending</Badge>
      case 'approved':
        return <Badge variant="info">Approved</Badge>
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>
      case 'fulfilled':
        return <Badge variant="success">Fulfilled</Badge>
      default:
        return <Badge variant="default">{status}</Badge>
    }
  }

  if (requests.length === 0) {
    return (
      <EmptyState
        icon={<MessageSquare className="h-8 w-8" />}
        title="No requests"
        description="No supply requests have been submitted yet"
      />
    )
  }

  return (
    <div className="space-y-3">
      {requests.map((request) => (
        <Card key={request.id} className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-medium">{request.item_name}</h3>
                {getStatusBadge(request.status)}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {request.quantity} {request.unit}
              </p>
              {request.notes && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{request.notes}</p>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                Requested {new Date(request.created_at).toLocaleDateString()}
              </p>
            </div>

            {canManage && request.status === 'pending' && (
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleReject(request.id)}
                  disabled={loading[request.id]}
                >
                  <X className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleApprove(request.id)}
                  disabled={loading[request.id]}
                  loading={loading[request.id]}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Approve
                </Button>
              </div>
            )}

            {canManage && request.status === 'approved' && (
              <Button
                type="button"
                size="sm"
                onClick={() => handleFulfill(request.id)}
                disabled={loading[request.id]}
                loading={loading[request.id]}
              >
                <Check className="h-4 w-4 mr-1" />
                Mark fulfilled
              </Button>
            )}
          </div>
        </Card>
      ))}
    </div>
  )
}
