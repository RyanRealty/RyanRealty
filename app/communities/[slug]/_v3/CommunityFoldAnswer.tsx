import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS } from '@/components/site/v3'
import { TAKEAWAY_FIGURE_RE } from '@/components/site/v3/V3Takeaways'
import type { CommunityFoldAnswer } from './community-fold-answer'

function withFigures(sentence: string) {
  const parts = sentence.split(TAKEAWAY_FIGURE_RE)
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="v3-takeaways__figure">
        {part}
      </strong>
    ) : (
      part
    ),
  )
}

/**
 * Server-rendered above-the-fold answer. Prints live sentences when the
 * helpers produced them; otherwise the no-figure fallback. Never a $0.
 */
export function CommunityFoldAnswer({
  answer,
  link,
  className,
}: {
  answer: CommunityFoldAnswer
  link?: { label: string; href: string } | null
  className?: string
}) {
  if (answer.sentences.length === 0 && !answer.fallback) return null
  return (
    <div id="answer" className={cn(V3_ROOT_CLASS, 'v3-takeaways', 'v3-takeaways--lede', className)}>
      {answer.sentences.length > 0 ? (
        <p className="v3-takeaways__lead">
          {answer.sentences.map((sentence, i) => (
            <span key={sentence}>
              {i > 0 ? ' ' : null}
              {withFigures(sentence)}
            </span>
          ))}
        </p>
      ) : (
        <p className="v3-takeaways__lead">{answer.fallback}</p>
      )}
      {answer.source ? <p className="v3-takeaways__source">{answer.source}</p> : null}
      {link ? (
        <p className="v3-takeaways__source">
          <a href={link.href}>{link.label}</a>
        </p>
      ) : null}
    </div>
  )
}
