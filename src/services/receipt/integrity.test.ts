import {
  canonicalize,
  computeReceiptIntegrityHash,
  receiptIntegrityPayload,
  verifyReceiptIntegrity,
} from './integrity';
import { buildConversationReceipt } from './buildReceipt';
import { Conversation } from '@/types';

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  const now = '2026-01-01T00:00:00.000Z';
  return {
    id: 'conv_1',
    agentId: 'local',
    phoneNumberId: '',
    customer: {
      id: 'cus_1',
      phoneNumber: 'Local recording',
      displayName: 'Recorded Conversation',
      metadata: { recordingType: 'conversation' },
      identificationSource: 'manual',
      createdAt: now,
      updatedAt: now,
    },
    direction: 'inbound',
    status: 'completed',
    processingStatus: 'completed',
    startedAt: now,
    endedAt: now,
    duration: 42,
    transcript: {
      id: 'tr_1',
      conversationId: 'conv_1',
      segments: [
        {
          id: 'seg_1',
          speaker: 'CUSTOMER',
          speakerConfidence: 0.9,
          text: 'I was promised a refund within five business days.',
          startTime: 0,
          endTime: 4,
          confidence: 0.95,
        },
      ],
      fullText: 'I was promised a refund within five business days.',
      language: 'en',
      confidence: 0.95,
      status: 'completed',
      provider: 'recordioai',
      providerId: 'prov_1',
      createdAt: now,
      updatedAt: now,
    },
    analysis: {
      id: 'analysis_1',
      conversationId: 'conv_1',
      products: [
        {
          id: 'p_1',
          name: 'Annual Plan',
          confidence: 0.9,
          sourceSegmentIds: ['seg_1'],
        },
      ],
      prices: [
        {
          id: 'pr_1',
          amount: 99,
          currency: 'USD',
          confidence: 0.88,
          sourceSegmentIds: ['seg_1'],
        },
      ],
      fees: [],
      commitments: [
        {
          id: 'c_1',
          conversationId: 'conv_1',
          description: 'Refund within five business days',
          promisedBy: 'AI_AGENT',
          status: 'pending',
          confidence: 0.91,
          sourceSegmentIds: ['seg_1'],
          createdAt: now,
          updatedAt: now,
        },
      ],
      discrepancies: [],
      summary: 'Customer asked about a refund.',
      keyPoints: ['Refund promised'],
      sentiment: { overall: 'negative', customer: 'negative', agent: 'neutral', score: -0.4 },
      language: 'en',
      confidence: 0.9,
      modelVersion: 'test-model',
      createdAt: now,
      updatedAt: now,
    },
    tags: ['recording'],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('canonicalize', () => {
  it('is independent of key insertion order', () => {
    const a = { one: 1, two: { alpha: 'a', beta: 'b' }, three: [1, 2] };
    const b = { three: [1, 2], two: { beta: 'b', alpha: 'a' }, one: 1 };

    expect(canonicalize(a)).toBe(canonicalize(b));
  });

  it('drops undefined values but keeps null', () => {
    expect(canonicalize({ a: undefined, b: null })).toBe('{"b":null}');
  });

  it('preserves array ordering', () => {
    expect(canonicalize([1, 2, 3])).not.toBe(canonicalize([3, 2, 1]));
  });

  it('collapses non-finite numbers to null so output stays valid JSON', () => {
    expect(canonicalize({ n: Number.NaN })).toBe('{"n":null}');
  });
});

describe('buildConversationReceipt', () => {
  it('builds a receipt from real pipeline output', async () => {
    const conversation = makeConversation();
    const receipt = await buildConversationReceipt(conversation);

    expect(receipt.conversationId).toBe('conv_1');
    expect(receipt.transcriptRef).toBe('tr_1');
    expect(receipt.products).toHaveLength(1);
    expect(receipt.prices).toHaveLength(1);
    expect(receipt.commitments).toHaveLength(1);
    expect(receipt.integrityHash).toMatch(/^[0-9a-f]{64}$/);
    expect(receipt.verificationStatus).toBe('verified');
  });

  it('records that consent was not captured rather than asserting it', async () => {
    const receipt = await buildConversationReceipt(makeConversation());

    expect(receipt.consentStatus.recordingConsented).toBe(false);
    expect(receipt.consentStatus.disclosed).toBe(false);
  });

  it('refuses to build without a transcript or analysis', async () => {
    const noTranscript = makeConversation({ transcript: undefined });
    await expect(buildConversationReceipt(noTranscript)).rejects.toThrow(/transcript/i);

    const noAnalysis = makeConversation({ analysis: undefined });
    await expect(buildConversationReceipt(noAnalysis)).rejects.toThrow(/analysis/i);
  });
});

describe('verifyReceiptIntegrity', () => {
  it('verifies a freshly generated receipt', async () => {
    const receipt = await buildConversationReceipt(makeConversation());
    await expect(verifyReceiptIntegrity(receipt)).resolves.toBe(true);
  });

  it('detects a tampered price', async () => {
    const receipt = await buildConversationReceipt(makeConversation());
    receipt.prices[0].amount = 1;
    await expect(verifyReceiptIntegrity(receipt)).resolves.toBe(false);
  });

  it('detects a tampered transcript reference', async () => {
    const receipt = await buildConversationReceipt(makeConversation());
    receipt.transcriptRef = 'tr_somewhere_else';
    await expect(verifyReceiptIntegrity(receipt)).resolves.toBe(false);
  });

  it('detects an appended audit event', async () => {
    const receipt = await buildConversationReceipt(makeConversation());
    receipt.auditHistory.push({
      id: 'aud_x',
      action: 'receipt_verified',
      actor: 'user',
      recordType: 'receipt',
      recordId: receipt.id,
      metadata: {},
      timestamp: '2026-01-02T00:00:00.000Z',
    });
    await expect(verifyReceiptIntegrity(receipt)).resolves.toBe(false);
  });

  it('fails for a receipt with no hash at all', async () => {
    const receipt = await buildConversationReceipt(makeConversation());
    receipt.integrityHash = '';
    await expect(verifyReceiptIntegrity(receipt)).resolves.toBe(false);
  });

  it('excludes the verification result fields from the hash payload', async () => {
    const receipt = await buildConversationReceipt(makeConversation());
    const before = receiptIntegrityPayload(receipt);

    receipt.verificationStatus = 'failed';
    receipt.verifiedAt = '2026-02-02T00:00:00.000Z';

    expect(receiptIntegrityPayload(receipt)).toBe(before);
  });

  it('produces a stable hash across key reordering', async () => {
    const receipt = await buildConversationReceipt(makeConversation());
    const first = await computeReceiptIntegrityHash(receipt);

    const reordered = {
      ...receipt,
      customer: { ...receipt.customer },
    };
    const second = await computeReceiptIntegrityHash(reordered);

    expect(second).toBe(first);
  });
});
