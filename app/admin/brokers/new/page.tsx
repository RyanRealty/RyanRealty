import Link from 'next/link'
import AdminBrokerCreateForm from '../../../components/admin/AdminBrokerCreateForm'

export const dynamic = 'force-dynamic'

export default function AdminBrokerNewPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/admin/brokers" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
          ← Brokers
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-zinc-900">Add broker</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Required: display name, slug (URL), title, and Oregon license number. Dates are managed elsewhere.
      </p>
      <AdminBrokerCreateForm className="mt-6" />
    </main>
  )
}
