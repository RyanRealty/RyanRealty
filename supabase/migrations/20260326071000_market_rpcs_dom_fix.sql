-- Phase 1 follow-up: remove hard dependency on non-existent DaysOnMarket columns

create or replace function public.compute_and_cache_period_stats(
  p_geo_type text,
  p_geo_slug text,
  p_period_type text,
  p_period_start date,
  p_period_end date default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_period_end date := coalesce(p_period_end, (p_period_start + interval '1 month' - interval '1 day')::date);
  v_geo_label text := p_geo_slug;
  v_sold_count integer := 0;
  v_median_sale_price numeric;
  v_avg_sale_price numeric;
  v_total_volume numeric;
  v_median_dom numeric;
  v_speed_p25 numeric;
  v_speed_p50 numeric;
  v_speed_p75 numeric;
  v_median_ppsf numeric;
  v_avg_sale_to_list_ratio numeric;
  v_price_band_counts jsonb := '{}'::jsonb;
  v_bedroom_breakdown jsonb := '{}'::jsonb;
  v_property_type_breakdown jsonb := '{}'::jsonb;
  v_market_health_score numeric := 0;
  v_market_health_label text := 'Cold';
begin
  if p_geo_type = 'region' then
    v_geo_label := 'Central Oregon';
  elsif p_geo_type in ('city', 'subdivision') then
    v_geo_label := p_geo_slug;
  else
    raise exception 'Invalid geo_type: %', p_geo_type;
  end if;

  with closed_sales as (
    select
      coalesce(("details"->>'ClosePrice')::numeric, "ClosePrice", "ListPrice") as close_price,
      "ListPrice" as list_price,
      coalesce(("details"->>'DaysOnMarket')::numeric, ("details"->>'CumulativeDaysOnMarket')::numeric) as dom,
      "TotalLivingAreaSqFt" as living_area,
      "BedroomsTotal" as beds_total,
      "PropertyType" as property_type
    from public.listings l
    where coalesce("CloseDate", ("details"->>'CloseDate')::date) >= p_period_start
      and coalesce("CloseDate", ("details"->>'CloseDate')::date) <= v_period_end
      and (
        p_geo_type = 'region'
        or (p_geo_type = 'city' and lower(coalesce("City", '')) = lower(p_geo_slug))
        or (p_geo_type = 'subdivision' and lower(coalesce("SubdivisionName", '')) = lower(p_geo_slug))
      )
  ),
  base as (
    select
      count(*)::int as sold_count,
      percentile_cont(0.5) within group (order by close_price) as median_sale_price,
      avg(close_price) as avg_sale_price,
      sum(close_price) as total_volume,
      percentile_cont(0.5) within group (order by dom) as median_dom,
      percentile_cont(0.25) within group (order by dom) as speed_p25,
      percentile_cont(0.5) within group (order by dom) as speed_p50,
      percentile_cont(0.75) within group (order by dom) as speed_p75,
      percentile_cont(0.5) within group (order by case when living_area > 0 then close_price / living_area else null end) as median_ppsf,
      avg(case when list_price > 0 then close_price / list_price else null end) as avg_sale_to_list_ratio
    from closed_sales
  ),
  price_bands as (
    select jsonb_object_agg(label, cnt) as bands
    from (
      select
        case
          when close_price < 300000 then 'under_300k'
          when close_price < 500000 then '300k_500k'
          when close_price < 750000 then '500k_750k'
          when close_price < 1000000 then '750k_1m'
          else 'over_1m'
        end as label,
        count(*)::int as cnt
      from closed_sales
      group by 1
    ) b
  ),
  beds as (
    select jsonb_object_agg(label, cnt) as bands
    from (
      select coalesce(beds_total::text, 'unknown') as label, count(*)::int as cnt
      from closed_sales
      group by 1
    ) b
  ),
  prop_types as (
    select jsonb_object_agg(label, cnt) as bands
    from (
      select coalesce(property_type, 'unknown') as label, count(*)::int as cnt
      from closed_sales
      group by 1
    ) b
  )
  select
    coalesce(base.sold_count, 0),
    base.median_sale_price,
    base.avg_sale_price,
    base.total_volume,
    base.median_dom,
    base.speed_p25,
    base.speed_p50,
    base.speed_p75,
    base.median_ppsf,
    base.avg_sale_to_list_ratio,
    coalesce(price_bands.bands, '{}'::jsonb),
    coalesce(beds.bands, '{}'::jsonb),
    coalesce(prop_types.bands, '{}'::jsonb)
  into
    v_sold_count,
    v_median_sale_price,
    v_avg_sale_price,
    v_total_volume,
    v_median_dom,
    v_speed_p25,
    v_speed_p50,
    v_speed_p75,
    v_median_ppsf,
    v_avg_sale_to_list_ratio,
    v_price_band_counts,
    v_bedroom_breakdown,
    v_property_type_breakdown
  from base
  cross join price_bands
  cross join beds
  cross join prop_types;

  v_market_health_score :=
    least(25, greatest(0, coalesce((30 - coalesce(v_median_dom, 30)) * (25.0 / 30.0), 0))) +
    least(20, greatest(0, coalesce((coalesce(v_avg_sale_to_list_ratio, 1) - 0.95) * 400, 0))) +
    least(20, greatest(0, coalesce(v_sold_count / 10.0, 0))) +
    least(20, greatest(0, coalesce((750000 - coalesce(v_median_sale_price, 750000)) / 50000.0, 0))) +
    least(10, greatest(0, coalesce((coalesce(v_avg_sale_price, 0) - coalesce(v_median_sale_price, 0)) / nullif(v_median_sale_price, 0), 0) * 100));

  v_market_health_score := greatest(0, least(100, round(v_market_health_score, 2)));
  v_market_health_label := case
    when v_market_health_score >= 80 then 'Very Hot'
    when v_market_health_score >= 60 then 'Hot'
    when v_market_health_score >= 40 then 'Warm'
    when v_market_health_score >= 20 then 'Cool'
    else 'Cold'
  end;

  insert into public.market_stats_cache (
    geo_type, geo_slug, geo_label, period_type, period_start, period_end,
    sold_count, median_sale_price, avg_sale_price, total_volume, median_dom,
    speed_p25, speed_p50, speed_p75, median_ppsf, avg_sale_to_list_ratio,
    price_band_counts, bedroom_breakdown, property_type_breakdown,
    market_health_score, market_health_label, computed_at, updated_at
  )
  values (
    p_geo_type, p_geo_slug, v_geo_label, p_period_type, p_period_start, v_period_end,
    v_sold_count, v_median_sale_price, v_avg_sale_price, v_total_volume, v_median_dom,
    v_speed_p25, v_speed_p50, v_speed_p75, v_median_ppsf, v_avg_sale_to_list_ratio,
    v_price_band_counts, v_bedroom_breakdown, v_property_type_breakdown,
    v_market_health_score, v_market_health_label, now(), now()
  )
  on conflict (geo_type, geo_slug, period_type, period_start)
  do update set
    sold_count = excluded.sold_count,
    median_sale_price = excluded.median_sale_price,
    avg_sale_price = excluded.avg_sale_price,
    total_volume = excluded.total_volume,
    median_dom = excluded.median_dom,
    speed_p25 = excluded.speed_p25,
    speed_p50 = excluded.speed_p50,
    speed_p75 = excluded.speed_p75,
    median_ppsf = excluded.median_ppsf,
    avg_sale_to_list_ratio = excluded.avg_sale_to_list_ratio,
    price_band_counts = excluded.price_band_counts,
    bedroom_breakdown = excluded.bedroom_breakdown,
    property_type_breakdown = excluded.property_type_breakdown,
    market_health_score = excluded.market_health_score,
    market_health_label = excluded.market_health_label,
    computed_at = now(),
    updated_at = now();

  return jsonb_build_object('ok', true);
end;
$$;
