-- W8.1 D1 — §0: gate median_sale_price behind n>=3 in compute_and_cache_period_stats.
--
-- THE DEFECT. The function computed median_sale_price as a bare
--   percentile_cont(0.5) WITHIN GROUP (ORDER BY "ClosePrice")
-- with NO sample gate. Its sibling statistics were already gated at n>=5
-- (median_dom, median_ppsf, sale_to_list, concessions, quality, tax_rate) — the
-- headline number, the one that actually gets published, was not. So a period with
-- ONE closing published that single sale as a "median", usually with a YoY percent
-- beside it:
--
--   terrebonne        ytd     n=2  $708,500   +6.9% YoY   (rendered on /housing-market/terrebonne)
--   black butte ranch monthly n=1  $88,500   -93.5% YoY   (a luxury resort community)
--   pronghorn         ytd     n=1  $2,025,000 +82.0% YoY
--   mitchell      rolling_30d n=1  $19,000
--
-- 1,526 stored rows across 34 geos held such a median — 907 of them from a SINGLE
-- sale. This is the exact §0 failure the retired get_city_period_metrics RPC was
-- condemned for; the cache replacement inherited it.
--
-- THE FIX. Gate at all THREE sites that derive a median from "ClosePrice":
--   1. the current-period median in the `agg` CTE,
--   2. the prior-period median that feeds yoy_median_price_delta_pct,
--   3. the prior-MONTH median (v_prior_month_median_price),
-- so a YoY delta can never be derived from a 1-2 sale baseline either.
--
-- Threshold is n>=3, the ODS rule already applied by the subdivision producer
-- (20260724030000_compute_subdivision_period_stats.sql). Deliberately NOT n>=5:
-- that is the sibling threshold for ratio statistics, which are far noisier than a
-- median; matching the subdivision path keeps one rule across geo types.
--
-- Applied surgically by exact-string replacement on the live definition, each
-- anchor asserted to match exactly once, so the other ~29k characters of this
-- function are provably untouched. Re-running is safe: the anchors no longer match
-- once gated, and the assertions turn a miss into a loud failure rather than a
-- silent no-op.
do $mig$
declare
  v_def text;
  v_new text;
  v_hits int;
  a1 text := 'percentile_cont(0.5) WITHIN GROUP (ORDER BY "ClosePrice") AS median_sale_price';
  a2 text := 'SELECT COUNT(*)::integer,' || chr(10) || '    percentile_cont(0.5) WITHIN GROUP (ORDER BY "ClosePrice"),';
  a3 text := 'SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY "ClosePrice")' || chr(10) || '    INTO v_prior_month_median_price';
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'compute_and_cache_period_stats';

  if v_def is null then
    raise exception 'compute_and_cache_period_stats not found';
  end if;

  -- Already gated (re-run): nothing to do.
  if position('COUNT(*) >= 3 THEN percentile_cont' in v_def) > 0 then
    raise notice 'median sample gate already present — skipping';
    return;
  end if;

  v_new := v_def;

  v_hits := (length(v_new) - length(replace(v_new, a1, ''))) / length(a1);
  if v_hits <> 1 then raise exception 'anchor 1 matched % times, expected 1', v_hits; end if;
  v_new := replace(v_new, a1,
    'CASE WHEN COUNT(*) >= 3 THEN percentile_cont(0.5) WITHIN GROUP (ORDER BY "ClosePrice") ELSE NULL END AS median_sale_price');

  v_hits := (length(v_new) - length(replace(v_new, a2, ''))) / length(a2);
  if v_hits <> 1 then raise exception 'anchor 2 matched % times, expected 1', v_hits; end if;
  v_new := replace(v_new, a2,
    'SELECT COUNT(*)::integer,' || chr(10) ||
    '    CASE WHEN COUNT(*) >= 3 THEN percentile_cont(0.5) WITHIN GROUP (ORDER BY "ClosePrice") ELSE NULL END,');

  v_hits := (length(v_new) - length(replace(v_new, a3, ''))) / length(a3);
  if v_hits <> 1 then raise exception 'anchor 3 matched % times, expected 1', v_hits; end if;
  v_new := replace(v_new, a3,
    'SELECT CASE WHEN COUNT(*) >= 3 THEN percentile_cont(0.5) WITHIN GROUP (ORDER BY "ClosePrice") ELSE NULL END' || chr(10) ||
    '    INTO v_prior_month_median_price');

  execute v_new;
  raise notice 'compute_and_cache_period_stats: median gated at n>=3 (3 sites)';
end
$mig$;

-- Clear what the ungated function already stored. A YoY derived from a thin median
-- is equally unpublishable, so it goes with it.
update public.market_stats_cache
   set median_sale_price = null,
       yoy_median_price_delta_pct = null
 where sold_count is not null
   and sold_count < 3
   and (median_sale_price is not null or yoy_median_price_delta_pct is not null);
