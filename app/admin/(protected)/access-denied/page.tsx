import Link from 'next/link'

export default function AdminAccessDeniedPage() {
  return (
    <main className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="text-xl font-semibold text-foreground">Access denied</h1>
      <p className="mt-2 text-muted-foreground">
        Only the designated admin can access this area. If you believe you should have access, contact the site owner.
      </p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary"
      >
        Return home
      </Link>
    </main>
  )
}
