import { useState } from 'react'
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Input } from './Input'

function PasswordInput() {
  const [visible, setVisible] = useState(false)
  return (
    <Input
      label="Password"
      type={visible ? 'text' : 'password'}
      rightIcon={
        <button type="button" aria-label={visible ? 'Hide password' : 'Show password'} onClick={() => setVisible(!visible)}>
          Toggle
        </button>
      }
    />
  )
}

describe('Input', () => {
  it('keeps interactive right-side controls clickable', () => {
    render(<PasswordInput />)

    const password = screen.getByLabelText('Password')
    expect(password).toHaveAttribute('type', 'password')

    fireEvent.click(screen.getByRole('button', { name: 'Show password' }))
    expect(password).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: 'Hide password' })).toBeInTheDocument()
  })

  it('connects validation errors to the input', () => {
    render(<Input label="Email" error="Enter a valid email" />)
    const input = screen.getByLabelText('Email')

    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Enter a valid email')
  })
})
