import type { Metadata } from 'next'
import Link from 'next/link'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const contactEmail = process.env.NEXT_PUBLIC_SITE_OWNER_EMAIL ?? 'legal@ryanrealty.com'

export const metadata: Metadata = {
  title: 'DMCA Policy',
  description: 'DMCA notice and takedown procedure for Ryan Realty.',
  alternates: { canonical: `${siteUrl}/dmca` },
  robots: 'noindex, follow',
}

export default function DMCAPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-primary">DMCA Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Digital Millennium Copyright Act notice and takedown procedure</p>

      <section className="mt-8 space-y-6 text-sm text-primary">
        <div>
          <h2 className="text-lg font-semibold">Designated agent</h2>
          <p className="mt-2">
            Ryan Realty has designated an agent to receive notifications of claimed copyright infringement. To reach our DMCA designated agent, contact:
          </p>
          <p className="mt-2">
            <a href={`mailto:${contactEmail}`} className="text-accent-foreground underline hover:no-underline">{contactEmail}</a>
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold">Filing a DMCA notice</h2>
          <p className="mt-2">
            If you believe content on this site infringes your copyright, you may send a written DMCA notice to our designated agent. Your notice must include:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Your physical or electronic signature</li>
            <li>Identification of the copyrighted work you believe is infringed</li>
            <li>Identification of the material that you claim is infringing and where it is located on our site</li>
            <li>Your contact information (address, phone, email)</li>
            <li>A statement that you have a good-faith belief that use of the material is not authorized by the copyright owner</li>
            <li>A statement under penalty of perjury that the information in the notice is accurate and that you are authorized to act on behalf of the copyright owner</li>
          </ul>
          <p className="mt-2">
            We will respond to valid notices in accordance with the DMCA and may remove or disable access to the allegedly infringing material.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold">Counter-notification</h2>
          <p className="mt-2">
            If you believe material you posted was removed or disabled by mistake or misidentification, you may send a counter-notification to our designated agent. It must include your physical or electronic signature, identification of the material that was removed and its location before removal, a statement under penalty of perjury that the material was removed by mistake, your name and contact information, and consent to jurisdiction of the federal court in your district (or Oregon if outside the U.S.). We may forward the counter-notification to the original complainant. If the copyright owner does not file a court action, we may restore the material.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold">Repeat infringers</h2>
          <p className="mt-2">
            We may terminate accounts of users who are repeat infringers in appropriate circumstances.
          </p>
        </div>
      </section>

      <p className="mt-10">
        <Link href="/" className="text-accent-foreground underline hover:no-underline">Back to home</Link>
      </p>
    </main>
  )
}
