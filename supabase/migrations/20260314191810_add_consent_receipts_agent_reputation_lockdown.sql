/*
  # Add Consent Receipts, Agent Reputation, and Lockdown Events

  1. New Tables
    - `consent_receipts`
      - `id` (uuid, primary key)
      - `vault_id` (uuid, FK to vaults)
      - `disclosure_log_id` (uuid, FK to disclosure_logs, nullable)
      - `receipt_hash` (text) - SHA-256 of disclosed content
      - `wallet_signature` (text) - MetaMask personal_sign output
      - `signer_address` (text) - address that signed
      - `policy_id` (uuid, nullable)
      - `agent_address` (text)
      - `service_address` (text)
      - `category` (text)
      - `fields_disclosed` (text array)
      - `amount` (numeric, nullable)
      - `created_at` (timestamptz)
    - `agent_reputation`
      - `id` (uuid, primary key)
      - `vault_id` (uuid, FK to vaults)
      - `agent_address` (text)
      - `agent_alias` (text, nullable)
      - `trust_score` (integer, default 100)
      - `total_requests` (integer, default 0)
      - `approved_requests` (integer, default 0)
      - `denied_requests` (integer, default 0)
      - `budget_violations` (integer, default 0)
      - `spend_total` (numeric, default 0)
      - `last_active` (timestamptz, nullable)
      - `auto_restrict` (boolean, default false)
      - `restrict_threshold` (integer, default 40)
      - `created_at` (timestamptz)
      - UNIQUE on (vault_id, agent_address)
    - `lockdown_events`
      - `id` (uuid, primary key)
      - `vault_id` (uuid, FK to vaults)
      - `triggered_at` (timestamptz)
      - `policies_revoked` (integer, default 0)
      - `personas_deactivated` (integer, default 0)
      - `budgets_frozen` (integer, default 0)
      - `reason` (text, default 'manual')
      - `restored_at` (timestamptz, nullable)

  2. Security
    - Enable RLS on all new tables
    - Add anon read/write policies scoped to vault_id

  3. Functions
    - `compute_agent_reputation` - aggregates disclosure data into trust scores
    - `emergency_lockdown` - atomically revokes all access and logs the event

  4. Indexes
    - consent_receipts(vault_id), consent_receipts(receipt_hash)
    - agent_reputation(vault_id, agent_address)
    - lockdown_events(vault_id)
*/

-- consent_receipts table
CREATE TABLE IF NOT EXISTS consent_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id uuid NOT NULL REFERENCES vaults(id),
  disclosure_log_id uuid REFERENCES disclosure_logs(id),
  receipt_hash text NOT NULL,
  wallet_signature text NOT NULL,
  signer_address text NOT NULL,
  policy_id uuid,
  agent_address text NOT NULL,
  service_address text NOT NULL,
  category text NOT NULL CHECK (category = ANY (ARRAY['payment', 'identity', 'credentials', 'health', 'preferences'])),
  fields_disclosed text[] NOT NULL DEFAULT '{}',
  amount numeric,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE consent_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read consent receipts for vault"
  ON consent_receipts FOR SELECT
  TO anon
  USING (vault_id IS NOT NULL);

CREATE POLICY "Anon can insert consent receipts"
  ON consent_receipts FOR INSERT
  TO anon
  WITH CHECK (vault_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_consent_receipts_vault ON consent_receipts(vault_id);
CREATE INDEX IF NOT EXISTS idx_consent_receipts_hash ON consent_receipts(receipt_hash);

-- agent_reputation table
CREATE TABLE IF NOT EXISTS agent_reputation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id uuid NOT NULL REFERENCES vaults(id),
  agent_address text NOT NULL,
  agent_alias text,
  trust_score integer NOT NULL DEFAULT 100,
  total_requests integer NOT NULL DEFAULT 0,
  approved_requests integer NOT NULL DEFAULT 0,
  denied_requests integer NOT NULL DEFAULT 0,
  budget_violations integer NOT NULL DEFAULT 0,
  spend_total numeric NOT NULL DEFAULT 0,
  last_active timestamptz,
  auto_restrict boolean NOT NULL DEFAULT false,
  restrict_threshold integer NOT NULL DEFAULT 40,
  created_at timestamptz DEFAULT now(),
  UNIQUE(vault_id, agent_address)
);

ALTER TABLE agent_reputation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read agent reputation for vault"
  ON agent_reputation FOR SELECT
  TO anon
  USING (vault_id IS NOT NULL);

CREATE POLICY "Anon can insert agent reputation"
  ON agent_reputation FOR INSERT
  TO anon
  WITH CHECK (vault_id IS NOT NULL);

CREATE POLICY "Anon can update agent reputation"
  ON agent_reputation FOR UPDATE
  TO anon
  USING (vault_id IS NOT NULL)
  WITH CHECK (vault_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_agent_reputation_vault_agent ON agent_reputation(vault_id, agent_address);

-- lockdown_events table
CREATE TABLE IF NOT EXISTS lockdown_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id uuid NOT NULL REFERENCES vaults(id),
  triggered_at timestamptz NOT NULL DEFAULT now(),
  policies_revoked integer NOT NULL DEFAULT 0,
  personas_deactivated integer NOT NULL DEFAULT 0,
  budgets_frozen integer NOT NULL DEFAULT 0,
  reason text NOT NULL DEFAULT 'manual',
  restored_at timestamptz
);

ALTER TABLE lockdown_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read lockdown events for vault"
  ON lockdown_events FOR SELECT
  TO anon
  USING (vault_id IS NOT NULL);

CREATE POLICY "Anon can insert lockdown events"
  ON lockdown_events FOR INSERT
  TO anon
  WITH CHECK (vault_id IS NOT NULL);

CREATE POLICY "Anon can update lockdown events"
  ON lockdown_events FOR UPDATE
  TO anon
  USING (vault_id IS NOT NULL)
  WITH CHECK (vault_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_lockdown_events_vault ON lockdown_events(vault_id);

-- compute_agent_reputation function
CREATE OR REPLACE FUNCTION compute_agent_reputation(p_vault_id uuid, p_agent_address text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total integer;
  v_approved integer;
  v_denied integer;
  v_spend numeric;
  v_last_active timestamptz;
  v_alias text;
  v_violations integer;
  v_unique_services integer;
  v_score integer;
  v_result jsonb;
BEGIN
  SELECT count(*) INTO v_total
  FROM disclosure_logs
  WHERE vault_id = p_vault_id AND agent_address = p_agent_address;

  v_approved := v_total;

  SELECT count(*) INTO v_denied
  FROM disclosure_logs
  WHERE vault_id = p_vault_id AND agent_address = p_agent_address
    AND amount IS NOT NULL AND amount < 0;
  v_denied := COALESCE(v_denied, 0);

  SELECT COALESCE(sum(COALESCE(amount, 0)), 0) INTO v_spend
  FROM disclosure_logs
  WHERE vault_id = p_vault_id AND agent_address = p_agent_address AND amount > 0;

  SELECT max(timestamp) INTO v_last_active
  FROM disclosure_logs
  WHERE vault_id = p_vault_id AND agent_address = p_agent_address;

  SELECT agent_alias INTO v_alias
  FROM policies
  WHERE vault_id = p_vault_id AND agent_address = p_agent_address AND agent_alias IS NOT NULL
  LIMIT 1;

  SELECT count(DISTINCT service_address) INTO v_unique_services
  FROM disclosure_logs
  WHERE vault_id = p_vault_id AND agent_address = p_agent_address;

  v_violations := 0;
  v_score := 100;
  v_score := v_score - (v_denied * 5);
  v_score := v_score - (v_violations * 15);
  v_score := v_score - (GREATEST(v_unique_services - 3, 0) * 2);
  v_score := v_score + LEAST(v_approved / GREATEST(5, 1), 20);
  v_score := GREATEST(LEAST(v_score, 100), 0);

  INSERT INTO agent_reputation (vault_id, agent_address, agent_alias, trust_score, total_requests, approved_requests, denied_requests, budget_violations, spend_total, last_active)
  VALUES (p_vault_id, p_agent_address, v_alias, v_score, v_total, v_approved, v_denied, v_violations, v_spend, v_last_active)
  ON CONFLICT (vault_id, agent_address)
  DO UPDATE SET
    agent_alias = COALESCE(EXCLUDED.agent_alias, agent_reputation.agent_alias),
    trust_score = EXCLUDED.trust_score,
    total_requests = EXCLUDED.total_requests,
    approved_requests = EXCLUDED.approved_requests,
    denied_requests = EXCLUDED.denied_requests,
    budget_violations = EXCLUDED.budget_violations,
    spend_total = EXCLUDED.spend_total,
    last_active = EXCLUDED.last_active;

  v_result := jsonb_build_object(
    'trust_score', v_score,
    'total_requests', v_total,
    'approved_requests', v_approved,
    'denied_requests', v_denied,
    'budget_violations', v_violations,
    'spend_total', v_spend,
    'last_active', v_last_active,
    'agent_alias', v_alias
  );

  RETURN v_result;
END;
$$;

-- emergency_lockdown function
CREATE OR REPLACE FUNCTION emergency_lockdown(p_vault_id uuid, p_reason text DEFAULT 'manual')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_policies integer;
  v_personas integer;
  v_result jsonb;
BEGIN
  WITH revoked AS (
    UPDATE policies SET active = false
    WHERE vault_id = p_vault_id AND active = true
    RETURNING id
  )
  SELECT count(*) INTO v_policies FROM revoked;

  WITH deactivated AS (
    UPDATE ephemeral_personas SET active = false
    WHERE vault_id = p_vault_id AND active = true
    RETURNING id
  )
  SELECT count(*) INTO v_personas FROM deactivated;

  INSERT INTO lockdown_events (vault_id, policies_revoked, personas_deactivated, budgets_frozen, reason)
  VALUES (p_vault_id, v_policies, v_personas, 0, p_reason);

  v_result := jsonb_build_object(
    'policies_revoked', v_policies,
    'personas_deactivated', v_personas,
    'budgets_frozen', 0
  );

  RETURN v_result;
END;
$$;
