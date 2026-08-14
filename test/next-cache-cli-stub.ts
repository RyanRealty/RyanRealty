/**
 * CLI stub for `next/cache`.
 *
 * `unstable_cache` needs Next's incremental cache. A tsx / node CMA build
 * has none, so the wrapper becomes a passthrough. Production still uses the
 * real module.
 */
export function unstable_cache<T extends (...args: never[]) => unknown>(fn: T): T {
  return fn
}

export function revalidatePath(): void {}
export function revalidateTag(): void {}
export function revalidate(): void {}
export function cacheLife(): void {}
export function cacheTag(): void {}
