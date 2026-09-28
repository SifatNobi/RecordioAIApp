import {
  autoDisputesFor,
  createManualDispute,
  describeDiscrepancyType,
  disputeFromDiscrepancy,
} from './createDispute';
import { Conversation, Discrepancy } from '@/types';

const NOW = '2026-01-01T00:00:00.000Z';

function makeDiscrepancy(overrides: Partial<Discrepancy> = {}): Discrepancy {
  return {
    id: 'd_1',
    conversationId: 'conv_1',
    type: 'price_mismatch',
    description: 'Quoted $99 but charged $149.',
    promisedValue: 99,
    actualValue: 149,
    severity: 'medium',
    confidence: 0.93,
    sourceSegmentIds: ['seg_1'],
    status: 'detected',
    createdAt: NOW,
    ...overrides,
  };
}

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'conv_1',
    agentId: 'local',
    phoneNumberId: '',
    customer: {
      id: 'cus_1',
      phoneNumber: 'Local recording',
      displayName: 'Recorded Conversation',
      metadata: {},
      identificationSource: 'manual',
      createdAt: NOW,
      updatedAt: NOW,
    },
    direction: 'inbound',
    status: 'completed',
    processingStatus: 'completed',
    startedAt: NOW,
    endedAt: NOW,
    duration: 10,
    tags: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  } as Conversation;
}

describe('describeDiscrepancyType', () => {
  it('labels every known discrepancy type', () => {
    expect(describeDiscrepancyType('price_mismatch')).toBe('Price mismatch');
    expect(describeDiscrepancyType('fee_not_disclosed')).toBe('Undisclosed fee');
    expect(describeDiscrepancyType('other')).toBe('Discrepancy');
  });
});

describe('disputeFromDiscrepancy', () => {
  it('links the dispute to the conversation and its receipt', () => {
    const conversation = makeConversation({
      receipt: { id: 'rcpt_1' } as Conversation['receipt'],
    });
    const dispute = disputeFromDiscrepancy(conversation, makeDiscrepancy());

    expect(dispute.conversations).toEqual(['conv_1']);
    expect(dispute.evidence).toEqual(['rcpt_1']);
    expect(dispute.status).toBe('open');
    expect(dispute.notes).toEqual([]);
  });

  it('records no evidence when the conversation has no receipt', () => {
    const dispute = disputeFromDiscrepancy(makeConversation(), makeDiscrepancy());
    expect(dispute.evidence).toEqual([]);
  });

  it('escalates high severity to critical priority', () => {
    const dispute = disputeFromDiscrepancy(
      makeConversation(),
      makeDiscrepancy({ severity: 'high' })
    );
    expect(dispute.priority).toBe('critical');
  });
});

describe('autoDisputesFor', () => {
  it('only escalates high-severity discrepancies', () => {
    const conversation = makeConversation({
      analysis: {
        discrepancies: [
          makeDiscrepancy({ id: 'a', severity: 'high' }),
          makeDiscrepancy({ id: 'b', severity: 'medium' }),
          makeDiscrepancy({ id: 'c', severity: 'low' }),
        ],
      } as Conversation['analysis'],
    });

    const disputes = autoDisputesFor(conversation);
    expect(disputes).toHaveLength(1);
    expect(disputes[0].priority).toBe('critical');
  });

  it('returns nothing for a conversation with no analysis', () => {
    expect(autoDisputesFor(makeConversation())).toEqual([]);
  });

  it('returns nothing when no discrepancy is high severity', () => {
    const conversation = makeConversation({
      analysis: {
        discrepancies: [makeDiscrepancy({ severity: 'medium' })],
      } as Conversation['analysis'],
    });
    expect(autoDisputesFor(conversation)).toEqual([]);
  });
});

describe('createManualDispute', () => {
  it('stores the trimmed title and description', () => {
    const dispute = createManualDispute({
      conversationId: 'conv_1',
      title: '  Refund missing  ',
      description: '  No refund after 10 days  ',
      priority: 'high',
    });

    expect(dispute.title).toBe('Refund missing');
    expect(dispute.description).toBe('No refund after 10 days');
    expect(dispute.priority).toBe('high');
    expect(dispute.status).toBe('open');
  });

  it('falls back to safe defaults when fields are blank', () => {
    const dispute = createManualDispute({
      conversationId: 'conv_1',
      title: '   ',
      description: '   ',
      priority: 'medium',
    });

    expect(dispute.title).toBe('Dispute');
    expect(dispute.description).toBe('No description provided.');
  });
});
