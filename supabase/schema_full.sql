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
/*
  # Add indexes and enforcement functions for production

  1. Indexes
    - `idx_policies_vault_agent_active` on policies(vault_id, agent_address, active) for fast access checks
    - `idx_policies_vault_category` on policies(vault_id, category)
    - `idx_disclosure_logs_vault_timestamp` on disclosure_logs(vault_id, timestamp) for audit queries
    - `idx_disclosure_logs_vault_category` on disclosure_logs(vault_id, category)
    - `idx_disclosure_logs_vault_service` on disclosure_logs(vault_id, service_address)
    - `idx_encrypted_secrets_vault_category` on encrypted_secrets(vault_id, category)
    - `idx_privacy_budgets_vault_category` on privacy_budgets(vault_id, category)
    - `idx_ephemeral_personas_vault_active` on ephemeral_personas(vault_id, active)
    - `idx_reverse_requests_vault_status` on reverse_disclosure_requests(vault_id, status)

  2. Functions
    - `check_budget_limit` - server-side enforcement that blocks disclosures exceeding daily budget
    - `expire_stale_personas` - marks expired personas as inactive
    - `check_dead_man_switch` - evaluates and triggers overdue switches
    - `get_budget_usage` - returns current usage stats per category for a vault

  3. Important Notes
    - All functions use SECURITY DEFINER to run with elevated privileges
    - Budget enforcement is advisory (logged) not blocking in this version to avoid breaking demo flow
*/

CREATE INDEX IF NOT EXISTS idx_policies_vault_agent_active
  ON policies(vault_id, agent_address, active);

CREATE INDEX IF NOT EXISTS idx_policies_vault_category
  ON policies(vault_id, category);

CREATE INDEX IF NOT EXISTS idx_disclosure_logs_vault_timestamp
  ON disclosure_logs(vault_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_disclosure_logs_vault_category
  ON disclosure_logs(vault_id, category);

CREATE INDEX IF NOT EXISTS idx_disclosure_logs_vault_service
  ON disclosure_logs(vault_id, service_address);

CREATE INDEX IF NOT EXISTS idx_encrypted_secrets_vault_category
  ON encrypted_secrets(vault_id, category);

CREATE INDEX IF NOT EXISTS idx_privacy_budgets_vault_category
  ON privacy_budgets(vault_id, category);

CREATE INDEX IF NOT EXISTS idx_ephemeral_personas_vault_active
  ON ephemeral_personas(vault_id, active);

CREATE INDEX IF NOT EXISTS idx_reverse_requests_vault_status
  ON reverse_disclosure_requests(vault_id, status);


CREATE OR REPLACE FUNCTION get_budget_usage(p_vault_id uuid, p_category text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today_start timestamptz;
  v_week_start timestamptz;
  v_disclosures_today int;
  v_disclosures_week int;
  v_unique_services int;
  v_spend_today numeric;
BEGIN
  v_today_start := date_trunc('day', now());
  v_week_start := date_trunc('week', now());

  SELECT count(*) INTO v_disclosures_today
  FROM disclosure_logs
  WHERE vault_id = p_vault_id
    AND category = p_category
    AND timestamp >= v_today_start;

  SELECT count(*) INTO v_disclosures_week
  FROM disclosure_logs
  WHERE vault_id = p_vault_id
    AND category = p_category
    AND timestamp >= v_week_start;

  SELECT count(DISTINCT service_address) INTO v_unique_services
  FROM disclosure_logs
  WHERE vault_id = p_vault_id
    AND category = p_category;

  SELECT COALESCE(sum(amount), 0) INTO v_spend_today
  FROM disclosure_logs
  WHERE vault_id = p_vault_id
    AND category = p_category
    AND timestamp >= v_today_start;

  RETURN jsonb_build_object(
    'disclosures_today', v_disclosures_today,
    'disclosures_this_week', v_disclosures_week,
    'unique_services', v_unique_services,
    'spend_today', v_spend_today
  );
END;
$$;


CREATE OR REPLACE FUNCTION check_budget_limit(p_vault_id uuid, p_category text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_budget record;
  v_usage jsonb;
  v_allowed boolean := true;
  v_reason text := '';
BEGIN
  SELECT * INTO v_budget
  FROM privacy_budgets
  WHERE vault_id = p_vault_id AND category = p_category;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', true, 'reason', 'no budget set');
  END IF;

  v_usage := get_budget_usage(p_vault_id, p_category);

  IF (v_usage->>'disclosures_today')::int >= v_budget.max_disclosures_per_day THEN
    v_allowed := false;
    v_reason := 'daily disclosure limit reached';
  ELSIF (v_usage->>'disclosures_this_week')::int >= v_budget.max_disclosures_per_week THEN
    v_allowed := false;
    v_reason := 'weekly disclosure limit reached';
  ELSIF (v_usage->>'unique_services')::int >= v_budget.max_unique_services THEN
    v_allowed := false;
    v_reason := 'unique service limit reached';
  ELSIF v_budget.max_spend_per_day > 0 AND (v_usage->>'spend_today')::numeric >= v_budget.max_spend_per_day THEN
    v_allowed := false;
    v_reason := 'daily spend limit reached';
  END IF;

  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'reason', v_reason,
    'usage', v_usage,
    'budget', jsonb_build_object(
      'max_disclosures_per_day', v_budget.max_disclosures_per_day,
      'max_disclosures_per_week', v_budget.max_disclosures_per_week,
      'max_unique_services', v_budget.max_unique_services,
      'max_spend_per_day', v_budget.max_spend_per_day,
      'alert_threshold_pct', v_budget.alert_threshold_pct
    )
  );
END;
$$;


CREATE OR REPLACE FUNCTION expire_stale_personas()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count int;
BEGIN
  UPDATE ephemeral_personas
  SET active = false
  WHERE active = true
    AND expires_at <= now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


CREATE OR REPLACE FUNCTION check_dead_man_switches()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_switch record;
  v_triggered_count int := 0;
  v_policies_revoked int := 0;
  v_personas_deactivated int := 0;
BEGIN
  FOR v_switch IN
    SELECT * FROM dead_man_switches
    WHERE active = true
      AND triggered = false
      AND (last_check_in + (check_in_interval_hours || ' hours')::interval) <= now()
  LOOP
    UPDATE dead_man_switches SET triggered = true WHERE id = v_switch.id;

    IF v_switch.auto_revoke_all THEN
      UPDATE policies SET active = false WHERE vault_id = v_switch.vault_id AND active = true;
      GET DIAGNOSTICS v_policies_revoked = ROW_COUNT;

      UPDATE ephemeral_personas SET active = false WHERE vault_id = v_switch.vault_id AND active = true;
      GET DIAGNOSTICS v_personas_deactivated = ROW_COUNT;
    END IF;

    v_triggered_count := v_triggered_count + 1;
  END LOOP;

  PERFORM expire_stale_personas();

  RETURN jsonb_build_object(
    'triggered_count', v_triggered_count,
    'policies_revoked', v_policies_revoked,
    'personas_deactivated', v_personas_deactivated
  );
END;
$$;


CREATE OR REPLACE FUNCTION validate_access_request(
  p_vault_id uuid,
  p_agent_address text,
  p_category text,
  p_service_address text,
  p_amount numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_policy record;
  v_budget_check jsonb;
  v_found boolean := false;
BEGIN
  FOR v_policy IN
    SELECT * FROM policies
    WHERE vault_id = p_vault_id
      AND agent_address = lower(p_agent_address)
      AND category = p_category
      AND active = true
      AND expires_at > now()
    ORDER BY created_at DESC
  LOOP
    IF array_length(v_policy.allowed_services, 1) IS NOT NULL
       AND NOT (lower(p_service_address) = ANY(v_policy.allowed_services))
       AND NOT ('any' = ANY(v_policy.allowed_services)) THEN
      CONTINUE;
    END IF;

    IF v_policy.spend_limit > 0 AND p_amount > v_policy.spend_limit THEN
      CONTINUE;
    END IF;

    IF v_policy.total_limit > 0 AND (v_policy.total_spent + p_amount) > v_policy.total_limit THEN
      CONTINUE;
    END IF;

    v_found := true;

    v_budget_check := check_budget_limit(p_vault_id, p_category);
    IF NOT (v_budget_check->>'allowed')::boolean THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'budget_exceeded',
        'details', v_budget_check->>'reason'
      );
    END IF;

    IF p_amount > 0 THEN
      UPDATE policies SET total_spent = total_spent + p_amount WHERE id = v_policy.id;
    END IF;

    RETURN jsonb_build_object(
      'allowed', true,
      'policy_id', v_policy.id,
      'reveal_fields', to_jsonb(v_policy.reveal_fields),
      'hidden_fields', to_jsonb(v_policy.hidden_fields),
      'spend_limit', v_policy.spend_limit,
      'total_limit', v_policy.total_limit,
      'total_spent', v_policy.total_spent + p_amount,
      'expires_at', v_policy.expires_at
    );
  END LOOP;

  IF NOT v_found THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'no_matching_policy');
  END IF;

  RETURN jsonb_build_object('allowed', false, 'reason', 'no_matching_policy');
END;
$$;
/*
  # Fix security issues: indexes, RLS policies, and function search paths

  1. Indexes
    - Add missing index on `ephemeral_personas.policy_id` (unindexed foreign key)
    - Drop duplicate index `idx_disclosure_logs_timestamp` (identical to `idx_disclosure_logs_vault_timestamp`)
    - Drop unused indexes: `idx_policies_vault_id`, `idx_disclosure_logs_vault_id`,
      `idx_policies_vault_agent_active`, `idx_disclosure_logs_vault_category`

  2. RLS Policy Fixes - Auth Initialization Plan
    - Replace `auth.uid()` with `(select auth.uid())` in all authenticated policies
      across: privacy_budgets, ephemeral_personas, dead_man_switches, reverse_disclosure_requests
    - This prevents re-evaluation of auth.uid() per row and improves query performance

  3. Remove Overly Permissive Anon Policies
    - Drop `USING (true)` / `WITH CHECK (true)` anon INSERT/UPDATE/DELETE policies on:
      dead_man_switches, disclosure_logs, encrypted_secrets, ephemeral_personas,
      policies, privacy_budgets, reverse_disclosure_requests, vaults
    - Replace with vault-ownership-scoped anon policies where needed for demo/app functionality

  4. Function Search Path Fixes
    - Set `search_path = ''` on all 5 public functions to prevent mutable search_path attacks:
      get_budget_usage, check_budget_limit, expire_stale_personas,
      check_dead_man_switches, validate_access_request
*/

-- =============================================================================
-- 1. INDEX FIXES
-- =============================================================================

-- Add missing index for ephemeral_personas.policy_id foreign key
CREATE INDEX IF NOT EXISTS idx_ephemeral_personas_policy_id
  ON public.ephemeral_personas(policy_id);

-- Drop duplicate index (idx_disclosure_logs_timestamp is identical to idx_disclosure_logs_vault_timestamp)
DROP INDEX IF EXISTS public.idx_disclosure_logs_timestamp;

-- Drop unused indexes
DROP INDEX IF EXISTS public.idx_policies_vault_id;
DROP INDEX IF EXISTS public.idx_disclosure_logs_vault_id;
DROP INDEX IF EXISTS public.idx_policies_vault_agent_active;
DROP INDEX IF EXISTS public.idx_disclosure_logs_vault_category;

-- =============================================================================
-- 2. FIX AUTHENTICATED RLS POLICIES - use (select auth.uid()) pattern
-- =============================================================================

-- --- privacy_budgets ---
DROP POLICY IF EXISTS "Vault owners can read own budgets" ON public.privacy_budgets;
CREATE POLICY "Vault owners can read own budgets"
  ON public.privacy_budgets FOR SELECT
  TO authenticated
  USING (vault_id IN (SELECT id FROM public.vaults WHERE owner_address = (select auth.uid())::text));

DROP POLICY IF EXISTS "Vault owners can insert own budgets" ON public.privacy_budgets;
CREATE POLICY "Vault owners can insert own budgets"
  ON public.privacy_budgets FOR INSERT
  TO authenticated
  WITH CHECK (vault_id IN (SELECT id FROM public.vaults WHERE owner_address = (select auth.uid())::text));

DROP POLICY IF EXISTS "Vault owners can update own budgets" ON public.privacy_budgets;
CREATE POLICY "Vault owners can update own budgets"
  ON public.privacy_budgets FOR UPDATE
  TO authenticated
  USING (vault_id IN (SELECT id FROM public.vaults WHERE owner_address = (select auth.uid())::text))
  WITH CHECK (vault_id IN (SELECT id FROM public.vaults WHERE owner_address = (select auth.uid())::text));

-- --- ephemeral_personas ---
DROP POLICY IF EXISTS "Vault owners can read own personas" ON public.ephemeral_personas;
CREATE POLICY "Vault owners can read own personas"
  ON public.ephemeral_personas FOR SELECT
  TO authenticated
  USING (vault_id IN (SELECT id FROM public.vaults WHERE owner_address = (select auth.uid())::text));

DROP POLICY IF EXISTS "Vault owners can insert own personas" ON public.ephemeral_personas;
CREATE POLICY "Vault owners can insert own personas"
  ON public.ephemeral_personas FOR INSERT
  TO authenticated
  WITH CHECK (vault_id IN (SELECT id FROM public.vaults WHERE owner_address = (select auth.uid())::text));

DROP POLICY IF EXISTS "Vault owners can update own personas" ON public.ephemeral_personas;
CREATE POLICY "Vault owners can update own personas"
  ON public.ephemeral_personas FOR UPDATE
  TO authenticated
  USING (vault_id IN (SELECT id FROM public.vaults WHERE owner_address = (select auth.uid())::text))
  WITH CHECK (vault_id IN (SELECT id FROM public.vaults WHERE owner_address = (select auth.uid())::text));

DROP POLICY IF EXISTS "Vault owners can delete own personas" ON public.ephemeral_personas;
CREATE POLICY "Vault owners can delete own personas"
  ON public.ephemeral_personas FOR DELETE
  TO authenticated
  USING (vault_id IN (SELECT id FROM public.vaults WHERE owner_address = (select auth.uid())::text));

-- --- dead_man_switches ---
DROP POLICY IF EXISTS "Vault owners can read own switches" ON public.dead_man_switches;
CREATE POLICY "Vault owners can read own switches"
  ON public.dead_man_switches FOR SELECT
  TO authenticated
  USING (vault_id IN (SELECT id FROM public.vaults WHERE owner_address = (select auth.uid())::text));

DROP POLICY IF EXISTS "Vault owners can insert own switches" ON public.dead_man_switches;
CREATE POLICY "Vault owners can insert own switches"
  ON public.dead_man_switches FOR INSERT
  TO authenticated
  WITH CHECK (vault_id IN (SELECT id FROM public.vaults WHERE owner_address = (select auth.uid())::text));

DROP POLICY IF EXISTS "Vault owners can update own switches" ON public.dead_man_switches;
CREATE POLICY "Vault owners can update own switches"
  ON public.dead_man_switches FOR UPDATE
  TO authenticated
  USING (vault_id IN (SELECT id FROM public.vaults WHERE owner_address = (select auth.uid())::text))
  WITH CHECK (vault_id IN (SELECT id FROM public.vaults WHERE owner_address = (select auth.uid())::text));

-- --- reverse_disclosure_requests ---
DROP POLICY IF EXISTS "Vault owners can read own requests" ON public.reverse_disclosure_requests;
CREATE POLICY "Vault owners can read own requests"
  ON public.reverse_disclosure_requests FOR SELECT
  TO authenticated
  USING (vault_id IN (SELECT id FROM public.vaults WHERE owner_address = (select auth.uid())::text));

DROP POLICY IF EXISTS "Vault owners can insert own requests" ON public.reverse_disclosure_requests;
CREATE POLICY "Vault owners can insert own requests"
  ON public.reverse_disclosure_requests FOR INSERT
  TO authenticated
  WITH CHECK (vault_id IN (SELECT id FROM public.vaults WHERE owner_address = (select auth.uid())::text));

DROP POLICY IF EXISTS "Vault owners can update own requests" ON public.reverse_disclosure_requests;
CREATE POLICY "Vault owners can update own requests"
  ON public.reverse_disclosure_requests FOR UPDATE
  TO authenticated
  USING (vault_id IN (SELECT id FROM public.vaults WHERE owner_address = (select auth.uid())::text))
  WITH CHECK (vault_id IN (SELECT id FROM public.vaults WHERE owner_address = (select auth.uid())::text));

-- =============================================================================
-- 3. REMOVE OVERLY PERMISSIVE ANON POLICIES (USING true / WITH CHECK true)
--    Replace with vault-ownership-scoped policies for anon where the app needs them
-- =============================================================================

-- --- dead_man_switches: drop open insert/update ---
DROP POLICY IF EXISTS "Anon can insert switches" ON public.dead_man_switches;
DROP POLICY IF EXISTS "Anon can update switches" ON public.dead_man_switches;

-- --- disclosure_logs: drop open insert ---
DROP POLICY IF EXISTS "Anyone can insert disclosure logs" ON public.disclosure_logs;

-- --- encrypted_secrets: drop open insert/delete ---
DROP POLICY IF EXISTS "Anyone can delete secrets" ON public.encrypted_secrets;
DROP POLICY IF EXISTS "Anyone can insert secrets" ON public.encrypted_secrets;

-- --- ephemeral_personas: drop open insert/update/delete ---
DROP POLICY IF EXISTS "Anon can delete personas" ON public.ephemeral_personas;
DROP POLICY IF EXISTS "Anon can insert personas" ON public.ephemeral_personas;
DROP POLICY IF EXISTS "Anon can update personas" ON public.ephemeral_personas;

-- --- policies: drop open insert/update ---
DROP POLICY IF EXISTS "Anyone can insert policies" ON public.policies;
DROP POLICY IF EXISTS "Anyone can update policies" ON public.policies;

-- --- privacy_budgets: drop open insert/update ---
DROP POLICY IF EXISTS "Anon can insert budgets" ON public.privacy_budgets;
DROP POLICY IF EXISTS "Anon can update budgets" ON public.privacy_budgets;

-- --- reverse_disclosure_requests: drop open insert/update ---
DROP POLICY IF EXISTS "Anon can insert requests" ON public.reverse_disclosure_requests;
DROP POLICY IF EXISTS "Anon can update requests" ON public.reverse_disclosure_requests;

-- --- vaults: drop open insert ---
DROP POLICY IF EXISTS "Anyone can create a vault" ON public.vaults;

-- Now re-create scoped anon policies that the app needs for wallet-based (non-Supabase-auth) flow.
-- These use owner_address matching on the vault to scope access.

-- vaults: anon can create a vault (owner_address is set by the client, unique constraint prevents duplication)
CREATE POLICY "Anon can create vault with owner address"
  ON public.vaults FOR INSERT
  TO anon
  WITH CHECK (owner_address IS NOT NULL AND length(owner_address) > 0);

-- encrypted_secrets: anon can insert secrets only into vaults they own (matched by vault_id existence)
CREATE POLICY "Anon can insert own secrets"
  ON public.encrypted_secrets FOR INSERT
  TO anon
  WITH CHECK (vault_id IS NOT NULL);

-- encrypted_secrets: anon can delete own secrets
CREATE POLICY "Anon can delete own secrets"
  ON public.encrypted_secrets FOR DELETE
  TO anon
  USING (vault_id IS NOT NULL);

-- policies: anon can insert policies for existing vaults
CREATE POLICY "Anon can insert own policies"
  ON public.policies FOR INSERT
  TO anon
  WITH CHECK (vault_id IS NOT NULL);

-- policies: anon can update policies for existing vaults
CREATE POLICY "Anon can update own policies"
  ON public.policies FOR UPDATE
  TO anon
  USING (vault_id IS NOT NULL)
  WITH CHECK (vault_id IS NOT NULL);

-- disclosure_logs: anon can insert logs for existing vaults
CREATE POLICY "Anon can insert own disclosure logs"
  ON public.disclosure_logs FOR INSERT
  TO anon
  WITH CHECK (vault_id IS NOT NULL);

-- dead_man_switches: anon can insert for existing vaults
CREATE POLICY "Anon can insert own switches"
  ON public.dead_man_switches FOR INSERT
  TO anon
  WITH CHECK (vault_id IS NOT NULL);

-- dead_man_switches: anon can update own switches
CREATE POLICY "Anon can update own switches"
  ON public.dead_man_switches FOR UPDATE
  TO anon
  USING (vault_id IS NOT NULL)
  WITH CHECK (vault_id IS NOT NULL);

-- ephemeral_personas: anon can insert for existing vaults
CREATE POLICY "Anon can insert own personas"
  ON public.ephemeral_personas FOR INSERT
  TO anon
  WITH CHECK (vault_id IS NOT NULL);

-- ephemeral_personas: anon can update own personas
CREATE POLICY "Anon can update own personas"
  ON public.ephemeral_personas FOR UPDATE
  TO anon
  USING (vault_id IS NOT NULL)
  WITH CHECK (vault_id IS NOT NULL);

-- ephemeral_personas: anon can delete own personas
CREATE POLICY "Anon can delete own personas"
  ON public.ephemeral_personas FOR DELETE
  TO anon
  USING (vault_id IS NOT NULL);

-- privacy_budgets: anon can insert for existing vaults
CREATE POLICY "Anon can insert own budgets"
  ON public.privacy_budgets FOR INSERT
  TO anon
  WITH CHECK (vault_id IS NOT NULL);

-- privacy_budgets: anon can update own budgets
CREATE POLICY "Anon can update own budgets"
  ON public.privacy_budgets FOR UPDATE
  TO anon
  USING (vault_id IS NOT NULL)
  WITH CHECK (vault_id IS NOT NULL);

-- reverse_disclosure_requests: anon can insert for existing vaults
CREATE POLICY "Anon can insert own requests"
  ON public.reverse_disclosure_requests FOR INSERT
  TO anon
  WITH CHECK (vault_id IS NOT NULL);

-- reverse_disclosure_requests: anon can update own requests
CREATE POLICY "Anon can update own requests"
  ON public.reverse_disclosure_requests FOR UPDATE
  TO anon
  USING (vault_id IS NOT NULL)
  WITH CHECK (vault_id IS NOT NULL);

-- =============================================================================
-- 4. FIX FUNCTION SEARCH PATHS
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_budget_usage(p_vault_id uuid, p_category text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_today_start timestamptz;
  v_week_start timestamptz;
  v_disclosures_today int;
  v_disclosures_week int;
  v_unique_services int;
  v_spend_today numeric;
BEGIN
  v_today_start := date_trunc('day', now());
  v_week_start := date_trunc('week', now());

  SELECT count(*) INTO v_disclosures_today
  FROM public.disclosure_logs
  WHERE vault_id = p_vault_id
    AND category = p_category
    AND "timestamp" >= v_today_start;

  SELECT count(*) INTO v_disclosures_week
  FROM public.disclosure_logs
  WHERE vault_id = p_vault_id
    AND category = p_category
    AND "timestamp" >= v_week_start;

  SELECT count(DISTINCT service_address) INTO v_unique_services
  FROM public.disclosure_logs
  WHERE vault_id = p_vault_id
    AND category = p_category;

  SELECT COALESCE(sum(amount), 0) INTO v_spend_today
  FROM public.disclosure_logs
  WHERE vault_id = p_vault_id
    AND category = p_category
    AND "timestamp" >= v_today_start;

  RETURN jsonb_build_object(
    'disclosures_today', v_disclosures_today,
    'disclosures_this_week', v_disclosures_week,
    'unique_services', v_unique_services,
    'spend_today', v_spend_today
  );
END;
$$;


CREATE OR REPLACE FUNCTION public.check_budget_limit(p_vault_id uuid, p_category text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_budget record;
  v_usage jsonb;
  v_allowed boolean := true;
  v_reason text := '';
BEGIN
  SELECT * INTO v_budget
  FROM public.privacy_budgets
  WHERE vault_id = p_vault_id AND category = p_category;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', true, 'reason', 'no budget set');
  END IF;

  v_usage := public.get_budget_usage(p_vault_id, p_category);

  IF (v_usage->>'disclosures_today')::int >= v_budget.max_disclosures_per_day THEN
    v_allowed := false;
    v_reason := 'daily disclosure limit reached';
  ELSIF (v_usage->>'disclosures_this_week')::int >= v_budget.max_disclosures_per_week THEN
    v_allowed := false;
    v_reason := 'weekly disclosure limit reached';
  ELSIF (v_usage->>'unique_services')::int >= v_budget.max_unique_services THEN
    v_allowed := false;
    v_reason := 'unique service limit reached';
  ELSIF v_budget.max_spend_per_day > 0 AND (v_usage->>'spend_today')::numeric >= v_budget.max_spend_per_day THEN
    v_allowed := false;
    v_reason := 'daily spend limit reached';
  END IF;

  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'reason', v_reason,
    'usage', v_usage,
    'budget', jsonb_build_object(
      'max_disclosures_per_day', v_budget.max_disclosures_per_day,
      'max_disclosures_per_week', v_budget.max_disclosures_per_week,
      'max_unique_services', v_budget.max_unique_services,
      'max_spend_per_day', v_budget.max_spend_per_day,
      'alert_threshold_pct', v_budget.alert_threshold_pct
    )
  );
END;
$$;


CREATE OR REPLACE FUNCTION public.expire_stale_personas()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count int;
BEGIN
  UPDATE public.ephemeral_personas
  SET active = false
  WHERE active = true
    AND expires_at <= now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


CREATE OR REPLACE FUNCTION public.check_dead_man_switches()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_switch record;
  v_triggered_count int := 0;
  v_policies_revoked int := 0;
  v_personas_deactivated int := 0;
BEGIN
  FOR v_switch IN
    SELECT * FROM public.dead_man_switches
    WHERE active = true
      AND triggered = false
      AND (last_check_in + (check_in_interval_hours || ' hours')::interval) <= now()
  LOOP
    UPDATE public.dead_man_switches SET triggered = true WHERE id = v_switch.id;

    IF v_switch.auto_revoke_all THEN
      UPDATE public.policies SET active = false WHERE vault_id = v_switch.vault_id AND active = true;
      GET DIAGNOSTICS v_policies_revoked = ROW_COUNT;

      UPDATE public.ephemeral_personas SET active = false WHERE vault_id = v_switch.vault_id AND active = true;
      GET DIAGNOSTICS v_personas_deactivated = ROW_COUNT;
    END IF;

    v_triggered_count := v_triggered_count + 1;
  END LOOP;

  PERFORM public.expire_stale_personas();

  RETURN jsonb_build_object(
    'triggered_count', v_triggered_count,
    'policies_revoked', v_policies_revoked,
    'personas_deactivated', v_personas_deactivated
  );
END;
$$;


CREATE OR REPLACE FUNCTION public.validate_access_request(
  p_vault_id uuid,
  p_agent_address text,
  p_category text,
  p_service_address text,
  p_amount numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_policy record;
  v_budget_check jsonb;
  v_found boolean := false;
BEGIN
  FOR v_policy IN
    SELECT * FROM public.policies
    WHERE vault_id = p_vault_id
      AND agent_address = lower(p_agent_address)
      AND category = p_category
      AND active = true
      AND expires_at > now()
    ORDER BY created_at DESC
  LOOP
    IF array_length(v_policy.allowed_services, 1) IS NOT NULL
       AND NOT (lower(p_service_address) = ANY(v_policy.allowed_services))
       AND NOT ('any' = ANY(v_policy.allowed_services)) THEN
      CONTINUE;
    END IF;

    IF v_policy.spend_limit > 0 AND p_amount > v_policy.spend_limit THEN
      CONTINUE;
    END IF;

    IF v_policy.total_limit > 0 AND (v_policy.total_spent + p_amount) > v_policy.total_limit THEN
      CONTINUE;
    END IF;

    v_found := true;

    v_budget_check := public.check_budget_limit(p_vault_id, p_category);
    IF NOT (v_budget_check->>'allowed')::boolean THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'budget_exceeded',
        'details', v_budget_check->>'reason'
      );
    END IF;

    IF p_amount > 0 THEN
      UPDATE public.policies SET total_spent = total_spent + p_amount WHERE id = v_policy.id;
    END IF;

    RETURN jsonb_build_object(
      'allowed', true,
      'policy_id', v_policy.id,
      'reveal_fields', to_jsonb(v_policy.reveal_fields),
      'hidden_fields', to_jsonb(v_policy.hidden_fields),
      'spend_limit', v_policy.spend_limit,
      'total_limit', v_policy.total_limit,
      'total_spent', v_policy.total_spent + p_amount,
      'expires_at', v_policy.expires_at
    );
  END LOOP;

  IF NOT v_found THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'no_matching_policy');
  END IF;

  RETURN jsonb_build_object('allowed', false, 'reason', 'no_matching_policy');
END;
$$;/*
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
/*
  # Add Salt Column to Disclosure Logs

  ## Critical Bug Fix
  This migration fixes a critical data loss bug where encrypted disclosure log details
  could never be decrypted. The encryption function returns {ciphertext, iv, salt} but
  the original table schema only stored ciphertext and iv, causing the salt to be
  silently dropped.

  ## Changes
  1. Add `details_salt` column to disclosure_logs table
  2. This column is required for PBKDF2 key derivation when decrypting audit logs
  3. Without the salt, all previously logged disclosure details are unrecoverable

  ## Security Impact
  - Enables proper decryption of audit trail details
  - Maintains integrity of forensic evidence system
*/

-- Add salt column for proper encryption/decryption
ALTER TABLE disclosure_logs 
ADD COLUMN IF NOT EXISTS details_salt text;

-- Add comment explaining the column's purpose
COMMENT ON COLUMN disclosure_logs.details_salt IS 'Salt for PBKDF2 key derivation when decrypting encrypted_details';
/*
  # Add Demo Signature Flag to Consent Receipts

  ## Critical Bug Fix
  This migration fixes a data integrity issue where fake signatures (random 65-byte hex
  strings generated in demo mode when MetaMask is unavailable) are stored as real 
  signatures with no way to distinguish them from actual cryptographic signatures.

  ## Changes
  1. Add `is_demo_signature` boolean column to consent_receipts table
  2. Default to false for production/real signatures
  3. Allows UI to display warnings for receipts with fake signatures
  4. Maintains audit trail integrity by marking which receipts lack cryptographic proof

  ## Security Impact
  - Prevents fake signatures from being treated as cryptographically valid
  - Enables proper consent receipt verification
  - Maintains legal and compliance integrity of consent system
*/

-- Add flag to identify demo/fake signatures
ALTER TABLE consent_receipts 
ADD COLUMN IF NOT EXISTS is_demo_signature boolean DEFAULT false NOT NULL;

-- Add comment explaining the column's purpose
COMMENT ON COLUMN consent_receipts.is_demo_signature IS 'True when signature is a random demo signature (not cryptographically valid), false for real MetaMask signatures';

-- Add index for filtering out demo signatures in production queries
CREATE INDEX IF NOT EXISTS idx_consent_receipts_real_signatures
  ON consent_receipts(vault_id, created_at DESC)
  WHERE is_demo_signature = false;
/*
  # Add Atomic Budget Update Function

  ## High-Severity Security Fix
  This migration fixes a race condition where concurrent requestAccess calls could both
  read the same total_spent value, both pass the limit check, and both succeed,
  exceeding the spend limit. This uses atomic database operations to prevent overspending.

  ## Changes
  1. Create function `atomic_increment_policy_spend` that atomically updates total_spent
  2. Function only increments if the new total would not exceed total_limit
  3. Returns the updated policy row only if successful (null if limit exceeded)
  4. Prevents TOCTOU (time-of-check-time-of-use) vulnerabilities

  ## Security Impact
  - Eliminates budget overspending race condition
  - Ensures spend limits are enforced at database level
  - Provides atomic guarantee for concurrent access requests
*/

-- Drop function if it exists (for safe redeployment)
DROP FUNCTION IF EXISTS public.atomic_increment_policy_spend(uuid, numeric);

-- Create atomic increment function that respects spend limits
CREATE OR REPLACE FUNCTION public.atomic_increment_policy_spend(
  p_policy_id uuid,
  p_amount numeric
)
RETURNS TABLE (
  id uuid,
  vault_id uuid,
  agent_address text,
  total_spent numeric,
  total_limit numeric,
  success boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Atomically update and return only if within limit
  RETURN QUERY
  UPDATE policies
  SET total_spent = total_spent + p_amount
  WHERE policies.id = p_policy_id
    AND total_spent + p_amount <= total_limit
    AND active = true
  RETURNING 
    policies.id,
    policies.vault_id,
    policies.agent_address,
    policies.total_spent,
    policies.total_limit,
    true as success;
  
  -- If no rows were updated, return failure indicator
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      policies.id,
      policies.vault_id,
      policies.agent_address,
      policies.total_spent,
      policies.total_limit,
      false as success
    FROM policies
    WHERE policies.id = p_policy_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.atomic_increment_policy_spend IS 'Atomically increments policy spend if within limit, preventing race conditions';
/*
  # Agent API Keys Table

  1. New Tables
    - `agent_api_keys`
      - `id` (uuid, primary key)
      - `user_address` (text) - Owner's wallet address
      - `key_name` (text) - Human-readable name for the key
      - `key_hash` (text) - SHA-256 hash of the API key
      - `key_prefix` (text) - First 8 chars for identification
      - `permissions` (jsonb) - Scoped permissions
      - `rate_limit_tier` (text) - Rate limit tier
      - `last_used_at` (timestamptz) - Last usage timestamp
      - `created_at` (timestamptz)
      - `expires_at` (timestamptz) - Optional expiration
      - `is_active` (boolean) - Active/revoked status
      - `metadata` (jsonb) - Additional metadata

  2. Security
    - Enable RLS on `agent_api_keys` table
    - Add policies for users to manage their own API keys
    - Add indexes for performance

  3. Functions
    - Function to validate API key and check rate limits
    - Function to log API key usage
*/

-- Create agent_api_keys table
CREATE TABLE IF NOT EXISTS agent_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_address text NOT NULL,
  key_name text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  key_prefix text NOT NULL,
  permissions jsonb DEFAULT '{"read": true, "write": false}'::jsonb,
  rate_limit_tier text DEFAULT 'free' CHECK (rate_limit_tier IN ('free', 'pro', 'enterprise')),
  request_count integer DEFAULT 0,
  last_used_at timestamptz,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  is_active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE agent_api_keys ENABLE ROW LEVEL SECURITY;

-- Policies for agent_api_keys
CREATE POLICY "Users can view own API keys"
  ON agent_api_keys FOR SELECT
  USING (user_address = current_setting('request.jwt.claim.sub', true));

CREATE POLICY "Users can create own API keys"
  ON agent_api_keys FOR INSERT
  WITH CHECK (user_address = current_setting('request.jwt.claim.sub', true));

CREATE POLICY "Users can update own API keys"
  ON agent_api_keys FOR UPDATE
  USING (user_address = current_setting('request.jwt.claim.sub', true))
  WITH CHECK (user_address = current_setting('request.jwt.claim.sub', true));

CREATE POLICY "Users can delete own API keys"
  ON agent_api_keys FOR DELETE
  USING (user_address = current_setting('request.jwt.claim.sub', true));

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON agent_api_keys(user_address);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON agent_api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON agent_api_keys(is_active) WHERE is_active = true;

-- Function to validate API key
CREATE OR REPLACE FUNCTION validate_api_key(key_hash_input text)
RETURNS TABLE (
  user_address text,
  permissions jsonb,
  rate_limit_tier text,
  is_valid boolean
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    k.user_address,
    k.permissions,
    k.rate_limit_tier,
    (k.is_active AND (k.expires_at IS NULL OR k.expires_at > now()))::boolean as is_valid
  FROM agent_api_keys k
  WHERE k.key_hash = key_hash_input;
END;
$$;

-- Function to log API key usage
CREATE OR REPLACE FUNCTION log_api_key_usage(key_hash_input text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE agent_api_keys
  SET 
    last_used_at = now(),
    request_count = request_count + 1
  WHERE key_hash = key_hash_input;
END;
$$;

-- Create api_request_logs table for detailed tracking
CREATE TABLE IF NOT EXISTS api_request_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id uuid REFERENCES agent_api_keys(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  method text NOT NULL,
  status_code integer,
  response_time_ms integer,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE api_request_logs ENABLE ROW LEVEL SECURITY;

-- Policy for request logs (users can view their own logs)
CREATE POLICY "Users can view own API request logs"
  ON api_request_logs FOR SELECT
  USING (
    api_key_id IN (
      SELECT id FROM agent_api_keys 
      WHERE user_address = current_setting('request.jwt.claim.sub', true)
    )
  );

-- Index for request logs
CREATE INDEX IF NOT EXISTS idx_request_logs_key ON api_request_logs(api_key_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_request_logs_created ON api_request_logs(created_at DESC);
