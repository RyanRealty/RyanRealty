-- Store admin emails in lowercase so app lookup (email.trim().toLowerCase()) matches.
-- Only update when result would not conflict with an existing row (idempotent).
UPDATE admin_roles a
SET email = lower(a.email), updated_at = now()
WHERE a.email IN ('RebeccaPeterson@Ryan-Realty.com', 'Paul@Ryan-Realty.com')
  AND a.email != lower(a.email)
  AND NOT EXISTS (SELECT 1 FROM admin_roles b WHERE b.email = lower(a.email) AND b.id != a.id);
