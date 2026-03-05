import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy & cookies',
  description: 'Privacy policy and cookie use for Ryan Realty.',
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Privacy & cookies</h1>
      <p className="mt-2 text-zinc-600">
        How we collect, use, and protect your information when you use our website.
      </p>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-zinc-900">Sign-in with Google</h2>
        <p className="mt-2 text-sm text-zinc-600">
          You can sign in with your Google account to save searches and use account features. When
          you choose “Continue with Google,” we receive your email address and name from Google. We
          use this to create or update your account on our site and to recognize you on future
          visits. We do not control Google’s privacy practices; review Google’s privacy policy for
          how they handle your data.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-zinc-900">How we use your data when you’re signed in</h2>
        <p className="mt-2 text-sm text-zinc-600">
          When you are signed in, we send your contact information and site activity to our
          customer-relationship system (Follow Up Boss) so we can follow up with you about
          properties and provide better service. This includes: your email and name, that you signed
          in or signed up, which listings you view, and which search or area pages you visit. This
          helps us understand what you’re interested in and respond to inquiries. You can sign out
          at any time to stop this activity tracking; we will only send new activity while you are
          signed in.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-zinc-900">Cookies we use</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-600">
          <li>
            <strong>Essential:</strong> Sign-in session (when you use Google) and your cookie-consent
            choice. Required for the site to work and to keep you signed in across visits.
          </li>
          <li>
            <strong>With your consent:</strong> A visit identifier so we can understand how the site
            is used and improve it.
          </li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-zinc-900">Your choices</h2>
        <p className="mt-2 text-sm text-zinc-600">
          You can accept all cookies or only essential cookies via the banner. If you sign in with
          Google, we will retain your session so you stay signed in on return visits and we can
          track the activity described above in Follow Up Boss. To stop activity tracking, sign out.
          You can revoke our access to your Google account at any time in your Google account
          settings.
        </p>
      </section>
    </main>
  )
}
