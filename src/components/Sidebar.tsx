import React, { useState, useMemo } from 'react';
import { JournalEntry } from '../types';
import { 
  Search, 
  Plus, 
  Trash2, 
  BookOpen, 
  Lock,
  Compass,
  ChevronRight,
  X
} from 'lucide-react';
import { formatSidebarDate, formatJournalDateTime } from '../utils/journalFormatters';
import { DeleteConfirmModal } from './DeleteConfirmModal';

interface SidebarProps {
  entries: JournalEntry[];
  activeEntryId: string | null;
  onSelectEntry: (entry: JournalEntry) => void;
  onNewEntry: () => void;
  onDeleteEntry: (entryId: string) => Promise<void> | void;
  isLoading: boolean;
  onNavigateToLandscape?: () => void;
  onNavigateToTapes?: () => void;
  onCloseMobileDrawer?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  entries,
  activeEntryId,
  onSelectEntry,
  onNewEntry,
  onDeleteEntry,
  isLoading,
  onNavigateToLandscape,
  onNavigateToTapes,
  onCloseMobileDrawer,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [pendingDeleteEntry, setPendingDeleteEntry] = useState<JournalEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Extract all unique normalized tags
  const allTags = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((entry) => {
      (entry.tags || []).forEach((t) => {
        const clean = t.trim().replace(/^#/, '');
        if (clean) set.add(clean);
      });
    });
    return Array.from(set);
  }, [entries]);

  // Filter and sort entries deterministically
  const sortedFilteredEntries = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();

    const filtered = entries.filter((entry) => {
      const title = (entry.title || '').toLowerCase();
      const content = (entry.content || '').toLowerCase();
      const summary = (entry.summary || '').toLowerCase();
      const mood = (entry.mood || '').toLowerCase();
      const dateStr = formatJournalDateTime(entry.updatedAt || entry.createdAt).toLowerCase();

      const matchesSearch =
        !q ||
        title.includes(q) ||
        content.includes(q) ||
        summary.includes(q) ||
        mood.includes(q) ||
        dateStr.includes(q) ||
        (entry.messages || []).some((m) => (m.text || '').toLowerCase().includes(q)) ||
        (entry.tags || []).some((t) => t.toLowerCase().includes(q));

      const matchesTag =
        !selectedTag ||
        (entry.tags || []).some(
          (t) => t.trim().replace(/^#/, '').toLowerCase() === selectedTag.toLowerCase()
        );

      return matchesSearch && matchesTag;
    });

    // Sort by latest updatedAt (fallback to createdAt, then fallback to id)
    return filtered.sort((a, b) => {
      const timeA = a.updatedAt || a.createdAt || 0;
      const timeB = b.updatedAt || b.createdAt || 0;
      if (timeB !== timeA) return timeB - timeA;
      return b.id.localeCompare(a.id);
    });
  }, [entries, searchTerm, selectedTag]);

  const handleConfirmDelete = async () => {
    if (!pendingDeleteEntry) return;
    setIsDeleting(true);
    try {
      await onDeleteEntry(pendingDeleteEntry.id);
      setPendingDeleteEntry(null);
    } catch (err) {
      console.error('Failed to delete entry:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <aside className="w-full md:w-80 lg:w-[340px] bg-[#141417] border-r border-[rgba(255,255,255,0.06)] flex flex-col h-full shrink-0 select-none">
        {/* Sidebar Top: Calming Context Header & Search */}
        <div className="p-4 sm:p-4.5 border-b border-[rgba(255,255,255,0.06)] space-y-3.5">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-[17px] font-semibold text-[#f5f5f7] tracking-tight">
                  Reflections
                </h2>
                <span className="px-1.5 py-0.5 rounded-full bg-[#1c1c20] text-[11px] font-medium text-[#86868b] border border-[rgba(255,255,255,0.06)]">
                  {entries.length}
                </span>
              </div>
              <p className="text-[12px] text-[#86868b] mt-0.5">
                Your private thoughts & dialogues
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                id="sidebar-new-btn"
                onClick={onNewEntry}
                className="w-8 h-8 rounded-[8px] bg-[#1c1c20] hover:bg-[#242428] text-[#f5f5f7] border border-[rgba(255,255,255,0.08)] flex items-center justify-center cursor-pointer btn-press transition-colors shadow-xs"
                title="New reflection"
                aria-label="Create New Entry"
              >
                <Plus className="w-4 h-4 text-[#f5f5f7]" />
              </button>

              {onCloseMobileDrawer && (
                <button
                  onClick={onCloseMobileDrawer}
                  className="md:hidden w-8 h-8 rounded-[8px] bg-[#1c1c20] hover:bg-[#242428] text-zinc-400 hover:text-white border border-[rgba(255,255,255,0.08)] flex items-center justify-center cursor-pointer transition-colors"
                  title="Close sidebar"
                  aria-label="Close sidebar"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Integrated Search Bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#86868b] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="search-entries-input"
              type="text"
              placeholder="Search reflections, tags, dates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8.5 pr-7 py-1.5 bg-[#1c1c20] border border-[rgba(255,255,255,0.06)] focus:border-[#0a84ff]/60 rounded-[10px] text-[13px] text-[#f5f5f7] placeholder-[#636366] focus:outline-none transition-colors"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-[#86868b] hover:text-[#f5f5f7] cursor-pointer"
                title="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Minimal Tag Filter Pills */}
          {allTags.length > 0 && (
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-0.5 text-xs no-scrollbar">
              <button
                onClick={() => setSelectedTag(null)}
                className={`px-2.5 py-1 rounded-[6px] text-[11px] font-medium whitespace-nowrap cursor-pointer transition-colors ${
                  selectedTag === null
                    ? 'bg-[#2a2a30] text-[#f5f5f7]'
                    : 'bg-[#1c1c20] text-[#86868b] hover:text-[#f5f5f7]'
                }`}
              >
                All
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
                  className={`px-2.5 py-1 rounded-[6px] text-[11px] font-medium whitespace-nowrap cursor-pointer transition-colors ${
                    selectedTag === tag
                      ? 'bg-[#2a2a30] text-[#f5f5f7]'
                      : 'bg-[#1c1c20] text-[#86868b] hover:text-[#f5f5f7]'
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Editorial Feed / Notes List */}
        <div className="flex-1 overflow-y-auto p-2.5 sm:p-3 space-y-1">
          {isLoading && entries.length === 0 && (
            <div className="py-12 text-center text-[13px] text-[#86868b] animate-pulse">
              Loading reflections...
            </div>
          )}

          {!isLoading && entries.length === 0 && (
            <div className="py-12 px-4 text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-[#1c1c20] border border-[rgba(255,255,255,0.06)] flex items-center justify-center mx-auto text-[#86868b]">
                <BookOpen className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <p className="text-[14px] text-[#f5f5f7] font-medium">No reflections yet</p>
                <p className="text-[12px] text-[#86868b] leading-relaxed">Begin with a thought, a challenge, or a quiet moment.</p>
              </div>
              <button
                id="sidebar-empty-new-btn"
                onClick={onNewEntry}
                className="mt-1 px-3.5 py-1.5 text-[12px] font-medium bg-[#f5f5f7] hover:bg-[#e5e5ea] text-[#121214] rounded-[8px] transition-colors cursor-pointer btn-press"
              >
                + New reflection
              </button>
            </div>
          )}

          {!isLoading && entries.length > 0 && sortedFilteredEntries.length === 0 && (
            <div className="py-12 px-4 text-center space-y-3">
              <Search className="w-5 h-5 text-[#86868b] mx-auto opacity-50" />
              <div className="space-y-1">
                <p className="text-[13px] text-[#f5f5f7] font-medium">No matches found</p>
                <p className="text-[12px] text-[#86868b]">
                  No entries match &ldquo;{searchTerm}&rdquo;
                  {selectedTag ? ` with tag #${selectedTag}` : ''}.
                </p>
              </div>
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedTag(null);
                }}
                className="text-[12px] text-[#0a84ff] hover:underline cursor-pointer"
              >
                Clear filters
              </button>
            </div>
          )}

          {sortedFilteredEntries.map((entry) => {
            const isActive = entry.id === activeEntryId;
            const displayTitle = entry.title || 'Untitled Reflection';
            const previewText =
              entry.content ||
              entry.messages?.[0]?.text ||
              entry.summary ||
              '';

            return (
              <div
                key={entry.id}
                id={`sidebar-entry-${entry.id}`}
                onClick={() => onSelectEntry(entry)}
                className={`group relative p-3 rounded-[12px] transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#222226] border border-[rgba(255,255,255,0.1)] shadow-xs'
                    : 'bg-transparent hover:bg-[#1c1c20] border border-transparent'
                }`}
              >
                <div className="flex items-baseline justify-between gap-2 mb-1 pr-5">
                  <h3 
                    className={`text-[13.5px] font-medium truncate ${
                      isActive ? 'text-[#f5f5f7]' : 'text-[#e5e5e8]'
                    }`}
                    title={displayTitle}
                  >
                    {displayTitle}
                  </h3>
                  <span className="text-[11px] text-[#86868b] shrink-0 font-normal">
                    {formatSidebarDate(entry.updatedAt || entry.createdAt)}
                  </span>
                </div>

                {/* Preview snippet */}
                {previewText && (
                  <p className="text-[12.5px] text-[#86868b] line-clamp-2 leading-relaxed">
                    {previewText}
                  </p>
                )}

                {/* Tags preview if present */}
                {entry.tags && entry.tags.length > 0 && (
                  <div className="flex items-center space-x-1 mt-2 overflow-hidden">
                    {entry.tags.slice(0, 3).map((tag, idx) => (
                      <span
                        key={idx}
                        className="text-[10.5px] px-1.5 py-0.5 bg-[#121214] text-[#86868b] rounded-[4px] border border-[rgba(255,255,255,0.04)]"
                      >
                        #{tag}
                      </span>
                    ))}
                    {entry.tags.length > 3 && (
                      <span className="text-[10px] text-[#636366]">+{entry.tags.length - 3}</span>
                    )}
                  </div>
                )}

                {/* In-app Delete button */}
                <button
                  id={`delete-entry-btn-${entry.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPendingDeleteEntry(entry);
                  }}
                  className="opacity-70 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 absolute top-2.5 right-2 p-1.5 text-[#86868b] hover:text-[#ff453a] hover:bg-[#ff453a]/10 rounded-[6px] transition-all cursor-pointer"
                  title="Delete entry"
                  aria-label={`Delete ${displayTitle}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Navigation shortcuts in sidebar bottom */}
        {(onNavigateToLandscape || onNavigateToTapes) && (
          <div className="p-3 border-t border-[rgba(255,255,255,0.06)] space-y-1.5">
            {onNavigateToLandscape && (
              <button
                id="sidebar-landscape-shortcut-btn"
                onClick={onNavigateToLandscape}
                className="w-full h-9 flex items-center justify-between px-3 rounded-[8px] bg-[#1c1c20] hover:bg-[#242428] text-[12.5px] text-[#86868b] hover:text-[#f5f5f7] transition-colors cursor-pointer group btn-press border border-[rgba(255,255,255,0.04)]"
              >
                <div className="flex items-center space-x-2">
                  <Compass className="w-3.5 h-3.5 text-[#0a84ff]" />
                  <span className="font-medium">Emotional Landscape</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-[#636366] group-hover:text-[#86868b]" />
              </button>
            )}
            {onNavigateToTapes && (
              <button
                id="sidebar-tapes-shortcut-btn"
                onClick={onNavigateToTapes}
                className="w-full h-9 flex items-center justify-between px-3 rounded-[8px] bg-[#1c1c20] hover:bg-[#242428] text-[12.5px] text-[#86868b] hover:text-[#f5f5f7] transition-colors cursor-pointer group btn-press border border-[rgba(255,255,255,0.04)]"
              >
                <div className="flex items-center space-x-2">
                  <Lock className="w-3.5 h-3.5 text-[#e5a93c]" />
                  <span className="font-medium">Temporal Tapes</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-[#636366] group-hover:text-[#86868b]" />
              </button>
            )}
          </div>
        )}
      </aside>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={Boolean(pendingDeleteEntry)}
        title={pendingDeleteEntry?.title || ''}
        isDeleting={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDeleteEntry(null)}
      />
    </>
  );
};
