import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty'

export type SearchEmptyKind = 'empty' | 'degraded' | 'updating' | 'outside'

export function SearchEmpty({
  kind,
  title,
  description,
  action,
}: {
  kind: SearchEmptyKind
  title: string
  description: string
  action?: { href?: string; label: string; onClick?: () => void }
}) {
  return (
    <Empty className="srch-empty srch-panel m-4 border-0" data-taste="search-empty" data-kind={kind}>
      <EmptyHeader>
        <p className="srch-label">
          {kind === 'degraded'
            ? 'Search delayed'
            : kind === 'updating'
              ? 'Updating'
              : kind === 'outside'
                ? 'Outside this view'
                : 'No matches'}
        </p>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action ? (
        <EmptyContent>
          {action.href ? (
            <Button asChild variant="outline" className="srch-chip">
              <a href={action.href}>{action.label}</a>
            </Button>
          ) : (
            <Button type="button" variant="outline" className="srch-chip" onClick={action.onClick}>
              {action.label}
            </Button>
          )}
        </EmptyContent>
      ) : null}
    </Empty>
  )
}
