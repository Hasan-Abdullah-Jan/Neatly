import { z } from 'zod'

const frequencySchema = z.enum([
  'daily',
  'weekly',
  'biweekly',
  'monthly',
  'quarterly',
  'yearly',
  'custom',
])

const membershipRoleSchema = z.enum([
  'owner',
  'admin',
  'supervisor',
  'member',
  'cleaner',
  'auditor',
])

const taskSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, 'Every task needs a name'),
  description: z.string().optional(),
  frequency: frequencySchema,
  customFrequencyDays: z.number().int().positive().optional(),
  estimatedMinutes: z.number().int().positive().max(1440),
  defaultAssigneeRole: membershipRoleSchema.optional(),
  requiredSkills: z.array(z.string()).optional(),
  suppliesNeeded: z.array(z.string()).optional(),
  instructions: z.string().optional(),
})

const areaSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, 'Every area needs a name'),
  category: z.string().min(1),
  description: z.string(),
  parentId: z.string().nullable(),
  sortOrder: z.number().int(),
  isCustom: z.boolean(),
  archived: z.boolean(),
  suggestedTasks: z.array(taskSchema),
  selectedTasks: z.array(z.string()),
})

export const activationSchema = z.object({
  profile: z.object({
    spaceType: z.enum(['personal', 'shared_home', 'workplace', 'institution', 'healthcare', 'custom']),
    name: z.string().trim().min(2, 'Space name must be at least 2 characters'),
    timezone: z.string().trim().min(1, 'Choose a timezone'),
    building: z.string(),
    floor: z.string(),
    zone: z.string(),
  }),
  areas: z.array(areaSchema).min(1, 'Add at least one area before activating'),
  invitations: z.array(
    z.object({
      id: z.string(),
      email: z.string().trim().email('Check the invitation email address'),
      role: membershipRoleSchema,
      message: z.string().optional(),
    })
  ),
  modules: z.record(z.string(), z.boolean()),
  reminderDefaults: z.object({
    taskReminders: z.boolean(),
    taskOverdue: z.boolean(),
    dailySummary: z.boolean(),
    weeklySummary: z.boolean(),
  }),
})

export type ActivationInput = z.infer<typeof activationSchema>
