import { useState } from 'react'
import { Button } from '@components/ui/Button'
import { Select } from '@components/ui/Select'
import { Textarea } from '@components/ui/Input'
import { useAuth } from '@contexts/AuthContext'
import { fetchSpaceMembers } from '@features/spaces/api/spaces'
import type { SpaceMember } from '@features/spaces/api/spaces'
import { createTaskSwap } from '@features/spaces/api/assignments'

export function TaskSwapControl({
  instanceId,
  assigneeId,
}: {
  instanceId: string
  assigneeId: string | null
}) {
  const { currentSpace, user } = useAuth()
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<'swap' | 'unable'>('swap')
  const [requestedTo, setRequestedTo] = useState('')
  const [reason, setReason] = useState('')
  const [members, setMembers] = useState<SpaceMember[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!user || user.id !== assigneeId || !currentSpace) return null

  const start = async () => {
    setOpen((wasOpen) => !wasOpen)
    setError(null)
    if (members.length === 0) {
      try {
        setMembers(await fetchSpaceMembers(currentSpace.id))
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Could not load members.')
      }
    }
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await createTaskSwap(
        instanceId,
        kind === 'swap' ? requestedTo || null : null,
        `${kind === 'unable' ? 'Unable: ' : ''}${reason.trim()}`.trim()
      )
      setMessage(kind === 'unable' ? 'Your report was shared with the team.' : 'Your swap request was sent.')
      setOpen(false)
      setReason('')
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not submit your request.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mt-3">
      {message ? (
        <p className="text-sm text-text-muted" role="status">{message}</p>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={() => void start()}>
          {open ? 'Close request' : 'Request a swap or report a problem'}
        </Button>
      )}
      {open && (
        <form onSubmit={submit} className="mt-3 space-y-3 rounded-lg border border-border p-3">
          <Select
            label="What do you need?"
            options={[
              { value: 'swap', label: 'Request a task swap' },
              { value: 'unable', label: "I can't do this task" },
            ]}
            value={kind}
            onChange={(value) => setKind(value as 'swap' | 'unable')}
          />
          {kind === 'swap' && (
            <Select
              label="Ask (optional)"
              options={[
                { value: '', label: 'Anyone available' },
                ...members
                  .filter((member) => member.membership.user_id !== user.id)
                  .map((member) => ({
                    value: member.membership.user_id,
                    label: member.profile?.full_name?.trim() || 'Member',
                  })),
              ]}
              value={requestedTo}
              onChange={setRequestedTo}
            />
          )}
          <Textarea
            label="Note (optional)"
            value={reason}
            onChange={setReason}
            maxLength={500}
            rows={2}
          />
          <Button type="submit" size="sm" loading={submitting}>
            Send request
          </Button>
          {error && <p className="text-sm text-destructive-600" role="alert">{error}</p>}
        </form>
      )}
    </div>
  )
}
