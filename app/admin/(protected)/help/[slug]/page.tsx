// @no-parity — internal admin surface, no public mockup contract
/**
 * /admin/help/[slug] — one knowledge-base article, rendered from repo markdown
 * via the existing lightweight converter (lib/markdown-to-html.mjs — the same
 * no-dependency renderer the blog pipeline uses).
 */
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { markdownToHtml } from '@/lib/markdown-to-html.mjs'
import { getHelpArticle } from '@/lib/admin-help'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const article = getHelpArticle(slug)
  return { title: article ? `${article.title} | Help | Admin` : 'Help | Admin' }
}

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
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-4 text-sm text-muted-foreground">
        <Link
          href="/admin/help"
          className="inline-flex min-h-10 items-center gap-1 hover:text-foreground md:min-h-0"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          All help
        </Link>
      </div>

      <header className="mb-6">
        <Badge variant="outline" className="mb-2 py-0 text-xs">
          {article.area}
        </Badge>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{article.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{article.summary}</p>
      </header>

      <article
        className={[
          'text-sm leading-relaxed text-foreground',
          '[&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground',
          '[&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-foreground',
          '[&_p]:mb-3 [&_p]:text-foreground',
          '[&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-5',
          '[&_ul]:mb-4 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5',
          '[&_li]:text-foreground',
          '[&_strong]:font-semibold',
          '[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2',
          '[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs',
        ].join(' ')}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </main>
  )
}
