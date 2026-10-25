import { useState, useEffect } from 'react'
import { Modal } from '@components/ui/Modal'
import { Input } from '@components/ui/Input'
import { Button } from '@components/ui/Button'
import { createTeam, updateTeam } from '../api/assignments'
import type { Team } from '@/types/database'

interface TeamFormModalProps {
  isOpen: boolean
  team: Team | null
  spaceId: string
  onClose: () => void
}

export function TeamFormModal({ isOpen, team, spaceId, onClose }: TeamFormModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (team) {
      setName(team.name)
      setDescription(team.description || '')
      setColor(team.color || '')
    } else {
      setName('')
      setDescription('')
      setColor('')
    }
    setError('')
  }, [team, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('Team name is required')
      return
    }

    setSubmitting(true)
    try {
      if (team) {
        await updateTeam(team.id, {
          name: name.trim(),
          description: description.trim() || null,
          color: color.trim() || null,
        })
      } else {
        await createTeam(spaceId, name.trim(), description.trim() || null, color.trim() || null)
      }
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to save team')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={team ? 'Edit team' : 'Create team'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Team name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Morning Shift"
          required
          autoFocus
        />

        <Input
          label="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What this team does"
          maxLength={200}
        />

        <Input
          label="Color (optional)"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          placeholder="e.g., #3b82f6"
          type="color"
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
            {team ? 'Save changes' : 'Create team'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
