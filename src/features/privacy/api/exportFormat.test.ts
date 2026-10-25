import { describe, expect, it } from 'vitest'
import { isPrivacyExport, privacyExportCsv } from './exportFormat'

describe('privacy export format', () => {
  it('accepts only structured exports with an export timestamp', () => {
    expect(isPrivacyExport({ exported_at: '2026-10-25T10:00:00Z', profile: { full_name: 'Example' } })).toBe(true)
    expect(isPrivacyExport({ exported_at: 42 })).toBe(false)
    expect(isPrivacyExport(null)).toBe(false)
  })

  it('writes each record as escaped CSV and includes the profile and timestamp', () => {
    const csv = privacyExportCsv({
      exported_at: '2026-10-25T10:00:00Z',
      profile: { full_name: 'Example "A"' },
      task_completions: [{ task_instance_id: 'task-1' }],
      memberships: [],
    })

    expect(csv).toContain('"record_type","record_json"')
    expect(csv).toContain('"profile","{""full_name"":""Example \\""A\\""""}"')
    expect(csv).toContain('"task_completions","{""task_instance_id"":""task-1""}"')
    expect(csv).toContain('"exported_at","2026-10-25T10:00:00Z"')
  })
})
