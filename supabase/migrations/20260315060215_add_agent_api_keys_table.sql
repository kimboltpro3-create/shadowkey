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
