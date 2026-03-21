export interface ShadowKeyConfig {
  apiUrl: string;
  apiKey: string;
  timeout?: number;
  retryAttempts?: number;
  debug?: boolean;
}

export interface AccessRequest {
  agentId: string;
  agentName: string;
  requestedFields: string[];
  purpose: string;
  category?: string;
  expiresIn?: number;
}

export interface AccessResponse {
  requestId: string;
  status: 'pending' | 'approved' | 'denied' | 'expired';
  grantedFields?: string[];
  grantedData?: Record<string, any>;
  expiresAt?: string;
  message?: string;
}

export interface ReverseDisclosureRequest {
  serviceId: string;
  serviceName: string;
  dataOffered: Array<{
    field: string;
    value: string;
    category: string;
  }>;
  purpose: string;
}

export interface ReverseDisclosureResponse {
  receiptId: string;
  status: 'accepted' | 'rejected';
  storedFields?: string[];
  message?: string;
}

export interface DisclosureStatus {
  requestId: string;
  status: 'pending' | 'approved' | 'denied' | 'expired';
  approvedAt?: string;
  deniedAt?: string;
  expiresAt?: string;
  grantedFields?: string[];
  grantedData?: Record<string, any>;
}

export interface APIError {
  code: string;
  message: string;
  details?: any;
}

export interface RequestMetadata {
  timestamp: number;
  signature: string;
  nonce: string;
}
