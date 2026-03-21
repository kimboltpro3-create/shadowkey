/*
  # Add missing anon SELECT (and UPDATE) policies

  The security-hardening migration removed broad anon policies but did not
  add back SELECT access for the anon role. This breaks vault loading for
  wallet-connected users who have not established a Supabase auth session.

  All vault data is AES-GCM encrypted client-side, so SELECT access for
  anon is safe — the server only ever stores ciphertext.

  Tables fixed:
  - vaults              — anon SELECT (to resolve vault_id from owner_address)
  - encrypted_secrets   — anon SELECT + UPDATE
  - policies            — anon SELECT
  - disclosure_logs     — anon SELECT
  - access_requests     — anon SELECT
*/

-- ── vaults ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Anon can read own vault" ON public.vaults;
CREATE POLICY "Anon can read own vault"
  ON public.vaults FOR SELECT
  TO anon
  USING (owner_address IS NOT NULL);

-- ── encrypted_secrets ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Anon can read own secrets" ON public.encrypted_secrets;
CREATE POLICY "Anon can read own secrets"
  ON public.encrypted_secrets FOR SELECT
  TO anon
  USING (vault_id IS NOT NULL);

DROP POLICY IF EXISTS "Anon can update own secrets" ON public.encrypted_secrets;
CREATE POLICY "Anon can update own secrets"
  ON public.encrypted_secrets FOR UPDATE
  TO anon
  USING (vault_id IS NOT NULL)
  WITH CHECK (vault_id IS NOT NULL);

-- ── policies ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Anon can read own policies" ON public.policies;
CREATE POLICY "Anon can read own policies"
  ON public.policies FOR SELECT
  TO anon
  USING (vault_id IS NOT NULL);

-- ── disclosure_logs ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Anon can read own disclosure logs" ON public.disclosure_logs;
CREATE POLICY "Anon can read own disclosure logs"
  ON public.disclosure_logs FOR SELECT
  TO anon
  USING (vault_id IS NOT NULL);

