import { describe, expect, it } from 'vitest'
import { activationSchema } from './schema'

const validArea = {
  id: 'area-1',
  name: 'Kitchen',
  category: 'kitchen',
  description: '',
  parentId: null,
  sortOrder: 1,
  isCustom: false,
  archived: false,
  suggestedTasks: [
    {
      id: 'task-1',
      name: 'Wipe counters',
      frequency: 'daily' as const,
      estimatedMinutes: 10,
    },
  ],
  selectedTasks: ['task-1'],
}

const validInput = {
  profile: {
    spaceType: 'personal' as const,
    name: 'My home',
    timezone: 'Europe/London',
    building: '',
    floor: '',
    zone: '',
  },
  areas: [validArea],
  invitations: [],
  modules: { tasks: true, areas: true },
  reminderDefaults: {
    taskReminders: true,
    taskOverdue: true,
    dailySummary: false,
    weeklySummary: true,
  },
}

describe('activationSchema', () => {
  it('accepts a complete plan', () => {
    const result = activationSchema.safeParse(validInput)
    expect(result.success).toBe(true)
  })

  it('rejects a missing space name', () => {
    const result = activationSchema.safeParse({
      ...validInput,
      profile: { ...validInput.profile, name: ' ' },
    })
    expect(result.success).toBe(false)
  })

  it('rejects an empty plan', () => {
    const result = activationSchema.safeParse({ ...validInput, areas: [] })
    expect(result.success).toBe(false)
  })

  it('rejects an invalid invitation email', () => {
    const result = activationSchema.safeParse({
      ...validInput,
      invitations: [{ id: 'invite-1', email: 'not-an-email', role: 'member' }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-positive task estimates', () => {
    const result = activationSchema.safeParse({
      ...validInput,
      areas: [
        {
          ...validArea,
          suggestedTasks: [
            {
              id: 'task-1',
              name: 'Wipe counters',
              frequency: 'daily',
              estimatedMinutes: 0,
            },
          ],
        },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('rejects an unsupported space type', () => {
    const result = activationSchema.safeParse({
      ...validInput,
      profile: { ...validInput.profile, spaceType: 'spaceship' },
    })
    expect(result.success).toBe(false)
  })
})
