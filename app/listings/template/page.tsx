import { redirect } from 'next/navigation'
import { getMostRecentListingKey } from '../../../lib/spark'

export default async function ListingsTemplatePage() {
  const key = await getMostRecentListingKey()
  if (!key) {
    return (
      <main className="min-h-screen bg-zinc-50 p-8">
        <p className="text-zinc-600">No listings available or Spark API not configured.</p>
      </main>
    )
  }
  redirect(`/listing/${key}`)
}
