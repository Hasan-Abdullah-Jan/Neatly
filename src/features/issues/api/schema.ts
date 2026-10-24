import { z } from 'zod'
import type { IssueCategory, IssuePriority, IssueStatus } from '@/types/database'

export const issueCategoryValues = [
  'cleanliness',
  'facility',
  'supplies',
  'organization',
  'outdoor',
  'other',
  'custom',
] as const

export const issuePriorityValues = ['low', 'medium', 'high', 'urgent'] as const

export const issueCategoryLabels: Record<IssueCategory, string> = {
  cleanliness: 'Cleanliness',
  facility: 'Facility / Maintenance',
  supplies: 'Supplies',
  organization: 'Organization',
  outdoor: 'Outdoor / Plant',
  other: 'Other',
  custom: 'Custom',
}

export const issuePriorityLabels: Record<IssuePriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
}

export const issueStatusLabels: Record<IssueStatus, string> = {
  reported: 'Open',
  acknowledged: 'Assigned',
  in_progress: 'In progress',
  resolved: 'Resolved',
  closed: 'Verified / Closed',
  reopened: 'Reopened',
}

export const openIssueStatuses: IssueStatus[] = [
  'reported',
  'acknowledged',
  'in_progress',
  'reopened',
]

export function isOpenIssueStatus(status: IssueStatus): boolean {
  return openIssueStatuses.includes(status)
}

export function issueCategoryLabel(
  category: IssueCategory,
  customCategory: string | null
): string {
  if (category === 'custom') {
    return customCategory?.trim() || 'Custom'
  }
  return issueCategoryLabels[category]
}

export const ISSUE_PHOTO_MAX_BYTES = 5 * 1024 * 1024
export const ISSUE_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const ISSUE_PHOTO_GUIDANCE = 'Avoid including people or identifying details.'
export const MAX_ISSUE_PHOTOS = 5

const isoDateSchema = z
  .string()
  .refine((value) => Number.isFinite(Date.parse(value)), 'Use a valid date and time.')

export const issueReportSchema = z
  .object({
    areaId: z.string().uuid().nullable(),
    category: z.enum(issueCategoryValues),
    customCategory: z.string().trim().max(60, 'Keep the category name under 60 characters.'),
    description: z
      .string()
      .trim()
      .min(3, 'Add a few words so someone knows what needs attention.')
      .max(2000, 'Keep the description under 2,000 characters.'),
    priority: z.enum(issuePriorityValues),
    dueAt: isoDateSchema.nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.category === 'custom' && value.customCategory.trim().length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['customCategory'],
        message: 'Name the custom category.',
      })
    }
  })

export type IssueReportInput = z.infer<typeof issueReportSchema>

export const issueAssignmentTypes = ['unassigned', 'person', 'team', 'external'] as const
export type IssueAssignmentType = (typeof issueAssignmentTypes)[number]

export const issueAssignSchema = z
  .object({
    type: z.enum(issueAssignmentTypes),
    personId: z.string().uuid().nullable(),
    teamId: z.string().uuid().nullable(),
    externalService: z.string().trim().max(120, 'Keep the service name under 120 characters.'),
    dueDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a valid date.')
      .nullable(),
    note: z.string().trim().max(1000, 'Keep the note under 1,000 characters.'),
  })
  .superRefine((value, ctx) => {
    if (value.type === 'person' && !value.personId) {
      ctx.addIssue({
        code: 'custom',
        path: ['personId'],
        message: 'Choose a person.',
      })
    }
    if (value.type === 'team' && !value.teamId) {
      ctx.addIssue({
        code: 'custom',
        path: ['teamId'],
        message: 'Choose a team.',
      })
    }
    if (value.type === 'external' && value.externalService.trim().length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['externalService'],
        message: 'Name the external service.',
      })
    }
  })

export type IssueAssignInput = z.infer<typeof issueAssignSchema>

export const issueRequiredNoteSchema = z
  .string()
  .trim()
  .min(3, 'Add a short note so the timeline explains what changed.')
  .max(2000, 'Keep the note under 2,000 characters.')

export const issueOptionalNoteSchema = z
  .string()
  .trim()
  .max(2000, 'Keep the note under 2,000 characters.')

export const issueCommentSchema = z
  .string()
  .trim()
  .min(1, 'Write a comment first.')
  .max(2000, 'Keep the comment under 2,000 characters.')

export function firstIssueMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Check the details and try again.'
}

export function deriveIssueTitle(input: IssueReportInput, areaName: string | null): string {
  const firstLine = input.description.split('\n')[0]?.trim() ?? ''
  if (firstLine.length > 0) return firstLine.slice(0, 160)
  const category = issueCategoryLabel(input.category, input.customCategory)
  return areaName ? `${category} in ${areaName}`.slice(0, 160) : category
}
