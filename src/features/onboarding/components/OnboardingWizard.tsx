import { useState } from 'react'
import { cn } from '@lib/utils'
import { Button } from '@components/ui/Button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@components/ui/Card'
import { Progress } from '@components/ui/Progress'
import { ConfirmModal } from '@components/ui/Modal'
import { Check, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useOnboarding, type OnboardingState } from '../hooks/useOnboarding'
import { StepProfile } from './StepProfile'
import { StepDetails } from './StepDetails'
import { StepAreas } from './StepAreas'
import { StepPlan } from './StepPlan'
import { StepReview } from './StepReview'
import { StepInvite } from './StepInvite'
import { StepModules } from './StepModules'
import { StepComplete } from './StepComplete'

interface OnboardingWizardProps {
  onActivate: (state: OnboardingState) => Promise<void>
}

const stepDescriptions: Record<number, string> = {
  1: 'Choose the closest fit. This shapes the suggested areas and tasks.',
  2: 'Give the space a name and set its local time.',
  3: 'Keep the suggested areas, rename them, or add your own.',
  4: 'Turn tasks on or off and adjust how often they happen.',
  5: 'Check the whole plan before anything is created.',
  6: 'Add people and choose a role. Skippable.',
  7: 'Turn on optional modules. The profile defaults are a starting point.',
}

export function OnboardingWizard({ onActivate }: OnboardingWizardProps) {
  const onboarding = useOnboarding()
  const { state, stepLabels, canProceed, goToStep, complete, reset } = onboarding
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  if (state.completed) {
    return (
      <div className="min-h-screen bg-background px-4 py-8 sm:px-6">
        <StepComplete
          state={state}
          onActivate={onActivate}
          onReview={() => goToStep(5)}
        />
      </div>
    )
  }

  const renderStep = () => {
    switch (state.currentStep) {
      case 1:
        return <StepProfile profile={state.profile} onSelect={onboarding.selectProfile} />
      case 2:
        return <StepDetails profile={state.profile} updateProfile={onboarding.updateProfile} />
      case 3:
        return <StepAreas onboarding={onboarding} />
      case 4:
        return <StepPlan onboarding={onboarding} />
      case 5:
        return <StepReview onboarding={onboarding} />
      case 6:
        return <StepInvite onboarding={onboarding} />
      case 7:
        return <StepModules onboarding={onboarding} />
      default:
        return null
    }
  }

  const handleNext = () => {
    if (state.currentStep < state.totalSteps) {
      onboarding.nextStep()
    } else {
      complete()
    }
  }

  const progress = Math.round((state.currentStep / state.totalSteps) * 100)

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 flex-shrink-0 flex-col border-r border-border bg-surface p-6 lg:flex">
        <div className="mb-8">
          <h1 className="mb-1 text-heading-md font-semibold text-text">Neatly setup</h1>
          <p className="text-sm text-text-muted">Your draft saves automatically.</p>
        </div>

        <div className="mb-8">
          <Progress value={progress} label="Setup progress" />
          <p className="mt-2 text-sm text-text-muted">
            Step {state.currentStep} of {state.totalSteps}
          </p>
        </div>

        <nav className="flex-1" aria-label="Setup steps">
          <ol className="space-y-2" role="list">
            {stepLabels.map((label, index) => {
              const stepNumber = index + 1
              const isActive = stepNumber === state.currentStep
              const isCompleted = stepNumber < state.currentStep
              return (
                <li key={label}>
                  <button
                    type="button"
                    onClick={() => stepNumber <= state.currentStep && goToStep(stepNumber)}
                    disabled={stepNumber > state.currentStep}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors',
                      isActive
                        ? 'bg-primary-50 text-primary-800 dark:bg-primary-900/30 dark:text-primary-200'
                        : isCompleted
                          ? 'text-success-700 hover:bg-neutral-100 dark:text-success-300 dark:hover:bg-neutral-800'
                          : 'text-text-muted'
                    )}
                    aria-current={isActive ? 'step' : undefined}
                  >
                    <span
                      className={cn(
                        'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-medium',
                        isActive
                          ? 'bg-primary-600 text-white'
                          : isCompleted
                            ? 'bg-success-600 text-white'
                            : 'bg-neutral-200 text-text-muted dark:bg-neutral-700'
                      )}
                    >
                      {isCompleted ? <Check className="h-4 w-4" aria-hidden="true" /> : stepNumber}
                    </span>
                    <span className="truncate text-sm font-medium">{label}</span>
                  </button>
                </li>
              )
            })}
          </ol>
        </nav>

        <div className="border-t border-border pt-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full justify-start text-destructive-600"
            onClick={() => setShowResetConfirm(true)}
          >
            <X className="h-4 w-4 mr-2" aria-hidden="true" />
            Start over
          </Button>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b border-border bg-surface px-4 py-4 lg:px-6">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
            <div className="min-w-0">
              <h1 className="truncate text-heading-lg font-semibold text-text">Welcome to Neatly</h1>
              <p className="mt-1 text-sm text-text-muted">
                {stepLabels[state.currentStep - 1]} · {state.currentStep} of {state.totalSteps}
              </p>
            </div>
            <div className="w-32 flex-shrink-0 lg:w-48">
              <Progress value={progress} size="sm" showLabel label="Progress" />
            </div>
          </div>
        </header>

        <div className="flex-1 p-4 lg:p-6">
          <div className="mx-auto w-full max-w-4xl">
            <Card>
              <CardHeader>
                <CardTitle>{stepLabels[state.currentStep - 1]}</CardTitle>
                <CardDescription>{stepDescriptions[state.currentStep] ?? ''}</CardDescription>
              </CardHeader>
              <CardContent>{renderStep()}</CardContent>
              <CardFooter className="flex items-center justify-between gap-3 border-t border-border pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onboarding.prevStep}
                  disabled={state.currentStep === 1}
                  leftIcon={<ChevronLeft className="h-4 w-4" />}
                >
                  Back
                </Button>
                <div className="flex items-center gap-3">
                  <span className="hidden text-xs text-text-muted sm:inline">
                    Draft saved on this device
                  </span>
                  <Button
                    type="button"
                    onClick={handleNext}
                    disabled={!canProceed}
                    rightIcon={state.currentStep === state.totalSteps ? <Check className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  >
                    {state.currentStep === state.totalSteps ? 'Review activation' : 'Next'}
                  </Button>
                </div>
              </CardFooter>
            </Card>
          </div>
        </div>
      </main>

      <ConfirmModal
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={() => {
          reset()
          setShowResetConfirm(false)
        }}
        title="Start setup over?"
        message="This clears the draft on this device. Nothing has been created in your workspace yet."
        confirmText="Start over"
        variant="destructive"
      />
    </div>
  )
}

export type { OnboardingState }
