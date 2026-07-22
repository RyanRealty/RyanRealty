import AdminLinkTabs from '@/components/admin/AdminLinkTabs'

/**
 * Operations shell (consolidation 2026-07-07): Command center (system health,
 * sync, leads, growth). No gate here — the command center was open to every
 * admin role before the merge. (The Optimization sub-route was deleted
 * 2026-07-21 with the never-ran optimization-loop cron.)
 */
export default function AdminOperationsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="mx-auto w-full max-w-screen-2xl px-4 pt-6 sm:px-6">
        <AdminLinkTabs
          tabs={[
            { href: '/admin/operations', label: 'Command center' },
          ]}
        />
      </div>
      {children}
    </>
  )
}
