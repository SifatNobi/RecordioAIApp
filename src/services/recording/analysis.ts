import { API_BASE_URL } from '@/constants/env';
import { ApiError } from '@/services/api';
import { authedFetch, MobileAuthError } from '@/services/auth/deviceAuth';
import {
  classifyTransportError,
  describeTransportFailure,
} from '@/services/networkError';
import { ConversationAnalysis } from '@/types';

export enum AnalysisErrorCode {
  NETWORK_UNAVAILABLE = 'NETWORK_UNAVAILABLE',
  REQUEST_TIMEOUT = 'REQUEST_TIMEOUT',
  HTTP_400 = 'HTTP_400',
  HTTP_401 = 'HTTP_401',
  HTTP_403 = 'HTTP_403',
  HTTP_429 = 'HTTP_429',
  HTTP_500 = 'HTTP_500',
  MALFORMED_RESPONSE = 'MALFORMED_RESPONSE',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  EMPTY_TRANSCRIPT = 'EMPTY_TRANSCRIPT',
  ANALYSIS_PROVIDER_ERROR = 'ANALYSIS_PROVIDER_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export class AnalysisError extends Error {
  constructor(
    message: string,
    public code: AnalysisErrorCode,
    public status?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AnalysisError';
  }
}

export interface AnalysisRequest {
  transcript: string;
  language?: string;
  conversationId?: string;
  metadata?: Record<string, unknown>;
}

export interface AnalysisResult {
  analysis: ConversationAnalysis;
  provider: string;
  modelVersion: string;
}

const ANALYSIS_TIMEOUT = 180000;

const RETRY_ACTION = 'Please try again.';

function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'AbortError' || error.name === 'TimeoutError')
  );
}

function classifyError(error: unknown): AnalysisError {
  if (isAbortError(error)) {
    return new AnalysisError(
      'Analysis request timed out. Please try again.',
      AnalysisErrorCode.REQUEST_TIMEOUT
    );
  }

  if (error instanceof ApiError) {
    switch (error.status) {
      case 400:
        return new AnalysisError(
          'Invalid request. The transcript may be too long or malformed.',
          AnalysisErrorCode.HTTP_400,
          error.status,
          error.details
        );
      case 401:
        return new AnalysisError(
          'Authentication failed. Please check your credentials.',
          AnalysisErrorCode.HTTP_401,
          error.status,
          error.details
        );
      case 403:
        return new AnalysisError(
          'Access denied. You may not have permission to use AI analysis.',
          AnalysisErrorCode.HTTP_403,
          error.status,
          error.details
        );
      case 429:
        return new AnalysisError(
          'Too many requests. Please wait a moment and try again.',
          AnalysisErrorCode.HTTP_429,
          error.status,
          error.details
        );
      case 500:
        return new AnalysisError(
          'AI analysis service temporarily unavailable. Please try again later.',
          AnalysisErrorCode.HTTP_500,
          error.status,
          error.details
        );
      default:
        return new AnalysisError(
          `Analysis failed (error ${error.status}). ${RETRY_ACTION}`,
          AnalysisErrorCode.UNKNOWN_ERROR,
          error.status,
          error.details
        );
    }
  }

  if (error instanceof MobileAuthError) {
    return new AnalysisError(
      error.message,
      AnalysisErrorCode.AUTHENTICATION_ERROR
    );
  }

  if (error instanceof AnalysisError) {
    return error;
  }

  // Map transport failures through the shared classifier so raw Java/OkHttp
  // messages (e.g. "fetch failed: java.net.UnknownHostException: ...") are
  // never rendered to the user.
  if (error instanceof Error || error instanceof TypeError) {
    const failure = classifyTransportError(error);
    return new AnalysisError(
      describeTransportFailure(failure, RETRY_ACTION),
      failure.kind === 'aborted' || failure.kind === 'timeout'
        ? AnalysisErrorCode.REQUEST_TIMEOUT
        : AnalysisErrorCode.NETWORK_UNAVAILABLE,
      undefined,
      { transport: failure.kind }
    );
  }

  return new AnalysisError(
    'An unknown error occurred during AI analysis.',
    AnalysisErrorCode.UNKNOWN_ERROR
  );
}

export async function analyzeTranscript(request: AnalysisRequest): Promise<AnalysisResult> {
  if (!request.transcript || request.transcript.trim() === '') {
    throw new AnalysisError(
      'Transcript is empty. Cannot analyze empty transcript.',
      AnalysisErrorCode.EMPTY_TRANSCRIPT
    );
  }

  if (request.transcript.length > 500000) {
    throw new AnalysisError(
      'Transcript too long. Maximum 500,000 characters allowed.',
      AnalysisErrorCode.HTTP_400
    );
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ANALYSIS_TIMEOUT);

  try {
    const response = await authedFetch(`${API_BASE_URL}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        transcript: request.transcript,
        language: request.language || 'en',
        conversationId: request.conversationId,
        metadata: request.metadata,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorData: { message?: string; code?: string; details?: unknown } = {};
      try {
        errorData = await response.json();
      } catch {
      }
      throw new ApiError(
        errorData.message || `Analysis failed with status ${response.status}`,
        response.status,
        errorData.code,
        errorData.details
      );
    }

    let data: Record<string, unknown>;
    try {
      data = (await response.json()) as Record<string, unknown>;
    } catch {
      throw new AnalysisError(
        'The analysis service returned a response that could not be read. Please try again.',
        AnalysisErrorCode.MALFORMED_RESPONSE,
        response.status
      );
    }

    if (!data || typeof data !== 'object' || !data.analysis) {
      throw new AnalysisError(
        'The analysis service returned an unexpected response. Please try again.',
        AnalysisErrorCode.MALFORMED_RESPONSE,
        response.status
      );
    }

    const raw = data.analysis as Partial<ConversationAnalysis> & Record<string, unknown>;
    const modelVersion =
      typeof data.modelVersion === 'string' ? data.modelVersion : 'unknown';
    const provider =
      typeof data.provider === 'string' ? data.provider : 'recordioai';

    const analysis: ConversationAnalysis = {
      id: raw.id || `analysis_${Date.now()}`,
      conversationId: request.conversationId || `conv_${Date.now()}`,
      products: raw.products || [],
      prices: raw.prices || [],
      fees: raw.fees || [],
      commitments: raw.commitments || [],
      discrepancies: raw.discrepancies || [],
      summary: raw.summary || '',
      keyPoints: raw.keyPoints || [],
      sentiment: raw.sentiment || {
        overall: 'neutral',
        customer: 'neutral',
        agent: 'neutral',
        score: 0,
      },
      language: raw.language || request.language || 'en',
      confidence: raw.confidence ?? 0.85,
      modelVersion,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return {
      analysis,
      provider,
      modelVersion,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof ApiError || error instanceof AnalysisError) {
      throw error;
    }
    throw classifyError(error);
  }
}

export async function retryAnalysis(request: AnalysisRequest): Promise<AnalysisResult> {
  return analyzeTranscript(request);
}