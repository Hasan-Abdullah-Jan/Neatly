import { CircleAlert, ExternalLink, RotateCw } from 'lucide-react'

export function StartupFallback() {
  const hasSupabaseConfig = Boolean(
    import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
  )

  return (
    <main className="startup-canvas flex min-h-screen items-center justify-center px-4 py-10">
      <section
        role="alert"
        className="glass-card w-full max-w-xl rounded-3xl border border-white/70 p-7 shadow-2xl shadow-teal-950/10 sm:p-10"
      >
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-light text-primary-text shadow-inner">
          <CircleAlert className="h-6 w-6" aria-hidden="true" />
        </div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary-text">Neatly setup</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-text">
          {hasSupabaseConfig ? 'Neatly could not start' : 'One quick setup step'}
        </h1>
        <p className="mt-3 leading-7 text-text-muted">
          {hasSupabaseConfig
            ? 'The app could not load its services. Check your connection and configuration, then try again.'
            : 'This environment is not connected to Supabase yet. Add the public project URL and anon key to your local environment, then restart the development server.'}
        </p>
        {!hasSupabaseConfig && (
          <div className="mt-5 rounded-2xl border border-border bg-white/70 p-4 text-sm text-text-muted">
            <p className="font-medium text-text">Required browser settings</p>
            <code className="mt-2 block">VITE_SUPABASE_URL=...</code>
            <code className="mt-2 block">VITE_SUPABASE_ANON_KEY=...</code>
            <p className="mt-3">Use your project’s anon/public key only. Never put a service-role key in the browser.</p>
          </div>
        )}
        <div className="mt-7 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary-active px-4 py-2.5 font-medium text-white shadow-lg shadow-teal-900/15 transition hover:-translate-y-0.5 hover:bg-primary-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-active focus-visible:ring-offset-2"
          >
            <RotateCw className="h-4 w-4" aria-hidden="true" />
            Try again
          </button>
          <a
            href="/demo"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-white/60 px-4 py-2.5 font-medium text-text transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-active focus-visible:ring-offset-2"
          >
            Explore the demo
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
      </section>
    </main>
  )
}
