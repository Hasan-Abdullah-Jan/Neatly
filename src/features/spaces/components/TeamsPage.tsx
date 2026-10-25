import { useEffect, useState } from 'react'
import { Edit, Plus, Trash2, Users } from 'lucide-react'
import { Button } from '@components/ui/Button'
import { Card } from '@components/ui/Card'
import { EmptyState } from '@components/ui/EmptyState'
import { ErrorState } from '@components/ui/ErrorState'
import { Skeleton } from '@components/ui/Skeleton'
import { useAuth } from '@contexts/AuthContext'
import { fetchMembershipRole } from '@features/tasks/api/tasks'
import { isTaskManager } from '@features/tasks/lib/permissions'
import { fetchSpaceMembers, type SpaceMember } from '../api/spaces'
import {
  addTeamMember,
  deleteTeam,
  getTeamMembers,
  getTeams,
  removeTeamMember,
} from '../api/assignments'
import type { Team, TeamMember } from '@/types/database'
import { TeamFormModal } from './TeamFormModal'

export function TeamsPage() {
  const { currentSpace, user } = useAuth()
  const [teams, setTeams] = useState<Team[]>([])
  const [members, setMembers] = useState<SpaceMember[]>([])
  const [canManageSpace, setCanManageSpace] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingTeam, setEditingTeam] = useState<Team | null>(null)
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null)
  const [teamMembers, setTeamMembers] = useState<Record<string, TeamMember[]>>({})

  async function loadTeams() {
    if (!currentSpace?.id) return
    setLoading(true)
    setError(null)
    try {
      const [nextTeams, nextMembers, role] = await Promise.all([
        getTeams(currentSpace.id),
        fetchSpaceMembers(currentSpace.id),
        user ? fetchMembershipRole(currentSpace.id, user.id) : Promise.resolve(null),
      ])
      setTeams(nextTeams)
      setMembers(nextMembers)
      setCanManageSpace(isTaskManager(role))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load teams.')
    } finally {
      setLoading(false)
    }
  }

  async function loadTeamMembers(teamId: string) {
    try {
      const nextMembers = await getTeamMembers(teamId)
      setTeamMembers((current) => ({ ...current, [teamId]: nextMembers }))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load team members.')
    }
  }

  useEffect(() => {
    void loadTeams()
  }, [currentSpace?.id, user?.id])

  async function handleDelete(teamId: string) {
    if (!confirm('Delete this team?')) return
    try {
      await deleteTeam(teamId)
      await loadTeams()
    } catch (deleteError) {
      alert(deleteError instanceof Error ? deleteError.message : 'Could not delete the team.')
    }
  }

  async function handleExpand(teamId: string) {
    if (expandedTeam === teamId) {
      setExpandedTeam(null)
      return
    }
    setExpandedTeam(teamId)
    await loadTeamMembers(teamId)
  }

  async function handleAddMember(teamId: string, userId: string) {
    if (!userId) return
    try {
      await addTeamMember(teamId, userId)
      await loadTeamMembers(teamId)
    } catch (addError) {
      alert(addError instanceof Error ? addError.message : 'Could not add this member.')
    }
  }

  async function handleRemoveMember(teamId: string, userId: string) {
    try {
      await removeTeamMember(teamId, userId)
      await loadTeamMembers(teamId)
    } catch (removeError) {
      alert(removeError instanceof Error ? removeError.message : 'Could not remove this member.')
    }
  }

  function openForm(team: Team | null) {
    setEditingTeam(team)
    setShowForm(true)
  }

  async function closeForm() {
    setShowForm(false)
    setEditingTeam(null)
    await loadTeams()
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, index) => <Skeleton key={index} className="h-32" />)}
        </div>
      </div>
    )
  }
  if (error) return <ErrorState message={error} onRetry={() => void loadTeams()} />

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text">Teams</h1>
          <p className="text-text-muted">Organize space members for team task assignments.</p>
        </div>
        {canManageSpace && (
          <Button onClick={() => openForm(null)} leftIcon={<Plus className="h-4 w-4" />}>
            Create team
          </Button>
        )}
      </header>

      {teams.length === 0 ? (
        <EmptyState
          icon={<Users className="h-8 w-8" />}
          title="No teams yet"
          description="Create a team to organize members and assign work together."
          action={canManageSpace ? { label: 'Create team', onClick: () => openForm(null) } : undefined}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => {
            const roster = teamMembers[team.id] ?? []
            return (
              <Card key={team.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {team.color && (
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: team.color }} />
                      )}
                      <h2 className="font-medium text-text">{team.name}</h2>
                    </div>
                    {team.description && <p className="mt-1 text-sm text-text-muted">{team.description}</p>}
                    <p className="mt-2 text-sm text-text-muted">
                      {roster.length} member{roster.length === 1 ? '' : 's'}
                    </p>
                  </div>
                  {canManageSpace && (
                    <div className="flex">
                      <Button variant="ghost" size="icon" onClick={() => openForm(team)} aria-label={`Edit ${team.name}`}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => void handleDelete(team.id)} aria-label={`Delete ${team.name}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => void handleExpand(team.id)}>
                  {expandedTeam === team.id ? 'Hide members' : 'Manage members'}
                </Button>
                {expandedTeam === team.id && (
                  <div className="mt-3 border-t border-border pt-3">
                    <ul className="space-y-2">
                      {roster.map((teamMember) => (
                        <li key={teamMember.id} className="flex items-center justify-between gap-2 text-sm">
                          <span>
                            {members.find((member) => member.membership.user_id === teamMember.user_id)
                              ?.profile?.full_name?.trim() || 'Member'}
                            <span className="ml-1 text-text-muted">({teamMember.role})</span>
                          </span>
                          {canManageSpace && (
                            <Button variant="ghost" size="sm" onClick={() => void handleRemoveMember(team.id, teamMember.user_id)}>
                              Remove
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                    {canManageSpace && members.some((member) =>
                      !roster.some((teamMember) => teamMember.user_id === member.membership.user_id)
                    ) && (
                      <label className="mt-3 block text-sm text-text">
                        Add a space member
                        <select
                          className="mt-1 block min-h-11 w-full rounded-md border border-border bg-surface px-3"
                          defaultValue=""
                          onChange={(event) => {
                            void handleAddMember(team.id, event.target.value)
                            event.target.value = ''
                          }}
                        >
                          <option value="">Choose a member</option>
                          {members
                            .filter((member) => !roster.some((teamMember) => teamMember.user_id === member.membership.user_id))
                            .map((member) => (
                              <option key={member.membership.user_id} value={member.membership.user_id}>
                                {member.profile?.full_name?.trim() || 'Member'}
                              </option>
                            ))}
                        </select>
                      </label>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {showForm && currentSpace && (
        <TeamFormModal
          isOpen={showForm}
          team={editingTeam}
          spaceId={currentSpace.id}
          onClose={() => void closeForm()}
        />
      )}
    </div>
  )
}
