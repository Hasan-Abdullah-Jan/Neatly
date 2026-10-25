import type { Json } from '@/types/database'

export interface PrivacyExport {
  exported_at: string
  [key: string]: Json
}

function isJsonRecord(value: Json): value is { [key: string]: Json } {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isPrivacyExport(value: Json): value is PrivacyExport {
  return isJsonRecord(value) && typeof value.exported_at === 'string'
}

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`
}

export function privacyExportCsv(data: PrivacyExport): string {
  const rows: string[][] = [['record_type', 'record_json']]
  for (const [recordType, value] of Object.entries(data)) {
    if (!Array.isArray(value)) continue
    for (const record of value) rows.push([recordType, JSON.stringify(record)])
  }
  if (data.profile && !Array.isArray(data.profile)) {
    rows.push(['profile', JSON.stringify(data.profile)])
  }
  rows.push(['exported_at', data.exported_at])
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n')
}
