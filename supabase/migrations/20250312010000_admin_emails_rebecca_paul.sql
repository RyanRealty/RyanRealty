-- Set Rebecca and Paul admin login emails (Google accounts).
UPDATE admin_roles SET email = 'RebeccaPeterson@Ryan-Realty.com', updated_at = now() WHERE email = 'rebecca.peterson@ryan-realty.com';
UPDATE admin_roles SET email = 'Paul@Ryan-Realty.com', updated_at = now() WHERE email = 'paul.stevenson@ryan-realty.com';
