import { useState } from 'react'
import { Button } from '@components/ui/Button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@components/ui/Card'
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle, Clock, Loader2, Home, ListChecks } from 'lucide-react'
import type { OnboardingState } from '../hooks/useOnboarding'
import { formatMinutes, planWeeklyMinutes, selectedTaskCount } from '../lib/plan'

interface StepCompleteProps {
  state: OnboardingState
  onActivate: (state: OnboardingState) => Promise<void>
  onReview: () => void
}

export function StepComplete({ state, onActivate, onReview }: StepCompleteProps) {
  const [isActivating, setIsActivating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activeAreas = state.areas.filter((area) => !area.archived)
  const taskCount = selectedTaskCount(activeAreas)
  const weeklyMinutes = planWeeklyMinutes(activeAreas)

  const handleActivate = async () => {
    setError(null)
    setIsActivating(true)
    try {
      await onActivate(state)
    } catch (activationError) {
      setError(
        activationError instanceof Error
          ? activationError.message
          : 'Activation did not finish. Please try again.'
      )
      setIsActivating(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="py-8 text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-success-100 dark:bg-success-900/30">
          <CheckCircle className="h-10 w-10 text-success-600" aria-hidden="true" />
        </div>
        <h2 className="text-display-sm font-semibold text-text mb-2">Ready when you are</h2>
        <p className="mx-auto max-w-md text-text-muted">
          One last look. Activating creates the space, saves your starter plan, and schedules the
          next 30 days.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Space" value={state.profile.name} icon={<Home className="w-5 h-5" />} />
        <SummaryCard label="Areas" value={activeAreas.length} icon={<ListChecks className="w-5 h-5" />} />
        <SummaryCard label="Weekly plan" value={formatMinutes(weeklyMinutes)} icon={<Clock className="w-5 h-5" />} />
      </div>

      <Card variant="outlined">
        <CardHeader>
          <CardTitle>What activation does</CardTitle>
          <CardDescription>
            {taskCount} task {taskCount === 1 ? 'template' : 'templates'} will become recurring
            tasks with the next 30 days scheduled.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <StepItem number={1} text="Creates your space with its timezone and profile." />
          <StepItem number={2} text="Adds the areas you kept, in your order." />
          <StepItem number={3} text="Saves each selected task as a reusable template." />
          <StepItem number={4} text="Creates a recurring task for each template and fills the next 30 days." />
          <StepItem number={5} text="Stores pending invitations and your module choices." />
        </CardContent>
      </Card>

      {state.invitations.length > 0 && (
        <p className="text-center text-sm text-text-muted">
          {state.invitations.length} pending{' '}
          {state.invitations.length === 1 ? 'invitation' : 'invitations'} will be saved. Email
          delivery is not enabled yet.
        </p>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive-200 bg-destructive-50 p-4 dark:border-destructive-800 dark:bg-destructive-900/20" role="alert">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive-600" aria-hidden="true" />
          <div>
            <p className="font-medium text-destructive-800 dark:text-destructive-200">
              Could not activate the space
            </p>
            <p className="mt-1 text-sm text-destructive-700 dark:text-destructive-300">{error}</p>
          </div>
        </div>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        <Button type="button" variant="secondary" className="flex-1" onClick={onReview} disabled={isActivating}>
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
          Review again
        </Button>
        <Button
          type="button"
          className="flex-1"
          onClick={handleActivate}
          disabled={isActivating}
          rightIcon={
            isActivating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ArrowRight className="h-4 w-4" aria-hidden="true" />
          }
        >
          {isActivating ? 'Activating...' : 'Activate space'}
        </Button>
      </div>

      <p className="text-center text-sm text-text-muted">
        You can adjust everything later in Space Settings.
      </p>
    </div>
  )
}

function SummaryCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <Card padding="md">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm text-text-muted">{label}</p>
          <p className="truncate text-lg font-semibold text-text">{value}</p>
        </div>
      </div>
    </Card>
  )
}

function StepItem({ number, text }: { number: number; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
        {number}
      </span>
      <p className="text-text">{text}</p>
    </div>
  )
}
