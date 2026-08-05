import './admin-v2.css'

export type AdminState = 'down' | 'slow' | 'waiting' | 'ok' | 'accent'

/** Status is text + color, never color alone (WCAG 1.4.1). */
export function StateWord({ state, children }: { state: AdminState; children: React.ReactNode }) {
  return <span className={`av2-state av2-state--${state}`}>{children}</span>
}
