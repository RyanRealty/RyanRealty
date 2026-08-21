import { CONTACT } from '@/lib/brand/contact'

export function HoodDAsk({ name }: { name: string }) {
  return (
    <section className="hood-d-ask" id="ask">
      <div className="hood-d-wrap">
        <h2 className="hood-d-display">Ask me about {name}</h2>
        <p>Call or text about a house here.</p>
        <div className="hood-d-ask-row">
          <a className="hood-d-ask-phone" href={`tel:${CONTACT.phoneDirectTel}`}>
            {CONTACT.phoneDirect}
          </a>
          <span className="hood-d-ask-actions">
            <a href={`tel:${CONTACT.phoneDirectTel}`}>Call</a>
            <a href={`sms:${CONTACT.phoneDirectTel}`}>Text</a>
          </span>
        </div>
      </div>
    </section>
  )
}
