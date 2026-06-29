'use client'

/**
 * TopBarScope — the FUB persistent "Everyone ▾" agent-scope switcher pinned in
 * the mobile admin top bar on the contacts list (FUB ui2_5821). Reads the current
 * scope from the URL and mounts the shared BrokerScopeSheet so the scope is
 * reachable while scrolling the feed. Lives behind a <Suspense> in ConsoleShell
 * because useSearchParams must be boundary-isolated.
 */
import { useSearchParams } from 'next/navigation'
import { CRM_BROKERS, CRM_BROKER_DISPLAY } from '@/lib/crm/constants'
import BrokerScopeSheet from '@/components/admin/crm/BrokerScopeSheet'

/** Broker slug → web headshot (transparent PNG mirror in public/images/brokers). */
const BROKER_HEADSHOT: Record<string, string> = {
  matt: '/images/brokers/ryan-matt.png',
  rebecca: '/images/brokers/peterson-rebecca.png',
  paul: '/images/brokers/stevenson-paul.png',
}

export default function TopBarScope({ myBrokerSlug }: { myBrokerSlug: string | null }) {
  const sp = useSearchParams()
  const current = sp.get('broker') ?? 'all'

  return (
    <BrokerScopeSheet
      brokers={CRM_BROKERS.map((slug) => ({ slug, label: CRM_BROKER_DISPLAY[slug], headshot: BROKER_HEADSHOT[slug] ?? null }))}
      current={current}
      myBrokerSlug={myBrokerSlug}
      carry={{
        q: sp.get('q') ?? undefined,
        stage: sp.get('stage') ?? undefined,
        tag: sp.get('tag') ?? undefined,
        view: sp.get('view') ?? undefined,
      }}
      className="h-9 w-auto border-0 bg-transparent px-2 font-medium"
    />
  )
}
