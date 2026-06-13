// @no-parity — public e-signing surface (tokenized), not a marketing route; no mockup contract
// @data-free — token-gated signing data comes from a server action (tc-sign), not a cached @/lib/data DAL read
import { getSigningSession } from '@/app/actions/tc-sign'
import { SignFlow } from '@/components/tc/pdf-sign/SignFlow'

// Reads request headers (IP/UA capture) so it always renders per request.
export const revalidate = 0
export const metadata = { title: 'Sign documents · Ryan Realty', robots: { index: false, follow: false } }

function Centered({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ryan Realty</p>
      <h1 className="mt-2 font-display text-2xl font-bold text-foreground">{title}</h1>
      <p className="mt-3 text-sm text-muted-foreground">{body}</p>
      <p className="mt-8 text-xs text-muted-foreground">Questions? Call 541.213.6706 or reply to the email that sent you here.</p>
    </div>
  )
}

export default async function SignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const session = await getSigningSession(token)

  if (session.status === 'ready') {
    return (
      <main className="min-h-screen bg-background">
        <SignFlow token={token} payload={session.data} />
      </main>
    )
  }
  if (session.status === 'waiting') {
    return (
      <main className="min-h-screen bg-background">
        <Centered
          title="Almost your turn"
          body={`The earlier signers on ${session.propertyAddress} need to sign first. We will email you the moment it is your turn.`}
        />
      </main>
    )
  }
  if (session.status === 'completed') {
    return (
      <main className="min-h-screen bg-background">
        <Centered
          title="Already signed"
          body={`Your signature on ${session.propertyAddress} is recorded. A completed copy was emailed to you.`}
        />
      </main>
    )
  }
  return (
    <main className="min-h-screen bg-background">
      <Centered title="This link is not active" body={session.message} />
    </main>
  )
}
