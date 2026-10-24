import type { SpaceType } from '@/types/database'

export interface TemplateArea {
  name: string
  category: string
  description?: string
  suggestedTasks: TemplateTask[]
  sortOrder: number
}

export interface TemplateTask {
  name: string
  description?: string
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom'
  customFrequencyDays?: number
  estimatedMinutes: number
  defaultAssigneeRole?: 'owner' | 'admin' | 'supervisor' | 'member' | 'cleaner' | 'auditor'
  requiredSkills?: string[]
  suppliesNeeded?: string[]
  instructions?: string
}

export interface TemplatePack {
  id: string
  spaceType: SpaceType
  label: string
  description: string
  icon: string
  suggestedAreas: TemplateArea[]
  defaultModules: Record<string, boolean>
  reminderDefaults: {
    taskReminders: boolean
    taskOverdue: boolean
    dailySummary: boolean
    weeklySummary: boolean
  }
}

export const TEMPLATE_PACKS: Record<SpaceType, TemplatePack> = {
  personal: {
    id: 'personal',
    spaceType: 'personal',
    label: 'Personal Home',
    description: 'For one person managing their own space. Simple, flexible, no pressure.',
    icon: '🏠',
    suggestedAreas: [
      {
        name: 'Kitchen',
        category: 'kitchen',
        description: 'Where food happens',
        sortOrder: 1,
        suggestedTasks: [
          { name: 'Daily kitchen reset', description: 'Wipe counters, load dishwasher, take out trash', frequency: 'daily', estimatedMinutes: 10 },
          { name: 'Clean sink & faucet', description: 'Scrub sink, shine faucet', frequency: 'daily', estimatedMinutes: 3 },
          { name: 'Wipe appliance fronts', description: 'Fridge, oven, microwave, dishwasher', frequency: 'weekly', estimatedMinutes: 8 },
          { name: 'Clean microwave interior', frequency: 'weekly', estimatedMinutes: 5 },
          { name: 'Clean fridge shelves', description: 'Toss expired, wipe shelves', frequency: 'monthly', estimatedMinutes: 15 },
          { name: 'Deep clean oven', frequency: 'monthly', estimatedMinutes: 20 },
          { name: 'Descale kettle/coffee maker', frequency: 'quarterly', estimatedMinutes: 10 },
        ],
      },
      {
        name: 'Bathroom',
        category: 'bathroom',
        description: 'Keep it fresh',
        sortOrder: 2,
        suggestedTasks: [
          { name: 'Daily shower squeegee', description: 'Prevent buildup on glass', frequency: 'daily', estimatedMinutes: 2 },
          { name: 'Wipe sink & counter', frequency: 'daily', estimatedMinutes: 3 },
          { name: 'Clean toilet', frequency: 'weekly', estimatedMinutes: 8 },
          { name: 'Clean shower/tub', frequency: 'weekly', estimatedMinutes: 12 },
          { name: 'Wash bath mat & towels', frequency: 'weekly', estimatedMinutes: 5 },
          { name: 'Clean mirror', frequency: 'weekly', estimatedMinutes: 3 },
          { name: 'Deep clean grout', frequency: 'monthly', estimatedMinutes: 20 },
          { name: 'Descale showerhead', frequency: 'quarterly', estimatedMinutes: 10 },
        ],
      },
      {
        name: 'Bedroom',
        category: 'bedroom',
        description: 'Rest well',
        sortOrder: 3,
        suggestedTasks: [
          { name: 'Make bed', frequency: 'daily', estimatedMinutes: 2 },
          { name: 'Put away clothes', frequency: 'daily', estimatedMinutes: 5 },
          { name: 'Change sheets', frequency: 'weekly', estimatedMinutes: 10 },
          { name: 'Dust surfaces', frequency: 'weekly', estimatedMinutes: 8 },
          { name: 'Vacuum/sweep floor', frequency: 'weekly', estimatedMinutes: 10 },
          { name: 'Flip/rotate mattress', frequency: 'quarterly', estimatedMinutes: 5 },
        ],
      },
      {
        name: 'Living Area',
        category: 'living',
        description: 'Relax & unwind',
        sortOrder: 4,
        suggestedTasks: [
          { name: 'Tidy cushions & throws', frequency: 'daily', estimatedMinutes: 3 },
          { name: 'Quick vacuum high-traffic', frequency: 'daily', estimatedMinutes: 5 },
          { name: 'Dust surfaces', frequency: 'weekly', estimatedMinutes: 8 },
          { name: 'Vacuum/mop thoroughly', frequency: 'weekly', estimatedMinutes: 15 },
          { name: 'Clean glass surfaces', frequency: 'weekly', estimatedMinutes: 5 },
          { name: 'Declutter surfaces', frequency: 'weekly', estimatedMinutes: 10 },
        ],
      },
      {
        name: 'Storage/Closet',
        category: 'storage',
        description: 'Organized storage',
        sortOrder: 5,
        suggestedTasks: [
          { name: 'Return items to homes', frequency: 'weekly', estimatedMinutes: 10 },
          { name: 'Seasonal rotation', frequency: 'quarterly', estimatedMinutes: 30 },
          { name: 'Donate unused items', frequency: 'quarterly', estimatedMinutes: 20 },
        ],
      },
    ],
    defaultModules: {
      tasks: true,
      areas: true,
      supplies: true,
      issues: false,
      plants: false,
      inventory: false,
      maintenance: false,
      decluttering: false,
      reports: false,
      teams: false,
      rotation: false,
    },
    reminderDefaults: {
      taskReminders: true,
      taskOverdue: true,
      dailySummary: false,
      weeklySummary: true,
    },
  },

  shared_home: {
    id: 'shared_home',
    spaceType: 'shared_home',
    label: 'Shared Home',
    description: 'Roommates, partners, or family sharing a space. Fair rotation, clear ownership.',
    icon: '🏘️',
    suggestedAreas: [
      {
        name: 'Kitchen',
        category: 'kitchen',
        description: 'Shared cooking space',
        sortOrder: 1,
        suggestedTasks: [
          { name: 'Daily kitchen reset', frequency: 'daily', estimatedMinutes: 15, defaultAssigneeRole: 'member' },
          { name: 'Load/run dishwasher', frequency: 'daily', estimatedMinutes: 5, defaultAssigneeRole: 'member' },
          { name: 'Take out trash/compost', frequency: 'daily', estimatedMinutes: 3, defaultAssigneeRole: 'member' },
          { name: 'Wipe appliance fronts', frequency: 'weekly', estimatedMinutes: 10 },
          { name: 'Clean stove/oven', frequency: 'weekly', estimatedMinutes: 15 },
          { name: 'Clean fridge', frequency: 'monthly', estimatedMinutes: 20 },
          { name: 'Deep clean oven', frequency: 'monthly', estimatedMinutes: 25 },
        ],
      },
      {
        name: 'Bathroom(s)',
        category: 'bathroom',
        description: 'Shared bathroom routines',
        sortOrder: 2,
        suggestedTasks: [
          { name: 'Daily shower squeegee', frequency: 'daily', estimatedMinutes: 2, defaultAssigneeRole: 'member' },
          { name: 'Wipe sink/counter', frequency: 'daily', estimatedMinutes: 3, defaultAssigneeRole: 'member' },
          { name: 'Clean toilet', frequency: 'weekly', estimatedMinutes: 10 },
          { name: 'Clean shower/tub', frequency: 'weekly', estimatedMinutes: 15 },
          { name: 'Replace towels', frequency: 'weekly', estimatedMinutes: 5 },
          { name: 'Deep clean grout', frequency: 'monthly', estimatedMinutes: 20 },
        ],
      },
      {
        name: 'Common Areas',
        category: 'living',
        description: 'Living room, dining, hallway',
        sortOrder: 3,
        suggestedTasks: [
          { name: 'Daily tidy', frequency: 'daily', estimatedMinutes: 10, defaultAssigneeRole: 'member' },
          { name: 'Vacuum/sweep', frequency: 'weekly', estimatedMinutes: 15 },
          { name: 'Dust surfaces', frequency: 'weekly', estimatedMinutes: 10 },
          { name: 'Mop floors', frequency: 'weekly', estimatedMinutes: 15 },
          { name: 'Clean windows/mirrors', frequency: 'monthly', estimatedMinutes: 15 },
        ],
      },
      {
        name: 'Laundry',
        category: 'laundry',
        description: 'Shared laundry duties',
        sortOrder: 4,
        suggestedTasks: [
          { name: 'Run laundry loads', frequency: 'weekly', estimatedMinutes: 30, defaultAssigneeRole: 'member' },
          { name: 'Clean lint trap', frequency: 'weekly', estimatedMinutes: 2 },
          { name: 'Wipe machines', frequency: 'monthly', estimatedMinutes: 5 },
          { name: 'Clean dryer vent', frequency: 'quarterly', estimatedMinutes: 15 },
        ],
      },
    ],
    defaultModules: {
      tasks: true,
      areas: true,
      supplies: true,
      issues: true,
      plants: false,
      inventory: false,
      maintenance: false,
      decluttering: false,
      reports: false,
      teams: true,
      rotation: true,
    },
    reminderDefaults: {
      taskReminders: true,
      taskOverdue: true,
      dailySummary: true,
      weeklySummary: true,
    },
  },

  workplace: {
    id: 'workplace',
    spaceType: 'workplace',
    label: 'Workplace',
    description: 'Office, studio, or shop. Opening/closing routines, shared responsibility.',
    icon: '🏢',
    suggestedAreas: [
      {
        name: 'Reception/Entry',
        category: 'reception',
        description: 'First impression',
        sortOrder: 1,
        suggestedTasks: [
          { name: 'Opening: unlock, lights, climate', frequency: 'daily', estimatedMinutes: 5, defaultAssigneeRole: 'member' },
          { name: 'Closing: lock up, lights off, alarm', frequency: 'daily', estimatedMinutes: 5, defaultAssigneeRole: 'member' },
          { name: 'Tidy reception desk', frequency: 'daily', estimatedMinutes: 5 },
          { name: 'Sweep/vacuum entry', frequency: 'daily', estimatedMinutes: 5 },
          { name: 'Water plants', frequency: 'weekly', estimatedMinutes: 5 },
          { name: 'Deep clean entry glass', frequency: 'weekly', estimatedMinutes: 10 },
        ],
      },
      {
        name: 'Workstations',
        category: 'office',
        description: 'Desks & work areas',
        sortOrder: 2,
        suggestedTasks: [
          { name: 'Clear desk policy', frequency: 'daily', estimatedMinutes: 3, defaultAssigneeRole: 'member' },
          { name: 'Empty trash', frequency: 'daily', estimatedMinutes: 5 },
          { name: 'Dust surfaces', frequency: 'weekly', estimatedMinutes: 10 },
          { name: 'Vacuum floors', frequency: 'weekly', estimatedMinutes: 15 },
          { name: 'Sanitize high-touch', frequency: 'daily', estimatedMinutes: 5 },
        ],
      },
      {
        name: 'Kitchen/Break Room',
        category: 'kitchen',
        description: 'Shared refreshments',
        sortOrder: 3,
        suggestedTasks: [
          { name: 'Load/run dishwasher', frequency: 'daily', estimatedMinutes: 5, defaultAssigneeRole: 'member' },
          { name: 'Wipe counters', frequency: 'daily', estimatedMinutes: 5 },
          { name: 'Empty trash', frequency: 'daily', estimatedMinutes: 3 },
          { name: 'Clean fridge', frequency: 'weekly', estimatedMinutes: 10 },
          { name: 'Restock supplies', frequency: 'weekly', estimatedMinutes: 10 },
        ],
      },
      {
        name: 'Restrooms',
        category: 'bathroom',
        description: 'Clean facilities',
        sortOrder: 4,
        suggestedTasks: [
          { name: 'Restock paper/soap', frequency: 'daily', estimatedMinutes: 5 },
          { name: 'Clean sinks', frequency: 'daily', estimatedMinutes: 5 },
          { name: 'Clean toilets', frequency: 'daily', estimatedMinutes: 10 },
          { name: 'Mop floors', frequency: 'daily', estimatedMinutes: 10 },
          { name: 'Deep clean', frequency: 'weekly', estimatedMinutes: 20 },
        ],
      },
      {
        name: 'Meeting Rooms',
        category: 'meeting',
        description: 'Ready for collaboration',
        sortOrder: 5,
        suggestedTasks: [
          { name: 'Reset room after use', frequency: 'daily', estimatedMinutes: 5, defaultAssigneeRole: 'member' },
          { name: 'Wipe table/chairs', frequency: 'daily', estimatedMinutes: 5 },
          { name: 'Test AV equipment', frequency: 'weekly', estimatedMinutes: 10 },
          { name: 'Vacuum', frequency: 'weekly', estimatedMinutes: 10 },
        ],
      },
    ],
    defaultModules: {
      tasks: true,
      areas: true,
      supplies: true,
      issues: true,
      plants: false,
      inventory: true,
      maintenance: true,
      decluttering: false,
      reports: true,
      teams: true,
      rotation: true,
    },
    reminderDefaults: {
      taskReminders: true,
      taskOverdue: true,
      dailySummary: true,
      weeklySummary: true,
    },
  },

  institution: {
    id: 'institution',
    spaceType: 'institution',
    label: 'Institution',
    description: 'School, community center, library. High traffic, scheduled rounds.',
    icon: '🏫',
    suggestedAreas: [
      {
        name: 'Entrance/Lobby',
        category: 'reception',
        sortOrder: 1,
        suggestedTasks: [
          { name: 'Opening rounds', frequency: 'daily', estimatedMinutes: 10 },
          { name: 'Sweep/mop entry', frequency: 'daily', estimatedMinutes: 10 },
          { name: 'Clean glass doors', frequency: 'daily', estimatedMinutes: 5 },
          { name: 'Empty trash', frequency: 'daily', estimatedMinutes: 5 },
          { name: 'Check accessibility', frequency: 'daily', estimatedMinutes: 3 },
        ],
      },
      {
        name: 'Hallways/Corridors',
        category: 'hallway',
        sortOrder: 2,
        suggestedTasks: [
          { name: 'Sweep/vacuum', frequency: 'daily', estimatedMinutes: 15 },
          { name: 'Spot clean walls', frequency: 'daily', estimatedMinutes: 5 },
          { name: 'Mop floors', frequency: 'daily', estimatedMinutes: 15 },
          { name: 'Clean water fountains', frequency: 'daily', estimatedMinutes: 5 },
          { name: 'Buff floors', frequency: 'weekly', estimatedMinutes: 30 },
        ],
      },
      {
        name: 'Restrooms',
        category: 'bathroom',
        sortOrder: 3,
        suggestedTasks: [
          { name: 'Hourly check (high traffic)', frequency: 'daily', estimatedMinutes: 5 },
          { name: 'Full clean', frequency: 'daily', estimatedMinutes: 20 },
          { name: 'Restock supplies', frequency: 'daily', estimatedMinutes: 10 },
          { name: 'Deep clean', frequency: 'weekly', estimatedMinutes: 30 },
        ],
      },
      {
        name: 'Classrooms/Meeting Spaces',
        category: 'classroom',
        sortOrder: 4,
        suggestedTasks: [
          { name: 'Between-class reset', frequency: 'daily', estimatedMinutes: 5 },
          { name: 'Empty trash', frequency: 'daily', estimatedMinutes: 5 },
          { name: 'Wipe desks/tables', frequency: 'daily', estimatedMinutes: 10 },
          { name: 'Vacuum/sweep', frequency: 'daily', estimatedMinutes: 10 },
          { name: 'Sanitize high-touch', frequency: 'daily', estimatedMinutes: 5 },
          { name: 'Deep clean', frequency: 'weekly', estimatedMinutes: 20 },
        ],
      },
      {
        name: 'Common Areas/Cafeteria',
        category: 'common',
        sortOrder: 5,
        suggestedTasks: [
          { name: 'Wipe tables', frequency: 'daily', estimatedMinutes: 10 },
          { name: 'Sweep/mop', frequency: 'daily', estimatedMinutes: 15 },
          { name: 'Clean appliances', frequency: 'daily', estimatedMinutes: 10 },
          { name: 'Empty trash/recycling', frequency: 'daily', estimatedMinutes: 10 },
        ],
      },
    ],
    defaultModules: {
      tasks: true,
      areas: true,
      supplies: true,
      issues: true,
      plants: false,
      inventory: true,
      maintenance: true,
      decluttering: false,
      reports: true,
      teams: true,
      rotation: true,
    },
    reminderDefaults: {
      taskReminders: true,
      taskOverdue: true,
      dailySummary: true,
      weeklySummary: true,
    },
  },

  healthcare: {
    id: 'healthcare',
    spaceType: 'healthcare',
    label: 'Healthcare',
    description: 'Clinic, dental, therapy. Strict protocols. Procedures must be approved by your organization.',
    icon: '🏥',
    suggestedAreas: [
      {
        name: 'Waiting Room',
        category: 'waiting',
        sortOrder: 1,
        suggestedTasks: [
          { name: 'Wipe chairs/surfaces', frequency: 'daily', estimatedMinutes: 10 },
          { name: 'Vacuum/mop', frequency: 'daily', estimatedMinutes: 10 },
          { name: 'Sanitize high-touch', frequency: 'daily', estimatedMinutes: 5 },
          { name: 'Restock sanitizer/masks', frequency: 'daily', estimatedMinutes: 5 },
          { name: 'Check signage', frequency: 'daily', estimatedMinutes: 2 },
        ],
      },
      {
        name: 'Exam/Treatment Rooms',
        category: 'exam',
        sortOrder: 2,
        suggestedTasks: [
          { name: 'Between-patient wipe down', frequency: 'daily', estimatedMinutes: 5, defaultAssigneeRole: 'member' },
          { name: 'Terminal clean (end of day)', frequency: 'daily', estimatedMinutes: 15 },
          { name: 'Restock PPE/supplies', frequency: 'daily', estimatedMinutes: 5 },
          { name: 'Check equipment', frequency: 'daily', estimatedMinutes: 5 },
          { name: 'Weekly deep clean', frequency: 'weekly', estimatedMinutes: 20 },
        ],
      },
      {
        name: 'Restrooms (Patient)',
        category: 'bathroom',
        sortOrder: 3,
        suggestedTasks: [
          { name: 'Frequent checks', frequency: 'daily', estimatedMinutes: 5 },
          { name: 'Full clean & sanitize', frequency: 'daily', estimatedMinutes: 20 },
          { name: 'Restock supplies', frequency: 'daily', estimatedMinutes: 5 },
        ],
      },
      {
        name: 'Staff Areas',
        category: 'staff',
        sortOrder: 4,
        suggestedTasks: [
          { name: 'Wipe break room', frequency: 'daily', estimatedMinutes: 10 },
          { name: 'Clean fridge', frequency: 'weekly', estimatedMinutes: 10 },
          { name: 'Laundry (scrubs/linens)', frequency: 'daily', estimatedMinutes: 30 },
        ],
      },
      {
        name: 'Sterilization/Utility',
        category: 'sterile',
        sortOrder: 5,
        suggestedTasks: [
          { name: 'Instrument processing', frequency: 'daily', estimatedMinutes: 30 },
          { name: 'Autoclave maintenance', frequency: 'weekly', estimatedMinutes: 15 },
          { name: 'Chemical monitoring', frequency: 'daily', estimatedMinutes: 5 },
        ],
      },
    ],
    defaultModules: {
      tasks: true,
      areas: true,
      supplies: true,
      issues: true,
      plants: false,
      inventory: true,
      maintenance: true,
      decluttering: false,
      reports: true,
      teams: true,
      rotation: true,
    },
    reminderDefaults: {
      taskReminders: true,
      taskOverdue: true,
      dailySummary: true,
      weeklySummary: true,
    },
  },

  custom: {
    id: 'custom',
    spaceType: 'custom',
    label: 'Custom Space',
    description: 'Build your own from scratch. Add any areas and tasks you need.',
    icon: '✨',
    suggestedAreas: [
      {
        name: 'Area 1',
        category: 'custom',
        description: 'Rename me',
        sortOrder: 1,
        suggestedTasks: [
          { name: 'Daily task', frequency: 'daily', estimatedMinutes: 10 },
          { name: 'Weekly task', frequency: 'weekly', estimatedMinutes: 20 },
          { name: 'Monthly task', frequency: 'monthly', estimatedMinutes: 30 },
        ],
      },
      {
        name: 'Area 2',
        category: 'custom',
        description: 'Add another',
        sortOrder: 2,
        suggestedTasks: [
          { name: 'Daily task', frequency: 'daily', estimatedMinutes: 10 },
          { name: 'Weekly task', frequency: 'weekly', estimatedMinutes: 20 },
        ],
      },
    ],
    defaultModules: {
      tasks: true,
      areas: true,
      supplies: false,
      issues: false,
      plants: false,
      inventory: false,
      maintenance: false,
      decluttering: false,
      reports: false,
      teams: false,
      rotation: false,
    },
    reminderDefaults: {
      taskReminders: true,
      taskOverdue: true,
      dailySummary: false,
      weeklySummary: true,
    },
  },
}

export function getTemplatePack(spaceType: SpaceType): TemplatePack {
  return TEMPLATE_PACKS[spaceType] || TEMPLATE_PACKS.custom
}

export function getAllSpaceTypes(): { type: SpaceType; label: string; description: string; icon: string }[] {
  return Object.values(TEMPLATE_PACKS).map(pack => ({
    type: pack.spaceType,
    label: pack.label,
    description: pack.description,
    icon: pack.icon,
  }))
}