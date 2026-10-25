import { useState } from 'react'
import { Modal } from '@components/ui/Modal'
import { Input } from '@components/ui/Input'
import { Select } from '@components/ui/Select'
import { Button } from '@components/ui/Button'
import type { InvitationInsert } from '@/types/database'

type MembershipRole = 'owner' | 'admin' | 'supervisor' | 'member' | 'cleaner' | 'auditor'

interface InvitationModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (invitation: Pick<InvitationInsert, 'email' | 'role' | 'expires_at'>) => void | Promise<void>
  canInviteAdmin: boolean
}

const roleOptions: Array<{ value: MembershipRole; label: string }> = [
  { value: 'member', label: 'Member' },
  { value: 'cleaner', label: 'Cleaner' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'admin', label: 'Admin' },
]

export function InvitationModal({ isOpen, onClose, onSubmit, canInviteAdmin }: InvitationModalProps) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<MembershipRole>('member')
  const [expiresDays, setExpiresDays] = useState('7')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address')
      return
    }

    const days = Number(expiresDays)
    if (days < 1 || days > 365) {
      setError('Expiration must be between 1 and 365 days')
      return
    }

    setSubmitting(true)
    try {
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + days)

      await onSubmit({
        email: email.trim() || null,
        role,
        expires_at: expiresAt.toISOString(),
      })
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to create invitation')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Send invitation">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email (optional)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Leave empty to create a shareable link"
          type="email"
        />

        <Select
          label="Role"
          options={roleOptions.filter((option) => canInviteAdmin || option.value !== 'admin')}
          value={role}
          onChange={(value) => setRole(value as MembershipRole)}
        />

        <Input
          label="Expires in (days)"
          type="number"
          min="1"
          max="365"
          value={expiresDays}
          onChange={(e) => setExpiresDays(e.target.value)}
          required
        />

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            Create invitation
          </Button>
        </div>
      </form>
    </Modal>
  )
}
