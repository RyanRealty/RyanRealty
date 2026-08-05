import './admin-v2.css'
import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'quiet' | 'danger'

export interface AdminButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  /** 44px min-height for phone-primary surfaces (WCAG 2.5.8). */
  touch?: boolean
}

export function Button({ variant = 'primary', touch = false, className, ...rest }: AdminButtonProps) {
  const cls = [
    'av2-btn',
    variant === 'quiet' ? 'av2-btn--quiet' : '',
    variant === 'danger' ? 'av2-btn--danger' : '',
    touch ? 'av2-btn--touch' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')
  return <button type="button" {...rest} className={cls} />
}
