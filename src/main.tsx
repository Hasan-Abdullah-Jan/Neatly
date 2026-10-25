import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@styles/globals.css'
import { AppErrorBoundary } from '@components/ui/AppErrorBoundary'
import { StartupFallback } from '@components/ui/StartupFallback'

const root = createRoot(document.getElementById('root')!)
const routePath = window.location.pathname.replace(/\/+$/, '')
const isDemoRoute = routePath === '/demo'
const isPrivacyRoute = routePath === '/privacy'

if (isDemoRoute) {
  void import('@features/demo/DemoModePage').then(({ DemoModePage }) => {
    root.render(
      <StrictMode>
        <AppErrorBoundary>
          <DemoModePage />
        </AppErrorBoundary>
      </StrictMode>
    )
  }).catch(() => {
    root.render(
      <StrictMode>
        <StartupFallback />
      </StrictMode>
    )
  })
} else if (isPrivacyRoute) {
  void import('@features/privacy/pages/PrivacyPage').then(({ PrivacyPage }) => {
    root.render(
      <StrictMode>
        <AppErrorBoundary>
          <PrivacyPage />
        </AppErrorBoundary>
      </StrictMode>
    )
  }).catch(() => {
    root.render(
      <StrictMode>
        <StartupFallback />
      </StrictMode>
    )
  })
} else {
  void import('./AppBootstrap').then(({ AppBootstrap }) => {
    root.render(
      <StrictMode>
        <AppErrorBoundary>
          <AppBootstrap />
        </AppErrorBoundary>
      </StrictMode>
    )
  }).catch(() => {
    root.render(
      <StrictMode>
        <StartupFallback />
      </StrictMode>
    )
  })
}
