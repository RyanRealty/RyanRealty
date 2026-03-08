import Link from 'next/link'

export default function AdminAccessDeniedPage() {
  return (
    <main className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="text-xl font-semibold text-zinc-900">Access denied</h1>
      <p className="mt-2 text-zinc-600">
        Only the designated admin can access this area. If you believe you should have access, contact the site owner.
      </p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
      >
        Return home
      </Link>
    </main>
  )
}
