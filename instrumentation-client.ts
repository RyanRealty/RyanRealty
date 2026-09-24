import { installClientErrorReporting } from './lib/observability/client-errors'

// Browser errors go to Sentry, and the SDK loads only when one happens.
installClientErrorReporting()
