---
name: ops-fub-crm
description: KILLED. Follow Up Boss is decommissioned. CRM is in-house public.crm_people. Do not dispatch ops:fub_* rows. Do not call the FUB API.
---

# STOP - Follow Up Boss is decommissioned

CRM is in-house `public.crm_people`. There is no Follow Up Boss writer. Weekly `FORMAT_ROUTE_MAP` still names this path for `ops:fub_*` formats; if you loaded this file, stop. Do not invent FUB tags, sequences, tasks, or routing. Do not call `FOLLOWUPBOSS_*` secrets.

# ops-fub-crm (fossil - do not execute)

This directory exists so producer-runtime does not invent a missing FUB recipe. The live CRM is `lib/crm/` and `public.crm_people`.
