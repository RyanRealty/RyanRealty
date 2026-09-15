/**
 * /contact first viewport: house-doors + house-ask, then house-faces.
 *
 * Layout lock: one ask, V3Doors as a reach control with Call at display
 * scale and live hours. AboutFaces is the compact roster. ContactAsk is
 * the write path. Do not replace those objects with a second kit.
 */
import type { ReactNode } from 'react'
import './contact-fold.css'

export function ContactFold({
  reach,
  write,
  faces,
}: {
  reach: ReactNode
  write: ReactNode
  faces?: ReactNode
}) {
  return (
    <div className="contact-fold">
      <div className="contact-fold__reach">{reach}</div>
      <div className="contact-fold__write">{write}</div>
      {faces ? <div className="contact-fold__faces">{faces}</div> : null}
    </div>
  )
}
