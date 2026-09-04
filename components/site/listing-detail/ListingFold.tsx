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
    <details id={id} className="listing-detail__fold">
      <summary>{title}</summary>
      <div className="listing-detail__fold-body">{children}</div>
    </details>
  )
}
