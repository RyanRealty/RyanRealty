'use client'

/**
 * The URL's query string as a static-safe external store (SITE-29).
 *
 * `useSearchParams()` from next/navigation cannot run inside a statically
 * rendered route. During the prerender Next throws BailoutToCSRError from it
 * (dynamic-rendering.js, case 'prerender-legacy'), and React then
 * client-renders everything up to the nearest Suspense boundary. On a place
 * page that boundary is the route's loading.tsx, so the page's static HTML
 * would be the loading skeleton, listing cards and all. The split view's
 * client tree (SearchFilters, MapSearchView, and the sheet, save, and alert
 * components under them) therefore reads the query through THIS store:
 *
 *  - Server render and hydration return the value the page's provider
 *    supplies (a dynamic /search page passes the request's query string), or
 *    '' on a static shell, so the HTML and the first client render agree.
 *  - After hydration the store reads window.location.search, and one root
 *    bridge (`UrlSearchParamsBridge`, mounted by IdentityBridges inside its
 *    own Suspense boundary) keeps it current on every navigation. That bridge
 *    is the ONE place the real `useSearchParams()` runs: its bailout costs a
 *    null fallback and nothing else.
 *
 * Writing the URL on a static shell goes through `navigateQuery` with
 * `staticShell: true`: history.pushState, which Next's app router patches to
 * sync usePathname/useSearchParams (app-router.js), instead of router.push.
 * The route's RSC payload is static, so a router.push would fetch the same
 * payload again and change nothing; the client refetches the list itself.
 */
import {
  createContext,
  Suspense,
  useContext,
  useLayoutEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { ReadonlyURLSearchParams, useSearchParams } from 'next/navigation'

type Listener = () => void

const listeners = new Set<Listener>()
/** null until first read on the client; never read on the server. */
let current: string | null = null

/** `?a=1` and `a=1` both mean `a=1`. */
export function normalizeSearch(search: string | null | undefined): string {
  if (!search) return ''
  return search.startsWith('?') ? search.slice(1) : search
}

function readLocation(): string {
  return typeof window === 'undefined' ? '' : normalizeSearch(window.location.search)
}

function onPopState(): void {
  publishUrlSearchParams(readLocation())
}

/** Push a new query string into the store; listeners fire only on change. */
export function publishUrlSearchParams(search: string): void {
  const next = normalizeSearch(search)
  if (next === current) return
  current = next
  for (const listener of listeners) listener()
}

export function subscribeUrlSearchParams(listener: Listener): () => void {
  listeners.add(listener)
  if (listeners.size === 1 && typeof window !== 'undefined') {
    window.addEventListener('popstate', onPopState)
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && typeof window !== 'undefined') {
      window.removeEventListener('popstate', onPopState)
    }
  }
}

/** The client's current query string (no leading `?`). */
export function readUrlSearchParams(): string {
  if (current === null) current = readLocation()
  return current
}

/** Test seam: forget the client value so the next read comes from location. */
export function resetUrlSearchParamsForTests(): void {
  current = null
  listeners.clear()
}

const SsrSearchContext = createContext<string>('')

/**
 * A DYNAMIC page (one that already awaited `searchParams`) wraps its search
 * tree in this so the server render and hydration carry the request's query,
 * and the active-filter chips are in the HTML. A static shell renders no
 * provider: '' is the honest server value there.
 */
export function UrlSearchParamsProvider({
  search,
  children,
}: {
  search: string
  children: ReactNode
}) {
  return (
    <SsrSearchContext.Provider value={normalizeSearch(search)}>{children}</SsrSearchContext.Provider>
  )
}

/**
 * Drop-in for `useSearchParams()` under the split view. Same read-only
 * surface, one difference: on a static shell the first client render matches
 * the server ('' → defaults), and the URL's real query arrives right after
 * hydration, so no hydration mismatch and no CSR bailout.
 */
export function useUrlSearchParams(): ReadonlyURLSearchParams {
  const ssr = useContext(SsrSearchContext)
  const search = useSyncExternalStore(subscribeUrlSearchParams, readUrlSearchParams, () => ssr)
  return useMemo(() => new ReadonlyURLSearchParams(new URLSearchParams(search)), [search])
}

function Bridge() {
  const searchParams = useSearchParams()
  const search = searchParams?.toString() ?? ''
  // Layout effect: publish before paint so a navigation never paints a frame
  // whose chips read a stale query beside fresh server props.
  useLayoutEffect(() => {
    publishUrlSearchParams(search)
  }, [search])
  return null
}

/**
 * The one legitimate `useSearchParams()` under a static route: its bailout is
 * scoped to this Suspense boundary (fallback null). Mounted once, at the
 * root, by IdentityBridges.
 */
export function UrlSearchParamsBridge() {
  return (
    <Suspense fallback={null}>
      <Bridge />
    </Suspense>
  )
}

type QueryRouter = {
  push: (href: string, options?: { scroll?: boolean }) => void
  replace: (href: string, options?: { scroll?: boolean }) => void
}

/**
 * Write a filter change to the URL. On a static shell the URL is client state
 * (history.pushState, synced into the router by Next's patch) and the store
 * publishes at once; a dynamic page keeps router.push so the server re-renders
 * with the new query, as /search always has.
 */
export function navigateQuery(
  router: QueryRouter,
  href: string,
  options: { replace?: boolean; staticShell?: boolean } = {},
): void {
  if (options.staticShell && typeof window !== 'undefined') {
    const url = new URL(href, window.location.href)
    if (options.replace) window.history.replaceState(null, '', url.toString())
    else window.history.pushState(null, '', url.toString())
    publishUrlSearchParams(url.search)
    return
  }
  if (options.replace) router.replace(href, { scroll: false })
  else router.push(href, { scroll: false })
}
