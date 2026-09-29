import {
  transcribeAudio,
  TranscriptionResult,
  TranscriptionError,
  TranscriptionErrorCode,
} from './transcription';
import {
  analyzeTranscript,
  AnalysisError,
} from './analysis';
import { useRecordingStore, SavedRecording } from '@/store/recordingStore';
import { useAppStore } from '@/store/appStore';
import { buildConversationReceipt } from '@/services/receipt/buildReceipt';
import { autoDisputesFor } from '@/services/disputes/createDispute';
import { generateId } from '@/utils/id';
import {
  Conversation,
  Transcript,
  TranscriptSegment,
  Customer,
  ConversationAnalysis,
  SpeakerLabel,
} from '@/types';

function normalizeSegments(result: TranscriptionResult): TranscriptSegment[] {
  const segments: TranscriptSegment[] = result.segments.map((segment) => ({
    id: segment.id || generateId('seg'),
    speaker: segment.speaker as SpeakerLabel,
    speakerConfidence: segment.speakerConfidence ?? 0,
    text: segment.text,
    startTime: segment.startTime ?? 0,
    endTime: segment.endTime ?? 0,
    confidence: segment.confidence ?? result.confidence,
    words: segment.words,
  }));

  if (segments.length === 0 && result.transcript.trim()) {
    segments.push({
      id: generateId('seg'),
      speaker: 'UNKNOWN',
      speakerConfidence: 0,
      text: result.transcript.trim(),
      startTime: 0,
      endTime: 0,
      confidence: result.confidence,
    });
  }

  return segments;
}

function buildTranscript(conversationId: string, result: TranscriptionResult): Transcript {
  const now = new Date().toISOString();
  return {
    id: result.providerId || generateId('tr'),
    conversationId,
    segments: normalizeSegments(result),
    fullText: result.transcript,
    language: result.language,
    confidence: result.confidence,
    status: 'completed',
    provider: result.provider,
    providerId: result.providerId,
    createdAt: now,
    updatedAt: now,
  };
}

function buildFallbackAnalysis(transcriptText: string, conversationId: string): ConversationAnalysis {
  const now = new Date().toISOString();
  
  // Extract monetary amounts using regex
  const moneyRegex = /\$?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(USD|EUR|GBP|USD|\$|€|£)/gi;
  const moneyMatches = transcriptText.matchAll(moneyRegex);
  const prices = [];
  for (const match of moneyMatches) {
    const amount = parseFloat(match[1].replace(/,/g, ''));
    const currency = match[2].toUpperCase().replace('$', 'USD').replace('€', 'EUR').replace('£', 'GBP');
    prices.push({
      id: `price_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      productId: undefined,
      amount,
      currency,
      billingPeriod: undefined,
      confidence: 0.6,
      sourceSegmentIds: [],
      context: match[0],
    });
  }

  // Extract dates/times
  const dateRegex = /\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2}|\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b)/gi;
  const dateMatches = transcriptText.matchAll(dateRegex);
  const commitments = [];
  for (const match of dateMatches) {
    commitments.push({
      id: `cmt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      conversationId,
      description: `Deadline or date mentioned: ${match[0]}`,
      promisedBy: 'CUSTOMER' as const,
      dueDate: match[0],
      status: 'pending' as const,
      confidence: 0.5,
      sourceSegmentIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  // Extract potential commitments/promises
  const promiseKeywords = ['will', 'shall', 'promise', 'commit', 'agree', 'guarantee', 'ensure', 'provide', 'deliver'];
  const sentences = transcriptText.split(/[.!?]+/);
  sentences.forEach((sentence, idx) => {
    const lower = sentence.toLowerCase();
    if (promiseKeywords.some(kw => lower.includes(kw))) {
      commitments.push({
        id: `cmt_${Date.now()}_${idx}`,
        conversationId,
        description: sentence.trim(),
        promisedBy: lower.includes('i will') || lower.includes('we will') ? 'AI_AGENT' : 'CUSTOMER',
        dueDate: undefined,
        status: 'pending' as const,
        confidence: 0.55,
        sourceSegmentIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  });

  // Detect potential discrepancies (simple heuristic)
  const discrepancies = [];
  if (prices.length > 1) {
    discrepancies.push({
      id: `disc_${Date.now()}`,
      conversationId,
      type: 'price_mismatch' as const,
      description: 'Multiple price amounts detected in transcript',
      promisedValue: prices.map(p => p.amount).join(', '),
      actualValue: 'Multiple amounts found',
      severity: 'low' as const,
      confidence: 0.4,
      sourceSegmentIds: [],
      status: 'detected' as const,
      createdAt: new Date().toISOString(),
    });
  }

  return {
    id: `analysis_${Date.now()}`,
    conversationId,
    products: [],
    prices,
    fees: [],
    commitments,
    discrepancies,
    summary: 'Automated analysis (AI unavailable). Transcript processed with pattern matching.',
    keyPoints: ['Transcript processed with fallback analysis (no AI provider configured)'],
    sentiment: {
      overall: 'neutral',
      customer: 'neutral',
      agent: 'neutral',
      score: 0,
    },
    language: 'en',
    confidence: 0.5,
    modelVersion: 'fallback-v1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function buildConversation(params: {
  recording: SavedRecording;
  transcript: Transcript;
  analysis: ConversationAnalysis;
}): Conversation {
  const { recording, transcript, analysis } = params;
  const now = new Date().toISOString();
  const activeAgentId = useAppStore.getState().activeAgentId;

  const isPhoneCall = recording.recordingType === 'phone_call';

  const customer: Customer = {
    id: generateId('cus'),
    phoneNumber: isPhoneCall ? 'Phone call (mic)' : 'Local recording',
    displayName: isPhoneCall ? 'Phone Call Recording' : 'Recorded Conversation',
    metadata: {
      recordingType: recording.recordingType,
      source: 'create_record',
    },
    identificationSource: 'manual',
    createdAt: now,
    updatedAt: now,
  };

  return {
    id: analysis.conversationId,
    agentId: activeAgentId || 'local',
    phoneNumberId: '',
    customer,
    direction: 'inbound',
    status: 'completed',
    processingStatus: 'completed',
    startedAt: recording.createdAt,
    endedAt: now,
    duration: recording.duration,
    transcript,
    analysis,
    tags: [isPhoneCall ? 'phone-call' : 'recording'],
    createdAt: recording.createdAt,
    updatedAt: now,
  };
}

export function userMessageForError(error: unknown): string {
  if (error instanceof TranscriptionError || error instanceof AnalysisError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred. Please try again.';
}

/**
 * Runs transcription (if not yet produced), then AI analysis, then saves the
 * result as a conversation in the app store. Returns the created conversation id.
 *
 * The saved recording is updated with its status at every stage so failures
 * (transcription_failed / analysis_failed) can be retried later without
 * re-recording or re-pasting the transcript.
 */
export async function runRecordPipeline(
  recordingId: string
): Promise<string> {
  const store = useRecordingStore.getState();
  const recording = store.getRecording(recordingId);

  if (!recording) {
    throw new Error('Saved recording not found.');
  }

  let transcriptText = recording.transcript;

  if (!transcriptText) {
    store.updateRecording(recordingId, {
      status: 'transcribing',
      error: undefined,
    });

    let transcriptionResult: TranscriptionResult;
    try {
      transcriptionResult = await transcribeAudio(recording.filePath, {
        speakerDiarization: recording.recordingType === 'phone_call',
      });
    } catch (error) {
      store.updateRecording(recordingId, {
        status: 'transcription_failed',
        error: userMessageForError(error),
      });
      throw error;
    }

    transcriptText = transcriptionResult.transcript;
    store.updateRecording(recordingId, {
      status: 'transcribed',
      transcript: transcriptText,
      transcriptId: transcriptionResult.providerId,
      _transcript: buildTranscript(generateId('conv'), transcriptionResult),
      error: undefined,
    });
  }

  const updated = useRecordingStore.getState().getRecording(recordingId);
  if (!updated) {
    throw new Error('Saved recording not found.');
  }

  store.updateRecording(recordingId, {
    status: 'analyzing',
    error: undefined,
  });

  let analysis: ConversationAnalysis;
  try {
    const result = await analyzeTranscript({
      transcript: transcriptText,
      conversationId: updated._transcript?.conversationId,
    });
    analysis = result.analysis;
  } catch (error) {
    // Analysis failed - use deterministic fallback instead of failing
    console.warn('AI analysis failed, using fallback:', error);
    analysis = buildFallbackAnalysis(transcriptText, updated._transcript?.conversationId || `conv_${Date.now()}`);
  }

  let transcript = updated._transcript;
  if (!transcript) {
    transcript = buildTranscript(analysis.conversationId, {
      transcript: transcriptText,
      language: analysis.language,
      confidence: analysis.confidence,
      segments: [],
      provider: 'recordioai',
      providerId: updated.transcriptId || '',
    });
  }
  transcript.conversationId = analysis.conversationId;

  const conversation = buildConversation({
    recording: updated,
    transcript,
    analysis,
  });

  // Every completed conversation gets a tamper-evident receipt, so the Receipts
  // tab, the conversation Receipt tab and the Evidence tab all have real data.
  conversation.receipt = await buildConversationReceipt(conversation);

  useAppStore.getState().addConversation(conversation);

  // High-severity discrepancies are escalated into disputes automatically, so
  // the Resolve Centre reflects problems that were actually detected.
  const autoDisputes = autoDisputesFor(conversation);
  if (autoDisputes.length > 0) {
    useAppStore.getState().addDisputes(autoDisputes);
  }

  store.updateRecording(recordingId, {
    status: 'completed',
    analysisId: analysis.id,
    error: undefined,
  });

  return conversation.id;
}

/**
 * Creates a saved recording entry from a captured audio file and runs the
 * full pipeline (transcription + analysis).
 */
export async function createRecordingAndProcess(params: {
  filePath: string;
  fileName: string;
  duration: number;
  recordingType: 'conversation' | 'phone_call';
}): Promise<string> {
  const recordingId = useRecordingStore
    .getState()
    .addRecording({
      filePath: params.filePath,
      fileName: params.fileName,
      duration: params.duration,
      recordingType: params.recordingType,
      status: 'recorded',
    });

  await runRecordPipeline(recordingId);
  return recordingId;
}

/**
 * Stores a pasted transcript inline (no audio file) and runs analysis.
 * On failure the transcript text is kept so it can be retried without
 * pasting again. The recording id is always returned so the UI can offer
 * a retry that reuses the saved text.
 */
export async function createPastedTranscriptRecord(params: {
  transcript: string;
}): Promise<{ recordingId: string; conversationId?: string; error?: string }> {
  const text = params.transcript.trim();
  if (!text) {
    throw new TranscriptionError(
      'Transcript is empty. Paste the conversation text to analyze it.',
      TranscriptionErrorCode.EMPTY_TRANSCRIPT
    );
  }

  const store = useRecordingStore.getState();

  const now = new Date().toISOString();
  const pendingTranscript: Transcript = {
    id: generateId('tr'),
    conversationId: generateId('conv'),
    segments: [
      {
        id: generateId('seg'),
        speaker: 'UNKNOWN',
        speakerConfidence: 0,
        text,
        startTime: 0,
        endTime: 0,
        confidence: 0.9,
      },
    ],
    fullText: text,
    language: 'en',
    confidence: 0.9,
    status: 'completed',
    provider: 'paste',
    providerId: '',
    createdAt: now,
    updatedAt: now,
  };

  const recordingId = store.addRecording({
    filePath: '',
    fileName: `pasted_${generateId('tx').replace(/_/g, '')}.txt`,
    duration: 0,
    recordingType: 'conversation',
    status: 'transcribed',
    transcript: text,
    _transcript: pendingTranscript,
  });

  try {
    const conversationId = await runRecordPipeline(recordingId);
    return { recordingId, conversationId };
  } catch (error) {
    return { recordingId, error: userMessageForError(error) };
  }
}

/**
 * Retries a failed pipeline run. Re-uses the saved audio file when the
 * transcription step failed, and re-uses the saved transcript when only
 * the analysis step failed.
 */
export async function retryRecordPipeline(recordingId: string): Promise<string> {
  useRecordingStore.getState().incrementRetryCount(recordingId);
  return runRecordPipeline(recordingId);
}

export { buildTranscript };