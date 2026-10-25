export type DemoRole = 'resident' | 'cleaner' | 'supervisor' | 'admin'
export type DemoSpace = 'personal' | 'organization'
export type DemoTaskStatus = 'pending' | 'overdue' | 'completed'
export type RecommendationStatus = 'pending' | 'accepted' | 'edited' | 'dismissed'

export interface DemoTask {
  id: string
  title: string
  area: string
  frequency: string
  status: DemoTaskStatus
  assignedTo: string
  overdueCount: number
  originalTaskId?: string
  verificationStatus: 'not_required' | 'pending' | 'verified' | 'rework_requested'
  verifiedBy: string | null
}

export interface DemoArea {
  id: string
  name: string
  qrToken: string
}

export interface DemoState {
  version: 1
  started: boolean
  stepIndex: number
  activeSpace: DemoSpace
  role: DemoRole
  personal: {
    created: boolean
    areas: string[]
    tasks: DemoTask[]
    supplies: { name: string; quantity: number; threshold: number }[]
    history: string[]
  }
  organization: {
    areas: DemoArea[]
    members: { name: string; role: DemoRole }[]
    tasks: DemoTask[]
    checklist: { label: string; done: boolean }[]
    selectedAreaId: string | null
    scannedAreaId: string | null
    issue: {
      status: 'open' | 'assigned' | 'resolved'
      title: string
      reportedBy: string
      assignedTo: string | null
    }
    supplyRequest: { item: string; quantity: number; status: 'pending' | 'fulfilled' }
    recommendation: {
      title: string
      reason: string
      status: RecommendationStatus
    }
    dashboardOpened: boolean
  }
}

export type DemoAction =
  | { type: 'start' }
  | { type: 'create_apartment' }
  | { type: 'complete_personal_task' }
  | { type: 'add_low_supply' }
  | { type: 'switch_to_org' }
  | { type: 'assign_task' }
  | { type: 'scan_qr' }
  | { type: 'complete_checklist' }
  | { type: 'verify_task' }
  | { type: 'request_rework' }
  | { type: 'report_issue' }
  | { type: 'assign_issue' }
  | { type: 'resolve_issue' }
  | { type: 'open_dashboard' }
  | { type: 'recommendation_accept' }
  | { type: 'recommendation_edit'; title: string }
  | { type: 'recommendation_dismiss' }
  | { type: 'set_role'; role: DemoRole }
  | { type: 'set_space'; space: DemoSpace }
  | { type: 'reset' }

export const DEMO_STEPS = [
  { id: 'apartment', title: 'Create an apartment', description: 'Set up a personal space with a few useful areas and routines.' },
  { id: 'complete-task', title: 'Complete a task', description: 'Try completing the daily kitchen reset. The demo keeps a short history.' },
  { id: 'low-supply', title: 'Add and mark a low supply', description: 'Add a supply and see how a low quantity is shown.' },
  { id: 'switch-org', title: 'Switch to the organization', description: 'Move from the apartment into the seeded organization workspace.' },
  { id: 'assign-task', title: 'Assign a task', description: 'Assign the restroom reset to the cleaner.' },
  { id: 'scan-qr', title: 'Scan an area QR code', description: 'Use the demo action to simulate scanning the Kitchen QR code.' },
  { id: 'checklist', title: 'Complete the checklist', description: 'The cleaner completes the task checklist; it then awaits supervisor review.' },
  { id: 'verification', title: 'Verify or request rework', description: 'Switch to the supervisor role, then verify the submission or create linked rework.' },
  { id: 'report-issue', title: 'Report an issue', description: 'Switch to the cleaner role and report an issue from the area.' },
  { id: 'resolve-issue', title: 'Assign and resolve the issue', description: 'Switch to a supervisor or admin to assign and resolve the report.' },
  { id: 'dashboard', title: 'Review the dashboard', description: 'See the demo organization’s operational records and counts.' },
  { id: 'recommendation', title: 'Respond to a recommendation', description: 'Accept, edit, or dismiss the transparent overdue-task suggestion.' },
] as const

function seedOrganization(): DemoState['organization'] {
  const areas: DemoArea[] = [
    { id: 'org-kitchen', name: 'Kitchen', qrToken: `demo-${crypto.randomUUID()}` },
    { id: 'org-restrooms', name: 'Restrooms', qrToken: `demo-${crypto.randomUUID()}` },
    { id: 'org-lobby', name: 'Lobby', qrToken: `demo-${crypto.randomUUID()}` },
    { id: 'org-office', name: 'Office', qrToken: `demo-${crypto.randomUUID()}` },
    { id: 'org-storage', name: 'Storage', qrToken: `demo-${crypto.randomUUID()}` },
  ]

  return {
    areas,
    members: [
      { name: 'Casey Cleaner', role: 'cleaner' },
      { name: 'Jordan Supervisor', role: 'supervisor' },
      { name: 'Taylor Admin', role: 'admin' },
    ],
    tasks: [
      {
        id: 'org-restroom-task',
        title: 'Restroom reset',
        area: 'Restrooms',
        frequency: 'Daily',
        status: 'overdue',
        assignedTo: 'Casey Cleaner',
        overdueCount: 3,
        verificationStatus: 'pending',
        verifiedBy: null,
      },
      {
        id: 'org-repeat-overdue',
        title: 'Storage zone check',
        area: 'Storage',
        frequency: 'Weekly',
        status: 'overdue',
        assignedTo: 'Casey Cleaner',
        overdueCount: 3,
        verificationStatus: 'not_required',
        verifiedBy: null,
      },
    ],
    checklist: [
      { label: 'Wipe sink and counter', done: false },
      { label: 'Check supplies', done: false },
      { label: 'Empty bin', done: false },
    ],
    selectedAreaId: null,
    scannedAreaId: null,
    issue: {
      status: 'open',
      title: 'Dispenser needs attention',
      reportedBy: 'Demo staff member',
      assignedTo: null,
    },
    supplyRequest: { item: 'Cleaning solution', quantity: 2, status: 'pending' },
    recommendation: {
      title: 'Review the Storage zone check',
      reason: 'This task was postponed 3 times in 14 days.',
      status: 'pending',
    },
    dashboardOpened: false,
  }
}

export function createDemoState(): DemoState {
  return {
    version: 1,
    started: false,
    stepIndex: 0,
    activeSpace: 'personal',
    role: 'resident',
    personal: { created: false, areas: [], tasks: [], supplies: [], history: [] },
    organization: seedOrganization(),
  }
}

function advance(state: DemoState, stepIndex: number): DemoState {
  return { ...state, stepIndex }
}

export function demoReducer(state: DemoState, action: DemoAction): DemoState {
  switch (action.type) {
    case 'start':
      return { ...state, started: true, activeSpace: 'personal', stepIndex: 0 }
    case 'create_apartment':
      return advance({
        ...state,
        personal: {
          created: true,
          areas: ['Kitchen', 'Bathroom', 'Living room', 'Storage'],
          tasks: [
            { id: 'home-kitchen', title: 'Kitchen reset', area: 'Kitchen', frequency: 'Daily', status: 'pending', assignedTo: 'You', overdueCount: 0, verificationStatus: 'not_required', verifiedBy: null },
            { id: 'home-bathroom', title: 'Bathroom task', area: 'Bathroom', frequency: 'Weekly', status: 'pending', assignedTo: 'You', overdueCount: 0, verificationStatus: 'not_required', verifiedBy: null },
            { id: 'home-storage', title: 'Storage check', area: 'Storage', frequency: 'Monthly', status: 'pending', assignedTo: 'You', overdueCount: 0, verificationStatus: 'not_required', verifiedBy: null },
          ],
          supplies: [{ name: 'Soap', quantity: 1, threshold: 2 }],
          history: ['Yesterday · Kitchen reset submitted', '2 days ago · Bathroom task submitted', '3 days ago · Kitchen reset submitted'],
        },
      }, 1)
    case 'complete_personal_task':
      return advance({
        ...state,
        personal: {
          ...state.personal,
          tasks: state.personal.tasks.map((task) =>
            task.id === 'home-kitchen' ? { ...task, status: 'completed' } : task
          ),
          history: ['Today · Kitchen reset submitted', ...state.personal.history],
        },
      }, 2)
    case 'add_low_supply':
      return advance({
        ...state,
        personal: {
          ...state.personal,
          supplies: [
            ...state.personal.supplies.filter((item) => item.name !== 'Cleaning solution'),
            { name: 'Cleaning solution', quantity: 1, threshold: 2 },
          ],
        },
      }, 3)
    case 'switch_to_org':
      return advance({ ...state, activeSpace: 'organization' }, 4)
    case 'assign_task':
      return advance({
        ...state,
        organization: {
          ...state.organization,
          tasks: state.organization.tasks.map((task) =>
            task.id === 'org-restroom-task' ? { ...task, assignedTo: 'Casey Cleaner' } : task
          ),
        },
      }, 5)
    case 'scan_qr':
      return advance({
        ...state,
        activeSpace: 'organization',
        organization: {
          ...state.organization,
          scannedAreaId: 'org-kitchen',
          selectedAreaId: 'org-kitchen',
        },
      }, 6)
    case 'complete_checklist':
      return advance({
        ...state,
        organization: {
          ...state.organization,
          checklist: state.organization.checklist.map((item) => ({ ...item, done: true })),
          tasks: state.organization.tasks.map((task) =>
            task.id === 'org-restroom-task'
              ? { ...task, status: 'completed' as const, verificationStatus: 'pending' as const }
              : task
          ),
        },
      }, 7)
    case 'verify_task':
      return advance({
        ...state,
        organization: {
          ...state.organization,
          tasks: state.organization.tasks.map((task) =>
            task.id === 'org-restroom-task'
              ? { ...task, verificationStatus: 'verified', verifiedBy: 'Jordan Supervisor' }
              : task
          ),
        },
      }, 8)
    case 'request_rework':
      return advance({
        ...state,
        organization: {
          ...state.organization,
          tasks: [
            ...state.organization.tasks.map((task): DemoTask =>
              task.id === 'org-restroom-task'
                ? { ...task, verificationStatus: 'rework_requested' }
                : task
            ),
            {
              id: 'org-restroom-rework',
              title: 'Restroom reset (rework)',
              area: 'Restrooms',
              frequency: 'One-time rework',
              status: 'pending' as const,
              assignedTo: 'Casey Cleaner',
              overdueCount: 0,
              originalTaskId: 'org-restroom-task',
              verificationStatus: 'pending' as const,
              verifiedBy: null,
            } satisfies DemoTask,
          ],
        },
      }, 8)
    case 'report_issue':
      return advance({
        ...state,
        organization: {
          ...state.organization,
          issue: {
            ...state.organization.issue,
            title: 'Restroom dispenser is empty',
            status: 'open',
            reportedBy: 'Casey Cleaner',
            assignedTo: null,
          },
        },
      }, 9)
    case 'assign_issue':
      return {
        ...state,
        organization: {
          ...state.organization,
          issue: { ...state.organization.issue, status: 'assigned', assignedTo: 'Jordan Supervisor' },
        },
      }
    case 'resolve_issue':
      return advance({
        ...state,
        organization: {
          ...state.organization,
          issue: { ...state.organization.issue, status: 'resolved' },
        },
      }, 10)
    case 'open_dashboard':
      return advance({
        ...state,
        organization: { ...state.organization, dashboardOpened: true },
      }, 11)
    case 'recommendation_accept':
      return advance({
        ...state,
        organization: {
          ...state.organization,
          recommendation: { ...state.organization.recommendation, status: 'accepted' },
        },
      }, 12)
    case 'recommendation_edit':
      return advance({
        ...state,
        organization: {
          ...state.organization,
          recommendation: { ...state.organization.recommendation, title: action.title, status: 'edited' },
        },
      }, 12)
    case 'recommendation_dismiss':
      return advance({
        ...state,
        organization: {
          ...state.organization,
          recommendation: { ...state.organization.recommendation, status: 'dismissed' },
        },
      }, 12)
    case 'set_role':
      return { ...state, role: action.role }
    case 'set_space':
      return { ...state, activeSpace: action.space }
    case 'reset':
      return createDemoState()
    default:
      return state
  }
}

export function isDemoState(value: unknown): value is DemoState {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<DemoState>
  return candidate.version === 1
    && typeof candidate.started === 'boolean'
    && typeof candidate.stepIndex === 'number'
    && (candidate.activeSpace === 'personal' || candidate.activeSpace === 'organization')
    && typeof candidate.personal === 'object'
    && candidate.personal !== null
    && typeof candidate.organization === 'object'
    && candidate.organization !== null
    && Array.isArray(candidate.organization.areas)
}

export function isDemoRole(value: string): value is DemoRole {
  return value === 'resident' || value === 'cleaner' || value === 'supervisor' || value === 'admin'
}

export function loadDemoState(serialized: string | null): DemoState {
  if (serialized === null) return createDemoState()
  const parsed: unknown = JSON.parse(serialized)
  if (!isDemoState(parsed)) throw new Error('Saved demo data is invalid. Reset the demo to start a fresh sandbox.')
  return parsed
}
