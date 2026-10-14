/**
 * A recording stand-in for a supabase-js query chain, for unit tests.
 *
 * `from(table)` starts a chain; every method call on it is recorded and
 * returns the chain, and awaiting the chain resolves to whatever `answer`
 * returns for the recorded calls. One fake serves selects, updates, inserts
 * and upserts without modelling PostgREST.
 */
export type ChainCall = { method: string; args: unknown[] }
export type Chain = { table: string; calls: ChainCall[] }

export function fakeSupabase(answer: (chain: Chain) => unknown) {
  const chains: Chain[] = []
  const client = {
    from(table: string) {
      const chain: Chain = { table, calls: [] }
      chains.push(chain)
      const proxy: unknown = new Proxy(
        {},
        {
          get(_target, prop) {
            if (prop === 'then') {
              return (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
                Promise.resolve()
                  .then(() => answer(chain))
                  .then(resolve, reject)
            }
            return (...args: unknown[]) => {
              chain.calls.push({ method: String(prop), args })
              return proxy
            }
          },
        },
      )
      return proxy
    },
  }
  return { client, chains }
}

/** True when the chain called `method` (e.g. 'update'). */
export function called(chain: Chain, method: string): boolean {
  return chain.calls.some((c) => c.method === method)
}

/** The first argument of the chain's first call to `method`. */
export function argOf(chain: Chain, method: string): unknown {
  return chain.calls.find((c) => c.method === method)?.args[0]
}
