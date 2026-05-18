import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { getAllProducers, getProducerBySlug } from '@/lib/producer-catalog'
import { ExamplesGallery } from '../_components/ExamplesGallery'
import { EditProducerPanel } from '../_components/EditProducerPanel'

export async function generateStaticParams() {
  return getAllProducers().map((p) => ({ slug: p.slug }))
}

interface PageProps {
  params: Promise<{ slug: string }>
}

export default async function ProducerDetailPage({ params }: PageProps) {
  const { slug } = await params
  const producer = getProducerBySlug(slug)
  if (!producer) notFound()

  // Simple Markdown to HTML (headings, paragraphs, code blocks)
  const contentHtml = markdownToHtml(producer.skillContent)

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="text-sm text-muted-foreground">
        <Link href="/admin/producers" className="hover:text-foreground">
          Producer catalog
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{producer.name}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">{producer.name}</h1>
          <p className="text-muted-foreground">{producer.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{producer.sectionLabel}</Badge>
          {producer.actionTypes.map((at) => (
            <Badge key={at} className="bg-primary/10 text-primary hover:bg-primary/10">
              {at}
            </Badge>
          ))}
        </div>
      </div>

      <Separator />

      {/* Meta grid */}
      {(producer.outputType || producer.targetPlatforms.length > 0 || producer.requiredInputs.length > 0) && (
        <div className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-card p-4 text-sm md:grid-cols-4">
          {producer.outputType && (
            <div>
              <dt className="font-medium text-muted-foreground">Output type</dt>
              <dd className="mt-1 text-foreground">{producer.outputType}</dd>
            </div>
          )}
          {producer.targetPlatforms.length > 0 && (
            <div>
              <dt className="font-medium text-muted-foreground">Platforms</dt>
              <dd className="mt-1 flex flex-wrap gap-1">
                {producer.targetPlatforms.map((pl) => (
                  <Badge key={pl} variant="outline" className="text-xs">
                    {pl}
                  </Badge>
                ))}
              </dd>
            </div>
          )}
          {producer.requiredInputs.length > 0 && (
            <div>
              <dt className="font-medium text-muted-foreground">Required inputs</dt>
              <dd className="mt-1 flex flex-wrap gap-1">
                {producer.requiredInputs.map((inp) => (
                  <Badge key={inp} variant="outline" className="text-xs">
                    {inp}
                  </Badge>
                ))}
              </dd>
            </div>
          )}
          <div>
            <dt className="font-medium text-muted-foreground">SKILL.md path</dt>
            <dd className="mt-1 truncate text-xs text-muted-foreground" title={producer.skillPath}>
              {producer.skillPath.replace(/.*\/RyanRealty\//, '')}
            </dd>
          </div>
        </div>
      )}

      {/* Examples gallery */}
      <div>
        <h2 className="mb-3 text-base font-semibold text-foreground">Examples</h2>
        <ExamplesGallery
          exampleOutputs={producer.exampleOutputs}
          producerName={producer.name}
        />
      </div>

      <Separator />

      {/* SKILL.md content */}
      <div>
        <h2 className="mb-4 text-base font-semibold text-foreground">SKILL.md</h2>
        <div
          className="prose prose-sm max-w-none rounded-lg border border-border bg-card p-5 text-foreground
            prose-headings:text-foreground prose-h2:text-base prose-h3:text-sm
            prose-p:text-muted-foreground prose-li:text-muted-foreground
            prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:text-xs
            prose-pre:overflow-x-auto prose-pre:rounded-lg prose-pre:bg-muted prose-pre:p-4 prose-pre:text-xs"
          dangerouslySetInnerHTML={{ __html: contentHtml }}
        />
      </div>

      <Separator />

      {/* Edit panel */}
      <div>
        <h2 className="mb-3 text-base font-semibold text-foreground">Request changes</h2>
        <EditProducerPanel producerSlug={producer.slug} producerName={producer.name} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Minimal Markdown renderer (avoids pulling in remark/rehype deps)
// ---------------------------------------------------------------------------

function markdownToHtml(md: string): string {
  if (!md.trim()) return '<p class="text-muted-foreground italic">No SKILL.md body content.</p>'

  let html = md
    // Fenced code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
      const escaped = code.replace(/</g, '&lt;').replace(/>/g, '&gt;')
      return `<pre><code class="language-${lang}">${escaped}</code></pre>`
    })
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // H3
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    // H2
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    // H1
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Unordered list items
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    // Wrap consecutive <li> in <ul>
    .replace(/((<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr>')
    // Paragraphs (lines not already in a block tag)
    .split('\n\n')
    .map((chunk) => {
      const trimmed = chunk.trim()
      if (!trimmed) return ''
      if (/^<(h[1-6]|ul|ol|pre|hr|table|blockquote)/.test(trimmed)) return trimmed
      return `<p>${trimmed.replace(/\n/g, ' ')}</p>`
    })
    .join('\n')

  return html
}
