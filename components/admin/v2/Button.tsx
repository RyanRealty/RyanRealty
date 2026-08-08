import './admin-v2.css'
import { forwardRef, type ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'quiet' | 'danger'

export interface AdminButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  /** 44px min-height for phone-primary surfaces (WCAG 2.5.8). */
  touch?: boolean
}

/**
 * forwardRef is not optional here. Without it a `ref` on <Button> silently
 * attaches to nothing, and callers that need the DOM node — roving tabindex,
 * "focus this field", scroll-into-view — reach for document.getElementById
 * instead. Two files did exactly that during the 11F sequences migration before
 * this was fixed; a primitive that swallows refs pushes every caller outside
 * React's lifecycle.
 */
export const Button = forwardRef<HTMLButtonElement, AdminButtonProps>(function Button(
  { variant = 'primary', touch = false, className, ...rest },
  ref,
) {
  const cls = [
    'av2-btn',
    variant === 'quiet' ? 'av2-btn--quiet' : '',
    variant === 'danger' ? 'av2-btn--danger' : '',
    touch ? 'av2-btn--touch' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')
  return <button ref={ref} type="button" {...rest} className={cls} />
})
