-- analytics_dim_agent was reserved for a closed-sales agent dimension.
-- Hosted photograph 2026-08-18: 0 rows, no foreign keys, no TS reader.
-- Sibling analytics_dim_office stays. Drop the empty unused dim.

DROP TABLE IF EXISTS public.analytics_dim_agent;
