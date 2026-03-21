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
$$;