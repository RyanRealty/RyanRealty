-- Store admin emails in lowercase so app lookup (email.trim().toLowerCase()) matches.
UPDATE admin_roles SET email = lower(email), updated_at = now() WHERE email IN ('RebeccaPeterson@Ryan-Realty.com', 'Paul@Ryan-Realty.com');
