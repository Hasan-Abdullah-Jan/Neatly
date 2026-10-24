import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@components/ui/Card'
import { useAuth } from '@contexts/AuthContext'
import { Mail, Lock, User, Loader2, Eye, EyeOff } from 'lucide-react'

const registerSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

type RegisterForm = z.infer<typeof registerSchema>

export function RegisterPage() {
  const navigate = useNavigate()
  const { signUp } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: '', email: '', password: '', confirmPassword: '' },
  })

  const password = watch('password')

  const onSubmit = async (data: RegisterForm) => {
    setIsLoading(true)
    setError(null)
    const { error } = await signUp(data.email, data.password, data.fullName)
    setIsLoading(false)
    if (error) {
      setError(error.message)
    } else {
      navigate('/today', { replace: true })
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md" variant="elevated">
        <CardHeader className="text-center">
          <div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <CardTitle>Create your account</CardTitle>
          <CardDescription>Start organizing your spaces with Neatly</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-destructive-600 bg-destructive-50 rounded-lg" role="alert">
                {error}
              </div>
            )}
            <Input
              label="Full name"
              type="text"
              placeholder="Jane Doe"
              leftIcon={<User className="w-5 h-5" />}
              error={errors.fullName?.message}
              {...register('fullName')}
              autoComplete="name"
              disabled={isLoading}
            />
            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              leftIcon={<Mail className="w-5 h-5" />}
              error={errors.email?.message}
              {...register('email')}
              autoComplete="email"
              disabled={isLoading}
            />
            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                leftIcon={<Lock className="w-5 h-5" />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-text-muted hover:text-text"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                }
                error={errors.password?.message}
                {...register('password')}
                autoComplete="new-password"
                disabled={isLoading}
              />
              {password && (
                <div className="mt-2 text-xs text-text-muted">
                  <div className="flex gap-1 h-1">
                    {['weak', 'fair', 'good', 'strong'].map((_, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded"
                        style={{
                          backgroundColor:
                            (password.length >= 8 && i < 1) ||
                            (password.length >= 10 && i < 2) ||
                            (/[A-Z]/.test(password) && /[0-9]/.test(password) && i < 3) ||
                            (/[^A-Za-z0-9]/.test(password) && i < 4)
                              ? 'var(--color-primary)'
                              : 'var(--color-border)'
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
            <Input
              label="Confirm password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              leftIcon={<Lock className="w-5 h-5" />}
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
              autoComplete="new-password"
              disabled={isLoading}
            />
            <Button type="submit" fullWidth loading={isLoading} className="mt-2">
              {isLoading && <Loader2 className="w-4 h-4" />}
              Create account
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <p className="text-center text-sm text-text-muted">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-600 hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}

import { useState } from 'react'