import { SecretCategory } from '../types';

export const CATEGORY_LABELS: Record<SecretCategory, string> = {
  payment: 'Payment Methods',
  identity: 'Identity & Personal',
  credentials: 'API Credentials',
  health: 'Health Records',
  preferences: 'Preferences',
};

export const CATEGORY_FIELDS: Record<SecretCategory, string[]> = {
  payment: ['card_number', 'expiry', 'cvv', 'billing_name', 'billing_address', 'shipping_address'],
  identity: ['full_name', 'email', 'phone', 'dob', 'passport_number', 'passport_country', 'nationality'],
  credentials: ['api_key', 'api_secret', 'endpoint', 'username', 'password', 'token'],
  health: ['blood_type', 'allergies', 'medications', 'conditions', 'emergency_contact'],
  preferences: ['language', 'currency', 'timezone', 'dietary_restrictions', 'accessibility_needs'],
};

export const CATEGORY_COLORS: Record<SecretCategory, { bg: string; text: string; border: string; icon: string }> = {
  payment: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', icon: 'text-emerald-400' },
  identity: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30', icon: 'text-blue-400' },
  credentials: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', icon: 'text-amber-400' },
  health: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30', icon: 'text-rose-400' },
  preferences: { bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/30', icon: 'text-sky-400' },
};

export const EXPIRY_PRESETS = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: '1 year', days: 365 },
];

export const DEMO_AGENT_ADDRESSES = {
  shopping: '0xa1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
  travel: '0xb2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3',
  research: '0xc3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
};

export const DEMO_SERVICE_ADDRESSES = {
  merchant: '0xd4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5',
  airline: '0xe5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6',
  hotel: '0xf6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1',
};

export const BASE_SEPOLIA_CHAIN_ID = 84532;
export const BASE_MAINNET_CHAIN_ID = 8453;

export const BASE_SEPOLIA_CONFIG = {
  chainId: '0x14A34',
  chainName: 'Base Sepolia',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: ['https://sepolia.base.org'],
  blockExplorerUrls: ['https://sepolia.basescan.org'],
};

export const BASE_MAINNET_CONFIG = {
  chainId: '0x2105',
  chainName: 'Base',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: ['https://mainnet.base.org'],
  blockExplorerUrls: ['https://basescan.org'],
};

export const STATUS_NETWORK_SEPOLIA_CHAIN_ID = 1660990954;

export const STATUS_NETWORK_SEPOLIA_CONFIG = {
  chainId: '0x630d2baa', // 1660990954 in hex
  chainName: 'Status Network Sepolia',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: ['https://public.sepolia.rpc.status.network'],
  blockExplorerUrls: ['https://sepolia.explorer.status.network'],
};
