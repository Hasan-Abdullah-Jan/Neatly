import { useEffect, useState } from 'react'
import { Button } from '@components/ui/Button'
import { Textarea } from '@components/ui/Input'
import { Modal } from '@components/ui/Modal'
import {
  issueOptionalNoteSchema,
  issueRequiredNoteSchema,
} from '../api/schema'

export type IssueActionMode = 'start' | 'resolve' | 'verify' | 'reopen'

const copy: Record<
  IssueActionMode,
  {
    title: string
    description: string
    label: string
    button: string
    required: boolean
    placeholder: string
  }
> = {
  start: {
    title: 'Start work',
    description: 'Let the space know work has started. A short note is optional.',
    label: 'Start note (optional)',
    button: 'Start work',
    required: false,
    placeholder: 'For example: I have the supplies and will fix this today.',
  },
  resolve: {
    title: 'Resolve issue',
    description: 'Describe what was done. The reporter or a supervisor can verify and close it.',
    label: 'Resolution note',
    button: 'Mark resolved',
    required: true,
    placeholder: 'For example: Replaced the broken handle and tested the door.',
  },
  verify: {
    title: 'Verify and close',
    description:
      'Confirm the issue is actually resolved. This closes it but keeps the whole timeline.',
    label: 'Verification note (optional)',
    button: 'Verify and close',
    required: false,
    placeholder: 'For example: Checked the repair and it looks good.',
  },
  reopen: {
    title: 'Reopen issue',
    description: 'Explain what still needs attention. The issue returns to the open queue.',
    label: 'Reopen note',
    button: 'Reopen issue',
    required: true,
    placeholder: 'For example: The leak came back after a day.',
  },
}

export function IssueActionModal({
  isOpen,
  mode,
  busy,
  onClose,
  onSubmit,
}: {
  isOpen: boolean
  mode: IssueActionMode
  busy: boolean
  onClose: () => void
  onSubmit: (note: string) => Promise<boolean>
}) {
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const config = copy[mode]

  useEffect(() => {
    if (!isOpen) return
    setNote('')
    setError(null)
  }, [isOpen, mode])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const parsed = config.required
      ? issueRequiredNoteSchema.safeParse(note)
      : issueOptionalNoteSchema.safeParse(note)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the note.')
      return
    }

    setError(null)
    const saved = await onSubmit(parsed.data)
    if (saved) onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={config.title}
      description={config.description}
      size="md"
      closeOnOverlayClick={!busy}
      closeOnEscape={!busy}
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Textarea
          label={config.label}
          value={note}
          onChange={setNote}
          rows={4}
          maxLength={2000}
          error={error ?? undefined}
          placeholder={config.placeholder}
          required={config.required}
        />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="submit"
            loading={busy}
            variant={mode === 'reopen' ? 'destructive' : 'primary'}
          >
            {config.button}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
