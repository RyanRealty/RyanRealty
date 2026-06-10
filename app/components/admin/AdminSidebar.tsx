'use client'

import type { AdminRoleType } from '@/app/actions/admin-roles'
import { buildAdminNav } from '@/app/components/admin/admin-nav'
import AdminNavList from '@/app/components/admin/AdminNavList'

type AdminSidebarProps = {
  role: AdminRoleType
  brokerId: string | null
}

/**
 * Desktop admin nav. Hidden below lg — phones get the same sections via
 * AdminMobileNav (sheet drawer in the header). Both render from buildAdminNav.
 */
export default function AdminSidebar({ role, brokerId }: AdminSidebarProps) {
  const sections = buildAdminNav(role, brokerId)
  return (
    <aside
      className="sticky top-[61px] hidden h-[calc(100vh-61px)] w-56 shrink-0 flex-col overflow-y-auto border-r border-border bg-card lg:flex"
      aria-label="Admin navigation"
    >
      <AdminNavList sections={sections} />
    </aside>
  )
}
