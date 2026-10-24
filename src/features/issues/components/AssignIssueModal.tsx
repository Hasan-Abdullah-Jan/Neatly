import { useEffect, useMemo, useState } from 'react'
import { formatInTimeZone } from 'date-fns-tz'
import { Button } from '@components/ui/Button'
import { Input, Textarea } from '@components/ui/Input'
import { Modal } from '@components/ui/Modal'
import { Select } from '@components/ui/Select'
import type { Issue } from '@/types/database'
import type { SpaceMember } from '@features/spaces/api/spaces'
import type { SpaceTeam } from '@features/spaces/api/teams'
import {
  issueAssignSchema,
  type IssueAssignInput,
  type IssueAssignmentType,
} from '../api/schema'

const assignmentOptions = [
  { value: 'unassigned', label: 'Unassigned' },
  { value: 'person', label: 'Person' },
  { value: 'team', label: 'Team' },
  { value: 'external', label: 'External service' },
]

export function AssignIssueModal({
  isOpen,
  issue,
  members,
  teams,
  timezone,
  busy,
  onClose,
  onSubmit,
}: {
  isOpen: boolean
  issue: Issue
  members: SpaceMember[]
  teams: SpaceTeam[]
  timezone: string
  busy: boolean
  onClose: () => void
  onSubmit: (input: IssueAssignInput) => Promise<boolean>
}) {
  const [type, setType] = useState<IssueAssignmentType>('unassigned')
  const [personId, setPersonId] = useState('')
  const [teamId, setTeamId] = useState('')
  const [externalService, setExternalService] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!isOpen) return
    setType(
      issue.assigned_to
        ? 'person'
        : issue.assigned_team_id
          ? 'team'
          : issue.external_service
            ? 'external'
            : 'unassigned'
    )
    setPersonId(issue.assigned_to ?? '')
    setTeamId(issue.assigned_team_id ?? '')
    setExternalService(issue.external_service ?? '')
    setDueDate(
      issue.due_at ? formatInTimeZone(new Date(issue.due_at), timezone, 'yyyy-MM-dd') : ''
    )
    setNote('')
    setErrors({})
  }, [isOpen, issue, timezone])

  const personOptions = useMemo(
    () => [
      { value: '', label: 'Choose a person' },
      ...members.map((member) => ({
        value: member.membership.user_id,
        label: member.profile?.full_name?.trim() || 'Member',
      })),
    ],
    [members]
  )

  const teamOptions = useMemo(
    () => [
      { value: '', label: 'Choose a team' },
      ...teams.map((entry) => ({ value: entry.team.id, label: entry.team.name })),
    ],
    [teams]
  )

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const input: IssueAssignInput = {
      type,
      personId: type === 'person' ? personId || null : null,
      teamId: type === 'team' ? teamId || null : null,
      externalService: type === 'external' ? externalService : '',
      dueDate: dueDate || null,
      note,
    }

    const parsed = issueAssignSchema.safeParse(input)
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {}
      for (const issueError of parsed.error.issues) {
        const key = issueError.path.map(String)[0] ?? 'form'
        if (!nextErrors[key]) nextErrors[key] = issueError.message
      }
      setErrors(nextErrors)
      return
    }

    setErrors({})
    const saved = await onSubmit(parsed.data)
    if (saved) onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Assign issue"
      description="Choose a person, team, or external service. The assignee and due date are visible to everyone in the space."
      size="lg"
      closeOnOverlayClick={!busy}
      closeOnEscape={!busy}
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Select
          label="Assign to"
          options={assignmentOptions}
          value={type}
          onChange={(value) => setType(value as IssueAssignmentType)}
        />

        {type === 'person' && (
          <Select
            label="Person"
            options={personOptions}
            value={personId}
            onChange={setPersonId}
            error={errors.personId}
          />
        )}

        {type === 'team' && (
          <Select
            label="Team"
            options={teamOptions}
            value={teamId}
            onChange={setTeamId}
            error={errors.teamId}
            hint="Any member of the team can start and resolve the issue."
          />
        )}

        {type === 'external' && (
          <Input
            label="External service"
            value={externalService}
            onChange={(event) => setExternalService(event.target.value)}
            error={errors.externalService}
            placeholder="For example, a repair company"
            maxLength={120}
          />
        )}

        <Input
          label="Due date (optional)"
          type="date"
          value={dueDate}
          onChange={(event) => setDueDate(event.target.value)}
          hint={`Stored as end of day in ${timezone.replace('_', ' ')}.`}
        />

        <Textarea
          label="Assignment note (optional)"
          value={note}
          onChange={setNote}
          rows={3}
          maxLength={1000}
          hint="This note is saved in the issue timeline."
        />

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Save assignment
          </Button>
        </div>
      </form>
    </Modal>
  )
}
