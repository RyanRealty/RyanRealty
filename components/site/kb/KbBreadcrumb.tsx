import { Fragment } from 'react'

export interface KbCrumb {
  label: string
  href?: string
}

/**
 * KB Breadcrumb — a brutalist hierarchy strip for the top of any KB page.
 *
 * Renders one horizontal row of crumbs expressing the place hierarchy
 * (City › Neighborhood › Community/Subdivision › Listing). Mono uppercase
 * type, hard navy on cream by default (works on a cream strip), with a slash
 * separator between crumbs. Each crumb is a link when it carries an `href`;
 * the last/current crumb is plain text. Wraps on mobile, stays one logical row.
 *
 * Server component — no client JS, no data fetch, no motion. The matching
 * BreadcrumbList JSON-LD is emitted by MetadataBlock, so none is rendered here.
 * Returns null when there is nothing to show.
 */
export function KbBreadcrumb({ trail, overlay = false }: { trail: KbCrumb[]; overlay?: boolean }) {
  if (!trail || trail.length === 0) return null

  const lastIndex = trail.length - 1

  return (
    <nav className={`kb-bc${overlay ? ' overlay on-navy' : ''}`} aria-label="Breadcrumb">
      <div className="wrap">
        <ol className="kb-bc-list">
          {trail.map((crumb, i) => {
            const isCurrent = i === lastIndex
            return (
              <Fragment key={`${crumb.label}-${i}`}>
                <li className="kb-bc-item">
                  {crumb.href && !isCurrent ? (
                    <a className="kb-bc-link" href={crumb.href}>
                      {crumb.label}
                    </a>
                  ) : (
                    <span className="kb-bc-current" aria-current={isCurrent ? 'page' : undefined}>
                      {crumb.label}
                    </span>
                  )}
                </li>
                {!isCurrent ? (
                  <li className="kb-bc-sep" aria-hidden="true">
                    /
                  </li>
                ) : null}
              </Fragment>
            )
          })}
        </ol>
      </div>
    </nav>
  )
}
