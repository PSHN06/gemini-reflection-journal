import React, { useState, useRef, useEffect } from 'react';
import { JournalEntry, ChatMessage, ReflectionMode, JournalAttachment } from '../types';
import Markdown from 'react-markdown';
import { 
  Sparkles, 
  Send, 
  RefreshCw, 
  Copy, 
  Download, 
  Trash2,
  Calendar,
  Wand2,
  Tag,
  Smile,
  Compass,
  Paperclip,
  FileText,
  Image as ImageIcon,
  FileCode,
  X,
  AlertCircle,
  BookOpen
} from 'lucide-react';
import { 
  generateReflectionResponse, 
  generateEntrySummary, 
  extractTelemetry, 
  generateEntryTitle,
  GeminiApiError 
} from '../services/geminiService';
import { logUserInteraction, updateJournalEntryFields } from '../services/journalService';
import { db } from '../firebase';
import { doc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { 
  formatJournalDateTime, 
  generateTitleFromContent, 
  isDefaultTitle,
  isMeaningfulContentForTitle,
} from '../utils/journalFormatters';
import { validateAttachmentFile, formatAttachmentSize } from '../utils/attachmentLimits';
import { processClientFileAttachment } from '../utils/fileAttachmentExtractor';
import { EmojiPicker } from './EmojiPicker';
import { DeleteConfirmModal } from './DeleteConfirmModal';

interface EntryEditorProps {
  entry: JournalEntry;
  userId: string;
  onSaveEntry: (updated: JournalEntry) => Promise<void>;
  onDeleteEntry?: (entryId: string) => Promise<void> | void;
  onOpenLandscape?: () => void;
  onOpenEntriesDrawer?: () => void;
  onOpenCopilot?: () => void;
  saveStatus: 'saved' | 'saving' | 'error';
  lastSaveError: string | null;
}

export interface AiErrorDetail {
  message: string;
  code?: string;
  resolution?: string;
  rawDetails?: string;
}

const REFLECTION_PROMPT_STARTERS = [
  { label: 'Unpack a Decision', prompt: 'I need to make an important decision regarding... Here are the trade-offs I am weighing:' },
  { label: 'Daily Win & Learning', prompt: 'Today went well because... One key lesson or insight I want to hold onto is:' },
  { label: 'Overcome a Roadblock', prompt: 'I am feeling stuck on... Here is what is blocking my momentum:' },
  { label: 'Gratitude & Perspective', prompt: 'Three specific moments or insights I am deeply grateful for today are:' },
];

export const EntryEditor: React.FC<EntryEditorProps> = ({
  entry,
  userId,
  onSaveEntry,
  onDeleteEntry,
  onOpenLandscape,
  onOpenEntriesDrawer,
  onOpenCopilot,
  saveStatus,
  lastSaveError,
}) => {
  const [title, setTitle] = useState(entry.title || '');
  const [isCustomTitle, setIsCustomTitle] = useState(Boolean(entry.isCustomTitle));
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);
  const [mode, setMode] = useState<ReflectionMode>(entry.mode || 'reflection');
  const [tagsInput, setTagsInput] = useState((entry.tags || []).join(', '));
  const [mood, setMood] = useState(entry.mood || '');
  const [messages, setMessages] = useState<ChatMessage[]>(entry.messages || []);
  const [draftContent, setDraftContent] = useState(entry.content || '');
  const [inputPrompt, setInputPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiError, setAiError] = useState<AiErrorDetail | null>(null);
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string>('');
  const [summary, setSummary] = useState(entry.summary || '');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [activeModel, setActiveModel] = useState<string>(entry.lastGeminiModel || 'gemini-3.5-flash');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Attachments and Emojis State
  const [attachments, setAttachments] = useState<JournalAttachment[]>(entry.attachments || []);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Cognitive Telemetry State
  const [telemetryData, setTelemetryData] = useState<{
    stressIndex: number;
    focusIndex: number;
    creativityIndex: number;
    dominantThemes: string[];
    confidence?: number;
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activeEntryIdRef = useRef(entry.id);
  const lastTitledContentRef = useRef<string>(entry.content || '');
  const titleGenerationTokenRef = useRef<number>(0);

  // Sync state when incoming entry changes
  useEffect(() => {
    activeEntryIdRef.current = entry.id;
    setTitle(entry.title || '');
    setIsCustomTitle(Boolean(entry.isCustomTitle));
    setIsGeneratingTitle(false);
    lastTitledContentRef.current = entry.content || '';
    titleGenerationTokenRef.current++;
    setMode(entry.mode || 'reflection');
    setTagsInput((entry.tags || []).join(', '));
    setMood(entry.mood || '');
    setMessages(entry.messages || []);
    setDraftContent(entry.content || '');
    setSummary(entry.summary || '');
    setActiveModel(entry.lastGeminiModel || 'gemini-3.5-flash');
    setAttachments(entry.attachments || []);
    setAttachmentError(null);
    setIsEmojiPickerOpen(false);
    setAiError(null);
    setLastFailedPrompt('');
  }, [entry.id]);

  // Real-time listener for Cognitive Telemetry subcollection
  useEffect(() => {
    if (!userId || !entry?.id) return;

    const unsubscribe = onSnapshot(doc(db, `users/${userId}/telemetry`, entry.id), (docSnap) => {
      if (docSnap.exists()) {
        setTelemetryData(docSnap.data() as any);
      } else {
        setTelemetryData(null);
      }
    });

    return () => unsubscribe();
  }, [userId, entry?.id]);

  // Auto scroll chat to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isGenerating]);

  // Persist current state changes
  const triggerSave = async (overrides: Partial<JournalEntry> = {}) => {
    const parsedTags = tagsInput
      .split(',')
      .map((t) => t.trim().replace(/^#/, ''))
      .filter(Boolean);

    const updated: JournalEntry = {
      ...entry,
      title: title.trim() || 'Untitled Reflection',
      isCustomTitle,
      content: draftContent,
      mode,
      tags: parsedTags,
      mood,
      messages,
      summary,
      lastGeminiModel: activeModel,
      attachments,
      ...overrides,
      updatedAt: Date.now(),
    };

    await onSaveEntry(updated);
  };

  // Automatic title generator logic with race-condition guards
  const triggerAutoTitleGeneration = async (
    sourceContent: string,
    isExplicitRegeneration = false
  ) => {
    const targetEntryId = entry.id;
    if (!isMeaningfulContentForTitle(sourceContent)) {
      return;
    }

    // User customized title manually and didn't explicitly request regeneration
    if (isCustomTitle && !isExplicitRegeneration) {
      return;
    }

    const currentToken = ++titleGenerationTokenRef.current;
    if (activeEntryIdRef.current === targetEntryId) {
      setIsGeneratingTitle(true);
    }

    try {
      const result = await generateEntryTitle(sourceContent, targetEntryId);

      const isCurrentToken = currentToken === titleGenerationTokenRef.current;
      const isStillCurrentEntry = activeEntryIdRef.current === targetEntryId;

      if (isCurrentToken && isStillCurrentEntry) {
        setTitle(result.title);
        setIsCustomTitle(false);
        setIsGeneratingTitle(false);
        lastTitledContentRef.current = sourceContent;

        await triggerSave({
          title: result.title,
          isCustomTitle: false,
          titleGeneratedAt: Date.now(),
        });
      } else {
        // Safe cross-entry handling: user switched entries while generating
        if (userId && targetEntryId) {
          await updateJournalEntryFields(userId, targetEntryId, {
            title: result.title,
            isCustomTitle: false,
            titleGeneratedAt: Date.now(),
            updatedAt: Date.now(),
          });
        }
      }
    } catch (err) {
      console.warn('[EntryEditor] Failed to generate title automatically:', err);
    } finally {
      if (activeEntryIdRef.current === targetEntryId) {
        setIsGeneratingTitle(false);
      }
    }
  };

  // Debounced automatic title generation when user drafts meaningful content
  useEffect(() => {
    if (isCustomTitle) return;

    const combinedContent = (
      draftContent.trim() ||
      messages.map((m) => m.text).join('\n\n').trim() ||
      inputPrompt.trim()
    );

    if (!isMeaningfulContentForTitle(combinedContent)) return;

    const currentIsDefault = isDefaultTitle(title);
    const contentExpandedSubstantially =
      lastTitledContentRef.current &&
      Math.abs(combinedContent.length - lastTitledContentRef.current.length) > 500;

    if (!currentIsDefault && !contentExpandedSubstantially) {
      return;
    }

    const timer = setTimeout(() => {
      triggerAutoTitleGeneration(combinedContent, false);
    }, 2000);

    return () => clearTimeout(timer);
  }, [draftContent, inputPrompt, messages, isCustomTitle, title]);

  // Title input event handlers
  const handleTitleChange = (newVal: string) => {
    setTitle(newVal);
    setIsCustomTitle(true);
  };

  const handleTitleBlur = () => {
    const cleaned = title.trim();
    if (!cleaned) {
      const fallback = 'Untitled Reflection';
      setTitle(fallback);
      setIsCustomTitle(false);
      triggerSave({ title: fallback, isCustomTitle: false });
    } else {
      triggerSave({ title: cleaned, isCustomTitle: true });
    }
  };

  const handleRegenerateTitle = () => {
    const combinedContent = (
      draftContent.trim() ||
      messages.map((m) => m.text).join('\n\n').trim() ||
      inputPrompt.trim()
    );
    if (!isMeaningfulContentForTitle(combinedContent)) return;
    triggerAutoTitleGeneration(combinedContent, true);
  };

  // Handle sending a reflection message to Gemini
  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = (customPrompt !== undefined ? customPrompt : inputPrompt).trim();
    if (!textToSend || isGenerating) return;

    setAiError(null);
    setLastFailedPrompt(textToSend);

    // If title is currently a default placeholder and not user-defined, trigger title generation
    if (isDefaultTitle(title) && !isCustomTitle && isMeaningfulContentForTitle(textToSend)) {
      triggerAutoTitleGeneration(textToSend, false);
    }

    // Check if this is a retry of the last message
    const isRetry = Boolean(
      customPrompt &&
      messages.length > 0 &&
      messages[messages.length - 1].role === 'user' &&
      messages[messages.length - 1].text === textToSend
    );

    let currentMessages = messages;
    if (!isRetry) {
      const userMessage: ChatMessage = {
        id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        role: 'user',
        text: textToSend,
        timestamp: Date.now(),
      };
      currentMessages = [...messages, userMessage];
      setMessages(currentMessages);
      setInputPrompt('');
      
      // Save user message immediately to Firestore with updated content
      await triggerSave({
        content: draftContent || textToSend,
        messages: currentMessages,
      });
    }

    setIsGenerating(true);

    try {
      const userContext = summary ? `Active reflection summary: ${summary}` : undefined;

      const response = await generateReflectionResponse(
        textToSend,
        currentMessages,
        mode,
        userContext,
        entry?.id
      );

      // Verify active entry hasn't changed during network request
      if (activeEntryIdRef.current !== entry.id) {
        return;
      }

      const aiMessage: ChatMessage = {
        id: 'msg-' + (Date.now() + 1) + '-' + Math.random().toString(36).substring(2, 6),
        role: 'model',
        text: response.text,
        timestamp: Date.now(),
      };

      const finalMessages = [...currentMessages, aiMessage];
      setMessages(finalMessages);
      setActiveModel(response.modelUsed);
      setLastFailedPrompt('');

      // Persist Telemetry payload to isolated subcollection if returned from server
      if (response.telemetry && userId && entry?.id) {
        const telemetryRef = doc(db, `users/${userId}/telemetry`, entry.id);
        await setDoc(
          telemetryRef,
          {
            ...response.telemetry,
            entryId: entry.id,
            createdAt: serverTimestamp(),
          },
          { merge: true }
        );
      }

      // Log interaction in Firestore subcollection
      await logUserInteraction(userId, {
        userId,
        entryId: entry.id,
        prompt: textToSend,
        response: response.text,
        model: response.modelUsed,
        mode,
        timestamp: Date.now(),
      });

      // Save complete thread to Firestore
      await triggerSave({
        content: draftContent || textToSend,
        messages: finalMessages,
        lastGeminiModel: response.modelUsed,
      });
    } catch (err: any) {
      if (activeEntryIdRef.current !== entry.id) return;
      console.error('Gemini Reflection error:', err);
      const isApiErr = err instanceof GeminiApiError;
      setAiError({
        message: err.message || 'Failed to generate response.',
        code: isApiErr ? err.errorCode : 'UNKNOWN_ERROR',
        resolution: isApiErr ? err.resolution : 'Please check your connection and configuration.',
        rawDetails: isApiErr ? err.rawDetails : String(err),
      });
    } finally {
      if (activeEntryIdRef.current === entry.id) {
        setIsGenerating(false);
        setTimeout(() => textareaRef.current?.focus(), 50);
      }
    }
  };

  // Cognitive coaching prompt generator
  const handleInsertGuidedReflection = async () => {
    setIsGenerating(true);
    setAiError(null);

    const guidanceTemplates: Record<ReflectionMode, string> = {
      reflection: `Here are three grounded lenses to explore what you wrote:

1. Emotional check: What feeling stood out most as you wrote this?
2. 12-month horizon: Looking back a year from now, which part of this situation will matter most?
3. Agency check: What is one small step strictly within your direct control today?`,

      brainstorm: `Here are three concrete angles to consider:

- The inversion angle: What would the opposite of your current approach look like?
- The micro-step: What is a 5-minute action that creates immediate forward momentum?
- The unconstrained view: If fear of making a mistake were not a factor, what would you choose?`,

      socratic: `To clarify your perspective:

1. What evidence most strongly supports your current view?
2. What trade-offs or alternatives might be easy to overlook right now?
3. What is the single most important question you need answered before moving forward?`,

      summary: `Cognitive synthesis:
- Core focus: Reflecting on current priorities and clearing mental clutter.
- Key observation: Identifying what matters and setting intentional next steps.`,
    };

    const guidanceText = guidanceTemplates[mode] || guidanceTemplates.reflection;
    const aiMessage: ChatMessage = {
      id: 'msg-' + (Date.now() + 1) + '-' + Math.random().toString(36).substring(2, 6),
      role: 'model',
      text: guidanceText,
      timestamp: Date.now(),
    };

    const finalMessages = [...messages, aiMessage];
    setMessages(finalMessages);
    setActiveModel('Cognitive Coach (Offline Guided)');

    await triggerSave({
      messages: finalMessages,
      lastGeminiModel: 'Cognitive Coach (Offline Guided)',
    });
    setIsGenerating(false);
  };

  // Executive summary generation
  const handleGenerateSummary = async () => {
    if (messages.length === 0 && !title && !draftContent) return;
    setIsSummarizing(true);
    setAiError(null);

    try {
      const fullConversation = messages
        .map((m) => `${m.role === 'user' ? 'User Reflection' : 'Gemini Feedback'}:\n${m.text}`)
        .join('\n\n') || draftContent;

      const result = await generateEntrySummary(fullConversation || title, title);
      setSummary(result.summary);
      setActiveModel(result.modelUsed);

      await triggerSave({
        summary: result.summary,
        lastGeminiModel: result.modelUsed,
      });
    } catch (err: any) {
      console.error('Summary error:', err);
      const isApiErr = err instanceof GeminiApiError;
      setAiError({
        message: err.message || 'Failed to generate AI summary.',
        code: isApiErr ? err.errorCode : 'UNKNOWN_ERROR',
        resolution: isApiErr ? err.resolution : undefined,
        rawDetails: isApiErr ? err.rawDetails : String(err),
      });
    } finally {
      setIsSummarizing(false);
    }
  };

  // Copy message to clipboard
  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMessageId(id);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  // Export reflection as Markdown
  const handleExportMarkdown = () => {
    let md = `# ${title || 'Journal Reflection'}\n`;
    md += `*Date: ${formatJournalDateTime(entry.updatedAt || entry.createdAt)}*\n`;
    md += `*Mode: ${mode} | Model: ${activeModel}*\n`;
    if (tagsInput) md += `*Tags: ${tagsInput}*\n`;
    if (mood) md += `*Mood: ${mood}*\n\n`;
    if (draftContent) md += `## Initial Reflection Notes\n${draftContent}\n\n`;
    if (summary) {
      md += `## AI Executive Summary\n${summary}\n\n---\n\n`;
    }
    md += `## Reflection Dialogue\n\n`;
    messages.forEach((m) => {
      md += `### ${m.role === 'user' ? '👤 You' : '✨ Reflection Companion'}\n${m.text}\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(title || 'reflection').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Attachment Management
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setAttachmentError(null);

    const updatedAttachments = [...attachments];
    setIsUploadingAttachment(true);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const validation = validateAttachmentFile(
          file.name,
          file.size,
          file.type,
          updatedAttachments.length,
          updatedAttachments.map((a) => a.fileName)
        );

        if (!validation.valid) {
          setAttachmentError(validation.error || 'Failed to attach file.');
          continue;
        }

        const processed = await processClientFileAttachment(file, entry.id, userId);
        updatedAttachments.push(processed);
      }

      setAttachments(updatedAttachments);
      await triggerSave({ attachments: updatedAttachments });
    } catch (err: any) {
      setAttachmentError(err?.message || 'Error processing attachment.');
    } finally {
      setIsUploadingAttachment(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveAttachment = async (attachmentId: string) => {
    const updated = attachments.filter((a) => a.id !== attachmentId);
    setAttachments(updated);
    await triggerSave({ attachments: updated });
  };

  // Emoji insertion at cursor position in textarea
  const handleInsertEmoji = (emoji: string) => {
    const el = textareaRef.current;
    if (!el) {
      setInputPrompt((prev) => prev + emoji);
      return;
    }
    const start = el.selectionStart ?? inputPrompt.length;
    const end = el.selectionEnd ?? inputPrompt.length;
    const before = inputPrompt.substring(0, start);
    const after = inputPrompt.substring(end);
    const next = before + emoji + after;
    setInputPrompt(next);

    setTimeout(() => {
      el.selectionStart = el.selectionEnd = start + emoji.length;
      el.focus();
    }, 10);
  };

  const handleConfirmDelete = async () => {
    if (!onDeleteEntry) return;
    setIsDeleting(true);
    try {
      await onDeleteEntry(entry.id);
      setIsDeleteModalOpen(false);
    } catch (err) {
      console.error('Failed to delete entry:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#121214] text-[#f5f5f7] overflow-hidden">
      {/* Top Quiet Toolbar: feels integrated like Apple Notes */}
      <div className="px-3.5 sm:px-6 md:px-10 py-2.5 sm:py-3 border-b border-[rgba(255,255,255,0.06)] flex items-center justify-between text-xs text-[#86868b] bg-[#121214]/80 backdrop-blur-sm shrink-0 gap-2">
        <div className="flex items-center space-x-2 min-w-0">
          {/* Mobile Entries Drawer Toggle */}
          {onOpenEntriesDrawer && (
            <button
              type="button"
              onClick={onOpenEntriesDrawer}
              className="md:hidden flex items-center space-x-1.5 px-2.5 py-1 text-xs text-zinc-300 bg-[#1c1c20] hover:bg-[#24242a] active:bg-[#2c2c34] border border-white/[0.08] rounded-lg cursor-pointer shrink-0"
              title="View all reflections"
            >
              <BookOpen className="w-3.5 h-3.5 text-[#0a84ff]" />
              <span>Entries</span>
            </button>
          )}

          <div className="flex items-center space-x-1.5 truncate">
            <Calendar className="w-3.5 h-3.5 text-[#86868b] shrink-0" />
            <span className="font-normal text-[#86868b] truncate text-[11.5px] sm:text-xs">
              {formatJournalDateTime(entry.updatedAt || entry.createdAt)}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
          {saveStatus === 'saving' && (
            <span className="flex items-center space-x-1.5 text-[#86868b] text-[11px] sm:text-xs">
              <RefreshCw className="w-3 h-3 animate-spin text-[#86868b]" />
              <span className="hidden sm:inline">Saving...</span>
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="text-[#86868b] font-normal text-[11px] sm:text-xs">
              Saved
            </span>
          )}
          {saveStatus === 'error' && (
            <button
              onClick={() => triggerSave()}
              className="text-[#ff9f0a] hover:underline cursor-pointer text-[11px] sm:text-xs"
              title={lastSaveError || 'Failed to save'}
            >
              Save failed · Retry
            </button>
          )}

          {/* Explore Emotional Landscape */}
          {onOpenLandscape && (
            <button
              onClick={onOpenLandscape}
              className="flex items-center space-x-1.5 px-2.5 py-1 text-[#86868b] hover:text-[#f5f5f7] bg-[#1c1c20] hover:bg-[#24242a] border border-[rgba(255,255,255,0.06)] rounded-[7px] text-[12px] font-medium transition-colors cursor-pointer btn-press shadow-xs"
              title="Enter 3D Emotional Landscape for this entry"
            >
              <Compass className="w-3.5 h-3.5 text-[#0a84ff]" />
              <span className="hidden sm:inline">Landscape</span>
            </button>
          )}

          {/* Export */}
          <button
            onClick={handleExportMarkdown}
            className="p-1.5 text-[#86868b] hover:text-[#f5f5f7] hover:bg-[#1c1c20] rounded-[6px] transition-colors cursor-pointer"
            title="Export as Markdown"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          {/* Delete button directly in editor toolbar */}
          {onDeleteEntry && (
            <button
              onClick={() => setIsDeleteModalOpen(true)}
              className="p-1.5 text-[#86868b] hover:text-[#ff453a] hover:bg-[#ff453a]/10 rounded-[6px] transition-colors cursor-pointer"
              title="Delete this reflection"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Scrollable Canvas */}
      <div className="flex-1 overflow-y-auto scroll-touch">
        <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 md:px-10 py-4 sm:py-6 md:py-8 space-y-5 sm:space-y-6">
          {/* Title row with subtle auto-generate button and status */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <input
                id="entry-title-input"
                type="text"
                placeholder="Title your reflection..."
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                onBlur={handleTitleBlur}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.currentTarget.blur();
                  }
                }}
                className="w-full text-[22px] sm:text-[26px] md:text-[30px] font-semibold tracking-tight text-[#f5f5f7] placeholder-[#636366] bg-transparent border-none focus:outline-none leading-tight"
                aria-label="Reflection title"
              />
            </div>

            <div className="flex items-center space-x-2 shrink-0 pt-1">
              {/* Subtle Loading indicator */}
              {isGeneratingTitle && (
                <div 
                  className="flex items-center space-x-1.5 px-2.5 py-1 bg-[#1c1c20] text-[#86868b] border border-[rgba(255,255,255,0.06)] rounded-[7px] text-[11.5px] font-medium animate-pulse"
                  role="status"
                  aria-live="polite"
                >
                  <RefreshCw className="w-3 h-3 text-[#0a84ff] animate-spin" />
                  <span className="hidden sm:inline">Generating title...</span>
                </div>
              )}

              {/* Custom title tag if user manually edited */}
              {!isGeneratingTitle && isCustomTitle && (
                <span 
                  className="text-[11px] font-medium text-[#86868b] bg-[#1c1c20]/80 px-2 py-0.5 rounded-[5px] border border-[rgba(255,255,255,0.04)]"
                  title="Title was manually customized"
                >
                  Custom
                </span>
              )}

              {/* Regenerate title action */}
              {!isGeneratingTitle && (
                <button
                  id="regenerate-title-btn"
                  onClick={handleRegenerateTitle}
                  disabled={
                    !isMeaningfulContentForTitle(
                      draftContent.trim() || messages.map((m) => m.text).join(' ') || inputPrompt.trim()
                    )
                  }
                  className="p-1.5 text-[#86868b] hover:text-[#0a84ff] hover:bg-[#1c1c20] rounded-[7px] transition-colors cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed group relative"
                  title="Regenerate title with AI based on entry content"
                  aria-label="Regenerate title"
                >
                  <Wand2 className="w-4 h-4 transition-transform group-hover:scale-110" />
                </button>
              )}
            </div>
          </div>

          {/* Minimal Controls Row: Segmented Mode Selector & Metadata */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1 pb-3 border-b border-[rgba(255,255,255,0.06)]">
            {/* Segmented Mode Selector */}
            <div className="flex flex-wrap items-center bg-[#1c1c20] p-1 rounded-[10px] border border-[rgba(255,255,255,0.06)] gap-1">
              {(['reflection', 'brainstorm', 'summary', 'socratic'] as ReflectionMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setMode(m);
                    triggerSave({ mode: m });
                  }}
                  className={`px-3 py-1.5 rounded-[8px] text-[12px] font-medium capitalize transition-all cursor-pointer btn-press ${
                    mode === m
                      ? 'bg-[#2a2a30] text-[#f5f5f7] shadow-xs'
                      : 'text-[#86868b] hover:text-[#f5f5f7]'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            {/* Synthesize Insights Action */}
            <button
              id="generate-summary-btn"
              onClick={handleGenerateSummary}
              disabled={isSummarizing || (messages.length === 0 && !draftContent && !title)}
              className="h-8 px-3 bg-[#1c1c20] hover:bg-[#242428] text-[#f5f5f7] border border-[rgba(255,255,255,0.08)] rounded-[8px] text-[12px] font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed btn-press flex items-center space-x-1.5"
            >
              <Sparkles className="w-3 h-3 text-[#0a84ff]" />
              <span>{isSummarizing ? 'Synthesizing...' : 'Synthesize Insights'}</span>
            </button>
          </div>

          {/* Discreet Tags & Mood metadata */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 text-xs text-[#86868b]">
            <div className="flex-1 flex items-center space-x-2 bg-[#1c1c20]/60 px-3 py-1.5 rounded-[9px] border border-[rgba(255,255,255,0.04)]">
              <Tag className="w-3.5 h-3.5 text-[#636366] shrink-0" />
              <input
                type="text"
                placeholder="Add tags (comma separated)..."
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                onBlur={() => triggerSave()}
                className="w-full bg-transparent text-[#f5f5f7] placeholder-[#636366] focus:outline-none text-[12.5px]"
              />
            </div>

            <div className="sm:w-56 flex items-center space-x-2 bg-[#1c1c20]/60 px-3 py-1.5 rounded-[9px] border border-[rgba(255,255,255,0.04)]">
              <Smile className="w-3.5 h-3.5 text-[#636366] shrink-0" />
              <input
                type="text"
                placeholder="Mood (e.g. calm, focused)..."
                value={mood}
                onChange={(e) => setMood(e.target.value)}
                onBlur={() => triggerSave()}
                className="w-full bg-transparent text-[#f5f5f7] placeholder-[#636366] focus:outline-none text-[12.5px]"
              />
            </div>
          </div>

          {/* Cognitive Telemetry Indicators (Subtle Apple-style meters) */}
          {telemetryData && (
            <div className="p-4 bg-[#18181b] border border-[rgba(255,255,255,0.06)] rounded-[16px] space-y-3">
              <div className="flex items-center justify-between text-[11px] text-[#86868b] font-medium tracking-wide uppercase">
                <span>Mindset Indicators</span>
                {telemetryData.confidence !== undefined && telemetryData.confidence < 0.5 && (
                  <span className="text-[#636366] normal-case">Early trend</span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <div className="flex items-center justify-between text-[12.5px] mb-1">
                    <span className="text-[#86868b]">Stress</span>
                    <span className="text-[#f5f5f7] font-medium">{telemetryData.stressIndex.toFixed(1)}</span>
                  </div>
                  <div className="h-1.5 w-full bg-[#242428] rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[#ff9f0a] rounded-full transition-all duration-300" 
                      style={{ width: `${Math.min(100, Math.max(0, (telemetryData.stressIndex / 10) * 100))}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[12.5px] mb-1">
                    <span className="text-[#86868b]">Focus</span>
                    <span className="text-[#f5f5f7] font-medium">{telemetryData.focusIndex.toFixed(1)}</span>
                  </div>
                  <div className="h-1.5 w-full bg-[#242428] rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[#0a84ff] rounded-full transition-all duration-300" 
                      style={{ width: `${Math.min(100, Math.max(0, (telemetryData.focusIndex / 10) * 100))}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[12.5px] mb-1">
                    <span className="text-[#86868b]">Creativity</span>
                    <span className="text-[#f5f5f7] font-medium">{telemetryData.creativityIndex.toFixed(1)}</span>
                  </div>
                  <div className="h-1.5 w-full bg-[#242428] rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[#30d158] rounded-full transition-all duration-300" 
                      style={{ width: `${Math.min(100, Math.max(0, (telemetryData.creativityIndex / 10) * 100))}%` }}
                    />
                  </div>
                </div>
              </div>

              {telemetryData.dominantThemes && telemetryData.dominantThemes.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[rgba(255,255,255,0.04)]">
                  {telemetryData.dominantThemes.map((theme, i) => (
                    <span key={i} className="px-2 py-0.5 bg-[#121214] text-[#86868b] rounded-[5px] text-[11px] border border-[rgba(255,255,255,0.04)]">
                      {theme}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Synthesized Insights Panel */}
          {summary && (
            <div className="p-5 bg-[#18181c] border border-[rgba(255,255,255,0.06)] rounded-[16px] space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-3.5 h-3.5 text-[#0a84ff]" />
                  <h4 className="text-[13px] font-semibold text-[#f5f5f7]">
                    Synthesized Insights
                  </h4>
                </div>
                <button
                  onClick={() => handleCopyText('summary-box', summary)}
                  className="text-[11px] text-[#86868b] hover:text-[#f5f5f7] cursor-pointer"
                >
                  {copiedMessageId === 'summary-box' ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="text-[14px] text-[#f5f5f7] leading-relaxed max-h-48 overflow-y-auto">
                <Markdown>{summary}</Markdown>
              </div>
            </div>
          )}

          {/* Draft text if present and no messages */}
          {messages.length === 0 && draftContent && (
            <div className="p-5 rounded-[16px] bg-[#18181c] border border-[rgba(255,255,255,0.06)] space-y-3">
              <div className="flex items-center justify-between text-xs text-[#86868b]">
                <span className="font-medium">Initial Entry</span>
                <button
                  onClick={() => handleSendMessage(draftContent)}
                  className="text-[#0a84ff] hover:underline cursor-pointer font-medium"
                >
                  Request reflection →
                </button>
              </div>
              <p className="text-[15px] text-[#f5f5f7] whitespace-pre-wrap leading-relaxed">
                {draftContent}
              </p>
            </div>
          )}

          {/* Peaceful Empty State Starters */}
          {messages.length === 0 && !draftContent && (
            <div className="py-10 text-center space-y-6">
              <p className="text-[14.5px] text-[#86868b] max-w-md mx-auto leading-relaxed">
                Write freely about what is on your mind, or choose a prompt to begin your reflection.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                {REFLECTION_PROMPT_STARTERS.map((starter, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setInputPrompt(starter.prompt);
                      textareaRef.current?.focus();
                    }}
                    className="p-4 bg-[#18181b] hover:bg-[#1f1f24] rounded-[14px] transition-colors text-left cursor-pointer btn-press border border-[rgba(255,255,255,0.04)]"
                  >
                    <p className="text-[13px] font-semibold text-[#f5f5f7]">
                      {starter.label}
                    </p>
                    <p className="mt-1 text-[12px] text-[#86868b] line-clamp-2 leading-relaxed">
                      {starter.prompt}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Journal Entries & Reflection Thread */}
          {messages.length > 0 && (
            <div className="space-y-6 pt-2">
              {messages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div key={msg.id} className="space-y-1.5">
                    {/* User reflection: styled as a personal journal paragraph */}
                    {isUser ? (
                      <div className="p-4 sm:p-5 rounded-[16px] bg-[#1a1a1e] border border-[rgba(255,255,255,0.06)]">
                        <div className="flex items-center justify-between text-[11.5px] text-[#86868b] mb-2 pb-1.5 border-b border-[rgba(255,255,255,0.04)]">
                          <span className="font-medium text-[#e5e5e8]">Your Thought</span>
                          <div className="flex items-center space-x-2">
                            <span>
                              {new Date(msg.timestamp).toLocaleTimeString([], {
                                hour: 'numeric',
                                minute: '2-digit',
                              })}
                            </span>
                            <button
                              onClick={() => handleCopyText(msg.id, msg.text)}
                              className="text-[#86868b] hover:text-[#f5f5f7] cursor-pointer"
                              title="Copy text"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <p className="text-[15px] sm:text-[15.5px] text-[#f5f5f7] whitespace-pre-wrap leading-[1.65]">
                          {msg.text}
                        </p>
                      </div>
                    ) : (
                      /* Companion reflection: calm distinct editorial block */
                      <div className="p-5 sm:p-6 rounded-[16px] bg-[#16161a] border border-[rgba(255,255,255,0.07)] shadow-xs">
                        <div className="flex items-center justify-between text-[11.5px] text-[#86868b] mb-3 pb-2 border-b border-[rgba(255,255,255,0.05)]">
                          <div className="flex items-center space-x-1.5 text-[#0a84ff]">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span className="font-semibold text-[#f5f5f7]">Reflection Companion</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span>
                              {new Date(msg.timestamp).toLocaleTimeString([], {
                                hour: 'numeric',
                                minute: '2-digit',
                              })}
                            </span>
                            <button
                              onClick={() => handleCopyText(msg.id, msg.text)}
                              className="text-[#86868b] hover:text-[#f5f5f7] cursor-pointer"
                              title="Copy text"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <div className="text-[14.5px] sm:text-[15px] text-[#f5f5f7] leading-[1.68] prose prose-invert max-w-none">
                          <Markdown>{msg.text}</Markdown>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Loading state */}
          {isGenerating && (
            <div className="p-4 rounded-[14px] bg-[#16161a] border border-[rgba(255,255,255,0.06)] flex items-center space-x-2.5 text-[13px] text-[#86868b]">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#0a84ff]" />
              <span>Formulating thoughtful reflection...</span>
            </div>
          )}

          {/* Restrained AI Error Notification */}
          {aiError && (
            <div className="p-4 bg-[#1c1c20] border border-[#ff453a]/30 rounded-[14px] space-y-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <h4 className="text-[13px] font-medium text-[#ff453a]">
                    {aiError.message}
                  </h4>
                  {aiError.resolution && (
                    <p className="text-[12px] text-[#86868b]">
                      {aiError.resolution}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setAiError(null)}
                  className="text-[#86868b] hover:text-[#f5f5f7] p-1 cursor-pointer text-xs"
                >
                  ✕
                </button>
              </div>

              <div className="flex items-center space-x-2 pt-1 border-t border-[rgba(255,255,255,0.06)]">
                <button
                  onClick={() => handleSendMessage(lastFailedPrompt)}
                  disabled={isGenerating || !lastFailedPrompt}
                  className="px-3 py-1.5 bg-[#f5f5f7] text-[#121214] rounded-[7px] text-[12px] font-medium transition-colors cursor-pointer btn-press disabled:opacity-40"
                >
                  Retry
                </button>
                <button
                  onClick={handleInsertGuidedReflection}
                  disabled={isGenerating}
                  className="px-3 py-1.5 bg-[#242428] text-[#f5f5f7] rounded-[7px] text-[12px] font-medium transition-colors cursor-pointer btn-press"
                >
                  Use Cognitive Coaching Prompt
                </button>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Writing Input Bar */}
      <div className="p-3 sm:p-4 md:p-5 border-t border-[rgba(255,255,255,0.06)] bg-[#121214] shrink-0 safe-area-bottom">
        <div className="w-full max-w-3xl mx-auto space-y-2.5">
          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.txt,.md,.markdown,.png,.jpg,.jpeg,.webp"
            onChange={handleFileSelect}
            className="hidden"
            aria-label="Upload journal attachment"
          />

          {/* Attachment Error Alert */}
          {attachmentError && (
            <div className="px-3.5 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{attachmentError}</span>
              </div>
              <button
                type="button"
                onClick={() => setAttachmentError(null)}
                className="text-red-400 hover:text-red-200 p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Attached Files Chips Bar */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {attachments.map((att) => {
                const isImg = att.status === 'image' || att.fileType.startsWith('image/');
                const isExtracted = att.status === 'extracted';
                const isFailed = att.status === 'failed';

                return (
                  <div
                    key={att.id}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[#1c1c20] border border-white/[0.08] text-xs text-zinc-300 shadow-xs group"
                  >
                    {isImg ? (
                      att.previewUrl ? (
                        <img
                          src={att.previewUrl}
                          alt={att.fileName}
                          className="w-4 h-4 rounded object-cover"
                        />
                      ) : (
                        <ImageIcon className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      )
                    ) : att.fileName.endsWith('.md') ? (
                      <FileCode className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <FileText className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    )}

                    <span className="font-medium max-w-[120px] sm:max-w-[160px] truncate" title={att.fileName}>
                      {att.fileName}
                    </span>

                    <span className="text-[10px] text-zinc-500">
                      ({formatAttachmentSize(att.fileSize)})
                    </span>

                    {/* Status Badge */}
                    {isExtracted && (
                      <span className="text-[9.5px] px-1.5 py-0.2 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Extracted
                      </span>
                    )}
                    {isImg && (
                      <span className="text-[9.5px] px-1.5 py-0.2 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        Image
                      </span>
                    )}
                    {isFailed && (
                      <span className="text-[9.5px] px-1.5 py-0.2 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20" title={att.error}>
                        Text unavailable
                      </span>
                    )}

                    {/* Remove Attachment Button */}
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(att.id)}
                      title={`Remove ${att.fileName}`}
                      className="p-1 rounded text-zinc-500 hover:text-red-400 transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}

              {isUploadingAttachment && (
                <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                  <RefreshCw className="w-3 h-3 animate-spin text-zinc-400" />
                  <span>Processing attachment...</span>
                </div>
              )}
            </div>
          )}

          {/* Composer Box */}
          <div className="bg-[#1c1c20] focus-within:bg-[#222226] focus-within:border-[rgba(255,255,255,0.14)] border border-[rgba(255,255,255,0.07)] rounded-[18px] p-3 sm:p-3.5 transition-colors shadow-sm relative">
            {/* Emoji Picker Popover */}
            <EmojiPicker
              isOpen={isEmojiPickerOpen}
              onClose={() => setIsEmojiPickerOpen(false)}
              onSelectEmoji={handleInsertEmoji}
              positionClassName="bottom-full mb-3 left-0"
            />

            <textarea
              ref={textareaRef}
              id="reflection-prompt-input"
              rows={3}
              placeholder="What's on your mind? Write your reflection or question..."
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              className="w-full bg-transparent text-[15px] sm:text-[15.5px] leading-[1.6] text-[#f5f5f7] placeholder-[#636366] border-none focus:outline-none resize-none"
            />

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[rgba(255,255,255,0.05)]">
              {/* Left tools: Attachments, Emojis, and Copilot Trigger */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  id="attach-file-btn"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingAttachment || attachments.length >= 5}
                  className="h-10 sm:h-8 px-3 sm:px-2.5 text-zinc-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] active:bg-white/[0.12] border border-white/[0.06] rounded-xl sm:rounded-[7px] transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5 text-xs font-medium"
                  title="Attach file (PDF, DOCX, TXT, MD, Images up to 5 MB)"
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  <span>Attach</span>
                </button>

                <button
                  type="button"
                  id="insert-emoji-btn"
                  onClick={() => setIsEmojiPickerOpen((prev) => !prev)}
                  className="h-10 sm:h-8 px-3 sm:px-2.5 text-zinc-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] active:bg-white/[0.12] border border-white/[0.06] rounded-xl sm:rounded-[7px] transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-medium"
                  title="Insert emoji at cursor"
                >
                  <Smile className="w-3.5 h-3.5" />
                  <span>Emoji</span>
                </button>

                {/* AI Copilot Quick Trigger inside composer */}
                <button
                  type="button"
                  id="composer-copilot-trigger"
                  onClick={() => {
                    if (onOpenCopilot) onOpenCopilot();
                    else window.dispatchEvent(new CustomEvent('open-ai-copilot'));
                  }}
                  className="h-10 sm:h-8 px-3 sm:px-2.5 text-indigo-300 hover:text-white bg-indigo-500/10 hover:bg-indigo-500/20 active:bg-indigo-500/25 border border-indigo-500/25 rounded-xl sm:rounded-[7px] transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-medium"
                  title="Open AI Copilot"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Copilot</span>
                </button>
              </div>

              {/* Right: Reflect Action Button */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[#636366] hidden md:inline">
                  {inputPrompt.length > 0 ? `${inputPrompt.length} characters` : 'Press Enter to reflect'}
                </span>

                <button
                  id="send-reflection-btn"
                  onClick={() => handleSendMessage()}
                  disabled={!inputPrompt.trim() || isGenerating}
                  className="h-10 sm:h-8 px-4 bg-[#f5f5f7] hover:bg-[#e5e5ea] active:bg-[#d1d1d6] text-[#121214] text-xs sm:text-[13px] font-semibold rounded-xl sm:rounded-[8px] transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer btn-press flex items-center space-x-1.5 shadow-xs"
                  title="Send reflection"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Reflect</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* In-app Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        title={title}
        isDeleting={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setIsDeleteModalOpen(false)}
      />
    </div>
  );
};
