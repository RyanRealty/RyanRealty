'use client'

/**
 * HelpButton — the persistent floating Help control for the admin shell.
 *
 * Bottom-left so it never collides with the quick-action FAB (bottom-right)
 * or the mobile tab bar (bottom edge, hence bottom-20 on phones). Opens a
 * Sheet with: guided tours for the current page, help articles relevant to
 * the current page, and a link to the full knowledge base at /admin/help.
 */

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpen, HelpCircle, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { toursForPathname, type Tour } from '@/components/admin/help/tours'
import type { HelpArticleMeta } from '@/components/admin/help/types'

/** Articles are relevant when any of their routes is a prefix of the pathname. */
function articlesForPathname(articles: HelpArticleMeta[], pathname: string): HelpArticleMeta[] {
  return articles.filter((a) =>
    a.routes.some((r) => pathname === r || pathname.startsWith(`${r.endsWith('/') ? r : `${r}/`}`)),
  )
}

export default function HelpButton({
  articles,
  onStartTour,
}: {
  articles: HelpArticleMeta[]
  onStartTour: (tour: Tour) => void
}) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname() ?? ''
  const tours = toursForPathname(pathname)
  const pageArticles = articlesForPathname(articles, pathname)

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => setOpen(true)}
        aria-label="Help"
        title="Help"
        className="fixed bottom-20 left-4 z-40 h-11 w-11 rounded-full shadow-md lg:bottom-5 lg:left-5"
      >
        <HelpCircle className="h-5 w-5" aria-hidden />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Help</SheetTitle>
            <SheetDescription>Guided walkthroughs and how-to articles for this page.</SheetDescription>
          </SheetHeader>

          <div className="space-y-6 px-4 pb-6">
            {tours.length > 0 ? (
              <section aria-label="Guided tours">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Show me how
                </h3>
                <div className="space-y-2">
                  {tours.map((tour) => (
                    <Card key={tour.id} className="p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="min-w-0 flex-1 text-sm font-medium text-foreground">{tour.label}</p>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            setOpen(false)
                            // Let the sheet close before the overlay takes the screen.
                            setTimeout(() => onStartTour(tour), 250)
                          }}
                        >
                          <Play className="mr-1 h-3.5 w-3.5" aria-hidden />
                          Start tour
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            ) : null}

            {pageArticles.length > 0 ? (
              <section aria-label="Help for this page">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Help for this page
                </h3>
                <div className="space-y-2">
                  {pageArticles.map((a) => (
                    <Link
                      key={a.slug}
                      href={`/admin/help/${a.slug}`}
                      onClick={() => setOpen(false)}
                      className="block rounded-lg border border-border p-3 transition-colors hover:bg-muted/40"
                    >
                      <p className="text-sm font-medium text-foreground">{a.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{a.summary}</p>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}

            {tours.length === 0 && pageArticles.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No page-specific help here yet. Browse the full help library below.
              </p>
            ) : null}

            <Separator />

            <Button asChild variant="outline" className="w-full" onClick={() => setOpen(false)}>
              <Link href="/admin/help">
                <BookOpen className="mr-2 h-4 w-4" aria-hidden />
                Browse all help
              </Link>
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
