import { describe, expect, it } from 'vitest'
import { createDemoState, demoReducer, loadDemoState } from './demoState'

describe('demo sandbox', () => {
  it('seeds a five-area organization with unique QR codes and sample operational records', () => {
    const state = createDemoState()
    const organization = state.organization

    expect(organization.areas).toHaveLength(5)
    expect(new Set(organization.areas.map((area) => area.qrToken)).size).toBe(5)
    expect(organization.members.map((member) => member.role)).toEqual(['cleaner', 'supervisor', 'admin'])
    expect(organization.issue.status).toBe('open')
    expect(organization.supplyRequest.status).toBe('pending')
    expect(organization.tasks.some((task) => task.overdueCount >= 3)).toBe(true)
    expect(organization.recommendation.reason).toContain('3 times in 14 days')
  })

  it('walks through apartment, task, low supply, organization, checklist, issue, and recommendation actions', () => {
    let state = demoReducer(createDemoState(), { type: 'start' })
    state = demoReducer(state, { type: 'create_apartment' })
    expect(state.personal.areas).toEqual(['Kitchen', 'Bathroom', 'Living room', 'Storage'])
    expect(state.personal.tasks.map((task) => task.frequency)).toEqual(['Daily', 'Weekly', 'Monthly'])
    expect(state.personal.history).toHaveLength(3)

    state = demoReducer(state, { type: 'complete_personal_task' })
    expect(state.personal.tasks.find((task) => task.id === 'home-kitchen')?.status).toBe('completed')
    expect(state.personal.history[0]).toContain('Today')

    state = demoReducer(state, { type: 'add_low_supply' })
    expect(state.personal.supplies.find((item) => item.name === 'Cleaning solution')).toMatchObject({ quantity: 1, threshold: 2 })
    state = demoReducer(state, { type: 'switch_to_org' })
    state = demoReducer(state, { type: 'assign_task' })
    state = demoReducer(state, { type: 'scan_qr' })
    expect(state.organization.scannedAreaId).toBe('org-kitchen')
    state = demoReducer(state, { type: 'complete_checklist' })
    expect(state.organization.checklist.every((item) => item.done)).toBe(true)
    expect(state.organization.tasks.find((task) => task.id === 'org-restroom-task')?.verificationStatus).toBe('pending')

    state = demoReducer(state, { type: 'verify_task' })
    expect(state.organization.tasks.find((task) => task.id === 'org-restroom-task')?.verifiedBy).toBe('Jordan Supervisor')
    state = demoReducer(state, { type: 'report_issue' })
    state = demoReducer(state, { type: 'assign_issue' })
    state = demoReducer(state, { type: 'resolve_issue' })
    expect(state.organization.issue.status).toBe('resolved')
    state = demoReducer(state, { type: 'open_dashboard' })
    state = demoReducer(state, { type: 'recommendation_edit', title: 'Split the storage check' })
    expect(state.organization.dashboardOpened).toBe(true)
    expect(state.organization.recommendation).toMatchObject({ title: 'Split the storage check', status: 'edited' })
    expect(state.stepIndex).toBe(12)
  })

  it('links requested rework to the submitted task and resets to a fresh sandbox', () => {
    let state = demoReducer(createDemoState(), { type: 'start' })
    state = demoReducer(state, { type: 'create_apartment' })
    state = demoReducer(state, { type: 'complete_personal_task' })
    state = demoReducer(state, { type: 'add_low_supply' })
    state = demoReducer(state, { type: 'switch_to_org' })
    state = demoReducer(state, { type: 'assign_task' })
    state = demoReducer(state, { type: 'scan_qr' })
    state = demoReducer(state, { type: 'complete_checklist' })
    state = demoReducer(state, { type: 'request_rework' })

    const rework = state.organization.tasks.find((task) => task.id === 'org-restroom-rework')
    expect(rework).toMatchObject({ originalTaskId: 'org-restroom-task', status: 'pending' })
    expect(state.organization.tasks.find((task) => task.id === 'org-restroom-task')?.verificationStatus).toBe('rework_requested')

    const reset = demoReducer(state, { type: 'reset' })
    expect(reset.started).toBe(false)
    expect(reset.personal.created).toBe(false)
    expect(reset.organization.issue.status).toBe('open')
  })

  it('rejects invalid saved demo data instead of silently continuing with a broken sandbox', () => {
    expect(() => loadDemoState('{')).toThrow()
    expect(() => loadDemoState(JSON.stringify({ version: 2 }))).toThrow('Saved demo data is invalid')
  })
})
