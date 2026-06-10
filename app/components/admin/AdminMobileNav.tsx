'use client'

import { useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Menu01Icon } from '@hugeicons/core-free-icons'
import type { AdminRoleType } from '@/app/actions/admin-roles'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { buildAdminNav } from '@/app/components/admin/admin-nav'
import AdminNavList from '@/app/components/admin/AdminNavList'

type AdminMobileNavProps = {
  role: AdminRoleType
  brokerId: string | null
}

/** Phone/tablet admin nav: hamburger in the header opening a left sheet. Hidden at lg+. */
export default function AdminMobileNav({ role, brokerId }: AdminMobileNavProps) {
  const [open, setOpen] = useState(false)
  const sections = buildAdminNav(role, brokerId)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="lg:hidden"
          aria-label="Open admin navigation"
        >
          <HugeiconsIcon icon={Menu01Icon} className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 overflow-y-auto p-0">
        <SheetHeader className="border-b border-border px-4 py-3">
          <SheetTitle className="text-left text-base">Admin</SheetTitle>
        </SheetHeader>
        <AdminNavList sections={sections} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  )
}
