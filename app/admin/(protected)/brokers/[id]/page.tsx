import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getBrokerById } from '@/app/actions/brokers'
import { listBrokerGeneratedMedia } from '@/app/actions/broker-generated-media'
import AdminBrokerForm from '@/app/components/admin/AdminBrokerForm'

type PageProps = { params: Promise<{ id: string }> }

export const dynamic = 'force-dynamic'

export default async function AdminBrokerEditPage({ params }: PageProps) {
  const { id } = await params
  const [broker, generatedMedia] = await Promise.all([
    getBrokerById(id),
    listBrokerGeneratedMedia(id),
  ])
  if (!broker) notFound()

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/admin/brokers" className="text-sm font-medium text-muted-foreground hover:text-foreground">
          ← Brokers
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-foreground">Edit broker</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Slug: <code className="rounded bg-muted px-1">{broker.slug}</code> (used in URL /team/{broker.slug})
      </p>
      <AdminBrokerForm broker={broker} initialGeneratedMedia={generatedMedia} className="mt-6" />
    </main>
  )
}
