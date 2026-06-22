// Vitest stub for `server-only` (and `client-only`).
//
// Those packages are provided by the Next.js bundler and intentionally THROW
// when imported outside the correct (server / client) graph. Under vitest there
// is no Next bundler, so a bare `import 'server-only'` fails to resolve. Tests
// import server modules (e.g. lib/crm/twilio.ts, lib/supabase/service.ts)
// directly, so vitest.config.ts aliases the marker packages to this no-op.
//
// Production safety of the marker is enforced by `next build` (which uses the
// real package and fails if a server-only module enters the client graph) — NOT
// by tests. This stub only lets the unit tests import past the side-effect.
export {}
