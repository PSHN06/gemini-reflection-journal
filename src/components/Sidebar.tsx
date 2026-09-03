import React, { useState } from 'react';
import { JournalEntry, ReflectionMode } from '../types';
import { 
  Search, 
  Plus, 
  Trash2, 
  Clock, 
  Sparkles, 
  MessageSquare, 
  Lightbulb, 
  FileText, 
  HelpCircle,
  Tag,
  ChevronRight
} from 'lucide-react';

interface SidebarProps {
  entries: JournalEntry[];
  activeEntryId: string | null;
  onSelectEntry: (entry: JournalEntry) => void;
  onNewEntry: () => void;
  onDeleteEntry: (entryId: string) => void;
  isLoading: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  entries,
  activeEntryId,
  onSelectEntry,
  onNewEntry,
  onDeleteEntry,
  isLoading,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Extract all unique tags
  const allTags = Array.from(
    new Set(entries.flatMap((entry) => entry.tags || []))
  ).filter(Boolean);

  // Filter entries based on search and tag
  const filteredEntries = entries.filter((entry) => {
    const matchesSearch =
      searchTerm.trim() === '' ||
      entry.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (entry.summary && entry.summary.toLowerCase().includes(searchTerm.toLowerCase())) ||
      entry.messages.some((m) => m.text.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesTag = !selectedTag || (entry.tags && entry.tags.includes(selectedTag));

    return matchesSearch && matchesTag;
  });

  const getModeIcon = (mode: ReflectionMode) => {
    switch (mode) {
      case 'brainstorm':
        return <Lightbulb className="w-3.5 h-3.5 text-amber-400" />;
      case 'summary':
        return <FileText className="w-3.5 h-3.5 text-emerald-400" />;
      case 'socratic':
        return <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />;
      case 'reflection':
      default:
        return <Sparkles className="w-3.5 h-3.5 text-purple-400" />;
    }
  };

  const formatDate = (timestamp: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <aside className="w-full md:w-80 lg:w-96 bg-slate-900/70 border-r border-slate-800 flex flex-col h-full shrink-0">
      {/* Sidebar Header & Search */}
      <div className="p-4 border-b border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider font-['Outfit']">
              Past Reflections
            </h2>
            <span className="px-2 py-0.5 text-xs bg-slate-800 text-slate-400 rounded-full font-mono">
              {entries.length}
            </span>
          </div>
          <button
            id="sidebar-new-btn"
            onClick={onNewEntry}
            className="p-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-lg transition-colors cursor-pointer"
            title="Create New Reflection"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="search-entries-input"
            type="text"
            placeholder="Search entries, keywords, tags..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400/60 transition-colors"
          />
        </div>

        {/* Tag Filters */}
        {allTags.length > 0 && (
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs">
            <button
              onClick={() => setSelectedTag(null)}
              className={`px-2 py-0.5 rounded-md text-[11px] whitespace-nowrap cursor-pointer transition-colors ${
                selectedTag === null
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              All
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
                className={`px-2 py-0.5 rounded-md text-[11px] whitespace-nowrap cursor-pointer transition-colors ${
                  selectedTag === tag
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Entries List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isLoading && (
          <div className="p-4 text-center text-xs text-slate-500 animate-pulse">
            Loading reflections from Firestore...
          </div>
        )}

        {!isLoading && filteredEntries.length === 0 && (
          <div className="p-8 text-center">
            <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-xs text-slate-400 font-medium">No reflections found</p>
            <p className="text-[11px] text-slate-500 mt-1">
              {searchTerm ? 'Try a different search query' : 'Start your first reflection now!'}
            </p>
            <button
              onClick={onNewEntry}
              className="mt-3 px-3 py-1.5 text-xs font-medium text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-lg transition-colors cursor-pointer"
            >
              + Create Reflection
            </button>
          </div>
        )}

        {filteredEntries.map((entry) => {
          const isActive = entry.id === activeEntryId;
          const msgCount = entry.messages ? entry.messages.length : 0;

          return (
            <div
              key={entry.id}
              onClick={() => onSelectEntry(entry)}
              className={`group relative p-3 rounded-xl border transition-all cursor-pointer ${
                isActive
                  ? 'bg-slate-800/90 border-amber-500/40 shadow-sm shadow-amber-500/5'
                  : 'bg-slate-950/40 border-slate-800/80 hover:bg-slate-850 hover:border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center space-x-1.5 min-w-0">
                  <div className="p-1 rounded bg-slate-800 shrink-0">
                    {getModeIcon(entry.mode)}
                  </div>
                  <h3 className="text-xs font-semibold text-slate-200 truncate group-hover:text-amber-200 transition-colors">
                    {entry.title || 'Untitled Reflection'}
                  </h3>
                </div>

                <div className="flex items-center space-x-1 shrink-0">
                  <span className="text-[10px] text-slate-500 font-mono">
                    {formatDate(entry.updatedAt)}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete reflection "${entry.title}"?`)) {
                        onDeleteEntry(entry.id);
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 rounded transition-all cursor-pointer"
                    title="Delete entry"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Preview Content Snippet */}
              <p className="mt-1.5 text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                {entry.summary || entry.content || (entry.messages[0]?.text) || 'No reflection content yet.'}
              </p>

              {/* Metadata Badges */}
              <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-500">
                <div className="flex items-center space-x-2">
                  <span className="capitalize text-slate-400 flex items-center space-x-1">
                    <span>{entry.mode}</span>
                  </span>
                  {msgCount > 0 && (
                    <span className="flex items-center space-x-0.5 text-slate-400">
                      <MessageSquare className="w-3 h-3 text-slate-500" />
                      <span>{msgCount}</span>
                    </span>
                  )}
                </div>

                {entry.tags && entry.tags.length > 0 && (
                  <div className="flex items-center space-x-1 overflow-hidden max-w-[100px]">
                    <Tag className="w-2.5 h-2.5 text-slate-500 shrink-0" />
                    <span className="truncate text-slate-400">
                      {entry.tags.join(', ')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
};
