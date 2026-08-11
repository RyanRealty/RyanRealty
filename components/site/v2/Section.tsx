import type { ReactNode } from 'react'

export type V2SectionProps = {
  eyebrow?: string
  title?: string
  lede?: string
  navy?: boolean
  flush?: boolean
  narrow?: boolean
  children?: ReactNode
  className?: string
  id?: string
}

export function V2Section({
  eyebrow,
  title,
  lede,
  navy,
  flush,
  narrow,
  children,
  className,
  id,
}: V2SectionProps) {
  return (
    <section
      id={id}
      className={[
        'p2-section',
        navy ? 'p2-section--navy' : '',
        flush ? 'p2-section--flush' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className={narrow ? 'p2-wrap-narrow' : 'p2-wrap'}>
        {eyebrow ? <p className="p2-eyebrow">{eyebrow}</p> : null}
        {title ? (
          <h2 className="p2-display" style={{ fontSize: 'var(--p-text-2xl)', margin: 0 }}>
            {title}
          </h2>
        ) : null}
        {lede ? <p className="p2-lede">{lede}</p> : null}
        {children}
      </div>
    </section>
  )
}
