import Link from 'next/link'
import '@/components/admin/v2/admin-v2.css'

/** Messages first paint. Compose is one tap away — not a hanging skeleton. */
export default function MessagesLoading() {
  return (
    <div className="av2-scope av2-msgs av2-msgs--list" aria-busy>
      <nav className="av2-convlist" aria-label="Conversations">
        <div className="av2-sysnote" style={{ padding: 24 }}>
          Opening messages. New message is one tap away.
        </div>
      </nav>
      <section className="av2-thread" aria-label="Thread">
        <div className="av2-scroll">
          <div className="av2-sysnote">
            <Link href="/admin/messages/new" style={{ color: 'var(--a-accent)' }}>
              New message
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
