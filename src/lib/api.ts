const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

function functionUrl(name: string): string {
  return `${SUPABASE_URL}/functions/v1/${name}`;
}

function headers(): Record<string, string> {
  return {
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  };
}

export interface AccessRequestParams {
  vault_id: string;
  agent_address: string;
  category: string;
  service_address: string;
  amount?: number;
}

export interface AccessResponse {
  access: 'granted' | 'denied';
  token?: string;
  policy_id?: string;
  reveal_fields?: string[];
  hidden_fields?: string[];
  spend_limit?: number;
  total_limit?: number;
  total_spent?: number;
  expires_at?: string;
  persona?: {
    alias: string;
    address: string;
    mapped_fields: Record<string, string>;
  } | null;
  reason?: string;
  details?: string;
}

export async function apiRequestAccess(params: AccessRequestParams): Promise<AccessResponse> {
  const res = await fetch(functionUrl('access-request'), {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(errorData.error || `HTTP ${res.status}: ${res.statusText}`);
  }

  return res.json();
}

export interface ReverseDisclosureParams {
  vault_id: string;
  service_address: string;
  service_name: string;
  requested_fields: string[];
  justification: string;
  category: string;
  expires_in_days?: number;
}

export interface ReverseDisclosureResponse {
  status: string;
  request_id?: string;
  expires_at?: string;
  message?: string;
  error?: string;
}

export async function apiSubmitReverseDisclosure(params: ReverseDisclosureParams): Promise<ReverseDisclosureResponse> {
  const res = await fetch(functionUrl('reverse-disclosure'), {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(errorData.error || `HTTP ${res.status}: ${res.statusText}`);
  }

  return res.json();
}

export interface ReverseDisclosureStatusResponse {
  request_id: string;
  status: string;
  approved_fields: string[];
  responded_at: string | null;
  expires_at: string;
  created_at: string;
}

export async function apiCheckReverseDisclosureStatus(requestId: string): Promise<ReverseDisclosureStatusResponse> {
  const res = await fetch(`${functionUrl('reverse-disclosure')}?request_id=${requestId}`, {
    method: 'GET',
    headers: headers(),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(errorData.error || `HTTP ${res.status}: ${res.statusText}`);
  }

  return res.json();
}

export interface CronResponse {
  status: string;
  dead_man_switches: {
    triggered_count: number;
    policies_revoked: number;
    personas_deactivated: number;
  };
  personas_expired: number;
  requests_expired: number;
  ran_at: string;
}

export async function apiRunCron(): Promise<CronResponse> {
  const res = await fetch(functionUrl('dead-man-switch-cron'), {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(errorData.error || `HTTP ${res.status}: ${res.statusText}`);
  }

  return res.json();
}
