import AdminLinkTabs from '@/components/admin/AdminLinkTabs'

/**
 * Media library shell — one surface for the four media jobs (consolidation
 * 2026-07-07): Library (uploads), Photo curation, Banners, Stock photos.
 *
 * Role gates stay where they were before the merge: the Library page checks
 * superuser inline, Banners and Stock photos keep their superuser layouts as
 * nested layouts, and Photo curation remains open to any admin role.
 */
export default function AdminMediaLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6">
        <AdminLinkTabs
          tabs={[
            { href: '/admin/media', label: 'Library' },
            { href: '/admin/media/photos', label: 'Photo curation' },
            { href: '/admin/media/banners', label: 'Banners' },
            { href: '/admin/media/stock-photos', label: 'Stock photos' },
          ]}
        />
      </div>
      {children}
    </>
  )
}
