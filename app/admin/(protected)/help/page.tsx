// @no-parity — internal admin surface, no public mockup contract
/**
 * /admin/help — the admin knowledge base. Articles are repo markdown in
 * docs/admin-help/ (see the README there for why), loaded server-side and
 * searched client-side in HelpSearch (title + summary + body substring).
 */
import { getHelpArticles } from '@/lib/admin-help'
import HelpSearch from './HelpSearch'

export const metadata = { title: 'Help | Admin' }
export const dynamic = 'force-dynamic'

export default async function AdminHelpPage() {
  const articles = getHelpArticles()

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Help</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Step-by-step guides for everyday tasks in the admin. Use the Help button on any page for
          guided tours of that page.
        </p>
      </header>
      <HelpSearch
        articles={articles.map((a) => ({
          slug: a.slug,
          title: a.title,
          area: a.area,
          summary: a.summary,
          // Lowercased haystack for substring search, built server-side once.
          haystack: `${a.title}\n${a.summary}\n${a.body}`.toLowerCase(),
        }))}
      />
    </main>
  )
}
