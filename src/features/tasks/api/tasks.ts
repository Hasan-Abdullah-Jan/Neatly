import { supabase } from '@lib/supabase'
import type {
  Area,
  MembershipRole,
  Task,
  TaskCompletion,
  TaskDependency,
  TaskInstance,
  TaskTemplate,
} from '@/types/database'
import { fetchAreas, fetchSpaceTaskTemplates } from '@features/areas/api/areas'
import { fetchSpaceMembers } from '@features/spaces/api/spaces'
import { findCyclicDependencies, type DependencyEdge } from '../lib/dependencies'
import { addZonedDays, generateInstances, startOfZonedDay } from '../lib/recurrence'
import type { TaskInput } from './schema'

const OPEN_STATUSES: TaskInstance['status'][] = ['pending', 'in_progress', 'overdue']
const INSERT_CHUNK_SIZE = 200

export interface TaskHistoryEntry {
  instance: TaskInstance
  task: Task
  areaName: string | null
  completion: TaskCompletion | null
  completedByName: string | null
}

export async function fetchMembershipRole(
  spaceId: string,
  userId: string
): Promise<MembershipRole | null> {
  const { data, error } = await supabase
    .from('memberships')
    .select('role')
    .eq('space_id', spaceId)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return (data?.role as MembershipRole | undefined) ?? null
}

export async function fetchTasks(
  spaceId: string,
  includeInactive = false,
  includeDeleted = false
): Promise<Task[]> {
  let query = supabase
    .from('tasks')
    .select('*')
    .eq('space_id', spaceId)
    .order('name', { ascending: true })

  if (!includeDeleted) {
    query = query.is('deleted_at', null)
  }

  if (!includeInactive) {
    query = query.eq('is_active', true)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as Task[]
}

export async function fetchTasksForArea(
  areaId: string,
  includeInactive = false,
  includeDeleted = false
): Promise<Task[]> {
  let query = supabase
    .from('tasks')
    .select('*')
    .eq('area_id', areaId)
    .order('name', { ascending: true })

  if (!includeDeleted) {
    query = query.is('deleted_at', null)
  }

  if (!includeInactive) {
    query = query.eq('is_active', true)
  }

  const { data, error } = await query

  if (error) throw new Error(error.message)
  return (data ?? []) as Task[]
}

export async function fetchOpenInstances(
  spaceId: string,
  throughIso: string
): Promise<TaskInstance[]> {
  const { data, error } = await supabase
    .from('task_instances')
    .select('*')
    .eq('space_id', spaceId)
    .in('status', OPEN_STATUSES)
    .lte('due_at', throughIso)
    .is('deleted_at', null)
    .order('due_at', { ascending: true })
    .limit(300)

  if (error) throw new Error(error.message)
  return (data ?? []) as TaskInstance[]
}

export async function fetchInstancesInWindow(
  spaceId: string,
  fromIso: string,
  toIso: string,
  limit = 500
): Promise<TaskInstance[]> {
  const { data, error } = await supabase
    .from('task_instances')
    .select('*')
    .eq('space_id', spaceId)
    .gte('due_at', fromIso)
    .lt('due_at', toIso)
    .is('deleted_at', null)
    .order('due_at', { ascending: true })
    .limit(limit)

  if (error) throw new Error(error.message)
  return (data ?? []) as TaskInstance[]
}

export function mergeInstances(...lists: TaskInstance[][]): TaskInstance[] {
  const byId = new Map<string, TaskInstance>()
  for (const list of lists) {
    for (const instance of list) byId.set(instance.id, instance)
  }
  return [...byId.values()]
}

/**
 * Instances used to derive area status: all open work plus the recent window
 * of completed and skipped records. Status never depends on photos.
 */
export async function fetchStatusInstances(
  spaceId: string,
  timezone: string,
  now: Date = new Date()
): Promise<TaskInstance[]> {
  const todayStart = startOfZonedDay(now, timezone)
  const from = addZonedDays(todayStart, -7, timezone)
  const openHorizon = addZonedDays(todayStart, 90, timezone)
  const [open, window] = await Promise.all([
    fetchOpenInstances(spaceId, openHorizon.toISOString()),
    fetchInstancesInWindow(spaceId, from.toISOString(), openHorizon.toISOString()),
  ])
  return mergeInstances(open, window)
}

export async function fetchTaskDependencies(spaceId: string): Promise<TaskDependency[]> {
  const { data, error } = await supabase
    .from('task_dependencies')
    .select('*')
    .eq('space_id', spaceId)
    .is('deleted_at', null)

  if (error) throw new Error(error.message)
  return (data ?? []) as TaskDependency[]
}

/**
 * Materialize missing instances for every active task in the window. The
 * partial unique index protects against races; existing due instants are
 * filtered out first so a normal reload does not write anything.
 */
export async function ensureInstancesForSpace(
  spaceId: string,
  fromIso: string,
  toIso: string,
  timezone: string
): Promise<number> {
  const tasks = await fetchTasks(spaceId)
  if (tasks.length === 0) return 0

  const { data: existing, error: existingError } = await supabase
    .from('task_instances')
    .select('task_id, due_at')
    .eq('space_id', spaceId)
    .gte('due_at', fromIso)
    .lt('due_at', toIso)
    .is('deleted_at', null)

  if (existingError) throw new Error(existingError.message)

  const existingKeys = new Set(
    ((existing ?? []) as Array<{ task_id: string; due_at: string }>).map(
      (row) => `${row.task_id}|${new Date(row.due_at).getTime()}`
    )
  )

  const rows: Array<{
    task_id: string
    space_id: string
    assignee_id: string | null
    due_at: string
    timezone: string
    status: 'pending'
  }> = []

  for (const task of tasks) {
    const anchorTime = new Date(task.schedule_anchor_at ?? task.created_at).getTime()
    for (const generated of generateInstances(task, fromIso, toIso, timezone)) {
      // Recurrence cannot start before the anchor instant. This matters when a
      // task is created or reset late in the day: its earlier due time today
      // belongs to the past and should not appear as an instant backlog.
      if (Number.isFinite(anchorTime) && new Date(generated.dueAt).getTime() < anchorTime) {
        continue
      }
      const key = `${task.id}|${new Date(generated.dueAt).getTime()}`
      if (existingKeys.has(key)) continue
      existingKeys.add(key)
      rows.push({
        task_id: task.id,
        space_id: spaceId,
        assignee_id: task.assignee_id,
        due_at: generated.dueAt,
        timezone,
        status: 'pending',
      })
    }
  }

  if (rows.length === 0) return 0

  let inserted = 0
  for (let index = 0; index < rows.length; index += INSERT_CHUNK_SIZE) {
    const chunk = rows.slice(index, index + INSERT_CHUNK_SIZE)
    const { error } = await supabase.from('task_instances').insert(chunk)
    if (error) {
      // A concurrent generation may have won the unique index race. Anything
      // else is a real failure.
      if (error.code === '23505') continue
      throw new Error(error.message)
    }
    inserted += chunk.length
  }

  return inserted
}

/** Create one schedule task for each template that does not have one yet. */
export async function materializeTasksFromTemplates(
  spaceId: string,
  userId: string
): Promise<number> {
  const templates = await fetchSpaceTaskTemplates(spaceId)
  if (templates.length === 0) return 0

  const { data: existing, error: existingError } = await supabase
    .from('tasks')
    .select('template_id')
    .eq('space_id', spaceId)
    .not('template_id', 'is', null)
    .is('deleted_at', null)

  if (existingError) throw new Error(existingError.message)

  const existingTemplateIds = new Set(
    ((existing ?? []) as Array<{ template_id: string | null }>)
      .map((row) => row.template_id)
      .filter((value): value is string => Boolean(value))
  )

  const rows = templates
    .filter((template) => !existingTemplateIds.has(template.id))
    .map((template) => templateToTaskRow(template, userId))

  if (rows.length === 0) return 0

  const { error } = await supabase.from('tasks').insert(rows)
  if (error) throw new Error(error.message)
  return rows.length
}

function templateToTaskRow(template: TaskTemplate, userId: string) {
  return {
    space_id: template.space_id,
    template_id: template.id,
    area_id: template.area_id,
    name: template.name,
    description: template.description,
    estimated_minutes: template.estimated_minutes,
    frequency: template.frequency,
    custom_frequency_days: template.custom_frequency_days,
    due_time: template.due_time,
    schedule_anchor_at: new Date().toISOString(),
    assignee_id: null,
    assignee_role: template.default_assignee_role,
    required_skills: template.required_skills,
    supplies_needed: template.supplies_needed,
    instructions: template.instructions,
    is_active: true,
    created_by: userId,
  }
}

export async function createTaskRecord(
  spaceId: string,
  userId: string,
  input: TaskInput
): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      space_id: spaceId,
      template_id: null,
      area_id: input.areaId,
      name: input.name,
      description: input.description,
      estimated_minutes: input.estimatedMinutes,
      frequency: input.frequency,
      custom_frequency_days: input.frequency === 'custom' ? input.customFrequencyDays : null,
      due_time: input.dueTime,
      schedule_anchor_at: new Date().toISOString(),
      assignee_id: input.assigneeId,
      assignee_role: null,
      required_skills: [],
      supplies_needed: [],
      instructions: null,
      is_active: true,
      created_by: userId,
    })
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? 'Could not create the task.')
  }

  const task = data as Task

  try {
    await saveTaskDependencies(spaceId, task.id, input.dependsOnTaskIds, userId)
  } catch (dependencyError) {
    await setTaskDeleted(task.id, true)
    throw dependencyError
  }

  return task
}

export async function updateTaskRecord(
  spaceId: string,
  taskId: string,
  userId: string,
  input: TaskInput
): Promise<Task> {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('tasks')
    .update({
      area_id: input.areaId,
      name: input.name,
      description: input.description,
      estimated_minutes: input.estimatedMinutes,
      frequency: input.frequency,
      custom_frequency_days: input.frequency === 'custom' ? input.customFrequencyDays : null,
      due_time: input.dueTime,
      schedule_anchor_at: now,
      assignee_id: input.assigneeId,
      updated_at: now,
    })
    .eq('id', taskId)
    .eq('space_id', spaceId)
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? 'Could not update the task.')
  }

  // Editing resets open work so the new repeat pattern and due time take
  // effect immediately. Completed and skipped history is never touched.
  const { error: instanceError } = await supabase
    .from('task_instances')
    .update({ deleted_at: now, updated_at: now })
    .eq('task_id', taskId)
    .in('status', OPEN_STATUSES)
    .is('deleted_at', null)

  if (instanceError) throw new Error(instanceError.message)

  await saveTaskDependencies(spaceId, taskId, input.dependsOnTaskIds, userId)
  return data as Task
}

export async function saveTaskDependencies(
  spaceId: string,
  taskId: string,
  dependsOnTaskIds: string[],
  userId: string
): Promise<void> {
  const desired = [...new Set(dependsOnTaskIds.filter((id) => id !== taskId))]
  const { data, error } = await supabase
    .from('task_dependencies')
    .select('*')
    .eq('space_id', spaceId)

  if (error) throw new Error(error.message)

  const existing = (data ?? []) as TaskDependency[]
  const activeEdges: DependencyEdge[] = existing
    .filter((row) => !row.deleted_at && row.task_id !== taskId)
    .map((row) => ({ taskId: row.task_id, dependsOnTaskId: row.depends_on_task_id }))

  const cyclic = findCyclicDependencies(activeEdges, taskId, desired)
  if (cyclic.length > 0) {
    throw new Error('That prerequisite would create a loop. Remove the circular link first.')
  }

  const now = new Date().toISOString()
  const existingByDependency = new Map(
    existing.filter((row) => row.task_id === taskId).map((row) => [row.depends_on_task_id, row])
  )

  for (const dependsOnTaskId of desired) {
    const row = existingByDependency.get(dependsOnTaskId)
    if (row) {
      if (row.deleted_at) {
        const { error: restoreError } = await supabase
          .from('task_dependencies')
          .update({ deleted_at: null, updated_at: now })
          .eq('id', row.id)
        if (restoreError) throw new Error(restoreError.message)
      }
      continue
    }

    const { error: insertError } = await supabase.from('task_dependencies').insert({
      space_id: spaceId,
      task_id: taskId,
      depends_on_task_id: dependsOnTaskId,
      created_by: userId,
    })
    if (insertError) throw new Error(insertError.message)
  }

  for (const row of existing) {
    if (row.task_id !== taskId || row.deleted_at) continue
    if (desired.includes(row.depends_on_task_id)) continue
    const { error: removeError } = await supabase
      .from('task_dependencies')
      .update({ deleted_at: now, updated_at: now })
      .eq('id', row.id)
    if (removeError) throw new Error(removeError.message)
  }
}

export async function setTaskActive(taskId: string, active: boolean): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('tasks')
    .update({
      is_active: active,
      updated_at: now,
      ...(active ? { schedule_anchor_at: now } : {}),
    })
    .eq('id', taskId)

  if (error) throw new Error(error.message)

  if (!active) {
    // Pausing hides the task from Today, so clear its open work too. History
    // stays, and resuming starts a fresh recurrence from now.
    const { error: instanceError } = await supabase
      .from('task_instances')
      .update({ deleted_at: now, updated_at: now })
      .eq('task_id', taskId)
      .in('status', OPEN_STATUSES)
      .is('deleted_at', null)

    if (instanceError) throw new Error(instanceError.message)
  }
}

export async function setTaskDeleted(taskId: string, deleted: boolean): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('tasks')
    .update({
      deleted_at: deleted ? now : null,
      is_active: !deleted,
      updated_at: now,
      ...(deleted ? {} : { schedule_anchor_at: now }),
    })
    .eq('id', taskId)

  if (error) throw new Error(error.message)

  if (deleted) {
    const { error: instanceError } = await supabase
      .from('task_instances')
      .update({ deleted_at: now, updated_at: now })
      .eq('task_id', taskId)
      .in('status', OPEN_STATUSES)
      .is('deleted_at', null)

    if (instanceError) throw new Error(instanceError.message)
  }
}

export async function completeTaskInstance(
  instanceId: string,
  notes?: string
): Promise<TaskInstance> {
  const { data, error } = await supabase.rpc('complete_task_instance', {
    p_instance_id: instanceId,
    p_notes: notes ?? null,
    p_duration_minutes: null,
  })

  if (error || !data) {
    throw new Error(error?.message ?? 'Could not complete the task.')
  }
  return data as TaskInstance
}

export async function undoTaskCompletion(instanceId: string): Promise<TaskInstance> {
  const { data, error } = await supabase.rpc('undo_task_completion', {
    p_instance_id: instanceId,
  })

  if (error || !data) {
    throw new Error(error?.message ?? 'Could not undo the completion.')
  }
  return data as TaskInstance
}

export async function skipTaskInstance(
  instanceId: string,
  reason?: string
): Promise<TaskInstance> {
  const { data, error } = await supabase.rpc('skip_task_instance', {
    p_instance_id: instanceId,
    p_reason: reason ?? null,
  })

  if (error || !data) {
    throw new Error(error?.message ?? 'Could not skip the task.')
  }
  return data as TaskInstance
}

export async function reopenTaskInstance(instanceId: string): Promise<TaskInstance> {
  const { data, error } = await supabase.rpc('reopen_task_instance', {
    p_instance_id: instanceId,
  })

  if (error || !data) {
    throw new Error(error?.message ?? 'Could not reopen the task.')
  }
  return data as TaskInstance
}

export async function freshStartSpace(spaceId: string): Promise<number> {
  const { data, error } = await supabase.rpc('fresh_start_space', { p_space_id: spaceId })
  if (error) throw new Error(error.message)
  return typeof data === 'number' ? data : 0
}

export async function fetchAreaTaskInstances(areaId: string): Promise<TaskInstance[]> {
  const tasks = await fetchTasksForArea(areaId, true)
  if (tasks.length === 0) return []
  const taskIds = tasks.map((task) => task.id)
  const now = new Date()
  const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const to = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString()

  const [openResult, recentResult] = await Promise.all([
    supabase
      .from('task_instances')
      .select('*')
      .in('task_id', taskIds)
      .in('status', OPEN_STATUSES)
      .is('deleted_at', null)
      .order('due_at', { ascending: true })
      .limit(300),
    supabase
      .from('task_instances')
      .select('*')
      .in('task_id', taskIds)
      .gte('due_at', from)
      .lt('due_at', to)
      .is('deleted_at', null)
      .order('due_at', { ascending: true })
      .limit(300),
  ])

  if (openResult.error) throw new Error(openResult.error.message)
  if (recentResult.error) throw new Error(recentResult.error.message)

  return mergeInstances(
    (openResult.data ?? []) as TaskInstance[],
    (recentResult.data ?? []) as TaskInstance[]
  )
}

export async function fetchTaskHistory(
  spaceId: string,
  options: { taskIds?: string[]; limit?: number } = {}
): Promise<TaskHistoryEntry[]> {
  const limit = options.limit ?? 100
  const tasks = await fetchTasks(spaceId, true, true)
  const taskById = new Map(tasks.map((task) => [task.id, task]))
  const allowedIds = options.taskIds ? new Set(options.taskIds) : null

  let query = supabase
    .from('task_instances')
    .select('*')
    .eq('space_id', spaceId)
    .in('status', ['completed', 'skipped'])
    .is('deleted_at', null)
    .order('due_at', { ascending: false })
    .limit(limit)

  if (options.taskIds) {
    if (options.taskIds.length === 0) return []
    query = query.in('task_id', options.taskIds)
  }

  const { data: instances, error } = await query
  if (error) throw new Error(error.message)

  const rows = ((instances ?? []) as TaskInstance[]).filter((instance) => {
    const task = taskById.get(instance.task_id)
    return Boolean(task) && (!allowedIds || allowedIds.has(instance.task_id))
  })

  if (rows.length === 0) return []

  const instanceIds = rows.map((instance) => instance.id)
  const [completionResult, members, areas] = await Promise.all([
    supabase
      .from('task_completions')
      .select('*')
      .in('task_instance_id', instanceIds)
      .is('deleted_at', null)
      .order('completed_at', { ascending: false }),
    fetchSpaceMembers(spaceId),
    fetchAreas(spaceId, true),
  ])

  if (completionResult.error) throw new Error(completionResult.error.message)

  const completionByInstance = new Map<string, TaskCompletion>()
  for (const completion of (completionResult.data ?? []) as TaskCompletion[]) {
    if (!completionByInstance.has(completion.task_instance_id)) {
      completionByInstance.set(completion.task_instance_id, completion)
    }
  }

  const memberNameById = new Map(
    members.map((member) => [
      member.membership.user_id,
      member.profile?.full_name?.trim() || 'Member',
    ])
  )
  const areaById = new Map<string, Area>(areas.map((area) => [area.id, area]))

  const entries: TaskHistoryEntry[] = rows.map((instance) => {
    const task = taskById.get(instance.task_id)
    const completion = completionByInstance.get(instance.id) ?? null
    return {
      instance,
      task: task as Task,
      areaName: task?.area_id ? areaById.get(task.area_id)?.name ?? null : null,
      completion,
      completedByName: completion ? memberNameById.get(completion.user_id) ?? 'Member' : null,
    }
  })

  return entries
    .sort((a, b) => historyTimestamp(b) - historyTimestamp(a))
    .slice(0, limit)
}

function historyTimestamp(entry: TaskHistoryEntry): number {
  const value =
    entry.completion?.completed_at ?? entry.instance.skipped_at ?? entry.instance.due_at
  return new Date(value).getTime()
}

export async function fetchAreaHistory(
  spaceId: string,
  areaId: string,
  limit = 20
): Promise<TaskHistoryEntry[]> {
  const tasks = await fetchTasksForArea(areaId, true, true)
  return fetchTaskHistory(spaceId, { taskIds: tasks.map((task) => task.id), limit })
}
