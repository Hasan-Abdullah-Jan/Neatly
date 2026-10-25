import { useState, useEffect, useCallback } from 'react'
import { getSession, closeSession, type SharedDeviceSession } from '../api/sharedDevice'
import { useAuth } from '@contexts/AuthContext'

const SESSION_STORAGE_KEY = 'neatly-shared-session'

export function useSharedDevice() {
  const { currentSpace } = useAuth()
  const [session, setSession] = useState<SharedDeviceSession | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadSession()
  }, [currentSpace?.id])

  const loadSession = useCallback(async () => {
    if (!currentSpace?.id) return

    const stored = sessionStorage.getItem(SESSION_STORAGE_KEY)
    if (!stored) {
      setSession(null)
      return
    }

    try {
      setLoading(true)
      const token = JSON.parse(stored)
      const sessionData = await getSession(currentSpace.id, token)

      if (sessionData) {
        setSession(sessionData)
      } else {
        sessionStorage.removeItem(SESSION_STORAGE_KEY)
        setSession(null)
      }
    } catch (err) {
      console.error('Failed to load session:', err)
      sessionStorage.removeItem(SESSION_STORAGE_KEY)
      setSession(null)
    } finally {
      setLoading(false)
    }
  }, [currentSpace?.id])

  const startSession = useCallback((newSession: SharedDeviceSession) => {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(newSession.token))
    setSession(newSession)
  }, [])

  const endSession = useCallback(async () => {
    if (session?.token) {
      try {
        await closeSession(session.token)
      } catch (err) {
        console.error('Failed to close session:', err)
      }
    }
    sessionStorage.removeItem(SESSION_STORAGE_KEY)
    setSession(null)
  }, [session?.token])

  return {
    session,
    loading,
    startSession,
    endSession,
    refreshSession: loadSession,
  }
}
