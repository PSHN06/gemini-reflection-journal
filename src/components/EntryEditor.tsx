import React, { useState, useRef, useEffect } from 'react';
import { JournalEntry, ChatMessage, ReflectionMode } from '../types';
import Markdown from 'react-markdown';
import { 
  Sparkles, 
  Send, 
  Lightbulb, 
  FileText, 
  HelpCircle, 
  CheckCircle2, 
  RefreshCw, 
  Copy, 
  Download, 
  AlertCircle, 
  CornerDownLeft,
  Bot,
  User as UserIcon,
  Tag as TagIcon,
  Smile,
  Cpu,
  Bookmark,
  Activity
} from 'lucide-react';
import { generateReflectionResponse, generateEntrySummary, extractTelemetry, GeminiApiError } from '../services/geminiService';
import { logUserInteraction } from '../services/journalService';
import { db } from '../firebase';
import { doc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';

interface EntryEditorProps {
  entry: JournalEntry;
  userId: string;
  onSaveEntry: (updated: JournalEntry) => Promise<void>;
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
  saveStatus,
  lastSaveError,
}) => {
  const [title, setTitle] = useState(entry.title || '');
  const [mode, setMode] = useState<ReflectionMode>(entry.mode || 'reflection');
  const [tagsInput, setTagsInput] = useState((entry.tags || []).join(', '));
  const [mood, setMood] = useState(entry.mood || '');
  const [messages, setMessages] = useState<ChatMessage[]>(entry.messages || []);
  const [inputPrompt, setInputPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiError, setAiError] = useState<AiErrorDetail | null>(null);
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string>('');
  const [summary, setSummary] = useState(entry.summary || '');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [activeModel, setActiveModel] = useState<string>(entry.lastGeminiModel || 'gemini-3.6-flash');
  
  // Cognitive Telemetry State
  const [telemetryData, setTelemetryData] = useState<{
    stressIndex: number;
    focusIndex: number;
    creativityIndex: number;
    dominantThemes: string[];
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync state when incoming entry changes
  useEffect(() => {
    setTitle(entry.title || '');
    setMode(entry.mode || 'reflection');
    setTagsInput((entry.tags || []).join(', '));
    setMood(entry.mood || '');
    setMessages(entry.messages || []);
    setSummary(entry.summary || '');
    setActiveModel(entry.lastGeminiModel || 'gemini-3.6-flash');
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
      mode,
      tags: parsedTags,
      mood,
      messages,
      summary,
      lastGeminiModel: activeModel,
      ...overrides,
      updatedAt: Date.now(),
    };

    await onSaveEntry(updated);
  };

  // Handle sending a reflection message to Gemini
  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = (customPrompt !== undefined ? customPrompt : inputPrompt).trim();
    if (!textToSend || isGenerating) return;

    setAiError(null);
    setLastFailedPrompt(textToSend);

    // Check if the prompt is already the last message in `messages` (e.g., from retry)
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
      // Save user message immediately to Firestore so input is NEVER lost
      await triggerSave({ messages: currentMessages });
    }

    setIsGenerating(true);

    try {
      // Collect prior context if any
      const userContext = summary ? `Active reflection summary: ${summary}` : undefined;

      const response = await generateReflectionResponse(
        textToSend,
        currentMessages,
        mode,
        userContext
      );

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
        await setDoc(telemetryRef, {
          ...response.telemetry,
          entryId: entry.id,
          createdAt: serverTimestamp(),
        }, { merge: true });
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
        messages: finalMessages,
        lastGeminiModel: response.modelUsed,
      });
    } catch (err: any) {
      console.error('Gemini Reflection error:', err);
      const isApiErr = err instanceof GeminiApiError;
      setAiError({
        message: err.message || 'Failed to generate response.',
        code: isApiErr ? err.errorCode : 'UNKNOWN_ERROR',
        resolution: isApiErr ? err.resolution : 'Please check your connection and configuration.',
        rawDetails: isApiErr ? err.rawDetails : String(err),
      });
    } finally {
      setIsGenerating(false);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  };

  // Structured cognitive coaching prompt generator (graceful offline/restricted fallback)
  const handleInsertGuidedReflection = async () => {
    setIsGenerating(true);
    setAiError(null);

    const guidanceTemplates: Record<ReflectionMode, string> = {
      reflection: `### Structured Cognitive Reflection
Here are three introspective lenses to deepen your reflection:

1. **Emotional Inventory**: What emotion felt most prominent as you wrote this, and what core assumption might be fueling it?
2. **Horizon Perspective**: Imagine looking back on this situation 12 months from today—which part of what you wrote will matter most, and which part can you let go of?
3. **Agency Check**: What is one variable strictly inside your direct control today?`,

      brainstorm: `### Divergent Brainstorming Matrix
Here are fresh angles to expand your thinking:

- **The Inversion Angle**: What is the complete opposite of your current approach, and what surprising advantage might it offer?
- **The Low-Hanging Fruit**: What is a 5-minute micro-action that creates immediate forward momentum?
- **The 10x Bold Move**: If you had zero risk of failure or judgment, what radical next step would you take?`,

      socratic: `### Socratic Clarity Questions
To test and sharpen your perspective:

1. **Premise Verification**: What primary evidence supports your current view, and what evidence might contradict it?
2. **Unseen Trade-Offs**: If you choose this path, what are you implicitly saying "no" to?
3. **Core Breakthrough**: If a trusted mentor who believed in you deeply were advising you right now, what question would they ask?`,

      summary: `### Cognitive Synthesis & Action Steps
**Key Theme**: Clarifying priorities and intentional direction.
- **Identified Focus**: Processing challenges and organizing actionable takeaways.
- **Recommended Action**: Write down the single highest-leverage decision you can commit to before the day ends.`,
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
    setActiveModel('Guided Reflection Coach');

    await triggerSave({
      messages: finalMessages,
      lastGeminiModel: 'Guided Reflection Coach',
    });
    setIsGenerating(false);
  };

  // Handle one-click Executive Summary generation
  const handleGenerateSummary = async () => {
    if (messages.length === 0 && !title) return;
    setIsSummarizing(true);
    setAiError(null);

    try {
      const fullConversation = messages
        .map((m) => `${m.role === 'user' ? 'User Reflection' : 'Gemini Feedback'}:\n${m.text}`)
        .join('\n\n');

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
    md += `*Date: ${new Date(entry.updatedAt).toLocaleString()}*\n`;
    md += `*Mode: ${mode} | Model: ${activeModel}*\n`;
    if (tagsInput) md += `*Tags: ${tagsInput}*\n\n`;
    if (summary) {
      md += `## AI Executive Summary\n${summary}\n\n---\n\n`;
    }
    md += `## Reflection Dialogue\n\n`;
    messages.forEach((m) => {
      md += `### ${m.role === 'user' ? '👤 User' : '✨ Gemini'}\n${m.text}\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(title || 'reflection').toLowerCase().replace(/\s+/g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden">
      {/* Top Editor Toolbar */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/40 space-y-3">
        {/* Title and Cloud Sync Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <input
            id="entry-title-input"
            type="text"
            placeholder="Reflection Title (e.g., Launching Project V2, Clarifying Goals)..."
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
            }}
            onBlur={() => triggerSave()}
            className="flex-1 text-lg sm:text-xl font-bold text-slate-100 bg-transparent border-b border-transparent hover:border-slate-700 focus:border-amber-400 focus:outline-none transition-colors font-['Outfit']"
          />

          {/* Sync Status Badge */}
          <div className="flex items-center space-x-2 shrink-0">
            {saveStatus === 'saving' && (
              <div className="flex items-center space-x-1.5 px-2.5 py-1 text-xs text-amber-400 bg-amber-950/30 border border-amber-800/40 rounded-lg">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Syncing Firestore...</span>
              </div>
            )}
            {saveStatus === 'saved' && (
              <div className="flex items-center space-x-1.5 px-2.5 py-1 text-xs text-emerald-400 bg-emerald-950/30 border border-emerald-800/40 rounded-lg">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Saved to Firestore</span>
              </div>
            )}
            {saveStatus === 'error' && (
              <button
                onClick={() => triggerSave()}
                className="flex items-center space-x-1.5 px-2.5 py-1 text-xs text-rose-400 bg-rose-950/40 border border-rose-800/60 rounded-lg hover:bg-rose-900/40 cursor-pointer"
                title={lastSaveError || 'Failed to save to Firestore'}
              >
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Save Error • Retry</span>
              </button>
            )}

            {/* Export & Action dropdown/buttons */}
            <button
              onClick={handleExportMarkdown}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Export as Markdown"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mode Selector & Tags Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Mode Selector Tabs */}
          <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => {
                setMode('reflection');
                triggerSave({ mode: 'reflection' });
              }}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                mode === 'reflection'
                  ? 'bg-purple-600/30 text-purple-200 border border-purple-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>Deep Reflection</span>
            </button>

            <button
              onClick={() => {
                setMode('brainstorm');
                triggerSave({ mode: 'brainstorm' });
              }}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                mode === 'brainstorm'
                  ? 'bg-amber-600/30 text-amber-200 border border-amber-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
              <span>Brainstorm</span>
            </button>

            <button
              onClick={() => {
                setMode('summary');
                triggerSave({ mode: 'summary' });
              }}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                mode === 'summary'
                  ? 'bg-emerald-600/30 text-emerald-200 border border-emerald-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-emerald-400" />
              <span>Summary</span>
            </button>

            <button
              onClick={() => {
                setMode('socratic');
                triggerSave({ mode: 'socratic' });
              }}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                mode === 'socratic'
                  ? 'bg-cyan-600/30 text-cyan-200 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
              <span>Socratic</span>
            </button>
          </div>

          {/* Quick AI Action Buttons & Tags */}
          <div className="flex items-center space-x-2">
            <button
              id="generate-summary-btn"
              onClick={handleGenerateSummary}
              disabled={isSummarizing || (messages.length === 0 && !title)}
              className="flex items-center space-x-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-lg border border-slate-700 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>{isSummarizing ? 'Synthesizing...' : 'Extract Key Insights'}</span>
            </button>

            {/* Model Tag */}
            <div className="hidden lg:flex items-center space-x-1 px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 text-[11px]">
              <Cpu className="w-3 h-3 text-amber-400" />
              <span>{activeModel}</span>
            </div>
          </div>
        </div>

        {/* Tags input & Mood bar */}
        <div className="flex items-center space-x-3 text-xs pt-1">
          <div className="flex items-center space-x-1.5 flex-1 bg-slate-950/60 px-2.5 py-1 rounded-lg border border-slate-800/80">
            <TagIcon className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <input
              type="text"
              placeholder="Add tags separated by comma (e.g. goals, mindset, career)..."
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              onBlur={() => triggerSave()}
              className="w-full bg-transparent text-slate-300 placeholder-slate-600 focus:outline-none text-xs"
            />
          </div>

          <div className="flex items-center space-x-1.5 bg-slate-950/60 px-2.5 py-1 rounded-lg border border-slate-800/80">
            <Smile className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <input
              type="text"
              placeholder="Current mood / energy..."
              value={mood}
              onChange={(e) => setMood(e.target.value)}
              onBlur={() => triggerSave()}
              className="w-36 bg-transparent text-slate-300 placeholder-slate-600 focus:outline-none text-xs"
            />
          </div>
        </div>
      </div>

      {/* Cognitive Telemetry Stats Bar (Feature B) */}
      {telemetryData && (
        <div className="mx-4 mt-3 flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 px-4 py-2.5 rounded-xl text-xs shadow-inner">
          <div className="flex items-center space-x-4">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Telemetry:</span>
            <div className="flex items-center space-x-1.5 text-amber-400 font-medium">
              <span>Stress:</span>
              <span className="bg-amber-500/10 px-2 py-0.5 rounded font-bold text-amber-300">{telemetryData.stressIndex}/10</span>
            </div>
            <div className="flex items-center space-x-1.5 text-emerald-400 font-medium">
              <span>Focus:</span>
              <span className="bg-emerald-500/10 px-2 py-0.5 rounded font-bold text-emerald-300">{telemetryData.focusIndex}/10</span>
            </div>
            <div className="flex items-center space-x-1.5 text-sky-400 font-medium">
              <span>Creativity:</span>
              <span className="bg-sky-500/10 px-2 py-0.5 rounded font-bold text-sky-300">{telemetryData.creativityIndex}/10</span>
            </div>
          </div>
          {telemetryData.dominantThemes && telemetryData.dominantThemes.length > 0 && (
            <div className="flex items-center space-x-1.5">
              <span className="text-[11px] text-slate-500">Themes:</span>
              <div className="flex items-center space-x-1">
                {telemetryData.dominantThemes.map((theme, i) => (
                  <span key={i} className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px] border border-slate-700">
                    {theme}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* AI Executive Summary Card (if generated) */}
      {summary && (
        <div className="mx-4 mt-4 p-4 bg-gradient-to-r from-amber-950/20 via-slate-900 to-slate-900 border border-amber-500/30 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <Bookmark className="w-4 h-4 text-amber-400" />
              <h4 className="text-xs font-semibold text-amber-300 uppercase tracking-wider">
                Synthesized Key Insights
              </h4>
            </div>
            <button
              onClick={() => handleCopyText('summary-box', summary)}
              className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center space-x-1 cursor-pointer"
            >
              <Copy className="w-3 h-3" />
              <span>{copiedMessageId === 'summary-box' ? 'Copied!' : 'Copy Summary'}</span>
            </button>
          </div>
          <div className="text-xs text-slate-200 leading-relaxed max-h-40 overflow-y-auto">
            <Markdown>{summary}</Markdown>
          </div>
        </div>
      )}

      {/* Multi-turn Dialogue Container */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {/* Empty state: Reflection Starters */}
        {messages.length === 0 && (
          <div className="max-w-xl mx-auto py-8 text-center space-y-6">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-200 font-['Outfit']">
                Start your reflection with Gemini
              </h3>
              <p className="mt-1 text-xs text-slate-400">
                Write freely about what’s on your mind, or choose a starter below to spark thoughtful insights.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
              {REFLECTION_PROMPT_STARTERS.map((starter, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setInputPrompt(starter.prompt);
                    textareaRef.current?.focus();
                  }}
                  className="p-3 bg-slate-900/60 hover:bg-slate-850 border border-slate-800 rounded-xl transition-all text-left cursor-pointer group hover:border-amber-500/30"
                >
                  <p className="text-xs font-medium text-amber-300 group-hover:text-amber-200">
                    {starter.label}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400 line-clamp-2">
                    {starter.prompt}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message Thread */}
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex items-start gap-3 max-w-3xl ${
                isUser ? 'ml-auto justify-end' : 'mr-auto justify-start'
              }`}
            >
              {/* Bot Avatar */}
              {!isUser && (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-400 text-slate-950 flex items-center justify-center shrink-0 shadow-sm mt-1">
                  <Sparkles className="w-4 h-4" />
                </div>
              )}

              {/* Message Bubble */}
              <div
                className={`group relative rounded-2xl px-4 py-3 text-xs leading-relaxed max-w-[85%] sm:max-w-[75%] ${
                  isUser
                    ? 'bg-amber-400 text-slate-950 rounded-br-none shadow-sm'
                    : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none shadow-md'
                }`}
              >
                {/* Header info */}
                <div
                  className={`flex items-center justify-between pb-1 mb-1 border-b text-[10px] ${
                    isUser ? 'border-amber-500/30 text-slate-800' : 'border-slate-800 text-slate-500'
                  }`}
                >
                  <span className="font-semibold">
                    {isUser ? 'You' : 'Gemini 3.6 Flash'}
                  </span>
                  <span>
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                {/* Content */}
                <div className="prose prose-invert prose-xs max-w-none">
                  <Markdown>{msg.text}</Markdown>
                </div>

                {/* Copy button */}
                <button
                  onClick={() => handleCopyText(msg.id, msg.text)}
                  className={`absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity cursor-pointer ${
                    isUser ? 'text-slate-800 hover:bg-amber-500/20' : 'text-slate-400 hover:bg-slate-800'
                  }`}
                  title="Copy text"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </div>

              {/* User Avatar */}
              {isUser && (
                <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center shrink-0 mt-1">
                  <UserIcon className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {/* Loading Bubble */}
        {isGenerating && (
          <div className="flex items-start gap-3 max-w-3xl mr-auto">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-400 text-slate-950 flex items-center justify-center shrink-0 animate-pulse">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-bl-none px-4 py-3 text-xs text-slate-300 flex items-center space-x-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
              <span>Gemini is reflecting and formulating insights...</span>
            </div>
          </div>
        )}

        {/* AI Error Notification Card */}
        {aiError && (
          <div className="p-4 bg-slate-900/95 border border-rose-600/40 rounded-2xl shadow-lg space-y-3 max-w-3xl mr-auto">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start space-x-3">
                <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 shrink-0 mt-0.5">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold text-rose-300">
                    {aiError.code === 'PROJECT_ACCESS_DENIED'
                      ? 'Google Cloud Project Access Restricted (403)'
                      : aiError.code === 'QUOTA_EXCEEDED'
                      ? 'Gemini API Rate Limit or Quota Exceeded (429)'
                      : aiError.code === 'MISSING_API_KEY'
                      ? 'Gemini API Key Not Configured'
                      : 'Gemini Reflection Notice'}
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {aiError.message}
                  </p>
                  {aiError.resolution && (
                    <div className="mt-2 p-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-[11px] text-amber-300/90 leading-relaxed">
                      <span className="font-semibold text-amber-200">How to resolve: </span>
                      {aiError.resolution}
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={() => setAiError(null)}
                className="text-slate-500 hover:text-slate-300 p-1 rounded-lg cursor-pointer text-xs"
                title="Dismiss"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80">
              <button
                onClick={() => handleSendMessage(lastFailedPrompt)}
                disabled={isGenerating || !lastFailedPrompt}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Response</span>
              </button>

              <button
                onClick={handleInsertGuidedReflection}
                disabled={isGenerating}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-medium flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                <span>Use Cognitive Coach Prompts</span>
              </button>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Message Input Bar */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/60">
        <div className="max-w-4xl mx-auto flex items-end gap-2 bg-slate-950 border border-slate-800 rounded-2xl p-2 focus-within:border-amber-400/60 transition-colors">
          <textarea
            ref={textareaRef}
            id="reflection-prompt-input"
            rows={2}
            placeholder={`Express your reflection in "${mode}" mode... (Press Enter to send, Shift+Enter for new line)`}
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            className="flex-1 bg-transparent text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none resize-none px-2 py-1 max-h-32"
          />

          <button
            id="send-reflection-btn"
            onClick={() => handleSendMessage()}
            disabled={!inputPrompt.trim() || isGenerating}
            className="p-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl font-medium transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
            title="Send to Gemini"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-between max-w-4xl mx-auto mt-2 text-[10px] text-slate-500 px-1">
          <span>Gemini 3.6 Flash Fallback Chain Active</span>
          <span>All interactions synchronized to Cloud Firestore</span>
        </div>
      </div>
    </div>
  );
};