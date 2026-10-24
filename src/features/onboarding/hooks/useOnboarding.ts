import { useState, useCallback, useEffect } from 'react'
import type { ReminderDefaults, SpaceModules, SpaceType } from '@/types/database'
import type { TemplatePack, TemplateTask } from '../data/templatePacks'
import { getTemplatePack } from '../data/templatePacks'
import { detectTimezone } from '../data/timezones'

export interface OnboardingProfile {
  spaceType: SpaceType | null
  name: string
  timezone: string
  building: string
  floor: string
  zone: string
}

export interface OnboardingState {
  currentStep: number
  totalSteps: number
  profile: OnboardingProfile
  areas: OnboardingArea[]
  templatePack: TemplatePack | null
  invitations: OnboardingInvitation[]
  modules: SpaceModules
  reminderDefaults: ReminderDefaults
  completed: boolean
}

export interface OnboardingArea {
  id: string
  name: string
  category: string
  description: string
  parentId: string | null
  sortOrder: number
  isCustom: boolean
  archived: boolean
  suggestedTasks: OnboardingTask[]
  selectedTasks: string[]
}

export interface OnboardingTask {
  id: string
  name: string
  description?: string
  frequency: TemplateTask['frequency']
  customFrequencyDays?: number
  estimatedMinutes: number
  defaultAssigneeRole?: TemplateTask['defaultAssigneeRole']
  requiredSkills?: string[]
  suppliesNeeded?: string[]
  instructions?: string
}

export interface OnboardingInvitation {
  id: string
  email: string
  role: 'owner' | 'admin' | 'supervisor' | 'member' | 'cleaner' | 'auditor'
  message?: string
}

export type NewOnboardingArea = Pick<
  OnboardingArea,
  'name' | 'category' | 'description' | 'parentId'
> & {
  suggestedTasks?: OnboardingTask[]
  isCustom?: boolean
}

const STORAGE_KEY = 'neatly-onboarding-v2'
const CURRENT_VERSION = 2

const defaultReminders: ReminderDefaults = {
  taskReminders: true,
  taskOverdue: true,
  dailySummary: false,
  weeklySummary: true,
}

const initialState: OnboardingState = {
  currentStep: 1,
  totalSteps: 7,
  profile: {
    spaceType: null,
    name: '',
    timezone: detectTimezone(),
    building: '',
    floor: '',
    zone: '',
  },
  areas: [],
  templatePack: null,
  invitations: [],
  modules: { tasks: true, areas: true },
  reminderDefaults: defaultReminders,
  completed: false,
}

let localIdCounter = 0
function localId(prefix: string): string {
  localIdCounter += 1
  return `${prefix}-${Date.now()}-${localIdCounter}`
}

function cloneTask(task: TemplateTask, areaCategory: string, index: number): OnboardingTask {
  return {
    id: `task-${areaCategory}-${index}-${localIdCounter}`,
    name: task.name,
    description: task.description,
    frequency: task.frequency,
    customFrequencyDays: task.customFrequencyDays,
    estimatedMinutes: task.estimatedMinutes,
    defaultAssigneeRole: task.defaultAssigneeRole,
    requiredSkills: task.requiredSkills,
    suppliesNeeded: task.suppliesNeeded,
    instructions: task.instructions,
  }
}

function buildPackAreas(pack: TemplatePack): OnboardingArea[] {
  return pack.suggestedAreas.map((area, index) => {
    const tasks = area.suggestedTasks.map((task, taskIndex) =>
      cloneTask(task, area.category, taskIndex)
    )
    return {
      id: `suggested-${pack.id}-${area.category}-${index}`,
      name: area.name,
      category: area.category,
      description: area.description ?? '',
      parentId: null,
      sortOrder: index + 1,
      isCustom: false,
      archived: false,
      suggestedTasks: tasks,
      selectedTasks: tasks.map((task) => task.id),
    }
  })
}

function loadState(): OnboardingState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<OnboardingState> & { version?: number }
      if (parsed.version === CURRENT_VERSION) {
        return {
          ...initialState,
          ...parsed,
          profile: { ...initialState.profile, ...parsed.profile },
          modules: { ...initialState.modules, ...parsed.modules },
          reminderDefaults: { ...defaultReminders, ...parsed.reminderDefaults },
        }
      }
    }
  } catch {
    // A corrupt draft should never block setup.
  }
  return initialState
}

function persistState(state: OnboardingState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, version: CURRENT_VERSION }))
  } catch {
    // Storage can be unavailable in private mode; the in-memory draft still works.
  }
}

export function clearOnboardingDraft() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to clear.
  }
}

function sortSiblings(areas: OnboardingArea[], parentId: string | null): OnboardingArea[] {
  return areas
    .filter((area) => area.parentId === parentId && !area.archived)
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

function resequence(areas: OnboardingArea[], parentId: string | null): OnboardingArea[] {
  const siblings = sortSiblings(areas, parentId)
  const order = new Map(siblings.map((area, index) => [area.id, index + 1]))
  return areas.map((area) =>
    area.parentId === parentId && !area.archived
      ? { ...area, sortOrder: order.get(area.id) ?? area.sortOrder }
      : area
  )
}

function promoteChildren(areas: OnboardingArea[], parentId: string): OnboardingArea[] {
  const parent = areas.find((area) => area.id === parentId)
  if (!parent) return areas
  return areas.map((area) =>
    area.parentId === parentId
      ? { ...area, parentId: parent.parentId, sortOrder: area.sortOrder + 1000 }
      : area
  )
}

function isDescendant(areas: OnboardingArea[], candidateId: string, ancestorId: string): boolean {
  let current = areas.find((area) => area.id === candidateId)
  while (current?.parentId) {
    if (current.parentId === ancestorId) return true
    current = areas.find((area) => area.id === current?.parentId)
  }
  return false
}

export function useOnboarding() {
  const [state, setState] = useState<OnboardingState>(() => loadState())

  useEffect(() => {
    persistState(state)
  }, [state])

  const updateProfile = useCallback((updates: Partial<OnboardingProfile>) => {
    setState((prev) => ({ ...prev, profile: { ...prev.profile, ...updates } }))
  }, [])

  const selectProfile = useCallback((spaceType: SpaceType) => {
    const pack = getTemplatePack(spaceType)
    setState((prev) => ({
      ...prev,
      profile: { ...prev.profile, spaceType },
      templatePack: pack,
      areas: buildPackAreas(pack),
      modules: { ...pack.defaultModules },
      reminderDefaults: { ...pack.reminderDefaults },
    }))
  }, [])

  const addArea = useCallback((input: NewOnboardingArea) => {
    setState((prev) => {
      const id = localId(input.isCustom === false ? 'area' : 'area-custom')
      const tasks = (input.suggestedTasks ?? []).map((task, index) => ({
        ...task,
        id: task.id || localId(`task-${input.category}-${index}`),
      }))
      const siblings = sortSiblings(prev.areas, input.parentId ?? null)
      const newArea: OnboardingArea = {
        id,
        name: input.name.trim(),
        category: input.category,
        description: input.description ?? '',
        parentId: input.parentId ?? null,
        sortOrder: siblings.length + 1,
        isCustom: input.isCustom !== false,
        archived: false,
        suggestedTasks: tasks,
        selectedTasks: tasks.map((task) => task.id),
      }
      return { ...prev, areas: [...prev.areas, newArea] }
    })
  }, [])

  const addSuggestedArea = useCallback((name: string) => {
    setState((prev) => {
      const pack = prev.templatePack
      const suggestion = pack?.suggestedAreas.find((area) => area.name === name)
      if (!suggestion) return prev
      if (prev.areas.some((area) => area.name === suggestion.name && !area.archived)) return prev
      const tasks = suggestion.suggestedTasks.map((task, index) =>
        cloneTask(task, suggestion.category, index)
      )
      const newArea: OnboardingArea = {
        id: localId('area-suggested'),
        name: suggestion.name,
        category: suggestion.category,
        description: suggestion.description ?? '',
        parentId: null,
        sortOrder: sortSiblings(prev.areas, null).length + 1,
        isCustom: false,
        archived: false,
        suggestedTasks: tasks,
        selectedTasks: tasks.map((task) => task.id),
      }
      return { ...prev, areas: [...prev.areas, newArea] }
    })
  }, [])

  const updateArea = useCallback((id: string, updates: Partial<OnboardingArea>) => {
    setState((prev) => ({
      ...prev,
      areas: prev.areas.map((area) => (area.id === id ? { ...area, ...updates } : area)),
    }))
  }, [])

  const archiveArea = useCallback((id: string) => {
    setState((prev) => {
      const area = prev.areas.find((item) => item.id === id)
      if (!area) return prev
      let areas = promoteChildren(prev.areas, id)
      areas = areas.map((item) =>
        item.id === id ? { ...item, archived: !item.archived } : item
      )
      return {
        ...prev,
        areas: resequence(areas, area.parentId).map((item) =>
          item.parentId === null ? item : item
        ),
      }
    })
  }, [])

  const removeArea = useCallback((id: string) => {
    setState((prev) => {
      const area = prev.areas.find((item) => item.id === id)
      if (!area) return prev
      const areas = promoteChildren(prev.areas.filter((item) => item.id !== id), id)
      return { ...prev, areas: resequence(areas, area.parentId) }
    })
  }, [])

  const moveArea = useCallback((id: string, direction: 'up' | 'down') => {
    setState((prev) => {
      const area = prev.areas.find((item) => item.id === id)
      if (!area) return prev
      const siblings = sortSiblings(prev.areas, area.parentId)
      const index = siblings.findIndex((item) => item.id === id)
      const targetIndex = direction === 'up' ? index - 1 : index + 1
      const target = siblings[targetIndex]
      if (!target) return prev
      const areas = prev.areas.map((item) => {
        if (item.id === area.id) return { ...item, sortOrder: target.sortOrder }
        if (item.id === target.id) return { ...item, sortOrder: area.sortOrder }
        return item
      })
      return { ...prev, areas }
    })
  }, [])

  const nestArea = useCallback((id: string) => {
    setState((prev) => {
      const area = prev.areas.find((item) => item.id === id)
      if (!area) return prev
      const siblings = sortSiblings(prev.areas, area.parentId)
      const index = siblings.findIndex((item) => item.id === id)
      const previousSibling = index > 0 ? siblings[index - 1] : undefined
      if (!previousSibling || isDescendant(prev.areas, previousSibling.id, id)) return prev
      const areas = prev.areas.map((item) =>
        item.id === id
          ? {
              ...item,
              parentId: previousSibling.id,
              sortOrder: sortSiblings(prev.areas, previousSibling.id).length + 1,
            }
          : item
      )
      return { ...prev, areas }
    })
  }, [])

  const unnestArea = useCallback((id: string) => {
    setState((prev) => {
      const area = prev.areas.find((item) => item.id === id)
      if (!area?.parentId) return prev
      const parent = prev.areas.find((item) => item.id === area.parentId)
      if (!parent) return prev
      const areas = prev.areas.map((item) =>
        item.id === id
          ? {
              ...item,
              parentId: parent.parentId,
              sortOrder: sortSiblings(prev.areas, parent.parentId).length + 1,
            }
          : item
      )
      return { ...prev, areas }
    })
  }, [])

  const toggleTask = useCallback((areaId: string, taskId: string) => {
    setState((prev) => ({
      ...prev,
      areas: prev.areas.map((area) => {
        if (area.id !== areaId) return area
        const selected = new Set(area.selectedTasks)
        if (selected.has(taskId)) selected.delete(taskId)
        else selected.add(taskId)
        return { ...area, selectedTasks: Array.from(selected) }
      }),
    }))
  }, [])

  const updateTask = useCallback(
    (areaId: string, taskId: string, updates: Partial<OnboardingTask>) => {
      setState((prev) => ({
        ...prev,
        areas: prev.areas.map((area) =>
          area.id === areaId
            ? {
                ...area,
                suggestedTasks: area.suggestedTasks.map((task) =>
                  task.id === taskId ? { ...task, ...updates } : task
                ),
              }
            : area
        ),
      }))
    },
    []
  )

  const addTask = useCallback((areaId: string, task: Omit<OnboardingTask, 'id'>) => {
    setState((prev) => ({
      ...prev,
      areas: prev.areas.map((area) => {
        if (area.id !== areaId) return area
        const newTask: OnboardingTask = { ...task, id: localId('task-custom') }
        return {
          ...area,
          suggestedTasks: [...area.suggestedTasks, newTask],
          selectedTasks: [...area.selectedTasks, newTask.id],
        }
      }),
    }))
  }, [])

  const removeTask = useCallback((areaId: string, taskId: string) => {
    setState((prev) => ({
      ...prev,
      areas: prev.areas.map((area) =>
        area.id === areaId
          ? {
              ...area,
              suggestedTasks: area.suggestedTasks.filter((task) => task.id !== taskId),
              selectedTasks: area.selectedTasks.filter((id) => id !== taskId),
            }
          : area
      ),
    }))
  }, [])

  const addInvitation = useCallback((invitation: Omit<OnboardingInvitation, 'id'>) => {
    setState((prev) => ({
      ...prev,
      invitations: [...prev.invitations, { ...invitation, id: localId('invite') }],
    }))
  }, [])

  const removeInvitation = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      invitations: prev.invitations.filter((invitation) => invitation.id !== id),
    }))
  }, [])

  const toggleModule = useCallback((module: keyof SpaceModules) => {
    setState((prev) => ({
      ...prev,
      modules: { ...prev.modules, [module]: !prev.modules[module] },
    }))
  }, [])

  const updateReminderDefaults = useCallback((updates: Partial<ReminderDefaults>) => {
    setState((prev) => ({
      ...prev,
      reminderDefaults: { ...prev.reminderDefaults, ...updates },
    }))
  }, [])

  const nextStep = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentStep: Math.min(prev.currentStep + 1, prev.totalSteps),
    }))
  }, [])

  const prevStep = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentStep: Math.max(prev.currentStep - 1, 1),
    }))
  }, [])

  const goToStep = useCallback((step: number) => {
    setState((prev) => ({
      ...prev,
      currentStep: Math.max(1, Math.min(step, prev.totalSteps)),
      completed: false,
    }))
  }, [])

  const complete = useCallback(() => {
    setState((prev) => ({ ...prev, completed: true }))
  }, [])

  const reset = useCallback(() => {
    const fresh: OnboardingState = {
      ...initialState,
      profile: { ...initialState.profile, timezone: detectTimezone() },
    }
    setState(fresh)
    clearOnboardingDraft()
  }, [])

  const stepLabels = ['Profile', 'Details', 'Areas', 'Plan', 'Review', 'Invite', 'Modules']

  const activeAreas = state.areas.filter((area) => !area.archived)
  const selectedTaskCount = activeAreas.reduce(
    (sum, area) => sum + area.selectedTasks.length,
    0
  )

  const canProceed = (() => {
    switch (state.currentStep) {
      case 1:
        return state.profile.spaceType !== null
      case 2:
        return state.profile.name.trim().length > 0 && state.profile.timezone.length > 0
      case 3:
        return activeAreas.length > 0
      default:
        return true
    }
  })()

  return {
    state,
    stepLabels,
    canProceed,
    activeAreas,
    selectedTaskCount,
    updateProfile,
    selectProfile,
    addArea,
    addSuggestedArea,
    updateArea,
    archiveArea,
    removeArea,
    moveArea,
    nestArea,
    unnestArea,
    toggleTask,
    updateTask,
    addTask,
    removeTask,
    addInvitation,
    removeInvitation,
    toggleModule,
    updateReminderDefaults,
    nextStep,
    prevStep,
    goToStep,
    complete,
    reset,
  }
}

export type OnboardingActions = ReturnType<typeof useOnboarding>
