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
