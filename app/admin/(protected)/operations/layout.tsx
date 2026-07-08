import AdminLinkTabs from '@/components/admin/AdminLinkTabs'

/**
 * Operations shell (consolidation 2026-07-07): Command center (system health,
 * sync, leads, growth) + Optimization (weekly GA4/Search Console loop, moved
 * from /admin/optimization). No gate here — the command center was open to
 * every admin role before the merge; the Optimization sub-route keeps its
 * superuser layout gate.
 */
export default function AdminOperationsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="mx-auto w-full max-w-screen-2xl px-4 pt-6 sm:px-6">
        <AdminLinkTabs
          tabs={[
            { href: '/admin/operations', label: 'Command center' },
            { href: '/admin/operations/optimization', label: 'Optimization' },
          ]}
        />
      </div>
      {children}
    </>
  )
}
