import type { ReactNode } from 'react'
import Link from 'next/link'

/**
 * MegaPanel — the full-bleed mega-menu shell for one parent nav item.
 *
 * Server component, pure CSS interaction (no client JS), so it is hydration-safe
 * and renders identically on server and client. The parent <li> is a `group/nav`;
 * this panel is invisible/opacity-0 by default and becomes visible on
 * group-hover and group-focus-within, exactly like the legacy HomesMegaMenu.
 *
 * Full-bleed technique: the panel is absolutely positioned under the 72px sticky
 * header (`top-full`), then stretched to the full viewport width with
 * `left-1/2 -translate-x-1/2 w-screen` (NOT an arbitrary w-[...] bracket). The
 * inner content sits in a `max-w-7xl mx-auto px-6` container so it stays centered
 * while the bg-card surface reaches both screen edges. A `pt-2` hover bridge keeps
 * the panel open while the cursor travels from the trigger into the panel.
 */

const chevron = (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    className="opacity-60 transition-transform duration-150 group-hover/nav:rotate-180"
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
)

export function MegaPanel({
  label,
  href,
  panelId,
  children,
}: {
  label: string
  href: string
  /** Stable id linking the trigger's aria-controls to the panel region. */
  panelId: string
  children: ReactNode
}) {
  return (
    <div className="group/nav static">
      <Link
        href={href}
        aria-expanded={false}
        aria-controls={panelId}
        className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-[15px] font-medium text-white/85 transition hover:bg-white/10 hover:text-white group-hover/nav:bg-white/10 group-hover/nav:text-white group-focus-within/nav:bg-white/10 group-focus-within/nav:text-white"
      >
        {label}
        {chevron}
      </Link>

      <div
        id={panelId}
        className="invisible absolute left-1/2 top-full z-50 w-screen -translate-x-1/2 pt-2 opacity-0 transition-opacity duration-150 group-hover/nav:visible group-hover/nav:opacity-100 group-focus-within/nav:visible group-focus-within/nav:opacity-100"
      >
        <div className="border-t border-border bg-card text-foreground shadow-lg">
          <div className="mx-auto max-w-7xl px-6 py-10">{children}</div>
        </div>
      </div>
    </div>
  )
}
