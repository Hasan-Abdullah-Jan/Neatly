import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '@contexts/AuthContext'
import { OnboardingWizard } from '../components/OnboardingWizard'
import { activateSpace } from '../api/activateSpace'
import type { OnboardingState } from '../hooks/useOnboarding'
import { clearOnboardingDraft } from '../hooks/useOnboarding'

export function OnboardingPage() {
  const navigate = useNavigate()
  const { user, currentSpace, refreshSpaces, setCurrentSpace } = useAuth()

  if (currentSpace) {
    return <Navigate to="/today" replace />
  }

  const handleActivate = async (state: OnboardingState) => {
    if (!user) {
      throw new Error('Your session expired. Sign in again to finish setup.')
    }

    const result = await activateSpace(state, user.id)
    const spaces = await refreshSpaces()
    const createdSpace = spaces.find((space) => space.id === result.space.id) ?? result.space
    setCurrentSpace(createdSpace)
    clearOnboardingDraft()
    navigate('/today', { replace: true })
  }

  return <OnboardingWizard onActivate={handleActivate} />
}
