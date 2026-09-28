import { Conversation, Discrepancy, DisputeDetails } from '@/types';
import { generateId } from '@/utils/id';

/**
 * A detected discrepancy is only escalated into a dispute automatically when it
 * is high severity. Lower severities stay visible in the conversation analysis
 * and can be escalated by hand from the Resolve Centre.
 */
const AUTO_ESCALATED_SEVERITIES: Discrepancy['severity'][] = ['high'];

const SEVERITY_TO_PRIORITY: Record<Discrepancy['severity'], DisputeDetails['priority']> = {
  low: 'low',
  medium: 'medium',
  high: 'critical',
};

const DISCREPANCY_TITLES: Record<Discrepancy['type'], string> = {
  price_mismatch: 'Price mismatch',
  fee_not_disclosed: 'Undisclosed fee',
  feature_mismatch: 'Feature mismatch',
  timeline_mismatch: 'Timeline mismatch',
  commitment_unfulfilled: 'Unfulfilled commitment',
  product_mismatch: 'Product mismatch',
  other: 'Discrepancy',
};

/** Human label for a discrepancy type, used as the dispute title. */
export function describeDiscrepancyType(type: Discrepancy['type']): string {
  return DISCREPANCY_TITLES[type] ?? DISCREPANCY_TITLES.other;
}

/** Converts a detected discrepancy into a dispute record. */
export function disputeFromDiscrepancy(
  conversation: Conversation,
  discrepancy: Discrepancy
): DisputeDetails {
  const now = new Date().toISOString();

  return {
    id: generateId('dsp'),
    title: describeDiscrepancyType(discrepancy.type),
    description: discrepancy.description,
    status: 'open',
    priority: SEVERITY_TO_PRIORITY[discrepancy.severity] ?? 'medium',
    conversations: [conversation.id],
    evidence: conversation.receipt ? [conversation.receipt.id] : [],
    notes: [],
    createdAt: discrepancy.createdAt || now,
    updatedAt: now,
  };
}

/** Disputes that should be opened automatically for a freshly analysed conversation. */
export function autoDisputesFor(conversation: Conversation): DisputeDetails[] {
  const discrepancies = conversation.analysis?.discrepancies ?? [];

  return discrepancies
    .filter((discrepancy) => AUTO_ESCALATED_SEVERITIES.includes(discrepancy.severity))
    .map((discrepancy) => disputeFromDiscrepancy(conversation, discrepancy));
}

/** Creates a dispute raised by the user against a specific conversation. */
export function createManualDispute(params: {
  conversationId: string;
  title: string;
  description: string;
  priority: DisputeDetails['priority'];
  evidence?: string[];
}): DisputeDetails {
  const now = new Date().toISOString();
  const title = params.title.trim();
  const description = params.description.trim();

  return {
    id: generateId('dsp'),
    title: title || 'Dispute',
    description: description || 'No description provided.',
    status: 'open',
    priority: params.priority,
    conversations: [params.conversationId],
    evidence: params.evidence ?? [],
    notes: [],
    createdAt: now,
    updatedAt: now,
  };
}
