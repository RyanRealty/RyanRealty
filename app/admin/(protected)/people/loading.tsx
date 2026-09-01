import { SectionHead } from '@/components/admin/v2'
import '@/components/admin/v2/admin-v2.css'

/**
 * People first paint. The search row + New contact button are visible
 * immediately so a broker never sits on a blank white page while
 * recently-touched loads. The add form itself lives in the dialog.
 */
export default function PeopleLoading() {
  return (
    <div className="av2-scope" style={{ maxWidth: 760, margin: '0 auto', padding: 16 }} aria-busy>
      <div style={{ display: 'flex', gap: 8, margin: '0 0 20px' }}>
        <div className="av2-input" style={{ height: 36, flex: 1 }} />
        <span className="av2-btn av2-btn--touch" aria-hidden>
          New contact
        </span>
      </div>
      <SectionHead>Recently touched</SectionHead>
      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>Loading recent people.</p>
    </div>
  )
}
