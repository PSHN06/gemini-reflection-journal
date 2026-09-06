import React, { useState, useEffect, useRef } from 'react';
import { 
  auth, 
  loginWithGoogle, 
  logoutUser, 
  onAuthStateChanged,
  User 
} from './firebase';
import { 
  subscribeToUserEntries, 
  saveJournalEntry, 
  deleteJournalEntry 
} from './services/journalService';
import { JournalEntry, AuthUserProfile } from './types';
import { Navbar } from './components/Navbar';
import { LandingPage } from './components/LandingPage';
import { Sidebar } from './components/Sidebar';
import { EntryEditor } from './components/EntryEditor';
import { SecurityModal } from './components/SecurityModal';
import { TemporalTapesView } from './components/TemporalTapesView';
import { EmotionalLandscapeView } from './components/landscape/EmotionalLandscapeView';
import { AiCopilot } from './components/AiCopilot';
import { BENCHMARK_ENTRIES } from './data/benchmarkEntries';
import { Menu, X, Sparkles, AlertCircle, CheckCircle2, Compass, RefreshCw } from 'lucide-react';
import { formatJournalDate } from './utils/journalFormatters';

const STORAGE_KEY_ACTIVE_ENTRY = 'gemini_reflection_active_entry_id';
const STORAGE_KEY_ACTIVE_TAB = 'gemini_reflection_active_tab';

export default function App() {
  const [user, setUser] = useState<AuthUserProfile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const [currentTab, setCurrentTab] = useState<'journal' | 'landscape' | 'tapes'>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ACTIVE_TAB);
      if (saved === 'tapes' || saved === 'landscape') return saved;
      return 'journal';
    } catch {
      return 'journal';
    }
  });

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [activeEntry, setActiveEntry] = useState<JournalEntry | null>(null);
  const [isEntriesLoading, setIsEntriesLoading] = useState(false);
  const [isCreatingEntry, setIsCreatingEntry] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [lastSaveError, setLastSaveError] = useState<string | null>(null);

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'error' } | null>(null);

  const toastTimerRef = useRef<any>(null);

  const showToast = (message: string, type: 'info' | 'error' = 'info') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Sync tab changes to localStorage
  const handleSelectTab = (tab: 'journal' | 'landscape' | 'tapes') => {
    setCurrentTab(tab);
    try {
      localStorage.setItem(STORAGE_KEY_ACTIVE_TAB, tab);
    } catch {
      // Ignore storage errors in restricted contexts
    }
  };

  // Monitor Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: User | null) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
        });
      } else {
        setUser(null);
        setEntries([]);
        setActiveEntry(null);
      }
      setIsAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Subscribe to Firestore entries once user is authenticated
  useEffect(() => {
    if (!user?.uid) return;

    setIsEntriesLoading(true);
    const unsubscribe = subscribeToUserEntries(
      user.uid,
      (fetchedEntries) => {
        setEntries(fetchedEntries);
        setIsEntriesLoading(false);

        // Preserve active entry from memory or localStorage across reloads
        setActiveEntry((prev) => {
          let targetId = prev?.id;
          if (!targetId) {
            try {
              targetId = localStorage.getItem(STORAGE_KEY_ACTIVE_ENTRY) || undefined;
            } catch {
              // Ignore
            }
          }

          if (targetId) {
            const found = fetchedEntries.find((e) => e.id === targetId);
            if (found) return found;
          }

          // Fallback to most recent entry if available
          return fetchedEntries.length > 0 ? fetchedEntries[0] : null;
        });
      },
      (error) => {
        console.error('Failed to load user entries from Firestore:', error);
        setIsEntriesLoading(false);
        showToast('Failed to sync entries with Firestore.', 'error');
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  // Auth Handlers
  const handleSignIn = async () => {
    setAuthError(null);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error('Sign in failed:', err);
      let msg = err.message || 'Failed to sign in with Google.';
      if (err.code === 'auth/popup-closed-by-user') {
        const host = typeof window !== 'undefined' ? window.location.hostname : '';
        msg = `Authentication popup was closed. If it showed "The requested action is invalid", ensure '${host}' is added to Firebase Console → Authentication → Settings → Authorized domains.`;
      }
      setAuthError(msg);
      throw err;
    }
  };

  const handleExploreDemo = () => {
    setUser({
      uid: 'demo-user',
      email: 'explorer@reflections.internal',
      displayName: 'Guest Explorer',
      photoURL: null,
    });
    setEntries(BENCHMARK_ENTRIES);
    setActiveEntry(BENCHMARK_ENTRIES[0]);
    handleSelectTab('landscape');
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      try {
        localStorage.removeItem(STORAGE_KEY_ACTIVE_ENTRY);
      } catch {
        // Ignore
      }
    } catch (err: any) {
      console.error('Sign out error:', err);
    }
  };

  // Create New Reflection Entry with duplicate guard & empty check
  const handleCreateNewEntry = async () => {
    if (!user || isCreatingEntry) return;

    // Check if the current active entry is already blank and unsaved/unused
    if (
      activeEntry &&
      (!activeEntry.content || !activeEntry.content.trim()) &&
      (!activeEntry.messages || activeEntry.messages.length === 0) &&
      (!activeEntry.summary || !activeEntry.summary.trim())
    ) {
      setCurrentTab('journal');
      setIsMobileSidebarOpen(false);
      return;
    }

    setIsCreatingEntry(true);
    const newEntryId = 'entry-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    const newEntry: JournalEntry = {
      id: newEntryId,
      userId: user.uid,
      title: 'New Reflection',
      isCustomTitle: false,
      content: '',
      mode: 'reflection',
      tags: [],
      messages: [],
      summary: '',
      lastGeminiModel: 'gemini-3.5-flash',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Update UI immediately
    setActiveEntry(newEntry);
    setEntries((prev) => [newEntry, ...prev]);
    setCurrentTab('journal');
    setIsMobileSidebarOpen(false);

    try {
      localStorage.setItem(STORAGE_KEY_ACTIVE_ENTRY, newEntryId);
    } catch {
      // Ignore
    }

    try {
      setSaveStatus('saving');
      await saveJournalEntry(user.uid, newEntry);
      setSaveStatus('saved');
    } catch (err: any) {
      console.error('Failed to save new entry:', err);
      setSaveStatus('error');
      setLastSaveError(err.message || 'Error saving new entry');
      showToast('Could not persist new entry to Firestore: ' + (err.message || 'Network error'), 'error');
    } finally {
      setIsCreatingEntry(false);
    }
  };

  // Save / Update active entry
  const handleSaveEntry = async (updatedEntry: JournalEntry) => {
    if (!user) return;
    setSaveStatus('saving');
    setLastSaveError(null);

    try {
      await saveJournalEntry(user.uid, updatedEntry);
      // Guard against race conditions when switching entries
      setActiveEntry((current) => (current?.id === updatedEntry.id ? updatedEntry : current));
      setEntries((prev) => prev.map((e) => (e.id === updatedEntry.id ? updatedEntry : e)));
      setSaveStatus('saved');
      try {
        localStorage.setItem(STORAGE_KEY_ACTIVE_ENTRY, updatedEntry.id);
      } catch {
        // Ignore
      }
    } catch (err: any) {
      console.error('Failed to persist entry update:', err);
      setSaveStatus('error');
      setLastSaveError(err.message || 'Failed to update Firestore');
      showToast('Save failed: ' + (err.message || 'Firestore error'), 'error');
    }
  };

  // Delete entry with optimistic UI sync and toast notification
  const handleDeleteEntry = async (entryId: string) => {
    if (!user) return;
    try {
      await deleteJournalEntry(user.uid, entryId);
      
      const remaining = entries.filter((e) => e.id !== entryId);
      setEntries(remaining);

      if (activeEntry?.id === entryId) {
        const nextActive = remaining.length > 0 ? remaining[0] : null;
        setActiveEntry(nextActive);
        try {
          if (nextActive) {
            localStorage.setItem(STORAGE_KEY_ACTIVE_ENTRY, nextActive.id);
          } else {
            localStorage.removeItem(STORAGE_KEY_ACTIVE_ENTRY);
          }
        } catch {
          // Ignore
        }
      }
      showToast('Reflection permanently deleted.');
    } catch (err: any) {
      console.error('Failed to delete entry:', err);
      showToast('Failed to delete reflection: ' + (err.message || 'Unknown error'), 'error');
      throw err;
    }
  };

  // Loading Screen
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#121214] flex flex-col items-center justify-center text-[#f5f5f7]">
        <div className="w-10 h-10 rounded-[12px] bg-[#1c1c20] border border-[rgba(255,255,255,0.08)] text-[#f5f5f7] flex items-center justify-center animate-pulse mb-3">
          <Sparkles className="w-5 h-5 text-[#86868b]" />
        </div>
        <p className="text-[13px] text-[#86868b]">Loading Reflections...</p>
      </div>
    );
  }

  // Unauthenticated: Show Landing Page
  if (!user) {
    return (
      <div className="min-h-screen bg-[#121214] flex flex-col font-sans text-[#f5f5f7]">
        <Navbar
          user={null}
          currentTab="journal"
          onSelectTab={() => {}}
          onNavigateHome={() => {}}
          onNewEntry={() => {}}
          onLogout={() => {}}
          onOpenSecurityModal={() => setIsSecurityModalOpen(true)}
          entriesCount={0}
        />
        <LandingPage
          onSignIn={handleSignIn}
          onExploreDemo={handleExploreDemo}
          isLoading={isAuthLoading}
          authError={authError}
          onOpenSecurityModal={() => setIsSecurityModalOpen(true)}
        />
        <SecurityModal
          isOpen={isSecurityModalOpen}
          onClose={() => setIsSecurityModalOpen(false)}
        />
      </div>
    );
  }

  // Authenticated: Show Full Reflection Dashboard
  return (
    <div className="h-screen max-h-screen bg-[#121214] flex flex-col font-sans text-[#f5f5f7] overflow-hidden">
      {/* Top Navigation */}
      <Navbar
        user={user}
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        onNavigateHome={() => handleSelectTab('journal')}
        onNewEntry={handleCreateNewEntry}
        onLogout={handleLogout}
        onOpenSecurityModal={() => setIsSecurityModalOpen(true)}
        onOpenMobileEntries={() => setIsMobileSidebarOpen(true)}
        entriesCount={entries.length}
      />

      {/* Main Workspace */}
      {currentTab === 'tapes' ? (
        <TemporalTapesView userId={user.uid} />
      ) : currentTab === 'landscape' ? (
        <div className="flex-1 w-full h-full min-h-0 relative overflow-hidden flex flex-col">
          {isEntriesLoading ? (
            <div className="flex-1 h-full flex items-center justify-center text-[#86868b] text-[13px] bg-[#121214]">
              <RefreshCw className="w-5 h-5 animate-spin mr-2.5 text-[#0a84ff]" />
              <span>Loading reflections...</span>
            </div>
          ) : (
            <EmotionalLandscapeView
              entry={activeEntry || (entries.length > 0 ? entries[0] : null)}
              entries={entries.length > 0 ? entries : BENCHMARK_ENTRIES}
              onSelectEntry={(selected) => setActiveEntry(selected)}
              onReturnToJournal={() => handleSelectTab('journal')}
            />
          )}
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden relative">
          {/* Mobile Sidebar Toggle Button */}
          <div className="md:hidden absolute bottom-5 left-5 z-40">
            <button
              onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
              className="p-3 bg-[#f5f5f7] text-[#121214] rounded-full shadow-lg font-medium cursor-pointer btn-press"
              aria-label="Toggle sidebar"
            >
              {isMobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

          {/* Sidebar for Desktop & Mobile Overlay */}
          <div
            className={`fixed inset-y-0 left-0 z-30 transform md:relative md:translate-x-0 transition-transform duration-200 ease-in-out ${
              isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            <Sidebar
              entries={entries}
              activeEntryId={activeEntry?.id || null}
              onSelectEntry={(entry) => {
                setActiveEntry(entry);
                try {
                  localStorage.setItem(STORAGE_KEY_ACTIVE_ENTRY, entry.id);
                } catch {
                  // Ignore
                }
                setIsMobileSidebarOpen(false);
              }}
              onNewEntry={handleCreateNewEntry}
              onDeleteEntry={handleDeleteEntry}
              isLoading={isEntriesLoading}
              onNavigateToLandscape={() => {
                handleSelectTab('landscape');
                setIsMobileSidebarOpen(false);
              }}
              onNavigateToTapes={() => {
                handleSelectTab('tapes');
                setIsMobileSidebarOpen(false);
              }}
              onCloseMobileDrawer={() => setIsMobileSidebarOpen(false)}
            />
          </div>

          {/* Backdrop for Mobile Sidebar */}
          {isMobileSidebarOpen && (
            <div
              onClick={() => setIsMobileSidebarOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 md:hidden"
            />
          )}

          {/* Active Entry Editor or Empty State */}
          <main className="flex-1 flex flex-col overflow-hidden">
            {activeEntry ? (
              <EntryEditor
                key={activeEntry.id}
                entry={activeEntry}
                userId={user.uid}
                onSaveEntry={handleSaveEntry}
                onDeleteEntry={handleDeleteEntry}
                onOpenLandscape={() => handleSelectTab('landscape')}
                onOpenEntriesDrawer={() => setIsMobileSidebarOpen(true)}
                onOpenCopilot={() => window.dispatchEvent(new CustomEvent('open-ai-copilot'))}
                saveStatus={saveStatus}
                lastSaveError={lastSaveError}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#121214]">
                <div className="w-12 h-12 rounded-[14px] bg-[#18181c] border border-[rgba(255,255,255,0.08)] text-[#86868b] flex items-center justify-center mb-3">
                  <Sparkles className="w-5 h-5 text-[#86868b]" />
                </div>
                <h2 className="text-[18px] font-semibold text-[#f5f5f7]">
                  No Entry Selected
                </h2>
                <p className="mt-1 text-[13.5px] text-[#86868b] max-w-sm leading-relaxed">
                  Choose a reflection from the sidebar or begin a new one.
                </p>
                <button
                  id="empty-state-new-entry-btn"
                  onClick={handleCreateNewEntry}
                  disabled={isCreatingEntry}
                  className="mt-5 h-8 px-4 bg-[#f5f5f7] hover:bg-[#e5e5ea] text-[#121214] font-medium text-[13px] rounded-[8px] transition-colors cursor-pointer btn-press disabled:opacity-50 shadow-xs"
                >
                  {isCreatingEntry ? 'Creating...' : 'New Reflection'}
                </button>
              </div>
            )}
          </main>
        </div>
      )}

      {/* Security Details Modal */}
      <SecurityModal
        isOpen={isSecurityModalOpen}
        onClose={() => setIsSecurityModalOpen(false)}
        userId={user.uid}
      />

      {/* Persistent AI Copilot (Available across Journal, Landscape, and Tapes) */}
      <AiCopilot
        currentEntry={activeEntry}
        currentView={currentTab}
        onApplyTitle={(newTitle) => {
          if (activeEntry) {
            handleSaveEntry({
              ...activeEntry,
              title: newTitle,
              isCustomTitle: true,
              updatedAt: Date.now(),
            });
          }
        }}
      />

      {/* In-app Toast Banner */}
      {toast && (
        <div 
          className="fixed bottom-20 right-6 z-50 flex items-center space-x-2.5 px-4 py-2.5 bg-[#1c1c20] border border-[rgba(255,255,255,0.08)] rounded-[10px] shadow-2xl text-[13px] animate-modal-enter"
          role="status"
        >
          {toast.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-[#ff453a] shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-[#30d158] shrink-0" />
          )}
          <span className={toast.type === 'error' ? 'text-[#ff453a]' : 'text-[#f5f5f7]'}>
            {toast.message}
          </span>
          <button
            onClick={() => setToast(null)}
            className="text-[#86868b] hover:text-[#f5f5f7] p-1 ml-2 cursor-pointer text-xs"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
