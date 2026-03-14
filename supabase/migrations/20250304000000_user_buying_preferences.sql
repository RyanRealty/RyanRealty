-- One row per user: down payment %, interest rate, loan term. Used to show est. monthly payment on listings.
-- RLS: users can only read/update their own row.

CREATE TABLE IF NOT EXISTS user_buying_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  down_payment_percent numeric(5,2) NOT NULL DEFAULT 20 CHECK (down_payment_percent >= 0 AND down_payment_percent <= 100),
  interest_rate numeric(5,2) NOT NULL DEFAULT 7 CHECK (interest_rate >= 0 AND interest_rate <= 20),
  loan_term_years int NOT NULL DEFAULT 30 CHECK (loan_term_years IN (10, 15, 20, 30)),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_buying_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own buying_preferences" ON user_buying_preferences;
CREATE POLICY "Users can read own buying_preferences"
  ON user_buying_preferences FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own buying_preferences" ON user_buying_preferences;
CREATE POLICY "Users can insert own buying_preferences"
  ON user_buying_preferences FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own buying_preferences" ON user_buying_preferences;
CREATE POLICY "Users can update own buying_preferences"
  ON user_buying_preferences FOR UPDATE TO authenticated USING (auth.uid() = user_id);

COMMENT ON TABLE user_buying_preferences IS 'Saved down payment %, interest rate, term for signed-in users; used to show est. monthly payment on listings.';
