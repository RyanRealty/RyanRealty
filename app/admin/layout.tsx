/**
 * Root admin layout: no auth here so /admin/login and /admin/setup are reachable.
 * Auth and chrome live in (protected)/layout.tsx for all other admin routes.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
