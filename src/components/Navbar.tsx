import React from 'react';
import { AuthUserProfile } from '../types';
import { Sparkles, ShieldCheck, LogOut, Plus, BookOpen, Lock } from 'lucide-react';

interface NavbarProps {
  user: AuthUserProfile | null;
  currentTab: 'journal' | 'tapes';
  onSelectTab: (tab: 'journal' | 'tapes') => void;
  onNewEntry: () => void;
  onLogout: () => void;
  onOpenSecurityModal: () => void;
  entriesCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  currentTab,
  onSelectTab,
  onNewEntry,
  onLogout,
  onOpenSecurityModal,
  entriesCount,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand & Identity */}
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-400 flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0">
            <Sparkles className="w-4 h-4 text-slate-950 font-bold" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-sm sm:text-base tracking-tight font-['Outfit'] text-slate-100">
                Gemini Reflection
              </span>
              <span className="hidden md:inline-block px-2 py-0.5 text-[10px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20 rounded-full">
                Gemini 3.6 Flash
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden xl:block">
              Private AI reflections backed by Cloud Firestore
            </p>
          </div>
        </div>

        {/* Navigation Tabs (when authenticated) */}
        {user && (
          <nav className="flex items-center p-1 bg-slate-950/80 border border-slate-800 rounded-xl space-x-1" aria-label="Main Navigation">
            <button
              id="nav-journal-tab"
              onClick={() => onSelectTab('journal')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                currentTab === 'journal'
                  ? 'bg-slate-800 text-slate-100 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Journal</span>
            </button>
            <button
              id="nav-tapes-tab"
              onClick={() => onSelectTab('tapes')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                currentTab === 'tapes'
                  ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Temporal Tapes</span>
            </button>
          </nav>
        )}

        {/* Actions & Profile */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          <button
            id="security-info-btn"
            onClick={onOpenSecurityModal}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 text-xs font-medium text-emerald-400 bg-emerald-950/40 border border-emerald-800/60 rounded-lg hover:bg-emerald-900/40 transition-colors cursor-pointer"
            title="View Security & Isolation Model"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden lg:inline text-[11px]">User-Isolated</span>
          </button>

          {user && (
            <>
              {currentTab === 'journal' && (
                <button
                  id="new-reflection-btn"
                  onClick={onNewEntry}
                  className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 active:scale-95 transition-all rounded-lg shadow-sm shadow-amber-400/20 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">New Reflection</span>
                </button>
              )}

              <div className="h-5 w-px bg-slate-800 mx-0.5 hidden sm:block" />

              {/* User Avatar & Info */}
              <div className="flex items-center space-x-2 pl-0.5">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-slate-700 object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-medium text-slate-300">
                    {user.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}
                <div className="hidden 2xl:block text-left text-xs">
                  <div className="font-medium text-slate-200 truncate max-w-[120px]">
                    {user.displayName || 'Anonymous'}
                  </div>
                </div>

                <button
                  id="sign-out-btn"
                  onClick={onLogout}
                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
