import React, { useState, useEffect } from 'react';
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
import { Menu, X, Sparkles, RefreshCw } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<AuthUserProfile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const [currentTab, setCurrentTab] = useState<'journal' | 'tapes'>('journal');
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [activeEntry, setActiveEntry] = useState<JournalEntry | null>(null);
  const [isEntriesLoading, setIsEntriesLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [lastSaveError, setLastSaveError] = useState<string | null>(null);

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);

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

        // If no active entry is selected, default to the most recent or create one
        setActiveEntry((prev) => {
          if (prev) {
            const updated = fetchedEntries.find((e) => e.id === prev.id);
            return updated || prev;
          }
          return fetchedEntries.length > 0 ? fetchedEntries[0] : null;
        });
      },
      (error) => {
        console.error('Failed to load user entries from Firestore:', error);
        setIsEntriesLoading(false);
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
      setAuthError(err.message || 'Failed to sign in with Google.');
      throw err;
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch (err: any) {
      console.error('Sign out error:', err);
    }
  };

  // Create New Reflection Entry
  const handleCreateNewEntry = async () => {
    if (!user) return;

    const newEntryId = 'entry-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    const newEntry: JournalEntry = {
      id: newEntryId,
      userId: user.uid,
      title: 'New Reflection ' + new Date().toLocaleDateString([], { month: 'short', day: 'numeric' }),
      content: '',
      mode: 'reflection',
      tags: [],
      messages: [],
      summary: '',
      lastGeminiModel: 'gemini-3.6-flash',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setActiveEntry(newEntry);
    setCurrentTab('journal');
    setIsMobileSidebarOpen(false);

    try {
      setSaveStatus('saving');
      await saveJournalEntry(user.uid, newEntry);
      setSaveStatus('saved');
    } catch (err: any) {
      console.error('Failed to save new entry:', err);
      setSaveStatus('error');
      setLastSaveError(err.message || 'Error saving new entry');
    }
  };

  // Save / Update active entry
  const handleSaveEntry = async (updatedEntry: JournalEntry) => {
    if (!user) return;
    setSaveStatus('saving');
    setLastSaveError(null);

    try {
      await saveJournalEntry(user.uid, updatedEntry);
      setActiveEntry(updatedEntry);
      setSaveStatus('saved');
    } catch (err: any) {
      console.error('Failed to persist entry update:', err);
      setSaveStatus('error');
      setLastSaveError(err.message || 'Failed to update Firestore');
    }
  };

  // Delete entry
  const handleDeleteEntry = async (entryId: string) => {
    if (!user) return;
    try {
      await deleteJournalEntry(user.uid, entryId);
      if (activeEntry?.id === entryId) {
        const remaining = entries.filter((e) => e.id !== entryId);
        setActiveEntry(remaining.length > 0 ? remaining[0] : null);
      }
    } catch (err: any) {
      console.error('Failed to delete entry:', err);
      alert('Failed to delete reflection from Firestore.');
    }
  };

  // Loading Screen
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-400 text-slate-950 flex items-center justify-center animate-pulse mb-4">
          <Sparkles className="w-6 h-6" />
        </div>
        <p className="text-sm font-medium">Initializing Reflection Journal...</p>
      </div>
    );
  }

  // Unauthenticated: Show Landing Page
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col font-sans text-slate-100">
        <Navbar
          user={null}
          currentTab="journal"
          onSelectTab={() => {}}
          onNewEntry={() => {}}
          onLogout={() => {}}
          onOpenSecurityModal={() => setIsSecurityModalOpen(true)}
          entriesCount={0}
        />
        <LandingPage
          onSignIn={handleSignIn}
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
    <div className="min-h-screen bg-slate-950 flex flex-col font-sans text-slate-100 overflow-hidden">
      {/* Top Navigation */}
      <Navbar
        user={user}
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onNewEntry={handleCreateNewEntry}
        onLogout={handleLogout}
        onOpenSecurityModal={() => setIsSecurityModalOpen(true)}
        entriesCount={entries.length}
      />

      {/* Main Workspace */}
      {currentTab === 'tapes' ? (
        <TemporalTapesView userId={user.uid} />
      ) : (
        <div className="flex-1 flex overflow-hidden relative">
          {/* Mobile Sidebar Toggle Button */}
          <div className="md:hidden absolute bottom-4 left-4 z-40">
            <button
              onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
              className="p-3 bg-amber-400 text-slate-950 rounded-full shadow-lg font-bold cursor-pointer"
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
                setIsMobileSidebarOpen(false);
              }}
              onNewEntry={handleCreateNewEntry}
              onDeleteEntry={handleDeleteEntry}
              isLoading={isEntriesLoading}
            />
          </div>

          {/* Backdrop for Mobile Sidebar */}
          {isMobileSidebarOpen && (
            <div
              onClick={() => setIsMobileSidebarOpen(false)}
              className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-20 md:hidden"
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
                saveStatus={saveStatus}
                lastSaveError={lastSaveError}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-950">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-4">
                  <Sparkles className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-bold text-slate-100 font-['Outfit']">
                  Welcome to your Reflection Journal
                </h2>
                <p className="mt-2 text-sm text-slate-400 max-w-md">
                  All your multi-turn entries and Gemini dialogues are persisted securely in your isolated Cloud Firestore collection.
                </p>
                <button
                  id="empty-state-new-entry-btn"
                  onClick={handleCreateNewEntry}
                  className="mt-6 px-6 py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-sm rounded-xl shadow-lg shadow-amber-400/20 active:scale-95 transition-all cursor-pointer"
                >
                  + Create First Reflection
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
    </div>
  );
}
