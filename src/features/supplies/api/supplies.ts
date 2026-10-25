import { supabase } from '@lib/supabase'
import type { SupplyItem, SupplyRequest, SupplyItemInsert, SupplyItemUpdate, SupplyRequestInsert } from '@/types/database'

export async function getSupplyItems(spaceId: string): Promise<SupplyItem[]> {
  const { data, error } = await supabase
    .from('supply_items')
    .select('*')
    .eq('space_id', spaceId)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (error) throw error
  return data || []
}

export async function getSupplyItem(id: string): Promise<SupplyItem | null> {
  const { data, error } = await supabase
    .from('supply_items')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error) throw error
  return data
}

export async function createSupplyItem(
  item: Omit<SupplyItemInsert, 'space_id' | 'created_by'>
): Promise<SupplyItem> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('supply_items')
    .insert({
      ...item,
      space_id: user.user_metadata.currentSpaceId,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateSupplyItem(
  id: string,
  updates: Partial<SupplyItemUpdate>
): Promise<SupplyItem> {
  const { data, error } = await supabase
    .from('supply_items')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateQuantity(
  id: string,
  delta: number
): Promise<SupplyItem> {
  const { data, error } = await (supabase.rpc as any)('update_supply_quantity', {
    p_item_id: id,
    p_delta: delta,
  })

  if (error) throw error
  return data as SupplyItem
}

export async function markLowStock(id: string): Promise<SupplyItem> {
  const { data, error } = await (supabase.rpc as any)('mark_supply_low', {
    p_item_id: id,
  })

  if (error) throw error
  return data as SupplyItem
}

export async function deleteSupplyItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('supply_items')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error
}

export async function getSupplyRequests(spaceId: string): Promise<SupplyRequest[]> {
  const { data, error } = await supabase
    .from('supply_requests')
    .select('*, requested_by:profiles(full_name), approved_by:profiles(full_name), fulfilled_by:profiles(full_name)')
    .eq('space_id', spaceId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function createSupplyRequest(
  request: Omit<SupplyRequestInsert, 'space_id' | 'requested_by' | 'status'>
): Promise<SupplyRequest> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('supply_requests')
    .insert({
      ...request,
      space_id: user.user_metadata.currentSpaceId,
      requested_by: user.id,
      status: 'pending',
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function approveRequest(
  id: string,
  note?: string
): Promise<SupplyRequest> {
  const { data, error } = await (supabase.rpc as any)('approve_supply_request', {
    p_request_id: id,
    p_note: note || null,
  })

  if (error) throw error
  return data as SupplyRequest
}

export async function rejectRequest(
  id: string,
  note?: string
): Promise<SupplyRequest> {
  const { data, error } = await (supabase.rpc as any)('reject_supply_request', {
    p_request_id: id,
    p_note: note || null,
  })

  if (error) throw error
  return data as SupplyRequest
}

export async function markFulfilled(
  id: string,
  note?: string
): Promise<SupplyRequest> {
  const { data, error } = await (supabase.rpc as any)('fulfill_supply_request', {
    p_request_id: id,
    p_note: note || null,
  })

  if (error) throw error
  return data as SupplyRequest
}

export async function getShoppingList(spaceId: string): Promise<SupplyItem[]> {
  const { data, error } = await supabase
    .from('supply_items')
    .select('*')
    .eq('space_id', spaceId)
    .is('deleted_at', null)
    .lte('quantity', 'min_quantity')
    .order('name', { ascending: true })

  if (error) throw error
  return data || []
}

export async function recordPurchase(
  itemId: string,
  quantityPurchased: number,
  note?: string
): Promise<SupplyItem> {
  const { data, error } = await (supabase.rpc as any)('record_supply_purchase', {
    p_item_id: itemId,
    p_quantity_purchased: quantityPurchased,
    p_note: note || null,
  })

  if (error) throw error
  return data as SupplyItem
}
