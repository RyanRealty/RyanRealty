#!/usr/bin/env python3
# @producer-guard-exempt: retired stub — refuses to run; not a real producer (G47)
"""RETIRED. CMAs are produced ONLY by the agent running the skill, not this wrapper.

This script used to COPY a canonical example CMA (Tumalo Reservoir) and relabel
it for whatever address was passed in — which would ship a wrong-property CMA
with someone else's photos, comps, and numbers. That is a §0 data-accuracy
failure and a routing leak (a CMA produced outside the skill).

The ONLY sanctioned path to a CMA:
    marketing_brain_skills/producers/cma/SKILL.md
run by the agent against a `content:cma` action row. One property = one canonical
slug (the action row's target). Enforced by scripts/check-cma-routing.mjs (G47).

If you genuinely need a throwaway local stub, set CMA_ALLOW_STUB=1 — but never
let its output reach public/cmas/ or a client.
"""
import os
import sys

sys.stderr.write(
    "build_cma_wrapper.py is RETIRED. Produce CMAs via "
    "marketing_brain_skills/producers/cma/SKILL.md (agentic), not this wrapper.\n"
    "See scripts/check-cma-routing.mjs (G47).\n"
)
raise SystemExit(1)
