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
