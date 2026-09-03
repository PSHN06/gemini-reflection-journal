import { ChatMessage, ReflectionMode, TelemetryMetrics } from '../types';
import { auth } from '../firebase';

export class GeminiApiError extends Error {
  errorCode: string;
  resolution?: string;
  rawDetails?: string;

  constructor(message: string, errorCode: string = 'GENERIC_ERROR', resolution?: string, rawDetails?: string) {
    super(message);
    this.name = 'GeminiApiError';
    this.errorCode = errorCode;
    this.resolution = resolution;
    this.rawDetails = rawDetails;
  }
}

export interface GenerateReflectionResponse {
  success: boolean;
  text: string;
  telemetry?: TelemetryMetrics;
  modelUsed: string;
  timestamp: string;
}

export interface GenerateSummaryResponse {
  success: boolean;
  summary: string;
  modelUsed: string;
}

/**
 * Retrieves valid Bearer authorization headers with fresh Firebase ID token.
 */
async function getAuthHeaders(): Promise<Record<string, string>> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new GeminiApiError(
      'Authentication required. Please sign in to access reflection services.',
      'UNAUTHORIZED',
      'Sign in with your Google account in the top navigation bar to use the AI companion.'
    );
  }
  const token = await currentUser.getIdToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

/**
 * Sends a multi-turn journal prompt to the server-side Gemini fallback ladder.
 */
export async function generateReflectionResponse(
  prompt: string,
  conversationHistory: ChatMessage[],
  mode: ReflectionMode = 'reflection',
  userContext?: string
): Promise<GenerateReflectionResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch('/api/gemini/reflect', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      prompt,
      conversationHistory: conversationHistory.map((m) => ({
        role: m.role,
        text: m.text,
      })),
      mode,
      userContext,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new GeminiApiError(
      data.error || 'Failed to communicate with Gemini API',
      data.errorCode || data.code || 'UNKNOWN_ERROR',
      data.resolution,
      data.details
    );
  }

  return data;
}

/**
 * Summarizes the entire journal entry and extracts actionable insights.
 */
export async function generateEntrySummary(
  content: string,
  title: string
): Promise<GenerateSummaryResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch('/api/gemini/summarize', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      content,
      title,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new GeminiApiError(
      data.error || 'Failed to summarize journal entry',
      data.errorCode || data.code || 'UNKNOWN_ERROR',
      data.resolution,
      data.details
    );
  }

  return data;
}

/**
 * Extracts cognitive telemetry metrics from journal text using the telemetry engine prompt.
 */
export async function extractTelemetry(content: string): Promise<TelemetryMetrics> {
  const headers = await getAuthHeaders();
  const response = await fetch('/api/gemini/telemetry', {
    method: 'POST',
    headers,
    body: JSON.stringify({ content }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new GeminiApiError(
      data.error || 'Failed to extract telemetry metrics',
      data.errorCode || data.code || 'TELEMETRY_ERROR',
      data.resolution,
      data.details
    );
  }

  return data.telemetry;
}
