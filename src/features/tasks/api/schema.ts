import { z } from 'zod'

const frequencyValues = [
  'daily',
  'weekly',
  'biweekly',
  'monthly',
  'quarterly',
  'yearly',
  'custom',
] as const

const nullableUuid = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim() || null : value),
  z.string().uuid().nullable()
)

export const taskInputSchema = z
  .object({
    name: z.string().trim().min(1, 'Give the task a name.').max(120, 'Keep the name under 120 characters.'),
    areaId: nullableUuid,
    frequency: z.enum(frequencyValues),
    customFrequencyDays: z.number().int().min(1).max(365).nullable(),
    dueTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a 24-hour time such as 09:00.'),
    estimatedMinutes: z.number().int().min(1).max(1440).nullable(),
    assigneeId: nullableUuid,
    assigneeRole: z.enum(['owner', 'admin', 'supervisor', 'member', 'cleaner', 'auditor']).nullable(),
    assigneeTeamId: nullableUuid,
    rotationMemberIds: z.array(z.string().trim().uuid()).max(100).default([]),
    description: z.string().trim().max(2000, 'Keep notes under 2,000 characters.').nullable(),
    dependsOnTaskIds: z.array(z.string().uuid()).max(20, 'Choose no more than 20 prerequisites.'),
  })
  .superRefine((value, ctx) => {
    if (value.frequency === 'custom' && !value.customFrequencyDays) {
      ctx.addIssue({
        code: 'custom',
        path: ['customFrequencyDays'],
        message: 'Choose how many days between custom occurrences.',
      })
    }
  })

export type TaskInput = z.infer<typeof taskInputSchema>

export function firstTaskIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Check the task details.'
}
