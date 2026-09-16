'use client'

/**
 * Working surface around the locked capture forms.
 *
 * Stage placement is the shadcn Sheet: Stage photograph first, then the
 * address sheet. Page placement (valuation) stays the house Sheet token
 * under the compact Stage. Payload, field names, and Places stay on the
 * child form.
 */
import type { ReactNode } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { V3_ROOT_CLASS, V3Eyebrow, V3Heading } from '@/components/site/v3'
import '@/components/site/v3/V3Sheet.css'

type Props = {
  /** Omit when the child form already owns the hash target (SellValueForm id=get-value). */
  id?: string
  headingId?: string
  eyebrow: string
  heading?: string
  /** Used when the child form owns the visible heading. /sell address step has none. */
  ariaLabel?: string
  /**
   * `stage` is the address sheet on the photograph.
   * `page` is the full Sheet (valuation page under a compact Stage).
   */
  placement?: 'page' | 'stage'
  children: ReactNode
}

export function SellCapture({
  id,
  headingId,
  eyebrow,
  heading,
  ariaLabel,
  placement = 'page',
  children,
}: Props) {
  const named = heading && headingId
    ? { 'aria-labelledby': headingId }
    : { 'aria-label': ariaLabel ?? heading ?? eyebrow }

  if (placement === 'stage') {
    return (
      <Sheet open modal={false}>
        <SheetContent
          side="right"
          showCloseButton={false}
          overlayClassName="sell-address-sheet-overlay"
          className="sell-address-sheet bg-background text-foreground"
          {...named}
        >
          <SheetHeader>
            <SheetTitle className="font-display text-xl text-foreground">
              {heading ?? 'Home address'}
            </SheetTitle>
            <SheetDescription>{eyebrow}</SheetDescription>
          </SheetHeader>
          <div className="sell-address-sheet__body">{children}</div>
        </SheetContent>
      </Sheet>
    )
  }

  const head = (
    <header className="v3-sheet-head">
      <V3Eyebrow>{eyebrow}</V3Eyebrow>
      {heading && headingId ? (
        <V3Heading id={headingId} level={2}>
          {heading}
        </V3Heading>
      ) : null}
    </header>
  )

  return (
    <section id={id} className={`${V3_ROOT_CLASS} v3-sheet`} {...named}>
      {head}
      {children}
    </section>
  )
}
