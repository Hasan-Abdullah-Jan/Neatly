import { supabase } from '@lib/supabase'

export interface ChecklistItem {
  id: string
  space_id: string
  task_id: string
  label: string
  position: number
  created_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface ChecklistResult {
  id: string
  space_id: string
  task_instance_id: string
  checklist_item_id: string
  label_snapshot: string
  status: 'done' | 'not_applicable' | 'problem'
  note: string | null
  issue_id: string | null
  actor_user_id: string
  created_at: string
  updated_at: string
}

export async function getChecklistItems(taskId: string): Promise<ChecklistItem[]> {
  const { data, error } = await supabase
    .from('task_checklist_items')
    .select('*')
    .eq('task_id', taskId)
    .is('deleted_at', null)
    .order('position', { ascending: true })

  if (error) throw error
  return data || []
}

export async function getChecklistResults(instanceId: string): Promise<ChecklistResult[]> {
  const { data, error } = await supabase
    .from('task_checklist_results')
    .select('*')
    .eq('task_instance_id', instanceId)

  if (error) throw error
  return data || []
}

export async function replaceChecklist(taskId: string, labels: string[]): Promise<void> {
  const { error } = await supabase.rpc('replace_task_checklist', {
    p_task_id: taskId,
    p_labels: labels,
  })

  if (error) throw error
}

export async function saveChecklistResult(
  instanceId: string,
  checklistItemId: string,
  status: 'done' | 'not_applicable' | 'problem',
  note?: string,
  issueId?: string,
  deviceSessionToken?: string
): Promise<ChecklistResult> {
  const { data, error } = await supabase.rpc('save_checklist_result', {
    p_instance_id: instanceId,
    p_checklist_item_id: checklistItemId,
    p_status: status,
    p_note: note || null,
    p_issue_id: issueId || null,
    p_device_session_token: deviceSessionToken || null,
  })

  if (error) throw error
  return data
}
