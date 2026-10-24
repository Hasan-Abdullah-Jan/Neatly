const categoryLabels: Record<string, string> = {
  kitchen: 'Kitchen',
  bathroom: 'Bathroom',
  bedroom: 'Bedroom',
  living: 'Living area',
  dining: 'Dining',
  office: 'Office',
  laundry: 'Laundry',
  entry: 'Entryway',
  hallway: 'Hallway',
  storage: 'Storage',
  garden: 'Garden / yard',
  reception: 'Reception',
  meeting: 'Meeting room',
  waiting: 'Waiting room',
  exam: 'Exam room',
  classroom: 'Classroom',
  common: 'Common area',
  custom: 'Custom',
}

export function areaCategoryLabel(category: string | null): string {
  if (!category) return 'Uncategorized'
  return categoryLabels[category] ?? category
}

export function formatFrequency(
  frequency: string,
  customDays: number | null,
  isOneOff = false
): string {
  if (isOneOff) return 'One-off'
  switch (frequency) {
    case 'daily':
      return 'Daily'
    case 'weekly':
      return 'Weekly'
    case 'biweekly':
      return 'Every 2 weeks'
    case 'monthly':
      return 'Monthly'
    case 'quarterly':
      return 'Quarterly'
    case 'yearly':
      return 'Yearly'
    case 'custom':
      return customDays && customDays > 0 ? `Every ${customDays} days` : 'Custom interval'
    default:
      return frequency
  }
}
