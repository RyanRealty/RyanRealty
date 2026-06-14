import Link from 'next/link'
import AdminQueryBuilderForm from './AdminQueryBuilderForm'

export default function AdminQueryBuilderPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-bold text-foreground">Ad-hoc query builder</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Filter active listings by city, price, beds, baths, and amenities. Results cap at 500 rows. Export the full set to CSV.
      </p>

      <div className="mt-5">
        <AdminQueryBuilderForm />
      </div>

      <p className="mt-6 text-sm">
        <Link
          href="/admin"
          className="text-muted-foreground underline-offset-4 hover:underline"
        >
          Back to Dashboard
        </Link>
      </p>
    </div>
  )
}
