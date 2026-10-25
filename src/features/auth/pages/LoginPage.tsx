import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@components/ui/Card'
import { useAuth } from '@contexts/AuthContext'
import { Mail, Lock, Eye, EyeOff, Sparkles } from 'lucide-react'

const loginSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

type LoginForm = z.infer<typeof loginSchema>

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn, signInWithMagicLink } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const from = (location.state as { from?: Location })?.from?.pathname || '/today'

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })
  const email = watch('email')

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true)
    setError(null)
    setNotice(null)
    try {
      const result = await signIn(data.email.trim(), data.password)
      if (result.error) {
        setError(result.error.message)
      } else {
        navigate(from, { replace: true })
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Sign in failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleMagicLink = async () => {
    const parsedEmail = loginSchema.shape.email.safeParse(email?.trim())
    if (!parsedEmail.success) {
      setError('Enter a valid email address above to receive a sign-in link.')
      return
    }
    setIsLoading(true)
    setError(null)
    setNotice(null)
    try {
      const result = await signInWithMagicLink(parsedEmail.data)
      if (result.error) {
        setError(result.error.message)
      } else {
        setNotice('Your sign-in link is on its way. Check your inbox.')
      }
    } catch (linkError) {
      setError(linkError instanceof Error ? linkError.message : 'The sign-in link could not be sent.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="startup-canvas flex min-h-screen items-center justify-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-md">
        <div className="mb-5 flex items-center justify-center gap-2 text-sm font-semibold tracking-wide text-primary-text">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/75 shadow-sm ring-1 ring-white/80">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          </span>
          NEATLY
        </div>
        <Card className="glass-card w-full rounded-3xl border border-white/70 px-1 py-2 shadow-2xl shadow-teal-950/10 sm:px-3" variant="glass">
          <CardHeader className="px-5 pt-6 text-center sm:px-7">
            <CardTitle size="lg" className="text-3xl tracking-tight">Welcome back</CardTitle>
            <CardDescription className="mt-2 text-base">A calmer way to care for your space.</CardDescription>
          </CardHeader>
          <CardContent className="px-5 sm:px-7">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {error && (
                <div className="rounded-xl border border-destructive-200 bg-destructive-50 p-3 text-sm text-destructive-text" role="alert">
                  {error}
                </div>
              )}
              {notice && (
                <div className="rounded-xl border border-success-200 bg-success-50 p-3 text-sm text-success-text" role="status" aria-live="polite">
                  {notice}
                </div>
              )}
              <Input
                label="Email address"
                type="email"
                placeholder="you@example.com"
                leftIcon={<Mail className="h-5 w-5" />}
                error={errors.email?.message}
                {...register('email')}
                autoComplete="email"
                disabled={isLoading}
              />
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                leftIcon={<Lock className="h-5 w-5" />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword((shown) => !shown)}
                    className="touch-target rounded-lg p-2 text-text-muted transition hover:bg-black/5 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-active"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                }
                error={errors.password?.message}
                {...register('password')}
                autoComplete="current-password"
                disabled={isLoading}
              />
              <div className="flex items-center justify-end">
                <Link to="/forgot-password" className="rounded font-medium text-primary-text underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-active">
                  Forgot password?
                </Link>
              </div>
              <Button type="submit" fullWidth loading={isLoading} className="mt-1 min-h-12 rounded-xl shadow-lg shadow-teal-900/15">
                Sign in
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex-col gap-4 px-5 pb-3 sm:px-7">
            <div className="relative w-full">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border/80" /></div>
              <div className="relative flex justify-center text-sm"><span className="bg-white/80 px-3 text-text-muted">or sign in without a password</span></div>
            </div>
            <Button variant="outline" fullWidth onClick={handleMagicLink} disabled={isLoading} className="min-h-12 rounded-xl border-white/80 bg-white/45">
              <Mail className="mr-2 h-4 w-4" />
              Email me a sign-in link
            </Button>
            <p className="pt-1 text-center text-sm text-text-muted">
              New to Neatly?{' '}
              <Link to="/register" className="font-semibold text-primary-text underline-offset-4 hover:underline">Create an account</Link>
            </p>
            <a href="/demo" className="inline-flex min-h-11 items-center justify-center rounded-lg px-3 text-sm font-medium text-primary-text underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-active">
              Try the guided demo
            </a>
          </CardFooter>
        </Card>
        <p className="mt-5 text-center text-xs text-text-muted">Your space, your pace. No streaks or leaderboards.</p>
      </div>
    </div>
  )
}