import Link from 'next/link'
import Image from 'next/image'

type AdminHeaderProps = {
  user: { email: string; avatarUrl: string | null; fullName: string | null }
}

export default function AdminHeader({ user }: AdminHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card shadow-sm">
      <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link
          href="/admin"
          className="text-lg font-semibold text-foreground hover:text-muted-foreground"
        >
          Admin
        </Link>
        <div className="flex items-center gap-3">
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
