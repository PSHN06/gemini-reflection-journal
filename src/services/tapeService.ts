import { auth } from '../firebase';
import { TemporalTape, TapeUnlockCondition, EvaluateTapeResponse } from '../types';

export class TapeApiError extends Error {
  errorCode: string;
  constructor(message: string, errorCode: string = 'GENERIC_ERROR') {
    super(message);
    this.name = 'TapeApiError';
    this.errorCode = errorCode;
  }
}

/**
 * Retrieves valid Bearer authorization headers with fresh Firebase ID token.
 */
async function getAuthHeaders(): Promise<Record<string, string>> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new TapeApiError(
      'Authentication required. Please sign in to access Temporal Tapes.',
      'UNAUTHORIZED'
    );
  }
  const token = await currentUser.getIdToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

export interface SealTapePayload {
  title: string;
  sealedProse: string;
  recipientNote?: string;
  condition: TapeUnlockCondition;
}

/**
 * Seals a new Temporal Tape via the authenticated backend.
 */
export async function sealTemporalTape(payload: SealTapePayload): Promise<TemporalTape> {
  const headers = await getAuthHeaders();
  const response = await fetch('/api/tapes/seal', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new TapeApiError(
      errorData.error || `Failed to seal tape (HTTP ${response.status})`,
      errorData.code || 'SEAL_ERROR'
    );
  }

  const data = await response.json();
  return data.tape;
}

/**
 * Fetches all Temporal Tapes for the current authenticated user.
 */
export async function fetchUserTapes(): Promise<TemporalTape[]> {
  const headers = await getAuthHeaders();
  const response = await fetch('/api/tapes', {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new TapeApiError(
      errorData.error || `Failed to load tapes (HTTP ${response.status})`,
      errorData.code || 'FETCH_ERROR'
    );
  }

  const data = await response.json();
  return data.tapes || [];
}

/**
 * Fetches a single Temporal Tape by ID.
 */
export async function fetchTapeById(tapeId: string): Promise<TemporalTape> {
  const headers = await getAuthHeaders();
  const response = await fetch(`/api/tapes/${encodeURIComponent(tapeId)}`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new TapeApiError(
      errorData.error || `Failed to fetch tape (HTTP ${response.status})`,
      errorData.code || 'FETCH_ONE_ERROR'
    );
  }

  const data = await response.json();
  return data.tape;
}

/**
 * Manually evaluates a tape's unlock condition against the telemetry ledger.
 */
export async function evaluateTapeUnlock(tapeId: string): Promise<EvaluateTapeResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch(`/api/tapes/${encodeURIComponent(tapeId)}/evaluate`, {
    method: 'POST',
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new TapeApiError(
      errorData.error || `Failed to evaluate tape (HTTP ${response.status})`,
      errorData.code || 'EVALUATE_ERROR'
    );
  }

  const data = await response.json();
  return data;
}
