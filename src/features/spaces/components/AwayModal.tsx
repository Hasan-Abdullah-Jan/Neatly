import { useState } from 'react'
import { Modal } from '@components/ui/Modal'
import { Input } from '@components/ui/Input'
import { Select } from '@components/ui/Select'
import { Button } from '@components/ui/Button'
import type { AwayType } from '@/types/database'
import type { MemberAwayInsert } from '@/types/database'

interface AwayModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (away: Pick<MemberAwayInsert, 'type' | 'starts_at' | 'ends_at' | 'reason'>) => void
}

const typeOptions = [
  { value: 'illness', label: 'Illness' },
  { value: 'travel', label: 'Travel' },
  { value: 'personal', label: 'Personal' },
  { value: 'other', label: 'Other' },
]

export function AwayModal({ isOpen, onClose, onSubmit }: AwayModalProps) {
  const [type, setType] = useState<AwayType>('personal')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!startsAt) {
      setError('Start date is required')
      return
    }

    const start = new Date(startsAt)
    const end = endsAt ? new Date(endsAt) : null

    if (end && end <= start) {
      setError('End date must be after start date')
      return
    }

    setSubmitting(true)
    try {
      await onSubmit({
        type,
        starts_at: start.toISOString(),
        ends_at: end ? end.toISOString() : null,
        reason: reason.trim() || null,
      })
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to create away period')
    } finally {
      setSubmitting(false)
    }
  }

  const today = new Date().toISOString().split('T')[0]

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Set away period">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="Type"
          options={typeOptions}
          value={type}
          onChange={(value) => setType(value as AwayType)}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Start date"
            type="date"
            min={today}
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            required
          />
          <Input
            label="End date (optional)"
            type="date"
            min={startsAt || today}
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
          />
        </div>

        <Input
          label="Reason (optional)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Additional context"
          maxLength={200}
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
            Set away period
          </Button>
        </div>
      </form>
    </Modal>
  )
}
