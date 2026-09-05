-- likes: drop the USING (true) SELECT that let anon read user_id (deep-audit
-- 2026-09-04 D9). Like counts live on listings.like_count. Authenticated users
-- read only their own rows. Service role bypasses RLS for CRM saved-homes.

DROP POLICY IF EXISTS "Public read likes" ON public.likes;

DROP POLICY IF EXISTS "Authenticated read own likes" ON public.likes;
CREATE POLICY "Authenticated read own likes"
  ON public.likes
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.likes IS
  'User likes per listing. SELECT is own-row for authenticated; anon has no SELECT. Counts are listings.like_count.';
