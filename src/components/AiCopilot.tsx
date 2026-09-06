import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  X,
  Minimize2,
  Trash2,
  Send,
  Smile,
  BookOpen,
  HelpCircle,
  Paperclip,
  Check,
  RefreshCw,
} from 'lucide-react';
import Markdown from 'react-markdown';
import { JournalEntry } from '../types';
import { CopilotMessage, sendCopilotMessage } from '../services/copilotService';
import { EmojiPicker } from './EmojiPicker';

interface AiCopilotProps {
  currentEntry: JournalEntry | null;
  currentView: 'journal' | 'landscape' | 'tapes';
  onApplyTitle?: (suggestedTitle: string) => void;
  onInsertTextToDraft?: (text: string) => void;
}

const QUICK_ACTIONS = [
  { id: 'continue', label: 'Help me continue', prompt: 'Help me continue this thought and explore where it leads.' },
  { id: 'summarize', label: 'Summarize this entry', prompt: 'Summarize what I have written so far in a few clear, grounded points.' },
  { id: 'theme', label: 'Find the main theme', prompt: 'What seems to be the main theme or realization in this entry?' },
  { id: 'title', label: 'Suggest a title', prompt: 'Suggest a thoughtful title for this entry based on its core meaning.' },
  { id: 'question', label: 'Ask a reflection question', prompt: 'Give me a gentle reflection question to consider based on what I wrote.' },
  { id: 'explain', label: 'Explain this app', prompt: 'How does this application work, and what are its key features?' },
];

export const AiCopilot: React.FC<AiCopilotProps> = ({
  currentEntry,
  currentView,
  onApplyTitle,
  onInsertTextToDraft,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<CopilotMessage[]>([
    {
      id: 'init-msg',
      role: 'assistant',
      content: `Hello. I am your AI Copilot—here to help you reflect, organize thoughts, and explore features like the Emotional Landscape and Temporal Tapes.\n\nHow can I support your journaling today?`,
      timestamp: Date.now(),
      mode: 'companion',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copilotMode, setCopilotMode] = useState<'companion' | 'guide'>('companion');
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activeRequestRef = useRef<AbortController | null>(null);
  const activeEntryIdRef = useRef<string | undefined>(currentEntry?.id);

  // Sync mode automatically based on view
  useEffect(() => {
    if (currentView === 'landscape' || currentView === 'tapes') {
      setCopilotMode('guide');
    } else {
      setCopilotMode('companion');
    }
  }, [currentView]);

  // Track entry switches without losing the overall session conversation
  useEffect(() => {
    if (currentEntry?.id !== activeEntryIdRef.current) {
      activeEntryIdRef.current = currentEntry?.id;
      // Abort any pending requests from the previous entry
      if (activeRequestRef.current) {
        activeRequestRef.current.abort();
        activeRequestRef.current = null;
        setIsLoading(false);
      }
    }
  }, [currentEntry?.id]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isLoading]);

  // Listen to custom open-ai-copilot event
  useEffect(() => {
    function handleOpenEvent() {
      setIsOpen(true);
      setUnreadCount(0);
    }
    window.addEventListener('open-ai-copilot', handleOpenEvent);
    return () => window.removeEventListener('open-ai-copilot', handleOpenEvent);
  }, []);

  const handleSendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || isLoading) return;

    const userMessage: CopilotMessage = {
      id: 'msg-' + Date.now(),
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
    };

    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    setInputText('');
    setIsLoading(true);

    const controller = new AbortController();
    activeRequestRef.current = controller;

    // Build context
    const entryContext = currentEntry
      ? {
          id: currentEntry.id,
          title: currentEntry.title,
          content: currentEntry.content,
          mood: currentEntry.mood,
          tags: currentEntry.tags,
          attachments: currentEntry.attachments?.map((a) => ({
            id: a.id,
            fileName: a.fileName,
            fileType: a.fileType,
            status: a.status,
            extractedText: a.extractedText,
          })),
        }
      : undefined;

    try {
      const response = await sendCopilotMessage({
        prompt: trimmed,
        history: newHistory,
        mode: copilotMode,
        currentView,
        entryContext,
        signal: controller.signal,
      });

      const assistantMessage: CopilotMessage = {
        id: 'msg-' + Date.now(),
        role: 'assistant',
        content: response.content,
        timestamp: Date.now(),
        mode: response.mode,
        modelUsed: response.modelUsed,
        isFallback: response.isFallback,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      if (!isOpen) {
        setUnreadCount((c) => c + 1);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setMessages((prev) => [
          ...prev,
          {
            id: 'err-' + Date.now(),
            role: 'assistant',
            content: `I encountered a momentary connection issue. You can try sending your message again.`,
            timestamp: Date.now(),
            mode: copilotMode,
          },
        ]);
      }
    } finally {
      setIsLoading(false);
      activeRequestRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(inputText);
    }
  };

  const handleClearHistory = () => {
    if (activeRequestRef.current) {
      activeRequestRef.current.abort();
      activeRequestRef.current = null;
    }
    setIsLoading(false);
    setMessages([
      {
        id: 'init-msg-' + Date.now(),
        role: 'assistant',
        content: `Conversation refreshed. How can I assist with your journaling or application questions?`,
        timestamp: Date.now(),
        mode: copilotMode,
      },
    ]);
  };

  const handleInsertEmoji = (emoji: string) => {
    const el = textareaRef.current;
    if (!el) {
      setInputText((prev) => prev + emoji);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const text = inputText;
    const next = text.substring(0, start) + emoji + text.substring(end);
    setInputText(next);
    setTimeout(() => {
      el.selectionStart = el.selectionEnd = start + emoji.length;
      el.focus();
    }, 10);
  };

  return (
    <>
      {/* Minimized / Closed Pill Button (Bottom Right) */}
      {!isOpen && (
        <button
          type="button"
          id="copilot-toggle-button"
          onClick={() => {
            setIsOpen(true);
            setUnreadCount(0);
          }}
          className="fixed bottom-5 right-4 sm:bottom-6 sm:right-6 z-40 h-11 px-3.5 sm:px-4 rounded-full bg-[#18181b]/95 border border-white/12 text-white hover:bg-[#222226] hover:border-white/20 shadow-2xl backdrop-blur-xl transition-all duration-200 flex items-center gap-2 text-xs font-medium group cursor-pointer active:scale-95"
          aria-label="Open AI Copilot"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <Sparkles className="w-3.5 h-3.5 text-zinc-300 group-hover:text-white transition-colors" />
          <span className="font-medium">✦ AI Copilot</span>
          {unreadCount > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full bg-indigo-500/80 text-[10px] text-white font-mono">
              {unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/65 backdrop-blur-xs z-40 sm:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Expanded Floating Panel (Bottom Sheet on Mobile / Floating Window on Desktop) */}
      {isOpen && (
        <div
          id="copilot-floating-panel"
          className="fixed inset-x-0 bottom-0 z-50 h-[88dvh] max-h-[88dvh] rounded-t-[28px] bg-[#141416]/98 border-t border-white/12 shadow-2xl backdrop-blur-2xl flex flex-col overflow-hidden text-zinc-200 animate-in slide-in-from-bottom-6 duration-200 sm:fixed sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[390px] sm:max-w-[calc(100vw-2rem)] sm:h-[590px] sm:max-h-[calc(100vh-5rem)] sm:rounded-2xl sm:border sm:border-white/10 sm:animate-in sm:fade-in sm:slide-in-from-bottom-4"
        >
          {/* Mobile Drag Indicator */}
          <div className="w-10 h-1 bg-white/20 rounded-full mx-auto my-1.5 sm:hidden shrink-0" />

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 sm:py-3 border-b border-white/[0.08] bg-white/[0.02] shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 sm:w-7 sm:h-7 rounded-xl sm:rounded-lg bg-white/[0.06] border border-white/10 flex items-center justify-center text-zinc-300">
                <Sparkles className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              </div>
              <div>
                <h3 className="text-[13px] sm:text-xs font-semibold text-white flex items-center gap-1.5">
                  AI Copilot
                  <span className="text-[10px] font-normal text-zinc-400 border border-white/10 px-1.5 py-0.2 rounded-md">
                    {copilotMode === 'companion' ? 'Journal Companion' : 'App Guide'}
                  </span>
                </h3>
                <p className="text-[10.5px] text-zinc-400 leading-none mt-0.5">
                  Your writing companion & app guide
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleClearHistory}
                title="Clear conversation"
                className="w-9 h-9 sm:w-7 sm:h-7 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] flex items-center justify-center transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Minimize Copilot"
                className="hidden sm:flex w-7 h-7 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] items-center justify-center transition-colors cursor-pointer"
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Close"
                className="w-9 h-9 sm:w-7 sm:h-7 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              </button>
            </div>
          </div>

          {/* Mode Switcher & Entry Context Banner */}
          <div className="px-3.5 py-2 border-b border-white/[0.06] bg-black/20 flex items-center justify-between text-[11px] shrink-0">
            <div className="flex items-center gap-1 bg-white/[0.04] p-0.5 rounded-lg border border-white/[0.04]">
              <button
                type="button"
                onClick={() => setCopilotMode('companion')}
                className={`px-2.5 py-1 sm:px-2 sm:py-1 rounded-md transition-all cursor-pointer ${
                  copilotMode === 'companion'
                    ? 'bg-white/15 text-white shadow-sm font-medium'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span className="flex items-center gap-1">
                  <BookOpen className="w-3 h-3" />
                  Companion
                </span>
              </button>
              <button
                type="button"
                onClick={() => setCopilotMode('guide')}
                className={`px-2.5 py-1 sm:px-2 sm:py-1 rounded-md transition-all cursor-pointer ${
                  copilotMode === 'guide'
                    ? 'bg-white/15 text-white shadow-sm font-medium'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span className="flex items-center gap-1">
                  <HelpCircle className="w-3 h-3" />
                  App Guide
                </span>
              </button>
            </div>

            <div className="text-[10.5px] text-zinc-400 truncate max-w-[150px] sm:max-w-[170px]" title={currentEntry?.title || currentView}>
              {currentView === 'landscape' ? (
                <span>Landscape View</span>
              ) : currentView === 'tapes' ? (
                <span>Temporal Tapes</span>
              ) : currentEntry?.title ? (
                <span className="text-zinc-300">"{currentEntry.title}"</span>
              ) : (
                <span>Writing Draft</span>
              )}
            </div>
          </div>

          {/* Quick Actions Scrollable Bar */}
          <div className="px-3 py-2 border-b border-white/[0.04] flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.id}
                type="button"
                disabled={isLoading}
                onClick={() => handleSendMessage(action.prompt)}
                className="shrink-0 px-3 py-1.5 sm:px-2.5 sm:py-1 rounded-full text-[11px] sm:text-[10.5px] bg-white/[0.04] hover:bg-white/[0.09] active:bg-white/[0.12] text-zinc-300 hover:text-white border border-white/[0.06] transition-colors whitespace-nowrap cursor-pointer disabled:opacity-40"
              >
                {action.label}
              </button>
            ))}
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin scrollbar-thumb-white/10 scroll-touch">
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[90%] sm:max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                      isUser
                        ? 'bg-zinc-100 text-zinc-950 font-normal rounded-tr-sm shadow-sm'
                        : 'bg-white/[0.06] border border-white/[0.08] text-zinc-200 rounded-tl-sm'
                    }`}
                  >
                    {isUser ? (
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    ) : (
                      <div className="prose prose-invert prose-xs max-w-none space-y-1.5">
                        <Markdown>{msg.content}</Markdown>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 px-1">
                    <span className="text-[9.5px] text-zinc-500">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {msg.isFallback && !isUser && (
                      <span className="text-[9px] text-amber-300/80 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 font-medium">
                        Offline Guide
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex items-center gap-2 text-xs text-zinc-400 pl-1 py-1">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-zinc-400" />
                <span>Reflecting on your request...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Box & Toolbar with Safe Area */}
          <div className="p-3 sm:p-3 pb-6 sm:pb-3 border-t border-white/[0.08] bg-black/20 relative shrink-0 safe-area-bottom">
            {/* Emoji Picker Popover */}
            <EmojiPicker
              isOpen={isEmojiPickerOpen}
              onClose={() => setIsEmojiPickerOpen(false)}
              onSelectEmoji={handleInsertEmoji}
              positionClassName="bottom-full mb-2 right-2"
            />

            <div className="flex items-end gap-1.5 bg-white/[0.04] border border-white/[0.08] focus-within:border-white/20 rounded-xl px-2.5 py-1.5 transition-colors">
              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  copilotMode === 'companion'
                    ? 'Ask to continue, summarize, suggest a title...'
                    : 'Ask about Temporal Tapes, Landscape, storage...'
                }
                rows={1}
                className="flex-1 bg-transparent text-sm sm:text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none resize-none max-h-24 py-1 leading-relaxed"
                style={{ height: 'auto', minHeight: '24px' }}
              />

              <div className="flex items-center gap-1 pb-0.5">
                <button
                  type="button"
                  onClick={() => setIsEmojiPickerOpen((prev) => !prev)}
                  title="Insert emoji"
                  className="w-8 h-8 sm:w-7 sm:h-7 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] flex items-center justify-center transition-colors cursor-pointer"
                >
                  <Smile className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => handleSendMessage(inputText)}
                  disabled={!inputText.trim() || isLoading}
                  title="Send message (Enter)"
                  className="w-8 h-8 sm:w-7 sm:h-7 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-all cursor-pointer shadow-sm"
                >
                  <Send className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px] text-zinc-500 mt-1.5 px-1">
              <span className="hidden sm:inline">Shift+Enter for newline</span>
              <span className="text-[9.5px]">Strict privacy • Scoped to your account</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
