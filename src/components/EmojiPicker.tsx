import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X, Smile, Heart, Coffee, Sun, Zap } from 'lucide-react';

interface EmojiCategory {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  emojis: Array<{ char: string; name: string; keywords: string[] }>;
}

const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: 'emotions',
    name: 'Smileys & Emotions',
    icon: Smile,
    emojis: [
      { char: '✨', name: 'sparkles', keywords: ['star', 'magic', 'shine', 'glow'] },
      { char: '💭', name: 'thought balloon', keywords: ['think', 'thought', 'dream'] },
      { char: '🌿', name: 'herb', keywords: ['nature', 'leaf', 'peace', 'growth'] },
      { char: '🌱', name: 'seedling', keywords: ['plant', 'grow', 'new', 'start'] },
      { char: '🌤️', name: 'sun behind small cloud', keywords: ['weather', 'sun', 'hope'] },
      { char: '🧘', name: 'person in lotus', keywords: ['meditate', 'zen', 'mindful', 'calm'] },
      { char: '🙂', name: 'slight smile', keywords: ['smile', 'happy', 'pleasant'] },
      { char: '😌', name: 'relieved', keywords: ['calm', 'peace', 'content', 'relief'] },
      { char: '😊', name: 'blushing smile', keywords: ['warm', 'joy', 'smile'] },
      { char: '🤔', name: 'thinking face', keywords: ['question', 'reflect', 'wonder', 'curious'] },
      { char: '🥹', name: 'face holding back tears', keywords: ['touched', 'gratitude', 'emotional'] },
      { char: '😭', name: 'loudly crying', keywords: ['sad', 'tears', 'crying', 'overwhelmed'] },
      { char: '😔', name: 'pensive face', keywords: ['sad', 'deep', 'thoughtful'] },
      { char: '😮‍💨', name: 'face exhaling', keywords: ['sigh', 'relief', 'breathe', 'tired'] },
      { char: '😴', name: 'sleeping face', keywords: ['tired', 'sleep', 'rest'] },
      { char: '🤯', name: 'exploding head', keywords: ['mindblown', 'breakthrough', 'shock'] },
      { char: '💡', name: 'light bulb', keywords: ['idea', 'insight', 'clarity'] },
      { char: '🔥', name: 'fire', keywords: ['passion', 'energy', 'momentum', 'streak'] },
    ],
  },
  {
    id: 'hearts',
    name: 'Care & Connection',
    icon: Heart,
    emojis: [
      { char: '🤍', name: 'white heart', keywords: ['pure', 'love', 'kind', 'peace'] },
      { char: '❤️', name: 'red heart', keywords: ['love', 'care', 'passion'] },
      { char: '🤎', name: 'brown heart', keywords: ['warmth', 'grounded', 'earth'] },
      { char: '💜', name: 'purple heart', keywords: ['deep', 'creative', 'spirit'] },
      { char: '🤝', name: 'handshake', keywords: ['friend', 'agreement', 'support'] },
      { char: '🫂', name: 'people hugging', keywords: ['hug', 'empathy', 'comfort'] },
      { char: '🙏', name: 'folded hands', keywords: ['gratitude', 'thankful', 'hope', 'prayer'] },
      { char: '🫶', name: 'heart hands', keywords: ['love', 'appreciation', 'support'] },
      { char: '✍️', name: 'writing hand', keywords: ['write', 'journal', 'pen', 'reflect'] },
      { char: '📖', name: 'open book', keywords: ['read', 'story', 'wisdom', 'pages'] },
      { char: '💌', name: 'love letter', keywords: ['note', 'message', 'reflection'] },
    ],
  },
  {
    id: 'daily',
    name: 'Work & Daily Life',
    icon: Coffee,
    emojis: [
      { char: '☕', name: 'coffee', keywords: ['morning', 'focus', 'warm', 'break'] },
      { char: '🍵', name: 'matcha tea', keywords: ['tea', 'calm', 'rest', 'mindful'] },
      { char: '💻', name: 'laptop', keywords: ['code', 'work', 'build', 'study'] },
      { char: '🎯', name: 'direct hit', keywords: ['target', 'goal', 'focus', 'accuracy'] },
      { char: '⏳', name: 'hourglass', keywords: ['time', 'patience', 'wait', 'flow'] },
      { char: '🚶', name: 'person walking', keywords: ['walk', 'stroll', 'movement', 'fresh air'] },
      { char: '🏃', name: 'person running', keywords: ['run', 'exercise', 'stamina', 'health'] },
      { char: '🏆', name: 'trophy', keywords: ['win', 'achievement', 'pride', 'milestone'] },
      { char: '🛠️', name: 'hammer and wrench', keywords: ['fix', 'repair', 'problem', 'solve'] },
    ],
  },
  {
    id: 'nature',
    name: 'Nature & Atmosphere',
    icon: Sun,
    emojis: [
      { char: '🌅', name: 'sunrise', keywords: ['morning', 'new day', 'fresh', 'horizon'] },
      { char: '🌙', name: 'crescent moon', keywords: ['night', 'sleep', 'evening', 'quiet'] },
      { char: '⭐', name: 'star', keywords: ['shining', 'bright', 'clarity'] },
      { char: '🌊', name: 'water wave', keywords: ['ocean', 'tide', 'flow', 'deep'] },
      { char: '🍂', name: 'fallen leaf', keywords: ['autumn', 'change', 'transition'] },
      { char: '🌸', name: 'cherry blossom', keywords: ['flower', 'spring', 'delicate'] },
      { char: '🌧️', name: 'cloud with rain', keywords: ['rain', 'melancholy', 'storm'] },
      { char: '🌈', name: 'rainbow', keywords: ['hope', 'optimism', 'colors'] },
    ],
  },
  {
    id: 'symbols',
    name: 'Focus & Marks',
    icon: Zap,
    emojis: [
      { char: '⚡', name: 'high voltage', keywords: ['energy', 'quick', 'electric'] },
      { char: '🛡️', name: 'shield', keywords: ['boundary', 'protect', 'safe'] },
      { char: '🔑', name: 'key', keywords: ['unlock', 'solution', 'discovery'] },
      { char: '🧭', name: 'compass', keywords: ['direction', 'values', 'navigation'] },
      { char: '⚖️', name: 'balance scale', keywords: ['balance', 'fairness', 'decision'] },
      { char: '📌', name: 'pushpin', keywords: ['pinned', 'important', 'remember'] },
      { char: '🏷️', name: 'label', keywords: ['tag', 'theme', 'mark'] },
      { char: '✦', name: 'four point star', keywords: ['sparkle', 'gemini', 'symbol'] },
    ],
  },
];

interface EmojiPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
  positionClassName?: string;
}

export const EmojiPicker: React.FC<EmojiPickerProps> = ({
  isOpen,
  onClose,
  onSelectEmoji,
  positionClassName = 'bottom-full mb-2 left-0',
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('emotions');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  // Click outside listener
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const filteredEmojis = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      const cat = EMOJI_CATEGORIES.find((c) => c.id === activeCategory);
      return cat ? cat.emojis : [];
    }

    const matched: Array<{ char: string; name: string; keywords: string[] }> = [];
    for (const cat of EMOJI_CATEGORIES) {
      for (const item of cat.emojis) {
        if (
          item.name.toLowerCase().includes(q) ||
          item.keywords.some((k) => k.includes(q))
        ) {
          matched.push(item);
        }
      }
    }
    return matched;
  }, [activeCategory, searchQuery]);

  if (!isOpen) return null;

  return (
    <>
      {/* Mobile Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 sm:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Picker Container: Mobile Bottom Sheet / Desktop Popover */}
      <div
        ref={popoverRef}
        id="emoji-picker-popover"
        className={`fixed inset-x-0 bottom-0 z-50 max-h-[70vh] rounded-t-[24px] bg-[#1c1c1f]/98 border-t border-[rgba(255,255,255,0.12)] shadow-2xl backdrop-blur-2xl p-4 flex flex-col gap-3 text-white animate-in slide-in-from-bottom-4 duration-200 sm:animate-in sm:fade-in sm:zoom-in-95 sm:duration-150 sm:fixed-none sm:absolute sm:inset-auto ${positionClassName} sm:max-h-none sm:w-72 sm:rounded-2xl sm:border sm:p-3 sm:gap-2.5`}
      >
        {/* Mobile Drag Handle & Header */}
        <div className="flex sm:hidden items-center justify-between pb-1 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Smile className="w-4 h-4 text-[#0a84ff]" />
            <span className="text-[13px] font-medium text-zinc-200">Select Expression</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white"
            aria-label="Close emoji picker"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Header */}
        <div className="flex items-center gap-1.5 px-3 py-2 sm:px-2.5 sm:py-1.5 rounded-xl bg-white/[0.05] border border-white/[0.06] focus-within:border-white/20 transition-colors">
          <Search className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-zinc-400 shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search expressions, thoughts..."
            className="w-full bg-transparent text-sm sm:text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="p-1 sm:p-0.5 rounded text-zinc-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
            </button>
          )}
        </div>

        {/* Category Tabs (hidden during search) */}
        {!searchQuery && (
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-2 px-1">
            {EMOJI_CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  title={cat.name}
                  className={`p-2 sm:p-1.5 rounded-xl sm:rounded-lg transition-all ${
                    isActive
                      ? 'bg-white/15 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05]'
                  }`}
                >
                  <Icon className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                </button>
              );
            })}
          </div>
        )}

        {/* Grid of Emojis */}
        <div className="grid grid-cols-6 sm:grid-cols-6 gap-1.5 sm:gap-1 max-h-56 sm:max-h-48 overflow-y-auto pr-0.5 scrollbar-thin scrollbar-thumb-white/10">
          {filteredEmojis.length > 0 ? (
            filteredEmojis.map((emoji, index) => (
              <button
                key={`${emoji.char}-${index}`}
                type="button"
                onClick={() => {
                  onSelectEmoji(emoji.char);
                  onClose();
                }}
                title={emoji.name}
                className="w-11 h-11 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl text-xl sm:text-lg hover:bg-white/10 hover:scale-110 active:scale-95 transition-all cursor-pointer"
              >
                {emoji.char}
              </button>
            ))
          ) : (
            <div className="col-span-6 py-6 text-center text-xs text-zinc-500">
              No matching emojis found.
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="pt-2 sm:pt-1.5 border-t border-white/[0.04] text-[11px] sm:text-[10px] text-zinc-500 text-center flex items-center justify-between px-1">
          <span>Tap to insert at cursor</span>
          <kbd className="hidden sm:inline-block px-1 py-0.5 rounded bg-white/[0.06] text-zinc-400 font-mono text-[9px]">Esc</kbd>
        </div>
      </div>
    </>
  );
};
