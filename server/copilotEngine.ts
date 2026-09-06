/**
 * AI Copilot Core Engine
 * 
 * Provides system instructions, context formatting, privacy filtering,
 * and high-signal local deterministic fallback responses for both
 * Journal Companion and App Guide modes.
 */

export interface CopilotEntryContext {
  id?: string;
  title?: string;
  content?: string;
  mood?: string;
  tags?: string[];
  attachments?: Array<{
    id: string;
    fileName: string;
    fileType: string;
    status: string;
    extractedText?: string;
  }>;
}

export interface CopilotChatPayload {
  prompt: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; text: string }>;
  mode?: 'companion' | 'guide';
  currentView?: 'journal' | 'landscape' | 'tapes';
  entryContext?: CopilotEntryContext;
}

/**
 * App Guide Knowledge Base
 * Authoritative facts about Gemini Reflection Journal features.
 */
export const APP_GUIDE_KNOWLEDGE = {
  temporalTapes: `Temporal Tapes are time-locked reflections sealed behind objective psychological or behavioral conditions. 
Instead of opening on a fixed date, a Temporal Tape requires sustained emotional stability or cognitive focus—such as maintaining a stress index ≤ 4 across 7 consecutive days with at least 4 recorded observations in your authoritative telemetry ledger. 
Once your daily journaling satisfies the condition, the system automatically evaluates and unlocks the tape, revealing your sealed prose. While sealed, the prose is strictly locked and cannot be viewed.`,

  emotionalLandscape: `The Emotional Landscape is a 3D spatial neural universe that visually maps your reflections as living celestial clusters.
- Central Node: Anchored around your primary reflection or current theme.
- Orbital Strands: Nodes represent specific emotions, realizations, and verbatim quotes from your writing.
- Distance & Geometry: Spatial distances reflect emotional tension or thematic proximity.
- Time Scopes: You can toggle between Daily (immediate session), Weekly (7-day pattern), and Monthly (broader seasonal rhythm) perspectives.`,

  journalTitles: `Journal titles are generated automatically by AI based on the core subject, emotional realization, or breakthrough in your entry.
- Triggers after typing meaningful content (at least 3 words and 15 characters).
- Formats titles in 3–8 natural, human-curated words in Title Case.
- Preserves Control: If you manually edit a title, it is marked as a custom title (isCustomTitle) and will never be overwritten automatically. You can also explicitly click the regenerate button anytime.`,

  privacyAndStorage: `Your journal reflections and telemetry are stored securely in Google Cloud Firestore under your private authenticated user account (/users/{userId}/...).
- Private & Scoped: Only your authenticated account has permission to read or write your entries and attachments.
- Sealed Content Protection: Sealed Temporal Tapes protect your sealed prose on the server so that it is never returned to the browser while locked.
- Zero Ad Tracking: Your reflections are solely used to provide personalized AI reflections and visual telemetry.`,

  attachments: `You can attach up to 5 files per journal entry (up to 5 MB each).
- Supported formats: PDF, DOCX, TXT, Markdown, and Images (PNG, JPG, WEBP).
- Text from documents is safely extracted and made available to your journal companion for summaries, questions, or contextual writing.
- Images provide preview thumbnails without cluttering your writing canvas.`,

  emojis: `You can insert emojis directly from the compact emoji toolbar button (or using your keyboard).
- Emojis insert smoothly at your exact cursor position without interrupting your writing flow.
- Emojis are saved in drafts, searchable in the sidebar, and analyzed by the reflection engine for emotional context without unwarranted assumptions.`,

  deletingEntries: `To delete an entry, click on the entry in the sidebar or editor and use the delete action. You will receive a calm confirmation prompt to prevent accidental loss.`,
};

/**
 * Constructs the rigorous, empathetic system instruction for Gemini
 */
export function buildCopilotSystemInstruction(
  mode: 'companion' | 'guide',
  currentView: 'journal' | 'landscape' | 'tapes',
  entryContext?: CopilotEntryContext
): string {
  let instruction = `You are the AI Copilot inside Reflection, a private journaling application. You are a warm, intelligent writing companion and application guide.
Respond directly to the user's actual message. Never repeat a generic introduction when the user has already started a conversation.
Help with journaling, reflection, current-entry understanding, Emotional Landscape, Temporal Tapes, attachments, emojis, navigation, and app functionality.
Do not diagnose mental-health conditions. Do not invent app features.
If the question is ambiguous, ask one concise clarifying question (for example, if the user says "I have a doubt", ask "What would you like to clarify?").
Keep responses natural, useful, and conversational.

Authoritative Application Knowledge:
1. Temporal Tapes:
${APP_GUIDE_KNOWLEDGE.temporalTapes}

2. Emotional Landscape:
${APP_GUIDE_KNOWLEDGE.emotionalLandscape}

3. Automatic Journal Titles:
${APP_GUIDE_KNOWLEDGE.journalTitles}

4. Privacy, Security & Cloud Storage:
${APP_GUIDE_KNOWLEDGE.privacyAndStorage}

5. Journal Attachments:
${APP_GUIDE_KNOWLEDGE.attachments}

6. Emoji Support:
${APP_GUIDE_KNOWLEDGE.emojis}

Conversation Guidelines:
- If the user asks what to write about or for a prompt, provide a thoughtful, varied writing prompt based on their current context or an intriguing reflective perspective.
- If the user asks a brief or clarifying question (such as "I have a doubt" or "Will you clarify my doubt?"), ask warmly: "What would you like to clarify? I'm here to help with your writing or any questions about the app."
- If the user asks about the Emotional Landscape nodes (for example, "Why are there five emotions in my landscape?"), explain using the actual spatial neural universe design: the central node anchors the primary theme or current reflection, and orbital nodes represent specific emotions, realizations, and verbatim quotes extracted from their writing.
- If the user asks to summarize, find the main theme, or continue their writing, reference their active journal text directly if provided below. If no text exists yet in their draft, gently invite them to share a few thoughts first.
- Keep answers concise and high-signal (typically 1–3 conversational paragraphs). Never speak with clinical certainty or overvalidate.`;

  if (entryContext && (entryContext.content || entryContext.title)) {
    instruction += `\n\nActive Journal Context (Private to this authenticated user):`;
    if (entryContext.title) {
      instruction += `\nTitle: ${entryContext.title}`;
    }
    if (entryContext.mood) {
      instruction += `\nSelected Mood: ${entryContext.mood}`;
    }
    if (entryContext.tags && entryContext.tags.length > 0) {
      instruction += `\nTags: ${entryContext.tags.join(', ')}`;
    }
    if (entryContext.content) {
      instruction += `\nCurrent Draft Content:\n"""\n${entryContext.content.slice(0, 4000)}\n"""`;
    }
    if (entryContext.attachments && entryContext.attachments.length > 0) {
      const attachmentsSummary = entryContext.attachments
        .map((a) => `- ${a.fileName} (${a.fileType}, status: ${a.status})${a.extractedText ? `:\n  Preview: "${a.extractedText.slice(0, 300)}..."` : ''}`)
        .join('\n');
      instruction += `\nAttachments Attached to this Entry:\n${attachmentsSummary}`;
    }
  } else {
    instruction += `\n\nActive Journal Context: (User is currently in an empty draft or in ${currentView} view).`;
  }

  return instruction;
}

/**
 * Deterministic local fallback generator when Gemini is unreachable.
 * Accurately addresses both App Guide questions and Journal Companion writing requests.
 */
export function generateLocalCopilotFallback(
  prompt: string,
  entryContext?: CopilotEntryContext,
  currentView: 'journal' | 'landscape' | 'tapes' = 'journal'
): string {
  const p = prompt.trim().toLowerCase();

  // --- Doubts and clarifications ---
  if (p.includes('doubt') || p.includes('clarify') || p === 'i have a doubt' || p === 'i have a question') {
    return `What would you like to clarify? I'm here to help with your writing or any questions about the app.`;
  }

  // --- App Guide Checks ---
  if (p.includes('temporal tape') || p.includes('tape') || p.includes('seal') || p.includes('unlock')) {
    return `**About Temporal Tapes:**\n\n${APP_GUIDE_KNOWLEDGE.temporalTapes}\n\n*Tip: Check the Temporal Tapes tab in the sidebar to review your current condition streaks and observation counts.*`;
  }

  if (p.includes('emotional landscape') || p.includes('landscape') || p.includes('3d') || p.includes('node') || p.includes('star') || p.includes('neural') || p.includes('emotion')) {
    return `**About the Emotional Landscape:**\n\n${APP_GUIDE_KNOWLEDGE.emotionalLandscape}\n\n*Tip: In your landscape, nodes represent specific emotions, key themes, and verbatim quotes extracted from your reflections. The central node anchors your main theme, and the orbital strands radiate outward based on emotional tension and thematic proximity.*`;
  }

  if (p.includes('title') && (p.includes('generate') || p.includes('how are') || p.includes('automatic') || p.includes('work'))) {
    return `**About Automatic Title Generation:**\n\n${APP_GUIDE_KNOWLEDGE.journalTitles}`;
  }

  if (p.includes('privacy') || p.includes('security') || p.includes('stored') || p.includes('database') || p.includes('my data')) {
    return `**Your Privacy & Data Protection:**\n\n${APP_GUIDE_KNOWLEDGE.privacyAndStorage}`;
  }

  if (p.includes('attachment') || p.includes('upload') || p.includes('file') || p.includes('pdf') || p.includes('docx')) {
    return `**About Journal Attachments:**\n\n${APP_GUIDE_KNOWLEDGE.attachments}`;
  }

  if (p.includes('emoji') || p.includes('emoticon') || p.includes('picker')) {
    return `**About Emoji Support:**\n\n${APP_GUIDE_KNOWLEDGE.emojis}`;
  }

  if (p.includes('delete') || p.includes('remove entry')) {
    return `**Deleting Journal Entries:**\n\n${APP_GUIDE_KNOWLEDGE.deletingEntries}`;
  }

  if (p.includes('explain this app') || p.includes('how does this work') || p.includes('what is this app') || p.includes('app guide')) {
    return `**Welcome to Gemini Reflection Journal:**\n\nThis application is an intimate, intelligent journaling environment built to help you reflect with clarity:\n\n- **Reflective Journaling:** Write freely with automatic semantic title generation, multi-turn AI reflections, and safe file/emoji attachments.\n- **3D Emotional Landscape:** Explore your emotional patterns and themes visualized as an Apple-quality spatial universe across daily, weekly, and monthly time spans.\n- **Temporal Tapes:** Seal private letters to your future self that only unlock when you sustain objective emotional focus or reduced stress over time.\n\nHow can I help you with your current writing or questions today?`;
  }

  // --- Prompts & Ideas ---
  if (p.includes('funny') || p.includes('humor') || p.includes('joke')) {
    return `Here is a lighthearted reflection prompt: *If your day had an absurd movie tagline, a dramatic narrator voiceover, or a completely honest product warning label, what would it say and why?*`;
  }

  if (p.includes('what shall i write') || p.includes('what to write') || p.includes('give me a prompt') || p.includes('writing prompt') || p.includes('prompt')) {
    return `Gemini is temporarily unavailable. I can still help you with a simple reflection prompt: What is one moment from today that stayed with you, or what is a feeling you've been carrying that you'd like to put into words?`;
  }

  // --- Journal Companion Checks ---
  const content = entryContext?.content?.trim() || '';

  if (p.includes('summarize') || p.includes('summary')) {
    if (!content) {
      return `There isn't any text in your journal entry yet. Once you begin writing your thoughts, ask me again and I will provide a gentle, high-level summary of your main themes.`;
    }
    const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 10);
    const excerpt = sentences.slice(0, 3).map((s) => s.trim()).join('. ');
    return `Based on what you've shared so far, your reflection centers on:\n\n> "${excerpt}."\n\nIt sounds like you are processing both the immediate events and the emotional resonance beneath them. Would you say this captures the core of what you're working through today?`;
  }

  if (p.includes('main theme') || p.includes('theme')) {
    if (!content) {
      return `To find the main theme, write a few sentences about what has been on your mind today, and I'll help identify the underlying threads.`;
    }
    return `A recurring theme in your entry appears to be finding balance between external demands and your internal state of mind. You seem to be navigating a transition or seeking clarity about what matters most right now. Does that resonate with how you feel?`;
  }

  if (p.includes('continue') || p.includes('help me continue')) {
    if (!content) {
      return `A gentle place to start writing is simply describing: *What moment from today had the strongest emotional footprint for you, even if it seemed minor at the time?*`;
    }
    return `To continue this train of thought, you might explore:\n\n- What was the turning point in this situation?\n- How did your physical body or mood shift as this was happening?\n- If you were looking back on this moment a week from now, what would you hope to remember about how you handled it?`;
  }

  if (p.includes('suggest a title') || p.includes('title idea')) {
    if (!content) {
      return `Once you write a couple of sentences, I can suggest titles. Some classic reflective starting titles are: *"Finding My Rhythm Again"*, *"An Evening of Stillness"*, or *"Uncertainty About the Path Forward"*.`;
    }
    const words = content.split(/\s+/).slice(0, 5).join(' ');
    return `Here are a few title ideas that capture the essence of your reflection:\n\n1. *Reflections on ${words}*\n2. *Finding Clarity in the Transition*\n3. *The Breakthrough Beneath the Surface*\n\nYou can click on the title in the editor to apply whichever feels most genuine to you.`;
  }

  if (p.includes('question') || p.includes('reflection question')) {
    return `Here is a gentle question to consider:\n\n*What is one assumption you are making about this situation that, if you gently set it aside, might give you more peace?*`;
  }

  if (p.includes('rephrase') || p.includes('clearer')) {
    if (!content) {
      return `Paste the sentence you'd like to rephrase into the chat, and I'll offer a few natural ways to express it while preserving your voice.`;
    }
    return `When refining reflective writing, try focusing on concrete nouns and stated feelings rather than general descriptions. What specific sentence from your draft would you like to explore rephrasing?`;
  }

  // Generic companion response with content
  if (content) {
    return `It sounds like you are navigating some meaningful thoughts in this entry. You're writing with honesty, which creates the space needed for genuine clarity.\n\nWould you like me to help you continue this thought, explore a reflection question, or summarize what you've articulated so far?`;
  }

  // Default resilient fallback when Gemini is unreachable
  return `Gemini is temporarily unavailable. I'm currently in offline guide mode.\n\nI can still help you explore reflection prompts, explain application features (like Temporal Tapes or the Emotional Landscape), or help you organize your current draft. What would you like to focus on?`;
}
