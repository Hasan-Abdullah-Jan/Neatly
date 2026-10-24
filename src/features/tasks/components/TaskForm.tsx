import { useMemo, useState } from 'react'
import { Button } from '@components/ui/Button'
import { Checkbox } from '@components/ui/Checkbox'
import { Input, Textarea } from '@components/ui/Input'
import { Modal } from '@components/ui/Modal'
import { Select } from '@components/ui/Select'
import type { Area, Task, TaskDependency, TaskFrequency } from '@/types/database'
import type { SpaceMember } from '@features/spaces/api/spaces'
import { taskInputSchema, type TaskInput } from '../api/schema'

const frequencyOptions: Array<{ value: TaskFrequency; label: string }> = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'custom', label: 'Custom interval' },
]

export interface TaskFormProps {
  isOpen: boolean
  task?: Task | null
  areas: Area[]
  members: SpaceMember[]
  tasks: Task[]
  dependencies: TaskDependency[]
  submitting: boolean
  onClose: () => void
  onSubmit: (input: TaskInput) => Promise<boolean>
}

export function TaskForm({
  isOpen,
  task,
  areas,
  members,
  tasks,
  dependencies,
  submitting,
  onClose,
  onSubmit,
}: TaskFormProps) {
  const [name, setName] = useState(task?.name ?? '')
  const [areaId, setAreaId] = useState(task?.area_id ?? '')
  const [frequency, setFrequency] = useState<TaskFrequency>(task?.frequency ?? 'weekly')
  const [customDays, setCustomDays] = useState(
    task?.custom_frequency_days ? String(task.custom_frequency_days) : '7'
  )
  const [dueTime, setDueTime] = useState((task?.due_time ?? '09:00').slice(0, 5))
  const [estimatedMinutes, setEstimatedMinutes] = useState(
    task?.estimated_minutes ? String(task.estimated_minutes) : ''
  )
  const [assigneeId, setAssigneeId] = useState(task?.assignee_id ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [dependsOn, setDependsOn] = useState<string[]>(() =>
    task
      ? dependencies
          .filter((dependency) => dependency.task_id === task.id && !dependency.deleted_at)
          .map((dependency) => dependency.depends_on_task_id)
      : []
  )
  const [errors, setErrors] = useState<Record<string, string>>({})

  const areaOptions = useMemo(
    () => [
      { value: '', label: 'No area' },
      ...areas.map((area) => ({
        value: area.id,
        label: area.active ? area.name : `${area.name} (archived)`,
      })),
    ],
    [areas]
  )

  const memberOptions = useMemo(
    () => [
      { value: '', label: 'Anyone in the space' },
      ...members.map((member) => ({
        value: member.membership.user_id,
        label:
          member.profile?.full_name?.trim() ||
          (member.membership.user_id === task?.assignee_id ? 'Current assignee' : 'Member'),
      })),
    ],
    [members, task?.assignee_id]
  )

  const dependencyOptions = useMemo(
    () => tasks.filter((candidate) => candidate.id !== task?.id),
    [task?.id, tasks]
  )

  const toggleDependency = (taskId: string, checked: boolean) => {
    setDependsOn((current) =>
      checked ? [...new Set([...current, taskId])] : current.filter((id) => id !== taskId)
    )
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const input: TaskInput = {
      name,
      areaId: areaId || null,
      frequency,
      customFrequencyDays: frequency === 'custom' ? Number(customDays) : null,
      dueTime,
      estimatedMinutes: estimatedMinutes ? Number(estimatedMinutes) : null,
      assigneeId: assigneeId || null,
      description: description.trim() ? description : null,
      dependsOnTaskIds: dependsOn,
    }

    const parsed = taskInputSchema.safeParse(input)
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path.map(String)[0] ?? 'form'
        if (!nextErrors[key]) nextErrors[key] = issue.message
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
      title={task ? 'Edit task' : 'New task'}
      description="Recurrence starts today. Completed history is never rewritten by an edit."
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Input
          label="Task name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={errors.name}
          maxLength={120}
          autoFocus
          required
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Area"
            options={areaOptions}
            value={areaId}
            onChange={setAreaId}
            hint="Areas group tasks for each place."
          />
          <Select
            label="Assigned to"
            options={memberOptions}
            value={assigneeId}
            onChange={setAssigneeId}
            hint="Anyone means any member can pick it up."
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Select
            label="Repeats"
            options={frequencyOptions}
            value={frequency}
            onChange={(value) => setFrequency(value as TaskFrequency)}
          />
          <Input
            label="Due time"
            type="time"
            value={dueTime}
            onChange={(event) => setDueTime(event.target.value)}
            error={errors.dueTime}
            hint="Local time in your space timezone."
            required
          />
          {frequency === 'custom' ? (
            <Input
              label="Every N days"
              type="number"
              min={1}
              max={365}
              value={customDays}
              onChange={(event) => setCustomDays(event.target.value)}
              error={errors.customFrequencyDays}
              required
            />
          ) : (
            <Input
              label="Estimated minutes"
              type="number"
              min={1}
              max={1440}
              value={estimatedMinutes}
              onChange={(event) => setEstimatedMinutes(event.target.value)}
              error={errors.estimatedMinutes}
              placeholder="Optional"
            />
          )}
        </div>

        {frequency === 'custom' && (
          <Input
            label="Estimated minutes"
            type="number"
            min={1}
            max={1440}
            value={estimatedMinutes}
            onChange={(event) => setEstimatedMinutes(event.target.value)}
            error={errors.estimatedMinutes}
            placeholder="Optional"
          />
        )}

        <Textarea
          label="Notes (optional)"
          value={description}
          onChange={setDescription}
          error={errors.description}
          rows={3}
          maxLength={2000}
          hint="Only the task details are shown. No photos or evidence are requested."
        />

        {dependencyOptions.length > 0 && (
          <fieldset className="rounded-lg border border-border p-3">
            <legend className="px-1 text-sm font-medium text-text">Waiting on (optional)</legend>
            <p className="mb-2 text-xs text-text-muted">
              This task can be completed after the latest occurrence of each prerequisite is
              completed or skipped.
            </p>
            <div className="max-h-40 space-y-2 overflow-y-auto">
              {dependencyOptions.map((candidate) => (
                <Checkbox
                  key={candidate.id}
                  label={candidate.name}
                  checked={dependsOn.includes(candidate.id)}
                  onCheckedChange={(checked) => toggleDependency(candidate.id, checked)}
                />
              ))}
            </div>
          </fieldset>
        )}

        {errors.form && (
          <p className="text-sm text-destructive-600 dark:text-destructive-400" role="alert">
            {errors.form}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting} disabled={!name.trim()}>
            {task ? 'Save changes' : 'Create task'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
