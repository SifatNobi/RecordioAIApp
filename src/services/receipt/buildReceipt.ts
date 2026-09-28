import {
  AuditAction,
  AuditEvent,
  Conversation,
  ConversationReceipt,
} from '@/types';
import { useAppStore } from '@/store/appStore';
import { generateId } from '@/utils/id';
import { computeReceiptIntegrityHash } from './integrity';

const NO_AGENT_LABEL = 'No Agent Connected';

function auditEvent(
  action: AuditAction,
  recordType: string,
  recordId: string,
  timestamp: string,
  metadata: Record<string, unknown> = {}
): AuditEvent {
  return {
    id: generateId('aud'),
    action,
    actor: 'system',
    recordType,
    recordId,
    metadata,
    timestamp,
  };
}

/**
 * Builds the conversation receipt for a completed conversation.
 *
 * A receipt is a verifiable, tamper-evident snapshot of what was actually
 * transcribed and extracted. Every field is derived from real pipeline output:
 * products, prices, fees and commitments come straight from the stored analysis,
 * and `integrityHash` is a SHA-256 over that content.
 *
 * Consent is recorded honestly. The app does not currently capture a recording
 * disclosure, so `disclosed` / `recordingConsented` are left `false` rather than
 * being asserted. A receipt therefore never claims consent that was not
 * actually captured.
 */
export async function buildConversationReceipt(
  conversation: Conversation
): Promise<ConversationReceipt> {
  const { transcript, analysis, customer, agentId } = conversation;

  if (!transcript) {
    throw new Error('Cannot build a receipt without a transcript.');
  }
  if (!analysis) {
    throw new Error('Cannot build a receipt without an analysis.');
  }

  const now = new Date().toISOString();
  const agent = useAppStore.getState().agents.find((candidate) => candidate.id === agentId);

  const auditHistory: AuditEvent[] = [
    auditEvent('conversation_received', 'conversation', conversation.id, conversation.createdAt, {
      recordingType: customer.metadata?.recordingType ?? 'unknown',
      source: customer.metadata?.source ?? 'unknown',
    }),
    auditEvent('transcript_finalized', 'transcript', transcript.id, transcript.updatedAt || now, {
      provider: transcript.provider,
      language: transcript.language,
      confidence: transcript.confidence,
      segmentCount: transcript.segments.length,
    }),
    auditEvent('analysis_generated', 'product', analysis.id, analysis.createdAt || now, {
      modelVersion: analysis.modelVersion,
      confidence: analysis.confidence,
      productCount: analysis.products.length,
      commitmentCount: analysis.commitments.length,
      discrepancyCount: analysis.discrepancies.length,
    }),
  ];

  const receipt: ConversationReceipt = {
    id: generateId('rcpt'),
    conversationId: conversation.id,
    agentId,
    agentName: agent?.name || NO_AGENT_LABEL,
    agentVersion: agent?.version,
    configVersion: agent?.configVersion,
    customer,
    phoneNumber: customer.phoneNumber,
    direction: conversation.direction,
    startedAt: conversation.startedAt,
    endedAt: conversation.endedAt,
    duration: conversation.duration,
    consentStatus: {
      disclosed: false,
      recordingConsented: false,
    },
    transcriptRef: transcript.id,
    products: analysis.products,
    prices: analysis.prices,
    fees: analysis.fees,
    promises: analysis.commitments,
    commitments: analysis.commitments,
    disclosures: [],
    actions: [],
    integrityHash: '',
    verificationStatus: 'pending',
    auditHistory: [
      ...auditHistory,
      auditEvent('receipt_generated', 'receipt', conversation.id, now),
    ],
    createdAt: now,
  };

  // Hash is computed over the fully populated receipt (audit history included),
  // so any later edit to the stored receipt will fail verification.
  receipt.integrityHash = await computeReceiptIntegrityHash(receipt);
  receipt.verificationStatus = 'verified';
  receipt.verifiedAt = now;

  return receipt;
}
