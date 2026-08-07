// @no-parity — internal admin surface, no public mockup contract
//
// Help center — 11D: migrated to the LOCKED admin v2 language
// (design_system/admin/ADMIN_UI.md) through the shared presentation kit
// (@/components/admin/v2). Presentation only.
//
// Carried over verbatim: getHelpArticles() and its docs/admin-help/*.md
// source, the exact HelpSearch prop shape (slug · title · area · summary plus
// the server-built lowercased haystack of `title\nsummary\nbody`), the
// `Help | Admin` metadata title, and `export const dynamic = 'force-dynamic'`.
// No auth guard, server action, query param, or href moved.
//
// Shape changed, data did not: the page's own <main> is gone (ConsoleShell
// owns that landmark), the standalone <h1> is gone (acceptance-bar rule 1 —
// the nav names the page), and the article count now leads as the verdict.
//
// ONE SENTENCE WAS CUT rather than restyled: "Use the Help button on any page
// for guided tours of that page." Matt removed the Help FAB on 2026-08-06 —
// app/admin/(protected)/layout.tsx says so in a comment, and
// components/admin/help/HelpProvider is imported from nowhere outside its own
// folder. There is no Help button on any page, so the sentence described a
// control that does not render.
import { getHelpArticles } from '@/lib/admin-help'
import { VerdictLine } from '@/components/admin/v2'
import HelpSearch from './HelpSearch'

export const metadata = { title: 'Help | Admin' }
export const dynamic = 'force-dynamic'

export default async function AdminHelpPage() {
  const articles = getHelpArticles()

  return (
    <div className="av2-scope" style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={articles.length === 0 ? 'attention' : 'ok'}>
          {articles.length === 0 ? (
            <>
              <b>No help articles.</b> Articles are markdown files in docs/admin-help/.
            </>
          ) : (
            <>
              <b>
                {articles.length} help {articles.length === 1 ? 'article' : 'articles'}.
              </b>{' '}
              Search matches the title, the summary, and the body.
            </>
          )}
        </VerdictLine>
      </div>

      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: '0 0 16px' }}>
        Step-by-step guides for everyday tasks in the admin.
      </p>

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
    </div>
  )
}
