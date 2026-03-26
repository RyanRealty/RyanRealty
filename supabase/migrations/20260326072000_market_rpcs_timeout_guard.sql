-- Phase 1 follow-up: reduce timeout risk for refresh/backfill jobs

create or replace function public.refresh_current_period_stats()
returns jsonb
language plpgsql
security definer
as $$
declare
  v_month_start date := date_trunc('month', now())::date;
  v_month_end date := (date_trunc('month', now()) + interval '1 month' - interval '1 day')::date;
  v_city text;
  v_city_count integer := 0;
begin
  perform public.compute_and_cache_period_stats('region', 'central-oregon', 'monthly', v_month_start, v_month_end);

  for v_city in
    select lower("City") as city_slug
    from public.listings
    where "City" is not null and trim("City") <> ''
    group by 1
    order by count(*) desc
    limit 25
  loop
    begin
      perform public.compute_and_cache_period_stats('city', v_city, 'monthly', v_month_start, v_month_end);
      v_city_count := v_city_count + 1;
    exception when others then
      -- Keep processing remaining cities if one city fails.
      continue;
    end;
  end loop;

  return jsonb_build_object('ok', true, 'citiesProcessed', v_city_count);
end;
$$;

create or replace function public.backfill_all_historical_stats(p_months_back integer default 24)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_i integer := 0;
  v_start date;
  v_end date;
  v_city text;
  v_runs integer := 0;
begin
  while v_i < greatest(1, least(p_months_back, 24)) loop
    v_start := date_trunc('month', now() - make_interval(months => v_i))::date;
    v_end := (date_trunc('month', now() - make_interval(months => v_i)) + interval '1 month' - interval '1 day')::date;
    perform public.compute_and_cache_period_stats('region', 'central-oregon', 'monthly', v_start, v_end);
    v_runs := v_runs + 1;

    for v_city in
      select lower("City") as city_slug
      from public.listings
      where "City" is not null and trim("City") <> ''
      group by 1
      order by count(*) desc
      limit 25
    loop
      begin
        perform public.compute_and_cache_period_stats('city', v_city, 'monthly', v_start, v_end);
        v_runs := v_runs + 1;
      exception when others then
        continue;
      end;
    end loop;

    v_i := v_i + 1;
  end loop;

  return jsonb_build_object('ok', true, 'runs', v_runs, 'monthsBack', p_months_back);
end;
$$;
