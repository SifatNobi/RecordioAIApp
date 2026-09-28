import * as Crypto from 'expo-crypto';
import { ConversationReceipt } from '@/types';

/**
 * Deterministic JSON serialisation.
 *
 * Object keys are emitted in sorted order at every depth so that a receipt's
 * integrity hash is reproducible regardless of the order the keys happened to be
 * assigned in at creation time. `undefined` values are dropped, matching
 * `JSON.stringify` semantics, and non-finite numbers collapse to `null` so the
 * output is always valid JSON.
 */
export function canonicalize(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }

  if (typeof value === 'string') {
    return JSON.stringify(value);
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? JSON.stringify(value) : 'null';
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(',')}]`;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

    return `{${entries
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${canonicalize(entryValue)}`)
      .join(',')}}`;
  }

  return 'null';
}

/** SHA-256 of `input`, lower-case hex. */
export async function sha256Hex(input: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input, {
    encoding: Crypto.CryptoEncoding.HEX,
  });
}

/**
 * The exact subset of a receipt that the integrity hash covers.
 *
 * Deliberately excludes `integrityHash`, `verificationStatus` and `verifiedAt`:
 * those three fields are the *result* of verification, so including them would
 * make a receipt unable to verify itself.
 */
export function receiptIntegrityPayload(receipt: ConversationReceipt): string {
  return canonicalize({
    id: receipt.id,
    conversationId: receipt.conversationId,
    agentId: receipt.agentId,
    agentName: receipt.agentName,
    agentVersion: receipt.agentVersion,
    configVersion: receipt.configVersion,
    policyVersion: receipt.policyVersion,
    customer: receipt.customer,
    phoneNumber: receipt.phoneNumber,
    direction: receipt.direction,
    startedAt: receipt.startedAt,
    endedAt: receipt.endedAt,
    duration: receipt.duration,
    consentStatus: receipt.consentStatus,
    transcriptRef: receipt.transcriptRef,
    products: receipt.products,
    prices: receipt.prices,
    fees: receipt.fees,
    promises: receipt.promises,
    commitments: receipt.commitments,
    disclosures: receipt.disclosures,
    actions: receipt.actions,
    auditHistory: receipt.auditHistory,
    createdAt: receipt.createdAt,
  });
}

/** Computes the SHA-256 integrity hash for a receipt. */
export function computeReceiptIntegrityHash(receipt: ConversationReceipt): Promise<string> {
  return sha256Hex(receiptIntegrityPayload(receipt));
}

/** Constant-time hex comparison, so verification cannot be timed character by character. */
function hashesMatch(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Recomputes a receipt's integrity hash and reports whether the stored receipt
 * still matches the content it claims to cover. A `false` result means the
 * receipt has been altered after it was generated.
 */
export async function verifyReceiptIntegrity(
  receipt: ConversationReceipt
): Promise<boolean> {
  if (!receipt.integrityHash) {
    return false;
  }
  return hashesMatch(await computeReceiptIntegrityHash(receipt), receipt.integrityHash);
}
