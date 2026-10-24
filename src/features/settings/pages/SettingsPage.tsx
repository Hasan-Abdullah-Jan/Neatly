import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@components/ui/Card'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { Select } from '@components/ui/Select'
import { Checkbox } from '@components/ui/Checkbox'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@components/ui/Tabs'
import { useAuth } from '@contexts/AuthContext'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { User, Bell, Palette, Shield, Key, Trash2, Mail, Loader2, Sun, Moon, Monitor, Download } from 'lucide-react'
import { cn } from '@lib/utils'
import { useToastHelpers } from '@components/ui/Toast'

const profileSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  language: z.string(),
  theme: z.enum(['light', 'dark', 'system']),
})

type ProfileForm = z.infer<typeof profileSchema>

const notificationSchema = z.object({
  emailEnabled: z.boolean(),
  pushEnabled: z.boolean(),
  inAppEnabled: z.boolean(),
  taskReminders: z.boolean(),
  taskOverdue: z.boolean(),
  dailySummary: z.boolean(),
  weeklySummary: z.boolean(),
})

type NotificationForm = z.infer<typeof notificationSchema>

export function SettingsPage() {
  const { profile, updateProfile, user } = useAuth()
  const { showSuccess, showError } = useToastHelpers()
  const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'appearance' | 'privacy'>('profile')
  const [isSaving, setIsSaving] = useState(false)

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: profile?.full_name || user?.user_metadata?.full_name || '',
      email: user?.email || '',
      language: profile?.language || 'en',
      theme: profile?.theme || 'system',
    },
  })

  const notificationForm = useForm<NotificationForm>({
    resolver: zodResolver(notificationSchema),
    defaultValues: {
      emailEnabled: true,
      pushEnabled: true,
      inAppEnabled: true,
      taskReminders: true,
      taskOverdue: true,
      dailySummary: false,
      weeklySummary: true,
    },
  })

  const handleProfileSubmit = async (data: ProfileForm) => {
    setIsSaving(true)
    const { error } = await updateProfile(data)
    setIsSaving(false)
    if (error) {
      showError('Failed to save', error.message)
    } else {
      showSuccess('Profile updated', 'Your changes have been saved')
    }
  }

  const handleNotificationSubmit = async (_data: NotificationForm) => {
    setIsSaving(true)
    await new Promise((r) => setTimeout(r, 500))
    setIsSaving(false)
    showSuccess('Preferences saved', 'Your notification settings have been updated')
  }

  const tabs = [
    { id: 'profile' as const, label: 'Profile', icon: <User className="w-5 h-5" /> },
    { id: 'notifications' as const, label: 'Notifications', icon: <Bell className="w-5 h-5" /> },
    { id: 'appearance' as const, label: 'Appearance', icon: <Palette className="w-5 h-5" /> },
    { id: 'privacy' as const, label: 'Privacy & Security', icon: <Shield className="w-5 h-5" /> },
  ]

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-display-sm font-semibold text-text">Settings</h1>
        <p className="text-body text-text-muted mt-1">Manage your account and preferences</p>
      </div>

      <Tabs value={activeTab} onValueChange={(v: string) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="grid grid-cols-4 gap-1">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="flex items-center justify-center gap-2">
              {tab.icon}
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Manage your personal information</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={profileForm.handleSubmit(handleProfileSubmit)} className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Full name"
                    placeholder="Your name"
                    leftIcon={<User className="w-5 h-5" />}
                    error={profileForm.formState.errors.fullName?.message}
                    {...profileForm.register('fullName')}
                  />
                  <Input
                    label="Email"
                    type="email"
                    placeholder="you@example.com"
                    leftIcon={<Mail className="w-5 h-5" />}
                    error={profileForm.formState.errors.email?.message}
                    {...profileForm.register('email')}
                    disabled
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Select
                    label="Language"
                    options={[
                      { value: 'en', label: 'English' },
                      { value: 'es', label: 'Spanish' },
                      { value: 'fr', label: 'French' },
                      { value: 'de', label: 'German' },
                      { value: 'ja', label: 'Japanese' },
                    ]}
                    error={profileForm.formState.errors.language?.message}
                    onChange={(value: string) => profileForm.setValue('language', value, { shouldValidate: true })}
                  />
                  <Select
                    label="Theme"
                    options={[
                      { value: 'light', label: 'Light' },
                      { value: 'dark', label: 'Dark' },
                      { value: 'system', label: 'System' },
                    ]}
                    error={profileForm.formState.errors.theme?.message}
                    onChange={(value: string) => profileForm.setValue('theme', value as 'light' | 'dark' | 'system', { shouldValidate: true })}
                  />
                </div>
                <div className="flex justify-end pt-4 border-t border-border">
                  <Button type="submit" loading={isSaving}>
                    {isSaving && <Loader2 className="w-4 h-4" />}
                    Save changes
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>Choose how and when you want to be notified</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={notificationForm.handleSubmit(handleNotificationSubmit)} className="space-y-6">
                <fieldset>
                  <legend className="text-sm font-medium text-text mb-4">Delivery methods</legend>
                  <div className="space-y-3">
                    <Checkbox
                      label="Email notifications"
                      description="Receive notifications via email"
                      {...notificationForm.register('emailEnabled')}
                    />
                    <Checkbox
                      label="Push notifications"
                      description="Receive push notifications on your device"
                      {...notificationForm.register('pushEnabled')}
                    />
                    <Checkbox
                      label="In-app notifications"
                      description="Show notifications within the app"
                      {...notificationForm.register('inAppEnabled')}
                    />
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-sm font-medium text-text mb-4">Task notifications</legend>
                  <div className="space-y-3">
                    <Checkbox
                      label="Task reminders"
                      description="Get reminded before tasks are due"
                      {...notificationForm.register('taskReminders')}
                    />
                    <Checkbox
                      label="Overdue tasks"
                      description="Notify me when tasks become overdue"
                      {...notificationForm.register('taskOverdue')}
                    />
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-sm font-medium text-text mb-4">Summaries</legend>
                  <div className="space-y-3">
                    <Checkbox
                      label="Daily summary"
                      description="Receive a daily summary of tasks"
                      {...notificationForm.register('dailySummary')}
                    />
                    <Checkbox
                      label="Weekly summary"
                      description="Receive a weekly summary of activity"
                      {...notificationForm.register('weeklySummary')}
                    />
                  </div>
                </fieldset>

                <div className="flex justify-end pt-4 border-t border-border">
                  <Button type="submit" loading={isSaving}>
                    {isSaving && <Loader2 className="w-4 h-4" />}
                    Save preferences
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>Customize how Neatly looks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <fieldset>
                <legend className="text-sm font-medium text-text mb-4">Theme</legend>
                <div className="grid grid-cols-3 gap-3">
                  {(['light', 'dark', 'system'] as const).map((theme: 'light' | 'dark' | 'system') => (
                    <button
                      key={theme}
                      type="button"
                      onClick={() => profileForm.setValue('theme', theme, { shouldValidate: true })}
                      className={cn(
                        'p-4 rounded-lg border-2 transition-colors flex flex-col items-center gap-2',
                        profileForm.watch('theme') === theme
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                          : 'border-border hover:border-primary-300'
                      )}
                    >
                      {theme === 'light' && <Sun className="w-8 h-8" />}
                      {theme === 'dark' && <Moon className="w-8 h-8" />}
                      {theme === 'system' && <Monitor className="w-8 h-8" />}
                      <span className="text-sm font-medium capitalize">{theme}</span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-sm font-medium text-text mb-4">Density</legend>
                <div className="grid grid-cols-3 gap-3">
                  {(['comfortable', 'compact', 'spacious'] as const).map((density) => (
                    <button
                      key={density}
                      type="button"
                      className={cn(
                        'p-4 rounded-lg border-2 transition-colors flex flex-col items-center gap-2',
                        'border-border hover:border-primary-300'
                      )}
                    >
                      <div className={cn(
                        'w-16 h-8 rounded border-2 bg-surface',
                        density === 'compact' && 'border-t-4',
                        density === 'spacious' && 'border-t-8'
                      )} />
                      <span className="text-sm font-medium capitalize">{density}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="privacy">
          <Card>
            <CardHeader>
              <CardTitle>Privacy & Security</CardTitle>
              <CardDescription>Manage your data and security settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-text">Two-factor authentication</p>
                    <p className="text-sm text-text-muted">Add an extra layer of security to your account</p>
                  </div>
                  <Button variant="outline" leftIcon={<Key className="w-4 h-4" />}>Enable 2FA</Button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-text">Export my data</p>
                    <p className="text-sm text-text-muted">Download a copy of all your data</p>
                  </div>
                  <Button variant="outline" leftIcon={<Download className="w-4 h-4" />}>Export data</Button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-text">Delete account</p>
                    <p className="text-sm text-text-muted">Permanently delete your account and all data</p>
                  </div>
                  <Button variant="destructive" leftIcon={<Trash2 className="w-4 h-4" />}>Delete account</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}