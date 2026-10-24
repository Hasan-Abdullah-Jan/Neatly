import { supabase } from '@lib/supabase'
import type { Team, TeamMember } from '@/types/database'

export interface SpaceTeam {
  team: Team
  memberIds: string[]
}

export async function fetchSpaceTeams(spaceId: string): Promise<SpaceTeam[]> {
  const { data: teams, error } = await supabase
    .from('teams')
    .select('*')
    .eq('space_id', spaceId)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)

  const teamRows = (teams ?? []) as Team[]
  if (teamRows.length === 0) return []

  const { data: members, error: memberError } = await supabase
    .from('team_members')
    .select('*')
    .in(
      'team_id',
      teamRows.map((team) => team.id)
    )
    .is('deleted_at', null)

  if (memberError) throw new Error(memberError.message)

  const membersByTeam = new Map<string, string[]>()
  for (const member of (members ?? []) as TeamMember[]) {
    const list = membersByTeam.get(member.team_id) ?? []
    list.push(member.user_id)
    membersByTeam.set(member.team_id, list)
  }

  return teamRows.map((team) => ({
    team,
    memberIds: membersByTeam.get(team.id) ?? [],
  }))
}

export async function fetchMyTeamIds(spaceId: string, userId: string): Promise<string[]> {
  const teams = await fetchSpaceTeams(spaceId)
  return teams
    .filter((entry) => entry.memberIds.includes(userId))
    .map((entry) => entry.team.id)
}
