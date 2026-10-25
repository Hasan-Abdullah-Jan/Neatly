export function PrivacyPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-background px-4 py-12 text-text sm:px-6">
      <a href="/login" className="text-sm font-medium text-primary-700 underline dark:text-primary-300">Back to Neatly</a>
      <h1 className="mt-6 text-3xl font-semibold">Privacy at Neatly</h1>
      <p className="mt-3 text-text-muted">Neatly stores space, task, issue, supply, and account records needed to provide the service. Space members can see records according to their role and the workspace access rules.</p>
      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">Your choices</h2>
        <ul className="list-disc space-y-2 pl-6 text-text-muted">
          <li>Export personal account records as JSON or CSV from Settings → Privacy &amp; Security.</li>
          <li>Request account deletion from Settings. Sole-member personal spaces are removed; organization ownership is transferred where possible; retained shared records are anonymized.</li>
          <li>Photo capture is optional and governed by workspace settings and retention settings. Issue photos use private storage and signed access.</li>
          <li>The guided demo stores sample data only in the current browser tab and does not send it to Supabase.</li>
        </ul>
      </section>
      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">Security and retention</h2>
        <p className="text-text-muted">Database access is intended to be restricted by Supabase Row Level Security. Security settings and permissions must be tested in the deployment’s own staging project before production use. Workspace retention settings govern configured task evidence cleanup; the service operator must apply the scheduled cleanup job for automatic deletion.</p>
        <p className="text-text-muted">Neatly does not use third-party advertising or analytics trackers. Operational errors are handled in the app; no third-party error-monitoring service is configured.</p>
      </section>
      <p className="mt-8 text-sm text-text-muted">For privacy questions, contact the administrator who operates your Neatly deployment.</p>
    </main>
  )
}
