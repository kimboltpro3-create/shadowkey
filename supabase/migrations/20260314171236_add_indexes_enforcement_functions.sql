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
