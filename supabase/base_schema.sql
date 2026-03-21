-- ─── ShadowKey Base Schema ────────────────────────────────────────────────────
-- Run this FIRST in a fresh Supabase project before running schema_full.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- vaults: one per wallet address
CREATE TABLE IF NOT EXISTS vaults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_address text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE vaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read vaults"
  ON vaults FOR SELECT TO anon USING (true);

CREATE POLICY "Anon can create vault with owner address"
  ON vaults FOR INSERT TO anon
  WITH CHECK (owner_address IS NOT NULL AND length(owner_address) > 0);

-- encrypted_secrets: AES-GCM encrypted vault data
CREATE TABLE IF NOT EXISTS encrypted_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id uuid NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category = ANY (ARRAY['payment', 'identity', 'credentials', 'health', 'preferences'])),
  label text NOT NULL,
  ciphertext text NOT NULL,
  iv text NOT NULL,
  salt text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE encrypted_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read encrypted secrets"
  ON encrypted_secrets FOR SELECT TO anon USING (true);

CREATE POLICY "Anon can insert own secrets"
  ON encrypted_secrets FOR INSERT TO anon
  WITH CHECK (vault_id IS NOT NULL);

CREATE POLICY "Anon can delete own secrets"
  ON encrypted_secrets FOR DELETE TO anon
  USING (vault_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_encrypted_secrets_vault_category
  ON encrypted_secrets(vault_id, category);

-- vault_secrets: alias table used by backup.ts (same structure as encrypted_secrets)
CREATE TABLE IF NOT EXISTS vault_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id uuid NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
  category text NOT NULL,
  label text NOT NULL,
  encrypted_value text NOT NULL,
  iv text NOT NULL,
  salt text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE vault_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read vault secrets"
  ON vault_secrets FOR SELECT TO anon USING (true);

CREATE POLICY "Anon can insert vault secrets"
  ON vault_secrets FOR INSERT TO anon
  WITH CHECK (vault_id IS NOT NULL);

CREATE POLICY "Anon can delete vault secrets"
  ON vault_secrets FOR DELETE TO anon
  USING (vault_id IS NOT NULL);

-- policies: agent access policies
CREATE TABLE IF NOT EXISTS policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id uuid NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
  agent_address text NOT NULL,
  agent_alias text,
  category text NOT NULL CHECK (category = ANY (ARRAY['payment', 'identity', 'credentials', 'health', 'preferences'])),
  spend_limit numeric NOT NULL DEFAULT 0,
  total_limit numeric NOT NULL DEFAULT 0,
  total_spent numeric NOT NULL DEFAULT 0,
  allowed_services text[] NOT NULL DEFAULT '{}',
  reveal_fields text[] NOT NULL DEFAULT '{}',
  hidden_fields text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  expires_at timestamptz NOT NULL,
  tx_hash text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read policies"
  ON policies FOR SELECT TO anon USING (true);

CREATE POLICY "Anon can insert own policies"
  ON policies FOR INSERT TO anon
  WITH CHECK (vault_id IS NOT NULL);

CREATE POLICY "Anon can update own policies"
  ON policies FOR UPDATE TO anon
  USING (vault_id IS NOT NULL)
  WITH CHECK (vault_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_policies_vault_category
  ON policies(vault_id, category);

-- disclosure_logs: audit trail of agent data accesses
CREATE TABLE IF NOT EXISTS disclosure_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id uuid NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
  agent_address text NOT NULL,
  agent_alias text,
  category text NOT NULL,
  service_address text NOT NULL,
  encrypted_details text,
  details_iv text,
  details_salt text,
  amount numeric,
  tx_hash text,
  timestamp timestamptz DEFAULT now(),
  -- fields used by AgentDemoPage for mobile approval
  service_name text,
  fields_requested text[] DEFAULT '{}',
  fields_disclosed text[] DEFAULT '{}',
  purpose text,
  status text DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending', 'approved', 'denied'])),
  approved_at timestamptz,
  expires_at timestamptz,
  ipfs_cid text
);

ALTER TABLE disclosure_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read disclosure logs"
  ON disclosure_logs FOR SELECT TO anon USING (true);

CREATE POLICY "Anon can insert own disclosure logs"
  ON disclosure_logs FOR INSERT TO anon
  WITH CHECK (vault_id IS NOT NULL);

CREATE POLICY "Anon can update own disclosure logs"
  ON disclosure_logs FOR UPDATE TO anon
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_disclosure_logs_vault_timestamp
  ON disclosure_logs(vault_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_disclosure_logs_vault_service
  ON disclosure_logs(vault_id, service_address);
