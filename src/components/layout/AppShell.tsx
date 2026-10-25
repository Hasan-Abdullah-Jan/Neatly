import { useState, useEffect } from 'react'
import { Outlet, useLocation, NavLink, useNavigate } from 'react-router-dom'
import { cn } from '@lib/utils'
import { Button } from '@components/ui/Button'
import { SpaceSelector } from '@features/spaces/components/SpaceSelector'
import { useAuth } from '@contexts/AuthContext'
import { getUnreadNotificationCount } from '@features/notifications/api/notifications'
import {
  Home,
  LayoutGrid,
  CheckSquare,
  Package,
  History,
  Settings,
  FolderOpen,
  ClipboardList,
  AlertTriangle,
  Menu,
  X,
  ChevronDown,
  Sun,
  Moon,
  Monitor,
  LogOut,
  User,
  Users,
  CalendarDays,
  Scale,
  Bell,
  Lightbulb,
} from 'lucide-react'

type NavItem = {
  path: string
  label: string
  icon: React.ReactNode
  modes: ('personal' | 'organization')[]
  badge?: number
}

const personalNavItems: NavItem[] = [
  { path: '/today', label: 'Today', icon: <Home className="w-6 h-6" />, modes: ['personal'] },
  { path: '/rooms', label: 'Rooms & areas', icon: <LayoutGrid className="w-6 h-6" />, modes: ['personal'] },
  { path: '/tasks', label: 'Tasks', icon: <CheckSquare className="w-6 h-6" />, modes: ['personal'] },
  { path: '/supplies', label: 'Supplies', icon: <Package className="w-6 h-6" />, modes: ['personal'] },
  { path: '/history', label: 'History', icon: <History className="w-6 h-6" />, modes: ['personal'] },
  { path: '/insights', label: 'Suggestions', icon: <Lightbulb className="w-6 h-6" />, modes: ['personal'] },
  { path: '/issues', label: 'Issues', icon: <AlertTriangle className="w-6 h-6" />, modes: ['personal'] },
  { path: '/space-settings', label: 'Space settings', icon: <Settings className="w-6 h-6" />, modes: ['personal'] },
]

const organizationNavItems: NavItem[] = [
  { path: '/today', label: 'Today', icon: <Home className="w-6 h-6" />, modes: ['organization'] },
  { path: '/areas', label: 'Areas', icon: <FolderOpen className="w-6 h-6" />, modes: ['organization'] },
  { path: '/tasks', label: 'Tasks & schedules', icon: <ClipboardList className="w-6 h-6" />, modes: ['organization'] },
  { path: '/history', label: 'History', icon: <History className="w-6 h-6" />, modes: ['organization'] },
  { path: '/supplies', label: 'Supplies & Requests', icon: <Package className="w-6 h-6" />, modes: ['organization'] },
  { path: '/issues', label: 'Issues', icon: <AlertTriangle className="w-6 h-6" />, modes: ['organization'] },
  { path: '/teams', label: 'Teams', icon: <Users className="w-6 h-6" />, modes: ['organization'] },
  { path: '/invitations', label: 'Invitations', icon: <User className="w-6 h-6" />, modes: ['organization'] },
  { path: '/away', label: 'Away periods', icon: <CalendarDays className="w-6 h-6" />, modes: ['organization'] },
  { path: '/workload', label: 'Weekly workload', icon: <Scale className="w-6 h-6" />, modes: ['organization'] },
  { path: '/insights', label: 'Insights & suggestions', icon: <Lightbulb className="w-6 h-6" />, modes: ['organization'] },
  { path: '/space-settings', label: 'Settings', icon: <Settings className="w-6 h-6" />, modes: ['organization'] },
]

export function AppShell() {
  const { currentSpace, user, signOut, profile, updateProfile } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [notificationError, setNotificationError] = useState(false)
  const currentSpaceId = currentSpace?.id
  const theme = profile?.theme ?? 'system'

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
    const applyTheme = () => {
      root.classList.remove('light', 'dark')
      root.classList.add(theme === 'system' ? (systemTheme.matches ? 'dark' : 'light') : theme)
    }

    applyTheme()
    if (theme !== 'system') return

    systemTheme.addEventListener('change', applyTheme)
    return () => systemTheme.removeEventListener('change', applyTheme)
  }, [theme])

  useEffect(() => {
    let active = true
    if (!currentSpaceId) return

    getUnreadNotificationCount(currentSpaceId)
      .then((count) => {
        if (active) {
          setUnreadNotifications(count)
          setNotificationError(false)
        }
      })
      .catch(() => {
        if (active) setNotificationError(true)
      })

    return () => {
      active = false
    }
  }, [currentSpaceId, location.pathname])

  const spaceType = currentSpace?.type || 'personal'
  const navItems = spaceType === 'personal' ? personalNavItems : organizationNavItems

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const handleThemeChange = async (theme: 'light' | 'dark' | 'system') => {
    await updateProfile({ theme })
  }

  // Close sidebar on navigation (mobile)
  useEffect(() => {
    if (isMobile) setSidebarOpen(false)
  }, [location.pathname, isMobile])

  return (
    <div className="app-layout min-h-screen">
      {/* Mobile sidebar overlay */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar / Side rail */}
      <aside
        className={cn(
          'glass-sidebar fixed inset-y-0 left-0 z-50 w-64 border-r border-border',
          'transform transition-transform duration-300 ease-in-out lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          'flex flex-col'
        )}
        aria-label="Main navigation"
      >
        {/* Header with space selector */}
        <div className="p-4 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h1 className="text-heading-md font-semibold text-text truncate">Neatly</h1>
            {isMobile && (
              <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)} aria-label="Close menu">
                <X className="w-6 h-6" />
              </Button>
            )}
          </div>
          <SpaceSelector />
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-2" role="navigation" aria-label="Main">
          <ul className="space-y-1" role="list">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path || 
                (item.path !== '/' && location.pathname.startsWith(item.path + '/'))
              return (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    className={({ isActive: active }) => cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg',
                      'text-text-muted hover:text-text hover:bg-neutral-100 dark:hover:bg-neutral-800',
                      'transition-colors duration-150 touch-target',
                      active && 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 font-medium',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500'
                    )}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <span aria-hidden="true">{item.icon}</span>
                    <span className="truncate">{item.label}</span>
                    {item.badge && item.badge > 0 && (
                      <span className="ml-auto px-2 py-0.5 text-xs font-medium bg-primary-100 text-primary-700 rounded-full dark:bg-primary-900/30 dark:text-primary-300">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-border flex-shrink-0">
          <div className="relative">
            <Button
              variant="ghost"
              className="w-full justify-start gap-3"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              aria-expanded={userMenuOpen}
              aria-haspopup="true"
            >
              <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                {user?.user_metadata?.avatar_url ? (
                  <img src={user.user_metadata.avatar_url} alt="" className="w-8 h-8 rounded-full" />
                ) : (
                  <User className="w-5 h-5 text-primary-600" />
                )}
              </div>
              <div className="flex-1 text-left truncate">
                <p className="text-sm font-medium text-text">{user?.user_metadata?.full_name || user?.email || 'User'}</p>
                <p className="text-xs text-text-muted truncate">{user?.email}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-text-muted" />
            </Button>

            {userMenuOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-surface border border-border rounded-lg shadow-surface-elevated py-1 animate-in fade-in-0 zoom-in-95 duration-150">
                <button
                  onClick={() => navigate('/settings')}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-text hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  <User className="w-5 h-5" />
                  Profile
                </button>
                <button
                  onClick={() => navigate('/space-settings')}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-text hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  <Settings className="w-5 h-5" />
                  Space settings
                </button>
                <hr className="my-1 border-border" />
                <div className="px-3 py-2 space-y-2">
                  <p className="text-xs font-medium text-text-muted uppercase tracking-wide">Theme</p>
                  <div className="grid grid-cols-3 gap-1">
                    {(['light', 'dark', 'system'] as const).map((theme) => (
                      <button
                        key={theme}
                        onClick={() => handleThemeChange(theme)}
                        className={cn(
                          'px-2 py-1.5 rounded text-sm text-text-muted hover:text-text hover:bg-neutral-100 dark:hover:bg-neutral-800',
                          profile?.theme === theme && 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 font-medium'
                        )}
                      >
                        {theme === 'light' && <Sun className="w-4 h-4 mx-auto" />}
                        {theme === 'dark' && <Moon className="w-4 h-4 mx-auto" />}
                        {theme === 'system' && <Monitor className="w-4 h-4 mx-auto" />}
                        <span className="hidden sm:inline">{theme}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <hr className="my-1 border-border" />
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-destructive-600 hover:bg-destructive-50 dark:hover:bg-destructive-900/20"
                >
                  <LogOut className="w-5 h-5" />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile menu button */}
      {isMobile && (
        <Button
          variant="ghost"
          size="icon"
          className="fixed bottom-4 left-4 z-40 lg:hidden glass-panel"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="w-6 h-6" />
        </Button>
      )}

      {/* Main content */}
      <main className={cn(
      'app-main min-h-screen bg-transparent transition-all duration-300',
        'lg:ml-64',
        isMobile && 'pb-20'
      )}>
        {/* Top bar on mobile */}
        {isMobile && (
          <header className="sticky top-0 z-30 glass-panel border-b border-border px-4 py-2 lg:hidden">
            <div className="flex items-center justify-between">
              <h1 className="text-heading-sm font-semibold text-text">Neatly</h1>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative"
                  onClick={() => navigate('/notifications')}
                  aria-label={notificationError ? 'Notifications unavailable' : `Notifications${unreadNotifications ? `, ${unreadNotifications} unread` : ''}`}
                  title={notificationError ? 'Notifications could not be loaded' : 'Notifications'}
                >
                  <Bell className="w-5 h-5" aria-hidden="true" />
                  {unreadNotifications > 0 && (
                    <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-destructive-text px-1 text-[10px] leading-5 text-white">
                      {unreadNotifications > 99 ? '99+' : unreadNotifications}
                    </span>
                  )}
                </Button>
                {notificationError && <span role="status" className="text-xs text-destructive-text">Notifications unavailable</span>}
                <SpaceSelector compact />
              </div>
            </div>
          </header>
        )}

        {/* Desktop top bar with space selector */}
        {!isMobile && (
          <header className="sticky top-0 z-30 glass-panel border-b border-border px-6 py-3">
            <div className="flex items-center justify-between max-w-7xl mx-auto">
              <div className="flex items-center gap-4">
                <h1 className="text-heading-md font-semibold text-text">Neatly</h1>
                <SpaceSelector />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative"
                  onClick={() => navigate('/notifications')}
                  aria-label={notificationError ? 'Notifications unavailable' : `Notifications${unreadNotifications ? `, ${unreadNotifications} unread` : ''}`}
                  title={notificationError ? 'Notifications could not be loaded' : 'Notifications'}
                >
                  <Bell className="w-5 h-5" aria-hidden="true" />
                  {unreadNotifications > 0 && (
                    <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-destructive-text px-1 text-[10px] leading-5 text-white">
                      {unreadNotifications > 99 ? '99+' : unreadNotifications}
                    </span>
                  )}
                </Button>
                {notificationError && <span role="status" className="text-xs text-destructive-text">Notifications unavailable</span>}
                <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="Sign out">
                  <LogOut className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </header>
        )}

        <div className="p-4 lg:p-6 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>

      {/* Bottom tab bar on mobile */}
      {isMobile && (
        <nav
          className="fixed bottom-0 left-0 right-0 z-40 glass-panel border-t border-border lg:hidden"
          role="navigation"
          aria-label="Bottom navigation"
        >
          <div className="grid grid-cols-3 gap-1 px-2 py-1.5 max-w-7xl mx-auto">
            {navItems.slice(0, 5).map((item) => {
              const isActive = location.pathname === item.path
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive: active }) => cn(
                    'flex flex-col items-center gap-1 px-2 py-2 rounded-lg',
                    'text-text-muted transition-colors duration-150 touch-target',
                    active && 'text-primary-600 dark:text-primary-400',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500'
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span aria-hidden="true" className="text-xl">{item.icon}</span>
                  <span className="text-xs font-medium truncate w-full text-center">{item.label}</span>
                </NavLink>
              )
            })}
            <NavLink
              to="/settings"
              className={({ isActive }) => cn(
                'flex flex-col items-center gap-1 px-2 py-2 rounded-lg',
                'text-text-muted transition-colors duration-150 touch-target',
                isActive && 'text-primary-600 dark:text-primary-400',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500'
              )}
            >
              <span aria-hidden="true" className="text-xl"><Settings className="w-6 h-6" /></span>
              <span className="text-xs font-medium truncate w-full text-center">More</span>
            </NavLink>
          </div>
        </nav>
      )}
    </div>
  )
}