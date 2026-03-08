import Link from 'next/link'
import Image from 'next/image'

type AdminHeaderProps = {
  user: { email: string; avatarUrl: string | null; fullName: string | null }
}

export default function AdminHeader({ user }: AdminHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link
          href="/admin"
          className="text-lg font-semibold text-zinc-900 hover:text-zinc-700"
        >
          Admin
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-zinc-500 sm:inline" title={user.email}>
            {user.fullName || user.email}
          </span>
          <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-zinc-200 ring-2 ring-zinc-200">
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
              <span className="flex h-full w-full items-center justify-center text-sm font-medium text-zinc-600">
                {(user.fullName || user.email).charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <Link
            href="/"
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            View site
          </Link>
        </div>
      </div>
    </header>
  )
}
