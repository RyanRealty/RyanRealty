import './admin-v2.css'
import type { ButtonHTMLAttributes } from 'react'

/**
 * IconButton — an icon-only control inside a dense row (11F).
 *
 * `label` is REQUIRED and becomes the accessible name. An icon-only control
 * with no name is unusable by a screen reader, and a row of them ("rename what?
 * delete what?") is the version of that failure that actually ships, so the
 * type refuses to compile without one. Name the OBJECT too: "Rename Nurture",
 * not "Rename".
 *
 * Never a page's primary action — those carry visible text (ci:admin-ui rule C
 * counts primary Buttons, and an icon is not a label).
 */
export interface AdminIconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  label: string
  tone?: 'quiet' | 'danger'
  children: React.ReactNode
}

export function IconButton({ label, tone = 'quiet', className, children, ...rest }: AdminIconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={['av2-iconbtn', tone === 'danger' ? 'av2-iconbtn--danger' : '', className ?? '']
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </button>
  )
}
