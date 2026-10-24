import { supabase } from '@lib/supabase'
import type { Space, SpaceModules, SpaceSettings } from '@/types/database'
import type { OnboardingArea, OnboardingState } from '../hooks/useOnboarding'
import { activationSchema, type ActivationInput } from './schema'
import { ensureInstancesForSpace, materializeTasksFromTemplates } from '@features/tasks/api/tasks'
import { addZonedDays, startOfZonedDay } from '@features/tasks/lib/recurrence'

export interface ActivationResult {
  space: Space
  areaCount: number
  taskCount: number
  invitationCount: number
}

function firstIssue(error: { issues: Array<{ path: Array<string | number | symbol>; message: string }> }): string {
  const issue = error.issues[0]
  if (!issue) return 'The setup plan is incomplete.'
  const path = issue.path.map(String).join(' ')
  return path ? `${issue.message} (${path})` : issue.message
}

function activeAreas(areas: OnboardingArea[]): OnboardingArea[] {
  return areas
    .filter((area) => !area.archived)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

function normalizeParent(area: OnboardingArea, activeIds: Set<string>): string | null {
  return area.parentId && activeIds.has(area.parentId) ? area.parentId : null
}

async function rollbackSpace(spaceId: string): Promise<void> {
  try {
    await supabase.from('spaces').delete().eq('id', spaceId)
  } catch {
    // Best-effort cleanup. The partial space is still visible to its owner.
  }
}

export async function activateSpace(
  state: OnboardingState,
  userId: string
): Promise<ActivationResult> {
  const parsed = activationSchema.safeParse({
    profile: state.profile,
    areas: state.areas,
    invitations: state.invitations,
    modules: state.modules,
    reminderDefaults: state.reminderDefaults,
  })

  if (!parsed.success) {
    throw new Error(firstIssue(parsed.error))
  }

  const input: ActivationInput = parsed.data
  const areas = activeAreas(input.areas)
  const activeIds = new Set(areas.map((area) => area.id))

  const settings: SpaceSettings = {
    building: input.profile.building.trim() || undefined,
    floor: input.profile.floor.trim() || undefined,
    zone: input.profile.zone.trim() || undefined,
    evidenceRule: 'none',
    dataRetentionDays: null,
    reminderDefaults: input.reminderDefaults,
    photosEnabled: false,
    qrCodeEnabled: true,
    onboardingCompletedAt: new Date().toISOString(),
  }

  const modules = input.modules as SpaceModules

  const { data: createdSpace, error: spaceError } = await supabase.rpc('create_space_with_owner', {
    p_name: input.profile.name,
    p_type: input.profile.spaceType,
    p_timezone: input.profile.timezone,
    p_modules: modules,
    p_settings: settings,
    p_organization_name:
      input.profile.spaceType === 'personal' ? `${input.profile.name} (personal)` : input.profile.name,
  })

  if (spaceError || !createdSpace) {
    throw new Error(spaceError?.message ?? 'Could not create the space.')
  }

  const space = createdSpace as Space

  try {
    const localToDatabase = new Map<string, string>()
    const insertQueue: OnboardingArea[] = []
    const pending = areas.slice()

    // Insert parents before children so parent_area_id always resolves.
    while (pending.length > 0) {
      const nextIndex = pending.findIndex(
        (area) =>
          !area.parentId ||
          !activeIds.has(area.parentId) ||
          localToDatabase.has(area.parentId) ||
          !areas.some((candidate) => candidate.id === area.parentId)
      )
      if (nextIndex === -1) {
        // Defensive: break any impossible cycle by promoting the remaining areas to root level.
        insertQueue.push(...pending.splice(0).map((area) => ({ ...area, parentId: null })))
        break
      }
      const [area] = pending.splice(nextIndex, 1)
      if (area) insertQueue.push(area)
    }

    for (const area of insertQueue) {
      const parentId = normalizeParent(area, activeIds)
      const databaseParentId = parentId ? localToDatabase.get(parentId) ?? null : null

      const { data: createdArea, error: areaError } = await supabase
        .from('areas')
        .insert({
          space_id: space.id,
          parent_area_id: databaseParentId,
          name: area.name.trim(),
          category: area.category,
          sort_order: area.sortOrder,
          active: true,
        })
        .select('id')
        .single()

      if (areaError || !createdArea) {
        throw new Error(areaError?.message ?? `Could not create area "${area.name}".`)
      }

      localToDatabase.set(area.id, createdArea.id)
    }

    const taskRows = areas.flatMap((area) => {
      const areaId = localToDatabase.get(area.id)
      if (!areaId) return []
      const selected = new Set(area.selectedTasks)
      return area.suggestedTasks
        .filter((task) => selected.has(task.id))
        .map((task) => ({
          space_id: space.id,
          area_id: areaId,
          name: task.name,
          description: task.description ?? null,
          estimated_minutes: task.estimatedMinutes,
          frequency: task.frequency,
          custom_frequency_days: task.frequency === 'custom' ? task.customFrequencyDays ?? 7 : null,
          default_assignee_role: task.defaultAssigneeRole ?? null,
          required_skills: task.requiredSkills ?? [],
          supplies_needed: task.suppliesNeeded ?? [],
          instructions: task.instructions ?? null,
          is_active: true,
          created_by: userId,
        }))
    })

    if (taskRows.length > 0) {
      const { error: taskError } = await supabase.from('task_templates').insert(taskRows)
      if (taskError) {
        throw new Error(taskError.message)
      }

      // Turn the saved setup templates into recurring tasks and fill the next
      // 30 days. Starting at "now" avoids creating a backlog of instances that
      // were already due before the space existed.
      await materializeTasksFromTemplates(space.id, userId)
      const now = new Date()
      const horizon = addZonedDays(startOfZonedDay(now, space.timezone), 30, space.timezone)
      await ensureInstancesForSpace(
        space.id,
        now.toISOString(),
        horizon.toISOString(),
        space.timezone
      )
    }

    const invitationRows = input.invitations.map((invitation) => ({
      space_id: space.id,
      email: invitation.email.trim(),
      role: invitation.role,
      invited_by: userId,
      status: 'pending' as const,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    }))

    if (invitationRows.length > 0) {
      const { error: invitationError } = await supabase.from('invitations').insert(invitationRows)
      if (invitationError) {
        throw new Error(invitationError.message)
      }
    }

    return {
      space,
      areaCount: insertQueue.length,
      taskCount: taskRows.length,
      invitationCount: invitationRows.length,
    }
  } catch (error) {
    await rollbackSpace(space.id)
    throw error instanceof Error ? error : new Error('Setup could not be completed.')
  }
}
