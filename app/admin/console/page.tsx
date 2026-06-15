// @no-parity — internal admin surface, no public mockup contract
// @data-free — launchpad; entry tiles + lead search only, no data fetch here.
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export const metadata = { title: 'Today · Console' }

const TILES = [
  { href: '/admin/console/leads', title: 'Leads', desc: 'Every lead, what they want, the next move.' },
  { href: '/admin/crm/inbox', title: 'Inbox', desc: 'Inbound texts and emails.' },
  { href: '/admin/deals', title: 'Transactions', desc: 'Open deals and closing checklists.' },
  { href: '/admin', title: 'All admin tools', desc: 'The full brand admin.' },
]

export default function ConsoleHomePage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-7">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Today</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your workspace. Start with a lead.</p>
      </div>

      <Card>
        <CardContent className="p-4 sm:p-5">
          <form action="/admin/console/leads" method="GET" className="flex flex-col gap-2 sm:flex-row">
            <Input
              name="q"
              placeholder="Search a lead by name, email, or phone"
              className="h-11 flex-1 text-sm"
              aria-label="Search leads"
            />
            <Button type="submit" className="h-11 sm:w-32">Find lead</Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {TILES.map((t) => (
          <Link key={t.href} href={t.href} className="group block">
            <Card className="h-full transition-colors group-hover:border-foreground/20 group-hover:bg-accent/40">
              <CardContent className="flex items-center justify-between gap-3 p-4 sm:p-5">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground">{t.title}</div>
                  <div className="mt-0.5 truncate text-sm text-muted-foreground">{t.desc}</div>
                </div>
                <span className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden>→</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
