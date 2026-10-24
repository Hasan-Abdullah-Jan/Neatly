import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@components/ui/Card'
import { useAuth } from '@contexts/AuthContext'
import { Mail, Loader2, CheckCircle } from 'lucide-react'
import { cn } from '@lib/utils'

const forgotSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
})

type ForgotForm = z.infer<typeof forgotSchema>

export function ForgotPasswordPage() {
  const { signInWithMagicLink } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState<'idle' | 'sent' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotForm>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: '' },
  })

  const onSubmit = async (data: ForgotForm) => {
    setIsLoading(true)
    setError(null)
    const { error } = await signInWithMagicLink(data.email)
    setIsLoading(false)
    if (error) {
      setError(error.message)
      setStatus('error')
    } else {
      setStatus('sent')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md" variant="elevated">
        <CardHeader className="text-center">
          <div className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4',
            status === 'sent' ? 'bg-success-100 dark:bg-success-900/30' : 'bg-primary-100 dark:bg-primary-900/30'
          )}>
            {status === 'sent' ? (
              <CheckCircle className="w-7 h-7 text-success-600" />
            ) : (
              <Mail className="w-7 h-7 text-primary-600" />
            )}
          </div>
          <CardTitle>{status === 'sent' ? 'Check your email' : 'Forgot password?'}</CardTitle>
          <CardDescription>
            {status === 'sent'
              ? 'We\'ve sent a magic link to your email. Click the link to sign in.'
              : 'Enter your email and we\'ll send you a magic link to sign in.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status !== 'sent' && (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {error && (
                <div className="p-3 text-sm text-destructive-600 bg-destructive-50 rounded-lg" role="alert">
                  {error}
                </div>
              )}
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
              <Button type="submit" fullWidth loading={isLoading} className="mt-2">
                {isLoading && <Loader2 className="w-4 h-4" />}
                Send magic link
              </Button>
            </form>
          )}
          {status === 'sent' && (
            <div className="text-center">
              <p className="text-text-muted mb-4">Didn't receive the email?</p>
              <Button variant="outline" onClick={() => setStatus('idle')}>
                Try again
              </Button>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <p className="text-center text-sm text-text-muted">
            Remember your password?{' '}
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