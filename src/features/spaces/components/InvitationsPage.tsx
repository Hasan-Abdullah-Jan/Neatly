import { useState, useEffect } from 'react'
import { MailPlus, Copy, Trash2, Check, X, Clock } from 'lucide-react'
import { Button } from '@components/ui/Button'
import { Card } from '@components/ui/Card'
import { EmptyState } from '@components/ui/EmptyState'
import { ErrorState } from '@components/ui/ErrorState'
import { Skeleton } from '@components/ui/Skeleton'
import { InvitationModal } from './InvitationModal'
import { getInvitations, createInvitation, revokeInvitation } from '../api/assignments'
import type { Invitation, InvitationInsert, MembershipRole } from '@/types/database'
import { useAuth } from '@contexts/AuthContext'
import { fetchMembershipRole } from '@features/tasks/api/tasks'
import { isTaskManager } from '@features/tasks/lib/permissions'

export function InvitationsPage() {
  const { currentSpace, user } = useAuth()
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [canManageSpace, setCanManageSpace] = useState(false)
  const [canInviteAdmin, setCanInviteAdmin] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    if (currentSpace?.id) {
      loadInvitations()
      if (user?.id) {
        void fetchMembershipRole(currentSpace.id, user.id)
          .then((role: MembershipRole | null) => {
            setCanManageSpace(isTaskManager(role))
            setCanInviteAdmin(role === 'owner' || role === 'admin')
          })
          .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : 'Could not check permissions.'))
      }
    }
  }, [currentSpace?.id, user?.id])

  const loadInvitations = async () => {
    if (!currentSpace?.id) return

    setLoading(true)
    setError(null)

    try {
      const data = await getInvitations(currentSpace.id)
      setInvitations(data)
    } catch (err: any) {
      setError(err.message || 'Failed to load invitations')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (invitation: Pick<InvitationInsert, 'email' | 'role' | 'expires_at'>) => {
    if (!currentSpace?.id) return
    try {
      await createInvitation({
        spaceId: currentSpace.id,
        email: invitation.email ?? null,
        role: invitation.role,
        expiresAt: invitation.expires_at,
      })
      setShowForm(false)
      await loadInvitations()
    } catch (err: any) {
      console.error('Failed to create invitation:', err)
      alert(err.message || 'Failed to create invitation')
    }
  }

  const handleRevoke = async (id: string) => {
    if (!confirm('Revoke this invitation?')) return

    try {
      await revokeInvitation(id)
      await loadInvitations()
    } catch (err: any) {
      console.error('Failed to revoke invitation:', err)
      alert(err.message || 'Failed to revoke invitation')
    }
  }

  const handleCopyLink = async (token: string) => {
    const link = `${window.location.origin}/invite/${token}`
    setActionError(null)
    try {
      await navigator.clipboard.writeText(link)
      setActionError('Invitation link copied.')
    } catch (copyError) {
      setActionError(copyError instanceof Error ? copyError.message : 'Could not copy the invitation link.')
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="inline-flex items-center gap-1 text-sm text-amber-600 dark:text-amber-400">
          <Clock className="h-4 w-4" />
          Pending
        </span>
      case 'accepted':
        return <span className="inline-flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
          <Check className="h-4 w-4" />
          Accepted
        </span>
      case 'declined':
        return <span className="inline-flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
          <X className="h-4 w-4" />
          Declined
        </span>
      case 'revoked':
        return <span className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
          Revoked
        </span>
      case 'expired':
        return <span className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
          Expired
        </span>
      default:
        return <span className="text-sm">{status}</span>
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadInvitations} />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Invitations</h1>
          <p className="text-gray-600 dark:text-gray-400">Invite people to join this space</p>
        </div>
        {canManageSpace && (
          <Button onClick={() => setShowForm(true)}>
            <MailPlus className="h-4 w-4 mr-2" />
            Send invitation
          </Button>
        )}
      </div>

      <p className="text-sm text-text-muted">
        Email delivery is not configured yet. For email-address invitations, copy the link and share
        it with that person.
      </p>
      {actionError && <p className="text-sm text-text-muted" role="status">{actionError}</p>}

      {invitations.length === 0 ? (
        <EmptyState
          icon={<MailPlus className="h-8 w-8" />}
          title="No invitations"
          description="Send invitations to add people to this space"
          action={canManageSpace ? { label: 'Create invitation', onClick: () => setShowForm(true) } : undefined}
        />
      ) : (
        <div className="space-y-3">
          {invitations.map((invitation) => (
            <Card key={invitation.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium">{invitation.email || 'Link invitation'}</h3>
                    {getStatusBadge(
                      invitation.status === 'pending' && new Date(invitation.expires_at) <= new Date()
                        ? 'expired'
                        : invitation.status
                    )}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Role: {invitation.role}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                    Created {new Date(invitation.created_at).toLocaleDateString()}
                    {invitation.expires_at && ` · Expires ${new Date(invitation.expires_at).toLocaleDateString()}`}
                  </p>
                </div>

                <div className="flex gap-2">
                  {invitation.status === 'pending' && new Date(invitation.expires_at) > new Date() && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyLink(invitation.token)}
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Copy link
                    </Button>
                  )}
                  {canManageSpace && invitation.status === 'pending' && new Date(invitation.expires_at) > new Date() && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRevoke(invitation.id)}
                      aria-label="Revoke invitation"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showForm && (
        <InvitationModal
          isOpen={showForm}
          onClose={() => setShowForm(false)}
          onSubmit={handleCreate}
          canInviteAdmin={canInviteAdmin}
        />
      )}
    </div>
  )
}
