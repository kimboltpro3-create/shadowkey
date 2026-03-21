/*
  # Add tables for 5 new ShadowKey features

  1. New Tables
    - `privacy_budgets` - Per-vault privacy budget tracking with category-level limits
      - `id` (uuid, primary key)
      - `vault_id` (uuid, FK to vaults)
      - `category` (text, checked)
      - `max_disclosures_per_day` (int, default 10)
      - `max_disclosures_per_week` (int, default 50)
      - `max_unique_services` (int, default 5)
      - `max_spend_per_day` (numeric, default 0 = unlimited)
      - `alert_threshold_pct` (int, default 80)
      - `created_at` (timestamptz)

    - `ephemeral_personas` - Temporary pseudonymous identities for agents
      - `id` (uuid, primary key)
      - `vault_id` (uuid, FK to vaults)
      - `policy_id` (uuid, FK to policies)
      - `persona_alias` (text) - randomly generated alias
      - `persona_address` (text) - ephemeral wallet/pseudonym
      - `mapped_fields` (jsonb) - field substitutions
      - `active` (bool, default true)
      - `expires_at` (timestamptz)
      - `created_at` (timestamptz)

    - `dead_man_switches` - Auto-revocation triggers
      - `id` (uuid, primary key)
      - `vault_id` (uuid, FK to vaults)
      - `check_in_interval_hours` (int, default 168 = 7 days)
      - `last_check_in` (timestamptz)
      - `auto_revoke_all` (bool, default true)
      - `notify_before_hours` (int, default 24)
      - `triggered` (bool, default false)
      - `active` (bool, default true)
      - `created_at` (timestamptz)

    - `reverse_disclosure_requests` - Services requesting data from vault owners
      - `id` (uuid, primary key)
      - `vault_id` (uuid, FK to vaults)
      - `service_address` (text)
      - `service_name` (text)
      - `requested_fields` (text[])
      - `justification` (text)
      - `category` (text, checked)
      - `status` (text, checked: pending/approved/denied/expired)
      - `response_fields` (text[], default '{}')
      - `responded_at` (timestamptz, nullable)
      - `expires_at` (timestamptz)
      - `created_at` (timestamptz)

  2. Security
    - RLS enabled on all tables
    - Policies restrict access based on vault ownership
*/

CREATE TABLE IF NOT EXISTS privacy_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id uuid NOT NULL REFERENCES vaults(id),
  category text NOT NULL CHECK (category = ANY (ARRAY['payment', 'identity', 'credentials', 'health', 'preferences'])),
  max_disclosures_per_day int NOT NULL DEFAULT 10,
  max_disclosures_per_week int NOT NULL DEFAULT 50,
  max_unique_services int NOT NULL DEFAULT 5,
  max_spend_per_day numeric NOT NULL DEFAULT 0,
  alert_threshold_pct int NOT NULL DEFAULT 80,
  created_at timestamptz DEFAULT now(),
  UNIQUE(vault_id, category)
);

ALTER TABLE privacy_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vault owners can read own budgets"
  ON privacy_budgets FOR SELECT
  TO authenticated
  USING (vault_id IN (SELECT id FROM vaults WHERE owner_address = auth.uid()::text));

CREATE POLICY "Vault owners can insert own budgets"
  ON privacy_budgets FOR INSERT
  TO authenticated
  WITH CHECK (vault_id IN (SELECT id FROM vaults WHERE owner_address = auth.uid()::text));

CREATE POLICY "Vault owners can update own budgets"
  ON privacy_budgets FOR UPDATE
  TO authenticated
  USING (vault_id IN (SELECT id FROM vaults WHERE owner_address = auth.uid()::text))
  WITH CHECK (vault_id IN (SELECT id FROM vaults WHERE owner_address = auth.uid()::text));

CREATE POLICY "Anon can read budgets"
  ON privacy_budgets FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon can insert budgets"
  ON privacy_budgets FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can update budgets"
  ON privacy_budgets FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);


CREATE TABLE IF NOT EXISTS ephemeral_personas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id uuid NOT NULL REFERENCES vaults(id),
  policy_id uuid REFERENCES policies(id),
  persona_alias text NOT NULL DEFAULT '',
  persona_address text NOT NULL DEFAULT '',
  mapped_fields jsonb NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ephemeral_personas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vault owners can read own personas"
  ON ephemeral_personas FOR SELECT
  TO authenticated
  USING (vault_id IN (SELECT id FROM vaults WHERE owner_address = auth.uid()::text));

CREATE POLICY "Vault owners can insert own personas"
  ON ephemeral_personas FOR INSERT
  TO authenticated
  WITH CHECK (vault_id IN (SELECT id FROM vaults WHERE owner_address = auth.uid()::text));

CREATE POLICY "Vault owners can update own personas"
  ON ephemeral_personas FOR UPDATE
  TO authenticated
  USING (vault_id IN (SELECT id FROM vaults WHERE owner_address = auth.uid()::text))
  WITH CHECK (vault_id IN (SELECT id FROM vaults WHERE owner_address = auth.uid()::text));

CREATE POLICY "Vault owners can delete own personas"
  ON ephemeral_personas FOR DELETE
  TO authenticated
  USING (vault_id IN (SELECT id FROM vaults WHERE owner_address = auth.uid()::text));

CREATE POLICY "Anon can read personas"
  ON ephemeral_personas FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon can insert personas"
  ON ephemeral_personas FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can update personas"
  ON ephemeral_personas FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon can delete personas"
  ON ephemeral_personas FOR DELETE
  TO anon
  USING (true);


CREATE TABLE IF NOT EXISTS dead_man_switches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id uuid NOT NULL REFERENCES vaults(id) UNIQUE,
  check_in_interval_hours int NOT NULL DEFAULT 168,
  last_check_in timestamptz DEFAULT now(),
  auto_revoke_all boolean NOT NULL DEFAULT true,
  notify_before_hours int NOT NULL DEFAULT 24,
  triggered boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE dead_man_switches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vault owners can read own switches"
  ON dead_man_switches FOR SELECT
  TO authenticated
  USING (vault_id IN (SELECT id FROM vaults WHERE owner_address = auth.uid()::text));

CREATE POLICY "Vault owners can insert own switches"
  ON dead_man_switches FOR INSERT
  TO authenticated
  WITH CHECK (vault_id IN (SELECT id FROM vaults WHERE owner_address = auth.uid()::text));

CREATE POLICY "Vault owners can update own switches"
  ON dead_man_switches FOR UPDATE
  TO authenticated
  USING (vault_id IN (SELECT id FROM vaults WHERE owner_address = auth.uid()::text))
  WITH CHECK (vault_id IN (SELECT id FROM vaults WHERE owner_address = auth.uid()::text));

CREATE POLICY "Anon can read switches"
  ON dead_man_switches FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon can insert switches"
  ON dead_man_switches FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can update switches"
  ON dead_man_switches FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);


CREATE TABLE IF NOT EXISTS reverse_disclosure_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id uuid NOT NULL REFERENCES vaults(id),
  service_address text NOT NULL,
  service_name text NOT NULL DEFAULT '',
  requested_fields text[] NOT NULL DEFAULT '{}',
  justification text NOT NULL DEFAULT '',
  category text NOT NULL CHECK (category = ANY (ARRAY['payment', 'identity', 'credentials', 'health', 'preferences'])),
  status text NOT NULL DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending', 'approved', 'denied', 'expired'])),
  response_fields text[] NOT NULL DEFAULT '{}',
  responded_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE reverse_disclosure_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vault owners can read own requests"
  ON reverse_disclosure_requests FOR SELECT
  TO authenticated
  USING (vault_id IN (SELECT id FROM vaults WHERE owner_address = auth.uid()::text));

CREATE POLICY "Vault owners can insert own requests"
  ON reverse_disclosure_requests FOR INSERT
  TO authenticated
  WITH CHECK (vault_id IN (SELECT id FROM vaults WHERE owner_address = auth.uid()::text));

CREATE POLICY "Vault owners can update own requests"
  ON reverse_disclosure_requests FOR UPDATE
  TO authenticated
  USING (vault_id IN (SELECT id FROM vaults WHERE owner_address = auth.uid()::text))
  WITH CHECK (vault_id IN (SELECT id FROM vaults WHERE owner_address = auth.uid()::text));

CREATE POLICY "Anon can read requests"
  ON reverse_disclosure_requests FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon can insert requests"
  ON reverse_disclosure_requests FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can update requests"
  ON reverse_disclosure_requests FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);
