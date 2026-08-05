import './admin-v2.css'

/** Pattern 3 (lead) — the screen answers its question in one sentence, first. */
export function VerdictLine({ tone, children }: { tone: 'ok' | 'attention'; children: React.ReactNode }) {
  return (
    <p className={`av2-verdict av2-verdict--${tone}`}>
      <span className="av2-verdict__dot" aria-hidden="true" />
      <span>{children}</span>
    </p>
  )
}
