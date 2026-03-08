import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getBrokerById } from '../../../actions/brokers'
import AdminBrokerForm from '../../../components/admin/AdminBrokerForm'

type PageProps = { params: Promise<{ id: string }> }

export const dynamic = 'force-dynamic'

export default async function AdminBrokerEditPage({ params }: PageProps) {
  const { id } = await params
  const broker = await getBrokerById(id)
  if (!broker) notFound()

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/admin/brokers" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
          ← Brokers
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-zinc-900">Edit broker</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Slug: <code className="rounded bg-zinc-100 px-1">{broker.slug}</code> (used in URL /team/{broker.slug})
      </p>
      <AdminBrokerForm broker={broker} className="mt-6" />
    </main>
  )
}
