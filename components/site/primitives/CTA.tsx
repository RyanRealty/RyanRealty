import Link from 'next/link'
import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Brand-locked CTA primitives — wraps shadcn Button/Badge tokens with
 * the Ryan Realty Design System v2 variants so consumer code picks one
 * `tone` instead of stitching className soup.
 *
 * Tone palette:
 *   primary       — bg-primary navy + white text. Use for one CTA per
 *                   block (e.g. "List your home", "Get a free valuation").
 *   on-navy       — white background + navy text. Use on the navy
 *                   SiteHeader / hero so the CTA pops against the bg.
 *   on-navy-ghost — transparent border-white-25 + white text. Secondary
 *                   action sitting next to on-navy ("Sign in" next to
 *                   "List your home").
 *   outline       — bg-card + foreground text + border. The neutral
 *                   secondary CTA on cream sections.
 *   ghost         — transparent + hover bg-muted. Tertiary inline.
 *   destructive   — bg-destructive + white. Reserved for deletes.
 *
 * Sizes:
 *   sm — 36 px / py-1.5 — inline lists, table actions
 *   md — 44 px / py-2.5 — default ("Search" buttons, modal primary)
 *   lg — 52 px / py-3.5 — hero CTAs, primary form submit
 *
 * CTAButton: polymorphic — pass `href` to render Next Link, no href = button.
 * TextLink:  inline text link with the locked navy + underline-on-hover.
 * IconButton: 36px square button for icon-only actions.
 * BadgePill:  pill tag for status / tier / category labels.
 */

// ─── CTAButton ────────────────────────────────────────────────────────

type CTATone =
  | 'primary'
  | 'on-navy'
  | 'on-navy-ghost'
  | 'outline'
  | 'ghost'
  | 'destructive'

type CTASize = 'sm' | 'md' | 'lg'

const toneClass: Record<CTATone, string> = {
  primary:
    'bg-primary text-white hover:bg-primary/85 focus-visible:ring-primary/40',
  'on-navy':
    'bg-white text-primary hover:bg-white/90 focus-visible:ring-white/40',
  'on-navy-ghost':
    'border border-white/35 bg-transparent text-white hover:bg-white/10 focus-visible:ring-white/40',
  outline:
    'border border-border bg-card text-foreground hover:bg-muted focus-visible:ring-primary/30',
  ghost:
    'bg-transparent text-foreground hover:bg-muted focus-visible:ring-primary/30',
  destructive:
    'bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/40',
}

const sizeClass: Record<CTASize, string> = {
  sm: 'h-9 px-3.5 text-[13px] font-semibold',
  md: 'h-11 px-[18px] text-sm font-semibold',
  lg: 'h-[52px] px-6 text-base font-semibold',
}

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-[10px] transition active:translate-y-px focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-50'

type CTAButtonProps = {
  tone?: CTATone
  size?: CTASize
  /** When set, renders a Next <Link>. Omit to render a <button>. */
  href?: string
  /** When true, opens external links in a new tab + adds noopener. */
  external?: boolean
  children: ReactNode
  className?: string
  /** Native button-only props. */
  type?: 'button' | 'submit' | 'reset'
  onClick?: ComponentPropsWithoutRef<'button'>['onClick']
  disabled?: boolean
  /** Forms / a11y bag. */
  id?: string
  'aria-label'?: string
}

export function CTAButton({
  tone = 'primary',
  size = 'md',
  href,
  external,
  type = 'button',
  onClick,
  disabled,
  id,
  children,
  className,
  ...aria
}: CTAButtonProps) {
  const classes = cn(BASE, toneClass[tone], sizeClass[size], className)
  if (href) {
    if (external) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={classes}
          id={id}
          {...aria}
        >
          {children}
        </a>
      )
    }
    return (
      <Link href={href} className={classes} id={id} {...aria}>
        {children}
      </Link>
    )
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      id={id}
      className={classes}
      {...aria}
    >
      {children}
    </button>
  )
}

// ─── TextLink ─────────────────────────────────────────────────────────

type TextLinkProps = {
  href: string
  external?: boolean
  /** Underline behavior. Default 'on-hover'. */
  underline?: 'always' | 'on-hover' | 'never'
  children: ReactNode
  className?: string
} & Omit<ComponentPropsWithoutRef<typeof Link>, 'href' | 'className' | 'children'>

const underlineClass = {
  always: 'underline underline-offset-2',
  'on-hover': 'hover:underline underline-offset-2',
  never: 'no-underline',
} as const

export function TextLink({
  href,
  external,
  underline = 'on-hover',
  children,
  className,
  ...rest
}: TextLinkProps) {
  const classes = cn(
    'inline-flex items-center gap-1 text-primary font-semibold transition-colors hover:text-primary/85',
    underlineClass[underline],
    className,
  )
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>
        {children}
      </a>
    )
  }
  return (
    <Link href={href} className={classes} {...rest}>
      {children}
    </Link>
  )
}

// ─── IconButton ───────────────────────────────────────────────────────

type IconButtonProps = {
  tone?: CTATone
  /** Square edge. 32 / 36 / 44 px. Default 36. */
  size?: 32 | 36 | 44
  /** Accessibility label for icon-only buttons. */
  'aria-label': string
  children: ReactNode
  className?: string
} & Omit<ComponentPropsWithoutRef<'button'>, 'aria-label' | 'className' | 'children'>

const iconSizeClass: Record<32 | 36 | 44, string> = {
  32: 'h-8 w-8',
  36: 'h-9 w-9',
  44: 'h-11 w-11',
}

export function IconButton({
  tone = 'ghost',
  size = 36,
  children,
  className,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        BASE,
        iconSizeClass[size],
        toneClass[tone],
        'p-0',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

// ─── BadgePill ────────────────────────────────────────────────────────

type BadgeTone =
  | 'neutral'
  | 'navy'
  | 'success'
  | 'warning'
  | 'danger'
  | 'on-photo'

type BadgePillProps<T extends ElementType = 'span'> = {
  as?: T
  tone?: BadgeTone
  children: ReactNode
  className?: string
} & Omit<ComponentPropsWithoutRef<T>, 'children' | 'className'>

const badgeTone: Record<BadgeTone, string> = {
  neutral: 'bg-card text-foreground border border-border',
  navy: 'bg-primary text-white',
  success: 'bg-success text-success-foreground',
  warning: 'bg-warning text-warning-foreground',
  danger: 'bg-destructive text-white',
  'on-photo': 'bg-white/90 text-foreground backdrop-blur',
}

export function BadgePill<T extends ElementType = 'span'>({
  as,
  tone = 'neutral',
  children,
  className,
  ...rest
}: BadgePillProps<T>) {
  const Tag = (as ?? 'span') as ElementType
  return (
    <Tag
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.04em]',
        badgeTone[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  )
}
