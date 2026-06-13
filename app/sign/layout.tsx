// @no-parity — focused public e-signing shell, not a marketing route
import type { ReactNode } from 'react'

/**
 * Minimal, distraction-free shell for the client signing experience. The
 * marketing site chrome is suppressed for /sign/* in HideOnLP; this provides
 * the only branding a signer sees — a wordmark, a trust cue, and a slim footer.
 */
export default function SignLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <span className="font-display text-lg font-bold tracking-tight text-foreground">Ryan Realty</span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Secure signing
          </span>
        </div>
      </header>
      <div className="flex-1">{children}</div>
      <footer className="border-t border-border px-4 py-5 text-center text-xs text-muted-foreground">
        Ryan Realty · Bend · Oregon · 541.213.6706 · ryan-realty.com
      </footer>
    </div>
  )
}
