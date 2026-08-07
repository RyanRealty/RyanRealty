// @no-parity — internal admin surface, no public mockup contract
//
// One help article — 11D: migrated to the LOCKED admin v2 language
// (design_system/admin/ADMIN_UI.md) through the shared presentation kit
// (@/components/admin/v2). Presentation only.
//
// Carried over verbatim: getHelpArticle(slug) and its notFound() on a miss,
// the awaited `params` promise, generateMetadata and both title strings, the
// markdownToHtml(article.body) render through lib/markdown-to-html.mjs (the
// same no-dependency converter the blog pipeline uses), the /admin/help back
// href, and `export const dynamic = 'force-dynamic'`. No auth guard, server
// action, query param, or href moved.
//
// Shape changed, data did not: the page's own <main> is gone (ConsoleShell
// owns that landmark), the raw <h1> became EntityTitle — this IS an entity
// page, so acceptance-bar rule 1 grants it the article's own name — the
// shadcn Badge became the kit's StateWord, and the article body's typography
// now draws every colour from var(--a-*) instead of the public brand's
// foreground/primary/muted tokens.
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { markdownToHtml } from '@/lib/markdown-to-html.mjs'
import { getHelpArticle } from '@/lib/admin-help'
import { EntityTitle, StateWord } from '@/components/admin/v2'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const article = getHelpArticle(slug)
  return { title: article ? `${article.title} | Help | Admin` : 'Help | Admin' }
}

/**
 * Body typography for the injected markdown. Arbitrary property variants, not
 * Tailwind palette classes — every colour, size and face is an admin token.
 */
const ARTICLE_PROSE = [
  '[&_h2]:mt-7 [&_h2]:mb-2 [&_h2]:font-semibold',
  '[&_h2]:[color:var(--a-text)] [&_h2]:[font-size:var(--a-text-md)]',
  '[&_h3]:mt-5 [&_h3]:mb-2 [&_h3]:font-semibold',
  '[&_h3]:[color:var(--a-text)] [&_h3]:[font-size:var(--a-text-sm)]',
  '[&_p]:mb-3',
  '[&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-5',
  '[&_ul]:mb-4 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5',
  '[&_strong]:font-semibold',
  '[&_a]:underline [&_a]:underline-offset-2 [&_a]:[color:var(--a-accent)]',
  '[&_code]:rounded [&_code]:px-1 [&_code]:py-0.5',
  '[&_code]:[background:var(--a-inset)] [&_code]:[font-family:var(--a-font-mono)]',
  '[&_code]:[font-size:var(--a-text-xs)]',
].join(' ')

export default async function AdminHelpArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const article = getHelpArticle(slug)
  if (!article) notFound()

  const html = markdownToHtml(article.body)

  return (
    <div className="av2-scope" style={{ maxWidth: 760, margin: '0 auto', padding: 16 }}>
      <p style={{ margin: '0 0 12px' }}>
        <Link href="/admin/help" style={{ color: 'var(--a-accent)', fontSize: 'var(--a-text-sm)' }}>
          &larr; All help
        </Link>
      </p>

      <p style={{ margin: '0 0 6px' }}>
        <StateWord state="accent">{article.area}</StateWord>
      </p>
      <EntityTitle>{article.title}</EntityTitle>
      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: '4px 0 20px' }}>
        {article.summary}
      </p>

      <article
        style={{ fontSize: 'var(--a-text-sm)', lineHeight: 1.6, color: 'var(--a-text)' }}
        className={ARTICLE_PROSE}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}
