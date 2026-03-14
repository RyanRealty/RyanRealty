import Link from 'next/link'
import { Button } from "@/components/ui/button"

export const metadata = {
  title: 'Offline',
  description: 'You are offline.',
}

export default function OfflinePage() {
  return (
    <main id="main-content" className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-primary">You&apos;re offline</h1>
      <p className="mt-4 text-muted-foreground">
        This page isn&apos;t available right now. When you&apos;re back online, you can continue browsing.
      </p>
      <p className="mt-6">
        <Button
          type="button"
          onClick={() => {
            if (typeof navigator !== 'undefined' && navigator.onLine) {
              window.location.reload()
            }
          }}
          className="rounded bg-primary px-4 py-2 text-white hover:opacity-90"
        >
          Try again
        </Button>
      </p>
      <p className="mt-6">
        <Link href="/" className="text-accent-foreground underline hover:no-underline">
          Go to homepage
        </Link>
      </p>
    </main>
  )
}
