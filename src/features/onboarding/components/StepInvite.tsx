import { useState } from 'react'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { Select } from '@components/ui/Select'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@components/ui/Card'
import { Badge } from '@components/ui/Badge'
import { Mail, Trash2, Send, Info } from 'lucide-react'
import type { MembershipRole } from '@/types/database'
import type { OnboardingActions } from '../hooks/useOnboarding'

interface StepInviteProps {
  onboarding: OnboardingActions
}

const roleOptions: Array<{ value: MembershipRole; label: string; description: string }> = [
  { value: 'admin', label: 'Admin', description: 'Manage settings, people, and everything else' },
  { value: 'supervisor', label: 'Supervisor', description: 'Manage tasks, areas, issues, and supplies' },
  { value: 'member', label: 'Member', description: 'Complete tasks and report issues' },
  { value: 'cleaner', label: 'Cleaner', description: 'Complete assigned tasks only' },
  { value: 'auditor', label: 'Auditor', description: 'Read-only access to records' },
]

type InviteRole = Exclude<MembershipRole, 'owner'>

export function StepInvite({ onboarding }: StepInviteProps) {
  const { state } = onboarding
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<InviteRole>('member')
  const [message, setMessage] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)

  const isPersonal = state.profile.spaceType === 'personal'
  const selectedRole = roleOptions.find((option) => option.value === role)

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const trimmed = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError('Enter a valid email address')
      return
    }
    if (state.invitations.some((invitation) => invitation.email.toLowerCase() === trimmed.toLowerCase())) {
      setEmailError('That email is already on the list')
      return
    }
    onboarding.addInvitation({ email: trimmed, role, message: message.trim() })
    setEmail('')
    setMessage('')
    setEmailError(null)
  }

  if (isPersonal) {
    return (
      <div className="space-y-6">
        <div className="py-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/30">
            <Mail className="h-8 w-8 text-primary-600" aria-hidden="true" />
          </div>
          <h3 className="text-heading-md font-semibold text-text mb-2">This space is just for you</h3>
          <p className="mx-auto max-w-md text-text-muted">
            No invitations needed for a personal space. You can invite people later from Space
            Settings if that changes.
          </p>
        </div>
        <Card variant="outlined" className="border-dashed">
          <CardContent className="py-6 text-center">
            <p className="text-sm text-text-muted">No invitations for this profile.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-heading-sm font-medium text-text">Invite people</h3>
          <p className="text-sm text-text-muted mt-1">Optional. Invitations stay pending until accepted.</p>
        </div>
        <Badge variant="outline">{state.invitations.length} invited</Badge>
      </div>

      <Card variant="outlined">
        <CardHeader>
          <CardTitle>Add an invitation</CardTitle>
          <CardDescription>Choose the smallest role that fits what they need to do.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
              <Input
                label="Email address"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value)
                  setEmailError(null)
                }}
                error={emailError ?? undefined}
                leftIcon={<Mail className="w-5 h-5" />}
                required
              />
              <Select
                label="Role"
                options={roleOptions.map((option) => ({ value: option.value, label: option.label }))}
                value={role}
                onChange={(value) => setRole(value as InviteRole)}
              />
            </div>

            {selectedRole && (
              <p className="flex items-start gap-2 text-sm text-text-muted">
                <Info className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                <span>
                  <strong className="text-text">{selectedRole.label}:</strong> {selectedRole.description}
                </span>
              </p>
            )}

            <div>
              <label htmlFor="invite-message" className="mb-1.5 block text-sm font-medium text-text">
                Personal note (optional)
              </label>
              <textarea
                id="invite-message"
                className="min-h-20 w-full resize-y rounded-lg border border-border bg-surface px-4 py-2.5 text-text placeholder:text-text-muted focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                placeholder="A short hello helps."
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                maxLength={300}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <p className="text-xs text-text-muted">
                Pending invitations are stored now. Automatic email delivery is not enabled yet.
              </p>
              <Button type="submit" leftIcon={<Send className="w-4 h-4" />} disabled={!email.trim()}>
                Add invitation
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>Pending invitations</CardTitle>
            <Badge variant="outline">{state.invitations.length}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {state.invitations.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-8 text-center">
              <p className="font-medium text-text">No invitations yet</p>
              <p className="text-sm text-text-muted mt-1">
                That&apos;s fine. You can invite people after setup too.
              </p>
            </div>
          ) : (
            <ul className="space-y-2" role="list">
              {state.invitations.map((invitation) => (
                <li
                  key={invitation.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
                      {invitation.email.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-text">{invitation.email}</p>
                      <p className="text-xs capitalize text-text-muted">{invitation.role}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize">
                      {invitation.role}
                    </Badge>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => onboarding.removeInvitation(invitation.id)}
                      className="text-destructive-600"
                      aria-label={`Remove invitation for ${invitation.email}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
