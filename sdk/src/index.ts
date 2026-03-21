export { ShadowKeyClient } from './client';
export type {
  ShadowKeyConfig,
  AccessRequest,
  AccessResponse,
  ReverseDisclosureRequest,
  ReverseDisclosureResponse,
  DisclosureStatus,
  APIError,
  RequestMetadata
} from './types';

// ERC-8128: HTTP Message Signatures for Ethereum (RFC 9421)
export { signRequest, verifyRequest, computeContentDigest, buildSignatureBase } from './erc8128';
export type { ERC8128SignerConfig, ERC8128Headers } from './erc8128';
export { ERC8128ShadowKeyClient } from './erc8128Client';
export type { ERC8128ClientConfig } from './erc8128Client';
