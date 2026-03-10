import Link from 'next/link'
import AdminQueryBuilderForm from './AdminQueryBuilderForm'

export default function AdminQueryBuilderPage() {
  return (
    <div>
      <h1 className="text-xl font-bold text-zinc-900">Ad-hoc query builder</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Run search filters (city, price, beds, baths, pool, view, etc.). Results are limited to 500 rows. Export to CSV.
      </p>
      <div className="mt-6">
        <AdminQueryBuilderForm />
      </div>
      <p className="mt-6 text-xs text-zinc-500">
        <Link href="/admin" className="underline hover:no-underline">Back to Dashboard</Link>
      </p>
    </div>
  )
}
