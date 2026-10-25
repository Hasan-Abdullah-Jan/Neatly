import { supabase } from '@lib/supabase'
import { isPrivacyExport, privacyExportCsv, type PrivacyExport } from './exportFormat'

export async function exportMyData(): Promise<PrivacyExport> {
  const { data, error } = await supabase.rpc('get_my_privacy_export')
  if (error) throw error
  if (!isPrivacyExport(data)) {
    throw new Error('The privacy export returned an unexpected response.')
  }
  return data
}

function downloadFile(filename: string, contents: string, type: string): void {
  const file = new Blob([contents], { type })
  const objectUrl = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = filename
  link.click()
  URL.revokeObjectURL(objectUrl)
}

export async function downloadPrivacyExport(format: 'json' | 'csv'): Promise<void> {
  const data = await exportMyData()
  const date = new Date().toISOString().slice(0, 10)
  if (format === 'json') {
    downloadFile(`neatly-data-export-${date}.json`, JSON.stringify(data, null, 2), 'application/json')
    return
  }
  downloadFile(`neatly-data-export-${date}.csv`, privacyExportCsv(data), 'text/csv;charset=utf-8')
}

export async function deleteMyAccount(): Promise<void> {
  const { data, error } = await supabase.functions.invoke('delete-account', {
    body: { confirmation: 'DELETE' },
  })
  if (error) throw error
  if (!data || data.deleted !== true) {
    throw new Error('Account deletion did not complete. Your account is unchanged.')
  }
  const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' })
  if (signOutError) throw signOutError
}
