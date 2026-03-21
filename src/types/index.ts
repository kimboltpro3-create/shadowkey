export type SecretCategory =
  | 'payment'
  | 'identity'
  | 'credentials'
  | 'health'
  | 'preferences';

export interface SecretField {
  key: string;
  value: string;
}

export interface VaultSecret {
  id: string;
  vault_id: string;
  category: SecretCategory;
  label: string;
  ciphertext: string;
  iv: string;
  salt: string;
  created_at: string;
}

export interface Policy {
  id: string;
  vault_id: string;
  agent_address: string;
  agent_alias?: string;
  category: SecretCategory;
  spend_limit: number;
  total_limit: number;
  total_spent: number;
  allowed_services: string[];
  expires_at: string;
  reveal_fields: string[];
  hidden_fields: string[];
  active: boolean;
  created_at: string;
  tx_hash?: string;
}

export interface DisclosureLog {
  id: string;
  vault_id: string;
  agent_address: string;
  agent_alias?: string;
  category: SecretCategory;
  service_address: string;
  timestamp: string;
  encrypted_details: string;
  details_iv: string;
  details_salt: string;
  amount?: number;
  tx_hash?: string;
}

export interface Vault {
  id: string;
  owner_address: string;
  created_at: string;
}

export interface DecryptedSecret {
  id: string;
  category: SecretCategory;
  label: string;
  fields: SecretField[];
}

export interface ScopedAccess {
  token: string;
  agent: string;
  category: SecretCategory;
  fields: SecretField[];
  expires_at: string;
}

export interface PrivacyBudget {
  id: string;
  vault_id: string;
  category: SecretCategory;
  max_disclosures_per_day: number;
  max_disclosures_per_week: number;
  max_unique_services: number;
  max_spend_per_day: number;
  alert_threshold_pct: number;
  created_at: string;
}

export interface BudgetUsage {
  category: SecretCategory;
  disclosures_today: number;
  disclosures_this_week: number;
  unique_services: number;
  spend_today: number;
  budget: PrivacyBudget | null;
}

export interface EphemeralPersona {
  id: string;
  vault_id: string;
  policy_id: string | null;
  persona_alias: string;
  persona_address: string;
  mapped_fields: Record<string, string>;
  active: boolean;
  expires_at: string;
  created_at: string;
}

export interface DeadManSwitch {
  id: string;
  vault_id: string;
  check_in_interval_hours: number;
  last_check_in: string;
  auto_revoke_all: boolean;
  notify_before_hours: number;
  triggered: boolean;
  active: boolean;
  created_at: string;
}

export interface ReverseDisclosureRequest {
  id: string;
  vault_id: string;
  service_address: string;
  service_name: string;
  requested_fields: string[];
  justification: string;
  category: SecretCategory;
  status: 'pending' | 'approved' | 'denied' | 'expired';
  response_fields: string[];
  responded_at: string | null;
  expires_at: string;
  created_at: string;
}

export interface ForensicsDataPoint {
  service: string;
  category: SecretCategory;
  fieldsRevealed: string[];
  timestamp: string;
  amount?: number;
}

export interface AdversaryProfile {
  service: string;
  knownFields: string[];
  totalInteractions: number;
  totalSpend: number;
  categories: SecretCategory[];
  firstSeen: string;
  lastSeen: string;
}

export interface ConsentReceipt {
  id: string;
  vault_id: string;
  disclosure_log_id: string | null;
  receipt_hash: string;
  wallet_signature: string;
  signer_address: string;
  policy_id: string | null;
  agent_address: string;
  service_address: string;
  category: SecretCategory;
  fields_disclosed: string[];
  amount: number | null;
  is_demo_signature: boolean;
  created_at: string;
}

export interface AgentReputation {
  id: string;
  vault_id: string;
  agent_address: string;
  agent_alias: string | null;
  trust_score: number;
  total_requests: number;
  approved_requests: number;
  denied_requests: number;
  budget_violations: number;
  spend_total: number;
  last_active: string | null;
  auto_restrict: boolean;
  restrict_threshold: number;
  created_at: string;
}

export interface LockdownEvent {
  id: string;
  vault_id: string;
  triggered_at: string;
  policies_revoked: number;
  personas_deactivated: number;
  budgets_frozen: number;
  reason: string;
  restored_at: string | null;
}

export interface SimulationResult {
  access: 'granted' | 'denied';
  reason?: string;
  reveal_fields: string[];
  hidden_fields: string[];
  persona_fields: Record<string, string> | null;
  budget_impact: {
    disclosures_today: number;
    max_per_day: number;
    disclosures_this_week: number;
    max_per_week: number;
  } | null;
  spend_impact: {
    current_spent: number;
    request_amount: number;
    total_limit: number;
  } | null;
}

export type RecommendationType =
  | 'restrict_fields'
  | 'enable_persona'
  | 'adjust_budget'
  | 'revoke_unused'
  | 'add_budget'
  | 'enable_deadman'
  | 'over_exposed';

export type RecommendationSeverity = 'high' | 'medium' | 'low';

export interface PrivacyRecommendation {
  id: string;
  type: RecommendationType;
  severity: RecommendationSeverity;
  title: string;
  description: string;
  agent_address?: string;
  category?: SecretCategory;
  actionLabel: string;
  actionRoute: string;
}

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
}
