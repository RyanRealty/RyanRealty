/**
 * /contact first viewport: reach control + the one ask, side by side.
 *
 * Layout lock: one ask, doors with hierarchy and live hours, not four
 * identical link rows. The form is a first-viewport control (beui-input /
 * shadcn-input adapted into V3Input), not a section under a text hero.
 */
import type { ReactNode } from 'react'
import './contact-fold.css'

export function ContactFold({
  reach,
  write,
}: {
  reach: ReactNode
  write: ReactNode
}) {
  return (
    <div className="contact-fold">
      <div className="contact-fold__reach">{reach}</div>
      <div className="contact-fold__write">{write}</div>
    </div>
  )
}
