import type { ReactNode } from 'react'

export function ListingFold({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: ReactNode
}) {
  if (children == null || children === false) return null
  return (
    <details id={id} className="listing-detail__fold" open>
      <summary>
        <span className="listing-detail__fold-caret" aria-hidden="true" />
        {title}
      </summary>
      <div className="listing-detail__fold-body">{children}</div>
    </details>
  )
}
