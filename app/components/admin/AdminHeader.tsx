import Link from 'next/link'
import Image from 'next/image'
import type { AdminRoleType } from '@/app/actions/admin-roles'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import AdminMobileNav from '@/app/components/admin/AdminMobileNav'

type AdminHeaderProps = {
  user: { email: string; avatarUrl: string | null; fullName: string | null }
  role: AdminRoleType
  brokerId: string | null
}

export default function AdminHeader({ user, role, brokerId }: AdminHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card shadow-sm">
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <AdminMobileNav role={role} brokerId={brokerId} />
          <Link
            href="/admin"
            className="text-lg font-semibold text-foreground hover:text-muted-foreground"
          >
            Admin
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-end gap-3">
          <form action="/admin/search" method="get" className="hidden items-center gap-2 md:flex">
            <Input name="q" type="search" placeholder="Search listings, brokers, users" className="w-72" />
            <Button type="submit" variant="outline">Search</Button>
          </form>
          <span className="hidden text-sm text-muted-foreground sm:inline" title={user.email}>
            {user.fullName || user.email}
          </span>
          <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-border ring-2 ring-border">
            {user.avatarUrl ? (
              <Image
                src={user.avatarUrl}
                alt=""
                width={36}
                height={36}
                className="h-full w-full object-cover"
                unoptimized
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-sm font-medium text-muted-foreground">
                {(user.fullName || user.email).charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <Link
            href="/"
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted"
          >
            View site
          </Link>
        </div>
      </div>
    </header>
  )
}
