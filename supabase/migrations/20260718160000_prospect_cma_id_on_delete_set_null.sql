-- Adversarial audit 2026-07-18 (M1) — the cma_id FK was NO ACTION, so deleting or
-- rebuilding a cmas row that a prospect points at would fail with an FK violation
-- (or, worse, leave the operator unable to prune the cmas table). ON DELETE SET
-- NULL is the correct behavior: the prospect simply loses its stamped link and the
-- doc resolver falls back to the address-slug chain. The link is a convenience
-- pointer, never load-bearing.

alter table public.expired_listings drop constraint if exists expired_listings_cma_id_fkey;
alter table public.expired_listings
  add constraint expired_listings_cma_id_fkey
  foreign key (cma_id) references public.cmas(id) on delete set null;

alter table public.fsbo_listings drop constraint if exists fsbo_listings_cma_id_fkey;
alter table public.fsbo_listings
  add constraint fsbo_listings_cma_id_fkey
  foreign key (cma_id) references public.cmas(id) on delete set null;
