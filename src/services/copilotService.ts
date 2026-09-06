import { auth } from '../firebase';
import { CopilotEntryContext } from '../../server/copilotEngine';
import { generateLocalCopilotFallback } from '../../server/copilotEngine';

export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  mode?: 'companion' | 'guide';
  modelUsed?: string;
  isFallback?: boolean;
}

export interface SendCopilotMessageOptions {
  prompt: string;
  history: CopilotMessage[];
  mode?: 'companion' | 'guide';
  currentView?: 'journal' | 'landscape' | 'tapes';
  entryContext?: CopilotEntryContext;
  signal?: AbortSignal;
}

export interface CopilotResponse {
  success: boolean;
  content: string;
  reply?: string;
  mode: 'companion' | 'guide';
  modelUsed: string;
  isFallback: boolean;
}

/**
 * Sends a message to the backend Copilot API with token authorization and fallback resilience.
 */
export async function sendCopilotMessage(
  options: SendCopilotMessageOptions
): Promise<CopilotResponse> {
  const { prompt, history, mode = 'companion', currentView = 'journal', entryContext, signal } = options;

  let idToken = '';
  try {
    const currentUser = auth.currentUser;
    if (currentUser) {
      idToken = await currentUser.getIdToken();
    } else {
      let guestId = '';
      try {
        guestId = localStorage.getItem('reflection_guest_session_id') || '';
        if (!guestId) {
          guestId = 'guest_' + Math.random().toString(36).substring(2, 12);
          localStorage.setItem('reflection_guest_session_id', guestId);
        }
      } catch {
        guestId = 'guest_preview_user';
      }
      idToken = `preview_guest_${guestId}`;
    }
  } catch (err) {
    console.warn('[Copilot Service] Auth token note:', err);
    idToken = 'preview_guest_fallback';
  }

  // Format conversation history
  const formattedHistory = history.map((msg) => ({
    role: msg.role === 'assistant' ? 'assistant' as const : 'user' as const,
    text: msg.content,
  }));

  try {
    const res = await fetch('/api/copilot/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        message: prompt,
        prompt,
        entryId: entryContext?.id,
        entryContent: entryContext?.content,
        entryTitle: entryContext?.title,
        conversationHistory: formattedHistory,
        mode,
        currentView,
        entryContext,
      }),
      signal,
    });

    if (res.ok) {
      const data = await res.json();
      const reply = data.reply || data.content || data.text || '';
      return {
        success: true,
        content: reply,
        reply,
        mode: data.mode || mode,
        modelUsed: data.modelUsed || 'gemini-3.8-flash',
        isFallback: Boolean(data.usedFallback || data.isFallback),
      };
    } else {
      const errorJson = await res.json().catch(() => ({}));
      console.warn(`[Copilot Service] Backend returned status ${res.status}:`, errorJson?.error || 'Unknown error');
      const fallbackText = generateLocalCopilotFallback(prompt, entryContext, currentView);
      return {
        success: true,
        content: fallbackText,
        reply: fallbackText,
        mode,
        modelUsed: 'Local Copilot Guide Engine (Offline Resilient)',
        isFallback: true,
      };
    }
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw error;
    }
    console.warn('[Copilot Service] Network or fetch failure. Using local fallback engine:', error?.message);
    const fallbackText = generateLocalCopilotFallback(prompt, entryContext, currentView);
    return {
      success: true,
      content: fallbackText,
      reply: fallbackText,
      mode,
      modelUsed: 'Local Copilot Guide Engine (Offline Resilient)',
      isFallback: true,
    };
  }
}
