import Link from 'next/link'

export default function NoDataBanner() {
  return (
    <div className="bg-amber-500 px-4 py-3 text-center text-sm font-medium text-amber-950">
      No listings in the database yet. The site reads from Supabase — run the{' '}
      <Link href="/admin/sync" className="underline hover:no-underline">
        Spark sync
      </Link>{' '}
      to load data, then refresh.
    </div>
  )
}
