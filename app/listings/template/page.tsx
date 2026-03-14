import { redirect } from 'next/navigation'
import { getMostRecentListingKey } from '../../../lib/spark'
import { getMostRecentListingKeyFromSupabase } from '../../actions/listings'

export default async function ListingsTemplatePage() {
  // Use Spark when API key is set; otherwise use Supabase so the site works without the key (e.g. review with existing data).
  let key = await getMostRecentListingKey()
  if (!key) key = await getMostRecentListingKeyFromSupabase()
  if (!key) {
    return (
      <main className="min-h-screen bg-muted p-8">
        <p className="text-muted-foreground">No listings in the database yet. Add SPARK_API_KEY and run a sync to populate, or import data into Supabase.</p>
      </main>
    )
  }
  redirect(`/listing/${key}`)
}
