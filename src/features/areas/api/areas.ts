import { supabase } from '@lib/supabase'
import type { Area, AreaUpdate, TaskTemplate } from '@/types/database'

export async function fetchAreas(spaceId: string, includeArchived = false): Promise<Area[]> {
  let query = supabase
    .from('areas')
    .select('*')
    .eq('space_id', spaceId)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })

  if (!includeArchived) {
    query = query.eq('active', true)
  }

  const { data, error } = await query

  if (error) throw new Error(error.message)
  return (data ?? []) as Area[]
}

export async function fetchArea(areaId: string): Promise<Area | null> {
  const { data, error } = await supabase
    .from('areas')
    .select('*')
    .eq('id', areaId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return (data as Area | null) ?? null
}

export async function fetchAreaTaskTemplates(areaId: string): Promise<TaskTemplate[]> {
  const { data, error } = await supabase
    .from('task_templates')
    .select('*')
    .eq('area_id', areaId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as TaskTemplate[]
}

export async function fetchSpaceTaskTemplates(spaceId: string): Promise<TaskTemplate[]> {
  const { data, error } = await supabase
    .from('task_templates')
    .select('*')
    .eq('space_id', spaceId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as TaskTemplate[]
}

export async function createAreaRecord(input: {
  spaceId: string
  name: string
  category: string
  parentAreaId?: string | null
  sortOrder: number
}): Promise<Area> {
  const { data, error } = await supabase
    .from('areas')
    .insert({
      space_id: input.spaceId,
      parent_area_id: input.parentAreaId ?? null,
      name: input.name.trim(),
      category: input.category,
      sort_order: input.sortOrder,
      active: true,
    })
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? 'Could not create the area.')
  }
  return data as Area
}

export async function updateAreaRecord(areaId: string, updates: AreaUpdate): Promise<void> {
  const { error } = await supabase
    .from('areas')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', areaId)

  if (error) throw new Error(error.message)
}

export async function setAreaArchived(areaId: string, archived: boolean): Promise<void> {
  await updateAreaRecord(areaId, { active: !archived })
}

export async function deleteAreaRecord(areaId: string): Promise<void> {
  const { error } = await supabase
    .from('areas')
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', areaId)

  if (error) throw new Error(error.message)
}
