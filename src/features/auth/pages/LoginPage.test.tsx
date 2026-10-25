import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { LoginPage } from './LoginPage'

const authMocks = vi.hoisted(() => ({
  signIn: vi.fn(),
  signInWithMagicLink: vi.fn(),
}))

vi.mock('@contexts/AuthContext', () => ({
  useAuth: () => authMocks,
}))

function renderLoginPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMocks.signIn.mockResolvedValue({ error: null })
    authMocks.signInWithMagicLink.mockResolvedValue({ error: null })
  })

  it('toggles password visibility with its accessible control', async () => {
    const user = userEvent.setup()
    renderLoginPage()

    const password = screen.getByLabelText('Password')
    expect(password).toHaveAttribute('type', 'password')

    await user.click(screen.getByRole('button', { name: 'Show password' }))
    expect(password).toHaveAttribute('type', 'text')
  })

  it('validates and submits a magic link through the form value', async () => {
    const user = userEvent.setup()
    renderLoginPage()

    await user.click(screen.getByRole('button', { name: 'Email me a sign-in link' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a valid email address')
    expect(authMocks.signInWithMagicLink).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText('Email address'), ' staff@example.com ')
    await user.click(screen.getByRole('button', { name: 'Email me a sign-in link' }))

    await waitFor(() => {
      expect(authMocks.signInWithMagicLink).toHaveBeenCalledWith('staff@example.com')
    })
    expect(await screen.findByRole('status')).toHaveTextContent('Check your inbox')
  })

  it('shows returned sign-in failures instead of throwing out of the form', async () => {
    authMocks.signIn.mockResolvedValue({ error: new Error('Credentials were not accepted.') })
    renderLoginPage()

    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'staff@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'correct horse battery' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Credentials were not accepted.')
  })
})
