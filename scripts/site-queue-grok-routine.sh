#!/bin/bash
# Retired name (2026-09-12). The grinder is scripts/site-queue-routine.sh with a
# builder chain (grok -> cursor -> claude, subscriptions only). This shim keeps
# any old launchd plist or note pointing here working.
exec /bin/bash /Users/matthewryan/RyanRealty/scripts/site-queue-routine.sh "$@"
