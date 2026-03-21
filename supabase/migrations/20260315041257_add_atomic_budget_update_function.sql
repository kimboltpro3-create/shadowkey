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
