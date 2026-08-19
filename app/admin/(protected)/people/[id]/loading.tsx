import { EntityTitle } from '@/components/admin/v2'
import '@/components/admin/v2/admin-v2.css'

/** Person detail first paint. Identity chrome, not a hanging skeleton. */
export default function PersonLoading() {
  return (
    <div className="av2-scope" style={{ maxWidth: 760, margin: '0 auto', padding: 16 }} aria-busy>
      <EntityTitle>Person</EntityTitle>
      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
        Opening this person. Name, address, related people, and notes land first.
      </p>
    </div>
  )
}
