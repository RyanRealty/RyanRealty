import type { ReactNode } from 'react'
import { V2Button } from './Button'

export type V2HeroVariant = 'buy' | 'sell' | 'geo' | 'content' | 'tool' | 'brokerage'

export type V2HeroProps = {
  variant: V2HeroVariant
  eyebrow?: string
  title: string
  lede?: string
  /** Live meta line under lede (e.g. "1,815 homes · median $730,000") — must be §0-true */
  meta?: string
  primary?: { href: string; label: string }
  secondary?: { href: string; label: string }
  /** Optional right/slot content (form, search) */
  children?: ReactNode
  className?: string
}

/**
 * Intent-variant hero. Primary CTA is required for buy/sell; content/tool may omit.
 * Never renders five equal buttons — only primary + optional secondary.
 */
export function V2Hero({
  variant,
  eyebrow,
  title,
  lede,
  meta,
  primary,
  secondary,
  children,
  className,
}: V2HeroProps) {
  const defaultEyebrow: Record<V2HeroVariant, string | undefined> = {
    buy: 'Central Oregon',
    sell: 'Sell with Ryan Realty',
    geo: 'Area guide',
    content: undefined,
    tool: undefined,
    brokerage: 'Ryan Realty',
  }

  return (
    <header className={['p2-hero', 'p2-section', 'p2-section--flush', className].filter(Boolean).join(' ')} data-variant={variant}>
      <div className="p2-wrap">
        <p className="p2-eyebrow">{eyebrow ?? defaultEyebrow[variant]}</p>
        <h1 className="p2-display">{title}</h1>
        {lede ? <p className="p2-lede">{lede}</p> : null}
        {meta ? <p className="p2-hero__meta">{meta}</p> : null}
        {(primary || secondary) && (
          <div className="p2-actions">
            {primary ? <V2Button href={primary.href} variant="primary">{primary.label}</V2Button> : null}
            {secondary ? (
              <V2Button href={secondary.href} variant="secondary">
                {secondary.label}
              </V2Button>
            ) : null}
          </div>
        )}
        {children}
      </div>
    </header>
  )
}
