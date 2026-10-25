import { useEffect, useReducer, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CircleHelp,
  ClipboardCheck,
  Home,
  Package,
  RotateCcw,
  Users,
} from 'lucide-react'
import { Button } from '@components/ui/Button'
import {
  DEMO_STEPS,
  demoReducer,
  isDemoRole,
  loadDemoState,
  type DemoAction,
  type DemoArea,
  type DemoRole,
  type DemoState,
} from './demoState'

const STORAGE_KEY = 'neatly-demo-sandbox-v1'

const roleLabels: Record<DemoRole, string> = {
  resident: 'Resident',
  cleaner: 'Cleaner',
  supervisor: 'Supervisor',
  admin: 'Admin',
}

function initialState(): DemoState {
  const state = loadDemoState(sessionStorage.getItem(STORAGE_KEY))
  const areaToken = new URLSearchParams(window.location.search).get('area')
  if (!areaToken) return state

  const area = state.organization.areas.find((candidate) => candidate.qrToken === areaToken)
  if (!area) return state
  return {
    ...state,
    activeSpace: 'organization',
    organization: { ...state.organization, selectedAreaId: area.id, scannedAreaId: area.id },
  }
}

function AreaQrCard({ area }: { area: DemoArea }) {
  const qrUrl = new URL('/demo', window.location.origin)
  qrUrl.searchParams.set('area', area.qrToken)

  return (
    <a
      href={qrUrl.toString()}
      className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3 transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-active"
      aria-label={`Open demo QR for ${area.name}`}
    >
      <QRCodeSVG value={qrUrl.toString()} size={72} title={`${area.name} area QR code`} />
      <span className="min-w-0">
        <span className="block font-medium text-text">{area.name}</span>
        <span className="block truncate text-xs text-text-muted">Code: {area.qrToken.slice(0, 14)}…</span>
      </span>
    </a>
  )
}

function StatusPill({ children, low = false }: { children: React.ReactNode; low?: boolean }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${low ? 'bg-amber-light text-amber-text' : 'bg-surface-elevated text-text'}`}>
      {children}
    </span>
  )
}

function DemoCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-surface">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-text">
        <span aria-hidden="true" className="text-primary-text">{icon}</span>
        {title}
      </h2>
      {children}
    </section>
  )
}

function WalkthroughActions({
  state,
  dispatch,
  editTitle,
  setEditTitle,
}: {
  state: DemoState
  dispatch: React.Dispatch<DemoAction>
  editTitle: string
  setEditTitle: (value: string) => void
}) {
  const isManager = state.role === 'supervisor' || state.role === 'admin'
  const roleHint = (role: string) => (
    <p className="mt-2 text-sm text-text-muted">Switch the role above to {role} to continue this step.</p>
  )
  const button = (label: string, action: DemoAction, variant: 'primary' | 'outline' | 'success' = 'primary') => (
    <Button size="sm" variant={variant} onClick={() => dispatch(action)} rightIcon={<ArrowRight className="h-4 w-4" />}>
      {label}
    </Button>
  )

  switch (state.stepIndex) {
    case 0:
      return button('Create apartment', { type: 'create_apartment' })
    case 1:
      return button('Complete kitchen reset', { type: 'complete_personal_task' }, 'success')
    case 2:
      return button('Add cleaning solution · mark low', { type: 'add_low_supply' })
    case 3:
      return button('Switch to organization', { type: 'switch_to_org' })
    case 4:
      return button('Assign restroom reset to cleaner', { type: 'assign_task' })
    case 5:
      return button('Simulate scanning Kitchen QR', { type: 'scan_qr' })
    case 6:
      return button('Complete checklist', { type: 'complete_checklist' }, 'success')
    case 7:
      return isManager ? (
        <div className="flex flex-wrap gap-2">
          {button('Verify submission', { type: 'verify_task' }, 'success')}
          {button('Request rework', { type: 'request_rework' }, 'outline')}
        </div>
      ) : roleHint('the supervisor')
    case 8:
      return state.role === 'cleaner'
        ? button('Report dispenser issue', { type: 'report_issue' })
        : roleHint('the cleaner')
    case 9:
      if (!isManager) return roleHint('the supervisor')
      return state.organization.issue.status === 'open'
        ? button('Assign issue to supervisor', { type: 'assign_issue' })
        : button('Resolve issue', { type: 'resolve_issue' }, 'success')
    case 10:
      return button('Open dashboard', { type: 'open_dashboard' })
    case 11:
      return (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-text" htmlFor="demo-recommendation-title">Edit suggestion</label>
          <input
            id="demo-recommendation-title"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-active"
            value={editTitle}
            onChange={(event) => setEditTitle(event.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            {button('Accept', { type: 'recommendation_accept' }, 'success')}
            <Button size="sm" variant="outline" disabled={!editTitle.trim()} onClick={() => dispatch({ type: 'recommendation_edit', title: editTitle.trim() })}>Save edit</Button>
            {button('Dismiss', { type: 'recommendation_dismiss' }, 'outline')}
          </div>
        </div>
      )
    default:
      return (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => dispatch({ type: 'reset' })} leftIcon={<RotateCcw className="h-4 w-4" />}>Start over</Button>
          <a href="/login" className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-primary-text underline">Exit demo</a>
        </div>
      )
  }
}

function PersonalWorkspace({ state }: { state: DemoState }) {
  if (!state.personal.created) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center">
        <Home className="mx-auto mb-3 h-8 w-8 text-primary-text" aria-hidden="true" />
        <h2 className="font-semibold text-text">Your apartment demo is ready to create</h2>
        <p className="mt-1 text-sm text-text-muted">The walkthrough will set up the apartment, its routines, history, and a low supply.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <DemoCard title="Areas" icon={<Home className="h-5 w-5" />}>
        <div className="flex flex-wrap gap-2">
          {state.personal.areas.map((area) => <StatusPill key={area}>{area}</StatusPill>)}
        </div>
      </DemoCard>
      <DemoCard title="Routines" icon={<ClipboardCheck className="h-5 w-5" />}>
        <ul className="space-y-3">
          {state.personal.tasks.map((task) => (
            <li key={task.id} className="flex items-center justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
              <div>
                <p className="font-medium text-text">{task.title}</p>
                <p className="text-sm text-text-muted">{task.area} · {task.frequency}</p>
              </div>
              <StatusPill>{task.status === 'completed' ? 'Submitted' : 'To do'}</StatusPill>
            </li>
          ))}
        </ul>
      </DemoCard>
      <DemoCard title="Supplies" icon={<Package className="h-5 w-5" />}>
        {state.personal.supplies.length === 0 ? (
          <p className="text-sm text-text-muted">No supplies added yet.</p>
        ) : (
          <ul className="space-y-2">
            {state.personal.supplies.map((item) => (
              <li key={item.name} className="flex items-center justify-between gap-3">
                <span className="text-text">{item.name} · {item.quantity} left (minimum {item.threshold})</span>
                {item.quantity <= item.threshold && <StatusPill low>Low stock</StatusPill>}
              </li>
            ))}
          </ul>
        )}
      </DemoCard>
      <DemoCard title="Recent history" icon={<ClipboardCheck className="h-5 w-5" />}>
        <ul className="space-y-2 text-sm text-text-muted">
          {state.personal.history.map((entry, index) => <li key={`${entry}-${index}`}>{entry}</li>)}
        </ul>
      </DemoCard>
    </div>
  )
}

function OrganizationWorkspace({ state }: { state: DemoState }) {
  const organization = state.organization
  const selectedArea = organization.areas.find((area) => area.id === organization.selectedAreaId)

  return (
    <div className="space-y-5">
      {organization.dashboardOpened && (
        <DemoCard title="Operational dashboard" icon={<Users className="h-5 w-5" />}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Areas" value={organization.areas.length} />
            <Metric label="Team members" value={organization.members.length} />
            <Metric label="Open issues" value={organization.issue.status === 'resolved' ? 0 : 1} />
            <Metric label="Supply requests" value={organization.supplyRequest.status === 'pending' ? 1 : 0} />
          </div>
          <p className="mt-3 text-xs text-text-muted">Demo records only. No conclusions about staff performance.</p>
        </DemoCard>
      )}
      <DemoCard title="Areas and QR codes" icon={<Home className="h-5 w-5" />}>
        {selectedArea && (
          <p className="mb-3 rounded-lg bg-primary-light p-3 text-sm text-primary-text">
            {organization.scannedAreaId === selectedArea.id ? `QR opened ${selectedArea.name}.` : `Selected area: ${selectedArea.name}.`}
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {organization.areas.map((area) => <AreaQrCard key={area.id} area={area} />)}
        </div>
      </DemoCard>
      <DemoCard title="People and roles" icon={<Users className="h-5 w-5" />}>
        <ul className="grid gap-2 sm:grid-cols-3">
          {organization.members.map((member) => (
            <li key={member.role} className="rounded-lg bg-background p-3">
              <p className="font-medium text-text">{member.name}</p>
              <p className="text-sm text-text-muted">{roleLabels[member.role]}</p>
            </li>
          ))}
        </ul>
      </DemoCard>
      <DemoCard title="Tasks" icon={<ClipboardCheck className="h-5 w-5" />}>
        <ul className="space-y-3">
          {organization.tasks.map((task) => (
            <li key={task.id} className="rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-text">{task.title}</p>
                  <p className="text-sm text-text-muted">{task.area} · {task.frequency} · assigned to {task.assignedTo}</p>
                </div>
                <StatusPill low={task.status === 'overdue'}>{task.status === 'completed' ? 'Submitted' : task.status}</StatusPill>
              </div>
              {task.verificationStatus !== 'not_required' && (
                <p className="mt-2 text-sm text-text-muted">
                  Verification: {task.verificationStatus.replace('_', ' ')}
                  {task.verifiedBy ? ` by ${task.verifiedBy}` : ''}
                  {task.originalTaskId ? ` · linked to ${task.originalTaskId}` : ''}
                </p>
              )}
            </li>
          ))}
        </ul>
        <div className="mt-4 space-y-2">
          {organization.checklist.map((item) => (
            <div key={item.label} className="flex items-center gap-2 text-sm text-text">
              <span className={`flex h-5 w-5 items-center justify-center rounded-full ${item.done ? 'bg-success-light text-success-text' : 'border border-border'}`}>
                {item.done && <Check className="h-3 w-3" aria-hidden="true" />}
              </span>
              {item.label}
            </div>
          ))}
        </div>
      </DemoCard>
      <div className="grid gap-5 lg:grid-cols-2">
        <DemoCard title="Issue" icon={<AlertTriangle className="h-5 w-5" />}>
          <p className="font-medium text-text">{organization.issue.title}</p>
          <p className="mt-1 text-sm text-text-muted">Reported by {organization.issue.reportedBy} · {organization.issue.status}</p>
          {organization.issue.assignedTo && <p className="mt-1 text-sm text-text-muted">Assigned to {organization.issue.assignedTo}</p>}
        </DemoCard>
        <DemoCard title="Supply request" icon={<Package className="h-5 w-5" />}>
          <p className="font-medium text-text">{organization.supplyRequest.item} · quantity {organization.supplyRequest.quantity}</p>
          <p className="mt-1 text-sm text-text-muted">Status: {organization.supplyRequest.status}</p>
        </DemoCard>
      </div>
      <DemoCard title="Recommendation" icon={<CircleHelp className="h-5 w-5" />}>
        <p className="font-medium text-text">{organization.recommendation.title}</p>
        <p className="mt-1 text-sm text-text-muted">{organization.recommendation.reason}</p>
        <p className="mt-2 text-sm text-text-muted">Status: {organization.recommendation.status}</p>
      </DemoCard>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-background p-3">
      <p className="text-2xl font-semibold text-text">{value}</p>
      <p className="text-xs text-text-muted">{label}</p>
    </div>
  )
}

export function DemoModePage() {
  const [state, dispatch] = useReducer(demoReducer, undefined, initialState)
  const [editTitle, setEditTitle] = useState(state.organization.recommendation.title)

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const resetDemo = () => {
    sessionStorage.removeItem(STORAGE_KEY)
    window.history.replaceState(null, '', '/demo')
    setEditTitle('Review the Storage zone check')
    dispatch({ type: 'reset' })
  }

  const activeStep = DEMO_STEPS[state.stepIndex]
  const stepDone = state.started && !activeStep

  return (
    <div className="demo-canvas min-h-screen text-text">
      <header className="glass-panel sticky top-0 z-30 border-x-0 border-t-0">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div>
            <p className="text-xl font-semibold">Neatly <span className="text-sm font-medium text-primary-text">Demo</span></p>
            <p className="text-sm text-text-muted">An isolated sample workspace</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="demo-role" className="text-sm font-medium text-text">Play as</label>
            <select
              id="demo-role"
              aria-label="Switch demo role"
              value={state.role}
              onChange={(event) => {
                if (isDemoRole(event.target.value)) {
                  dispatch({ type: 'set_role', role: event.target.value })
                }
              }}
              className="min-h-11 rounded-lg border border-border bg-background px-3 text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-active"
            >
              {(Object.keys(roleLabels) as DemoRole[]).map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}
            </select>
            <Button variant="outline" size="sm" onClick={resetDemo} leftIcon={<RotateCcw className="h-4 w-4" />}>Reset demo</Button>
            <a href="/login" className="inline-flex min-h-11 items-center px-2 text-sm font-medium text-primary-text underline">Exit</a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 pb-44 sm:px-6">
        <div className="rounded-2xl border border-primary-light bg-primary-light p-4 text-sm text-primary-text shadow-sm">
          Demo activity is stored in this browser tab only. It never writes to Supabase or changes a real account. Reset or close the tab to clear the sandbox.
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{state.activeSpace === 'personal' ? 'Apartment' : 'Northstar Community Center'}</h1>
            <p className="text-sm text-text-muted">{state.activeSpace === 'personal' ? 'Personal space' : 'Organization workspace'} · {roleLabels[state.role]}</p>
          </div>
          <div className="flex gap-2" aria-label="Switch demo space">
            <Button size="sm" variant={state.activeSpace === 'personal' ? 'primary' : 'outline'} onClick={() => dispatch({ type: 'set_space', space: 'personal' })}>Apartment</Button>
            <Button size="sm" variant={state.activeSpace === 'organization' ? 'primary' : 'outline'} onClick={() => dispatch({ type: 'set_space', space: 'organization' })}>Organization</Button>
          </div>
        </div>

        {state.activeSpace === 'personal'
          ? <PersonalWorkspace state={state} />
          : <OrganizationWorkspace state={state} />}
      </main>

      <aside
        className="glass-panel fixed inset-x-3 bottom-3 z-40 mx-auto max-w-2xl rounded-2xl p-4 shadow-elevated sm:inset-x-auto sm:right-6 sm:bottom-6"
        aria-label="Guided demo walkthrough"
        aria-live="polite"
      >
        {!state.started ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-text">Try the guided demo</p>
              <p className="text-sm text-text-muted">Walk through apartment routines and an organization workflow.</p>
            </div>
            <Button onClick={() => dispatch({ type: 'start' })} rightIcon={<ArrowRight className="h-4 w-4" />}>Start demo</Button>
          </div>
        ) : stepDone ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-text">Walkthrough complete</p>
              <p className="text-sm text-text-muted">You can keep exploring the sample records or reset the demo.</p>
            </div>
            <Button variant="outline" onClick={resetDemo} leftIcon={<RotateCcw className="h-4 w-4" />}>Reset demo</Button>
          </div>
        ) : activeStep ? (
          <div>
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary-text">
                  Step {state.stepIndex + 1} of {DEMO_STEPS.length}
                </p>
                <h2 className="mt-1 font-semibold text-text">{activeStep.title}</h2>
                <p className="mt-1 text-sm text-text-muted">{activeStep.description}</p>
              </div>
              <button type="button" className="rounded px-2 py-1 text-sm text-text-muted underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-active" onClick={resetDemo}>Restart demo</button>
            </div>
            <WalkthroughActions state={state} dispatch={dispatch} editTitle={editTitle} setEditTitle={setEditTitle} />
          </div>
        ) : null}
      </aside>
    </div>
  )
}
