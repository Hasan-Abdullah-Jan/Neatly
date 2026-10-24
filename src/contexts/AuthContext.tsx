import { createContext, useContext, useEffect, useState, type ReactNode, useCallback } from 'react'
import { supabase } from '@lib/supabase'
import type { User, Session } from '@supabase/supabase-js'
import type { Space } from '@/types/database'

interface Profile {
  id: string
  full_name: string | null
  language: string
  theme: 'light' | 'dark' | 'system'
  created_at: string
  updated_at: string
}

interface AuthContextValue {
  user: User | null
  session: Session | null
  profile: Profile | null
  currentSpace: Space | null
  spaces: Space[]
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>
  signInWithMagicLink: (email: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  updateProfile: (data: Partial<Profile>) => Promise<{ error: Error | null }>
  setCurrentSpace: (space: Space | null) => void
  refreshSpaces: () => Promise<Space[]>
  toggleDemoMode: () => void
  isDemoMode: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [currentSpace, setCurrentSpace] = useState<Space | null>(null)
  const [spaces, setSpaces] = useState<Space[]>([])
  const [loading, setLoading] = useState(true)
  const [isDemoMode, setIsDemoMode] = useState(false)

  const fetchProfile = useCallback(async (userId: string) => {
    const result = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    
    const { data, error } = result as { data: Profile | null; error: Error | null }
    
    if (!error && data) {
      setProfile(data)
    }
  }, [])

  const fetchSpaces = useCallback(async (userId: string): Promise<Space[]> => {
    const result = await supabase
      .from('memberships')
      .select(`
        space_id,
        role,
        spaces!inner(*)
      `)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .is('spaces.deleted_at', null)

    const { data, error } = result as { data: Array<{ spaces: Space }> | null; error: Error | null }

    if (error) {
      return []
    }

    const userSpaces = (data ?? []).map((membership) => membership.spaces).filter(Boolean)
    setSpaces(userSpaces)

    setCurrentSpace((previous) => {
      if (previous) {
        const stillAvailable = userSpaces.find((space) => space.id === previous.id)
        if (stillAvailable) return stillAvailable
      }
      return userSpaces[0] ?? null
    })

    return userSpaces
  }, [])

  const refreshSpaces = useCallback(async () => {
    if (!user) return []
    return fetchSpaces(user.id)
  }, [user, fetchSpaces])

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
        fetchSpaces(session.user.id)
      }
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        await fetchProfile(session.user.id)
        await fetchSpaces(session.user.id)
      } else {
        setProfile(null)
        setSpaces([])
        setCurrentSpace(null)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [fetchProfile, fetchSpaces])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error ? new Error(error.message) : null }
  }

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    return { error: error ? new Error(error.message) : null }
  }

  const signInWithMagicLink = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({ email })
    return { error: error ? new Error(error.message) : null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
    setProfile(null)
    setSpaces([])
    setCurrentSpace(null)
  }

  const updateProfile = async (data: Partial<Profile>) => {
    if (!user) return { error: new Error('Not authenticated') }
    
    const result = await (supabase as any)
      .from('profiles')
      .update(data)
      .eq('id', user.id)
    
    const { error } = result as { error: Error | null }
    
    if (!error) {
      setProfile((prev) => (prev ? { ...prev, ...data } : null))
    }
    return { error: error ? new Error(error.message) : null }
  }

  const toggleDemoMode = useCallback(() => {
    setIsDemoMode((prev) => !prev)
    // TODO: Implement demo mode logic in Level 12
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        currentSpace,
        spaces,
        loading,
        signIn,
        signUp,
        signInWithMagicLink,
        signOut,
        updateProfile,
        setCurrentSpace,
        refreshSpaces,
        toggleDemoMode,
        isDemoMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}