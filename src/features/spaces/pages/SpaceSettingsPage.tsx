import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { z } from 'zod'
import { cn } from '@lib/utils'
import { useAuth } from '@contexts/AuthContext'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { Select } from '@components/ui/Select'
import { Checkbox } from '@components/ui/Checkbox'
import { Switch } from '@components/ui/Switch'
import { Badge } from '@components/ui/Badge'
import { Skeleton } from '@components/ui/Skeleton'
import { ConfirmModal } from '@components/ui/Modal'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@components/ui/Tabs'
import { useToastHelpers } from '@components/ui/Toast'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@components/ui/Card'
import {
  ArrowLeft,
  Bell,
  Building2,
  Clock,
  Mail,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react'
import type {
  EvidenceRule,
  Invitation,
  MembershipRole,
  ReminderDefaults,
  SpaceModules,
  SpaceSettings,
} from '@/types/database'
import {
  createSpaceInvitation,
  fetchSpaceInvitations,
  fetchSpaceMembers,
  removeMember,
  updateInvitationStatus,
  updateMemberRole,
  updateSpaceDetails,
  type SpaceMember,
} from '../api/spaces'
import { getTimezoneOptions } from '@features/onboarding/data/timezones'

const generalSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  timezone: z.string().trim().min(1, 'Choose a timezone'),
  building: z.string(),
  floor: z.string(),
  zone: z.string(),
})

const inviteSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
})

const roleOptions: Array<{ value: MembershipRole; label: string }> = [
  { value: 'owner', label: 'Owner' },
  { value: 'admin', label: 'Admin' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'member', label: 'Member' },
  { value: 'cleaner', label: 'Cleaner' },
  { value: 'auditor', label: 'Auditor' },
]

const moduleDefinitions: Array<{
  key: keyof SpaceModules
  label: string
  description: string
  required?: boolean
}> = [
  { key: 'tasks', label: 'Tasks', description: 'Core scheduling and completion', required: true },
  { key: 'areas', label: 'Areas', description: 'Rooms and zones', required: true },
  { key: 'supplies', label: 'Supplies', description: 'Stock levels and restock requests' },
  { key: 'issues', label: 'Issues', description: 'Problem reporting and resolution' },
  { key: 'plants', label: 'Plants', description: 'Plant care schedules' },
  { key: 'inventory', label: 'Inventory', description: 'Equipment and asset tracking' },
  { key: 'maintenance', label: 'Maintenance', description: 'Preventive maintenance schedules' },
  { key: 'decluttering', label: 'Decluttering', description: 'Decluttering and donation projects' },
  { key: 'reports', label: 'Reports', description: 'Operational summaries' },
  { key: 'teams', label: 'Teams', description: 'Group members and responsibilities' },
  { key: 'rotation', label: 'Fair rotation', description: 'Take turns on recurring tasks' },
]

const evidenceOptions: Array<{ value: EvidenceRule; label: string; description: string }> = [
  { value: 'none', label: 'No evidence', description: 'One-tap completion. Best for everyday routines.' },
  { value: 'checklist', label: 'Checklist', description: 'Complete each step and note exceptions.' },
  { value: 'photo', label: 'Photo', description: 'Attach an optional photo. Off by default elsewhere.' },
  { value: 'supervisor_review', label: 'Supervisor review', description: 'A supervisor confirms the work.' },
]

const retentionOptions = [
  { value: '30', label: 'Keep 30 days' },
  { value: '90', label: 'Keep 90 days' },
  { value: '180', label: 'Keep 6 months' },
  { value: '365', label: 'Keep 1 year' },
  { value: 'forever', label: 'Keep until deleted' },
]

const defaultReminders: ReminderDefaults = {
  taskReminders: true,
  taskOverdue: true,
  dailySummary: false,
  weeklySummary: true,
}

export function SpaceSettingsPage() {
  const { user, currentSpace, setCurrentSpace, refreshSpaces } = useAuth()
  const { showSuccess, showError } = useToastHelpers()
  const [activeTab, setActiveTab] = useState('general')

  const [general, setGeneral] = useState({
    name: '',
    timezone: 'UTC',
    building: '',
    floor: '',
    zone: '',
  })
  const [generalErrors, setGeneralErrors] = useState<Record<string, string>>({})
  const [savingGeneral, setSavingGeneral] = useState(false)

  const [modules, setModules] = useState<SpaceModules>({})
  const [savingModules, setSavingModules] = useState(false)

  const [evidenceRule, setEvidenceRule] = useState<EvidenceRule>('none')
  const [retention, setRetention] = useState('forever')
  const [reminders, setReminders] = useState<ReminderDefaults>(defaultReminders)
  const [savingRules, setSavingRules] = useState(false)

  const [members, setMembers] = useState<SpaceMember[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [peopleLoading, setPeopleLoading] = useState(true)
  const [peopleError, setPeopleError] = useState<string | null>(null)
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null)
  const [removeTarget, setRemoveTarget] = useState<SpaceMember | null>(null)
  const [removing, setRemoving] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<MembershipRole>('member')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviting, setInviting] = useState(false)
  const [revokingId, setRevokingId] = useState<string | null>(null)

  const timezoneOptions = useMemo(
    () => getTimezoneOptions(general.timezone),
    [general.timezone]
  )

  useEffect(() => {
    if (!currentSpace) return
    setGeneral({
      name: currentSpace.name,
      timezone: currentSpace.timezone,
      building: currentSpace.settings?.building ?? '',
      floor: currentSpace.settings?.floor ?? '',
      zone: currentSpace.settings?.zone ?? '',
    })
    setModules(currentSpace.modules ?? {})
    setEvidenceRule(currentSpace.settings?.evidenceRule ?? 'none')
    setRetention(
      currentSpace.settings?.dataRetentionDays
        ? String(currentSpace.settings.dataRetentionDays)
        : 'forever'
    )
    setReminders({ ...defaultReminders, ...currentSpace.settings?.reminderDefaults })
  }, [currentSpace])

  const loadPeople = useCallback(async () => {
    if (!currentSpace) return
    setPeopleLoading(true)
    setPeopleError(null)
    try {
      const [nextMembers, nextInvitations] = await Promise.all([
        fetchSpaceMembers(currentSpace.id),
        fetchSpaceInvitations(currentSpace.id),
      ])
      setMembers(nextMembers)
      setInvitations(nextInvitations)
    } catch (error) {
      setPeopleError(error instanceof Error ? error.message : 'Could not load people.')
    } finally {
      setPeopleLoading(false)
    }
  }, [currentSpace])

  useEffect(() => {
    void loadPeople()
  }, [loadPeople])

  const myMembership = members.find((member) => member.membership.user_id === user?.id)
  const canManagePeople =
    myMembership?.membership.role === 'owner' || myMembership?.membership.role === 'admin'

  if (!currentSpace) {
    return <Navigate to="/onboarding" replace />
  }

  const mergeSettings = (updates: Partial<SpaceSettings>): SpaceSettings => ({
    ...currentSpace.settings,
    ...updates,
  })

  const handleSaveGeneral = async (event: React.FormEvent) => {
    event.preventDefault()
    const parsed = generalSchema.safeParse(general)
    if (!parsed.success) {
      const errors: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? 'form')
        errors[key] = issue.message
      }
      setGeneralErrors(errors)
      return
    }

    setGeneralErrors({})
    setSavingGeneral(true)
    try {
      const updated = await updateSpaceDetails(currentSpace.id, {
        name: parsed.data.name,
        timezone: parsed.data.timezone,
        settings: mergeSettings({
          building: parsed.data.building.trim(),
          floor: parsed.data.floor.trim(),
          zone: parsed.data.zone.trim(),
        }),
      })
      setCurrentSpace(updated)
      await refreshSpaces()
      showSuccess('Space updated', 'The name and timezone are saved.')
    } catch (error) {
      showError('Could not save', error instanceof Error ? error.message : 'Try again in a moment.')
    } finally {
      setSavingGeneral(false)
    }
  }

  const handleSaveModules = async () => {
    setSavingModules(true)
    try {
      const updated = await updateSpaceDetails(currentSpace.id, { modules })
      setCurrentSpace(updated)
      await refreshSpaces()
      showSuccess('Modules updated', 'Optional features changed without touching task logic.')
    } catch (error) {
      showError('Could not save modules', error instanceof Error ? error.message : 'Try again in a moment.')
    } finally {
      setSavingModules(false)
    }
  }

  const handleSaveRules = async () => {
    setSavingRules(true)
    try {
      const updated = await updateSpaceDetails(currentSpace.id, {
        settings: mergeSettings({
          evidenceRule,
          dataRetentionDays: retention === 'forever' ? null : Number(retention),
          reminderDefaults: reminders,
        }),
      })
      setCurrentSpace(updated)
      await refreshSpaces()
      showSuccess('Rules updated', 'New tasks will use these defaults.')
    } catch (error) {
      showError('Could not save rules', error instanceof Error ? error.message : 'Try again in a moment.')
    } finally {
      setSavingRules(false)
    }
  }

  const handleRoleChange = async (member: SpaceMember, role: MembershipRole) => {
    if (role === member.membership.role) return
    const previous = members
    setUpdatingMemberId(member.membership.id)
    setMembers((current) =>
      current.map((item) =>
        item.membership.id === member.membership.id
          ? { ...item, membership: { ...item.membership, role } }
          : item
      )
    )
    try {
      await updateMemberRole(currentSpace.id, member.membership, role)
      showSuccess('Role updated', 'Changes apply immediately.')
    } catch (error) {
      setMembers(previous)
      showError('Could not change the role', error instanceof Error ? error.message : 'Try again in a moment.')
    } finally {
      setUpdatingMemberId(null)
    }
  }

  const handleRemoveMember = async () => {
    if (!removeTarget) return
    setRemoving(true)
    try {
      await removeMember(currentSpace.id, removeTarget.membership)
      setMembers((current) =>
        current.filter((member) => member.membership.id !== removeTarget.membership.id)
      )
      showSuccess('Member removed', 'Their history stays in the record.')
      setRemoveTarget(null)
    } catch (error) {
      showError('Could not remove the member', error instanceof Error ? error.message : 'Try again in a moment.')
    } finally {
      setRemoving(false)
    }
  }

  const handleInvite = async (event: React.FormEvent) => {
    event.preventDefault()
    const parsed = inviteSchema.safeParse({ email: inviteEmail })
    if (!parsed.success) {
      setInviteError(parsed.error.issues[0]?.message ?? 'Enter a valid email address')
      return
    }
    if (invitations.some((invitation) => invitation.email?.toLowerCase() === parsed.data.email.toLowerCase())) {
      setInviteError('That email is already invited')
      return
    }
    if (!user) {
      setInviteError('Your session expired. Sign in again.')
      return
    }

    setInviteError(null)
    setInviting(true)
    try {
      const invitation = await createSpaceInvitation({
        spaceId: currentSpace.id,
        email: parsed.data.email,
        role: inviteRole,
        invitedBy: user.id,
      })
      setInvitations((current) => [invitation, ...current])
      setInviteEmail('')
      showSuccess('Invitation added', 'It stays pending until accepted.')
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : 'Could not create the invitation.')
    } finally {
      setInviting(false)
    }
  }

  const handleRevoke = async (invitation: Invitation) => {
    setRevokingId(invitation.id)
    try {
      await updateInvitationStatus(invitation.id, 'revoked')
      setInvitations((current) => current.filter((item) => item.id !== invitation.id))
      showSuccess('Invitation revoked')
    } catch (error) {
      showError('Could not revoke the invitation', error instanceof Error ? error.message : 'Try again in a moment.')
    } finally {
      setRevokingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-display-sm font-semibold text-text">Space settings</h1>
            <Badge variant="outline" className="capitalize">
              {currentSpace.type.replace('_', ' ')}
            </Badge>
          </div>
          <p className="mt-1 text-text-muted">
            {currentSpace.name} · {currentSpace.timezone}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => window.history.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
            Back
          </Button>
          <Link
            to="/settings"
            className="inline-flex items-center justify-center rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            Account settings
          </Link>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap gap-1 rounded-lg border border-border bg-surface p-1">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="modules">Modules</TabsTrigger>
          <TabsTrigger value="rules">Rules & reminders</TabsTrigger>
          <TabsTrigger value="people">People</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4 space-y-4">
          <form onSubmit={handleSaveGeneral}>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-text-muted" aria-hidden="true" />
                  <CardTitle>Basics</CardTitle>
                </div>
                <CardDescription>Used across schedules, reports, and area labels.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Space name"
                    value={general.name}
                    onChange={(event) => setGeneral((current) => ({ ...current, name: event.target.value }))}
                    error={generalErrors.name}
                    maxLength={80}
                  />
                  <Select
                    label="Timezone"
                    options={timezoneOptions}
                    value={general.timezone}
                    onChange={(timezone) => setGeneral((current) => ({ ...current, timezone }))}
                    error={generalErrors.timezone}
                    hint="Due dates are calculated in this local time."
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Input
                    label="Building (optional)"
                    value={general.building}
                    onChange={(event) => setGeneral((current) => ({ ...current, building: event.target.value }))}
                    maxLength={60}
                  />
                  <Input
                    label="Floor (optional)"
                    value={general.floor}
                    onChange={(event) => setGeneral((current) => ({ ...current, floor: event.target.value }))}
                    maxLength={60}
                  />
                  <Input
                    label="Zone (optional)"
                    value={general.zone}
                    onChange={(event) => setGeneral((current) => ({ ...current, zone: event.target.value }))}
                    maxLength={60}
                  />
                </div>
                {Object.keys(generalErrors).length > 0 && (
                  <p className="text-sm text-destructive-600" role="alert">
                    Check the highlighted fields.
                  </p>
                )}
              </CardContent>
            </Card>
            <div className="mt-4 flex justify-end">
              <Button type="submit" loading={savingGeneral}>
                Save changes
              </Button>
            </div>
          </form>
        </TabsContent>

        <TabsContent value="modules" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Modules</CardTitle>
              <CardDescription>
                Optional features are independent of core task logic. Off is the default.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border" role="list">
                {moduleDefinitions.map((module) => {
                  const checked = Boolean(modules[module.key])
                  return (
                    <li key={module.key} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
                      <div>
                        <p className="font-medium text-text flex items-center gap-2">
                          {module.label}
                          {module.required && <Badge variant="primary" size="sm">Core</Badge>}
                        </p>
                        <p className="text-sm text-text-muted">{module.description}</p>
                      </div>
                      <Switch
                        checked={module.required ? true : checked}
                        onChange={(next) => {
                          if (module.required) return
                          setModules((current) => ({ ...current, [module.key]: next }))
                        }}
                        disabled={module.required}
                        aria-label={`${module.label} module`}
                      />
                    </li>
                  )
                })}
              </ul>
            </CardContent>
          </Card>
          <div className="mt-4 flex justify-end">
            <Button onClick={handleSaveModules} loading={savingModules}>
              Save modules
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="rules" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-text-muted" aria-hidden="true" />
                <CardTitle>Evidence rule</CardTitle>
              </div>
              <CardDescription>
                The default for new tasks. Photos stay optional and off unless you choose them.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <fieldset>
                <legend className="sr-only">Default evidence rule</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {evidenceOptions.map((option) => (
                    <label
                      key={option.value}
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors',
                        evidenceRule === option.value
                          ? 'border-primary-400 bg-primary-50 dark:border-primary-700 dark:bg-primary-900/20'
                          : 'border-border hover:border-primary-300'
                      )}
                    >
                      <input
                        type="radio"
                        name="evidence-rule"
                        value={option.value}
                        checked={evidenceRule === option.value}
                        onChange={() => setEvidenceRule(option.value)}
                        className="mt-1 h-4 w-4 text-primary-600 focus:ring-2 focus:ring-primary-500"
                      />
                      <span>
                        <span className="block font-medium text-text">{option.label}</span>
                        <span className="block text-sm text-text-muted">{option.description}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-text-muted" aria-hidden="true" />
                <CardTitle>Reminder defaults</CardTitle>
              </div>
              <CardDescription>Applied to new members unless they change their own preferences.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Checkbox
                label="Task reminders"
                description="A quiet reminder before a task is due."
                checked={reminders.taskReminders}
                onCheckedChange={(checked) =>
                  setReminders((current) => ({ ...current, taskReminders: checked }))
                }
              />
              <Checkbox
                label="Overdue notice"
                description="One notice when a task becomes overdue. No nagging."
                checked={reminders.taskOverdue}
                onCheckedChange={(checked) =>
                  setReminders((current) => ({ ...current, taskOverdue: checked }))
                }
              />
              <Checkbox
                label="Daily summary"
                description="A short summary at the start of the day."
                checked={reminders.dailySummary}
                onCheckedChange={(checked) =>
                  setReminders((current) => ({ ...current, dailySummary: checked }))
                }
              />
              <Checkbox
                label="Weekly summary"
                description="A weekly overview of what was done and what needs attention."
                checked={reminders.weeklySummary}
                onCheckedChange={(checked) =>
                  setReminders((current) => ({ ...current, weeklySummary: checked }))
                }
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-text-muted" aria-hidden="true" />
                <CardTitle>Data retention</CardTitle>
              </div>
              <CardDescription>
                How long completion history and issue records are kept. Members are never deleted
                automatically.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select
                label="Keep history for"
                options={retentionOptions}
                value={retention}
                onChange={setRetention}
                className="max-w-xs"
              />
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSaveRules} loading={savingRules}>
              Save rules
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="people" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-text-muted" aria-hidden="true" />
                <CardTitle>Members</CardTitle>
              </div>
              <CardDescription>
                Roles decide what people can do. The database enforces the same rules.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {peopleLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : peopleError ? (
                <div className="rounded-lg border border-destructive-200 bg-destructive-50 p-4 dark:border-destructive-800 dark:bg-destructive-900/20" role="alert">
                  <p className="font-medium text-destructive-800 dark:text-destructive-200">
                    Could not load members
                  </p>
                  <p className="mt-1 text-sm text-destructive-700 dark:text-destructive-300">{peopleError}</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => void loadPeople()}>
                    Try again
                  </Button>
                </div>
              ) : members.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border py-8 text-center">
                  <p className="font-medium text-text">No members yet</p>
                  <p className="text-sm text-text-muted mt-1">Invite someone below to get started.</p>
                </div>
              ) : (
                <ul className="divide-y divide-border" role="list">
                  {members.map((member) => {
                    const isSelf = member.membership.user_id === user?.id
                    const name = member.profile?.full_name || (isSelf ? user?.email : null) || 'Member'
                    return (
                      <li key={member.membership.id} className="flex flex-wrap items-center gap-3 py-4 first:pt-0 last:pb-0">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
                          {name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-text">
                            {name} {isSelf && <span className="text-text-muted">(you)</span>}
                          </p>
                          <p className="text-xs text-text-muted">
                            Joined {new Date(member.membership.joined_at).toLocaleDateString()}
                          </p>
                        </div>
                        {canManagePeople ? (
                          <div className="flex items-center gap-2">
                            <Select
                              aria-label={`Role for ${name}`}
                              options={roleOptions}
                              value={member.membership.role}
                              onChange={(value) => void handleRoleChange(member, value as MembershipRole)}
                              disabled={updatingMemberId === member.membership.id}
                              className="w-36 py-1.5 text-sm"
                              fullWidth={false}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive-600"
                              onClick={() => setRemoveTarget(member)}
                              disabled={isSelf}
                              aria-label={`Remove ${name}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <Badge variant="outline" className="capitalize">
                            {member.membership.role}
                          </Badge>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
              {!peopleLoading && !peopleError && !canManagePeople && members.length > 0 && (
                <p className="mt-4 text-sm text-text-muted">
                  Only owners and admins can change roles or invite people.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-text-muted" aria-hidden="true" />
                <CardTitle>Invite someone</CardTitle>
              </div>
              <CardDescription>
                Invitations stay pending until accepted. Email delivery is not enabled yet.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {canManagePeople ? (
                <form onSubmit={handleInvite} className="space-y-4" noValidate>
                  <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
                    <Input
                      label="Email"
                      type="email"
                      placeholder="name@example.com"
                      value={inviteEmail}
                      onChange={(event) => {
                        setInviteEmail(event.target.value)
                        setInviteError(null)
                      }}
                      error={inviteError ?? undefined}
                      leftIcon={<Mail className="h-5 w-5" />}
                    />
                    <Select
                      label="Role"
                      options={roleOptions.filter((role) => role.value !== 'owner')}
                      value={inviteRole}
                      onChange={(value) => setInviteRole(value as MembershipRole)}
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit" loading={inviting} disabled={!inviteEmail.trim()}>
                      Add invitation
                    </Button>
                  </div>
                </form>
              ) : (
                <p className="text-sm text-text-muted">Only owners and admins can invite people.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle>Pending invitations</CardTitle>
                  <CardDescription>Expired invitations can be removed safely.</CardDescription>
                </div>
                <Badge variant="outline">{invitations.length}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {peopleLoading ? (
                <Skeleton className="h-14 w-full" />
              ) : invitations.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border py-8 text-center">
                  <p className="font-medium text-text">No pending invitations</p>
                  <p className="text-sm text-text-muted mt-1">Everyone invited has joined or none were sent.</p>
                </div>
              ) : (
                <ul className="divide-y divide-border" role="list">
                  {invitations.map((invitation) => (
                    <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-text">{invitation.email ?? 'Email pending'}</p>
                        <p className="text-xs text-text-muted">
                          {invitation.role} · expires {new Date(invitation.expires_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">
                          {invitation.status}
                        </Badge>
                        {canManagePeople && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleRevoke(invitation)}
                            loading={revokingId === invitation.id}
                          >
                            Revoke
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ConfirmModal
        isOpen={removeTarget !== null}
        onClose={() => setRemoveTarget(null)}
        onConfirm={() => void handleRemoveMember()}
        title="Remove this member?"
        message="They lose access to this space. Their past completions and history stay in the record."
        confirmText="Remove member"
        variant="destructive"
        loading={removing}
      />
    </div>
  )
}
