import React, { useState, useRef, useEffect } from 'react';
import { AuthUserProfile } from '../types';
import { 
  LogOut, 
  Plus, 
  BookOpen, 
  Lock, 
  ShieldCheck, 
  Compass, 
  Home, 
  MoreHorizontal, 
  X,
  FileText,
  User as UserIcon 
} from 'lucide-react';

interface NavbarProps {
  user: AuthUserProfile | null;
  currentTab: 'journal' | 'landscape' | 'tapes';
  onSelectTab: (tab: 'journal' | 'landscape' | 'tapes') => void;
  onNavigateHome: () => void;
  onNewEntry: () => void;
  onLogout: () => void;
  onOpenSecurityModal: () => void;
  onOpenMobileEntries?: () => void;
  entriesCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  currentTab,
  onSelectTab,
  onNavigateHome,
  onNewEntry,
  onLogout,
  onOpenSecurityModal,
  onOpenMobileEntries,
  entriesCount,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMobileMenuOpen]);

  // Section title mapping
  const sectionTitle = !user 
    ? 'Reflection' 
    : currentTab === 'journal' 
      ? 'Journal' 
      : currentTab === 'landscape' 
        ? 'Emotional Landscape' 
        : 'Temporal Tapes';

  return (
    <header className="sticky top-0 z-30 bg-[#121214]/95 backdrop-blur-md border-b border-[rgba(255,255,255,0.07)] text-[#f5f5f7]">
      {/* 1. DESKTOP NAVIGATION BAR (>= 768px) */}
      <div className="hidden md:flex max-w-7xl mx-auto px-6 h-14 items-center justify-between">
        {/* Brand */}
        <button
          onClick={onNavigateHome}
          className="flex items-center space-x-2.5 cursor-pointer group text-left"
          title="Return to Home"
        >
          <div className="w-7 h-7 rounded-[8px] bg-[#1c1c20] border border-[rgba(255,255,255,0.08)] flex items-center justify-center text-[#0a84ff] group-hover:border-[#0a84ff]/40 transition-colors">
            <BookOpen className="w-3.5 h-3.5" />
          </div>
          <span className="text-[17px] font-semibold tracking-tight text-[#f5f5f7]">
            Reflection
          </span>
        </button>

        {/* Segmented Control on Desktop */}
        {user && (
          <nav
            className="flex items-center bg-[#1c1c20] p-0.5 rounded-[10px] border border-[rgba(255,255,255,0.06)] space-x-0.5"
            aria-label="Main Navigation"
          >
            <button
              id="nav-journal-tab"
              onClick={() => onSelectTab('journal')}
              className={`h-8 px-3.5 rounded-[8px] text-[13px] font-medium transition-all flex items-center space-x-1.5 cursor-pointer btn-press ${
                currentTab === 'journal'
                  ? 'bg-[#2a2a30] text-[#f5f5f7] shadow-sm font-semibold'
                  : 'text-[#86868b] hover:text-[#f5f5f7] hover:bg-[#222226]/50'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Journal</span>
            </button>
            <button
              id="nav-landscape-tab"
              onClick={() => onSelectTab('landscape')}
              className={`h-8 px-3.5 rounded-[8px] text-[13px] font-medium transition-all flex items-center space-x-1.5 cursor-pointer btn-press ${
                currentTab === 'landscape'
                  ? 'bg-[#2a2a30] text-[#f5f5f7] shadow-sm font-semibold'
                  : 'text-[#86868b] hover:text-[#f5f5f7] hover:bg-[#222226]/50'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Emotional Landscape</span>
            </button>
            <button
              id="nav-tapes-tab"
              onClick={() => onSelectTab('tapes')}
              className={`h-8 px-3.5 rounded-[8px] text-[13px] font-medium transition-all flex items-center space-x-1.5 cursor-pointer btn-press ${
                currentTab === 'tapes'
                  ? 'bg-[#2a2a30] text-[#f5f5f7] shadow-sm font-semibold'
                  : 'text-[#86868b] hover:text-[#f5f5f7] hover:bg-[#222226]/50'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Temporal Tapes</span>
            </button>
          </nav>
        )}

        {/* Actions & Profile on Desktop */}
        <div className="flex items-center space-x-2.5">
          <button
            id="security-info-btn"
            onClick={onOpenSecurityModal}
            className="h-8 px-2.5 text-[12px] text-[#86868b] hover:text-[#f5f5f7] hover:bg-[#1c1c20] transition-colors rounded-[8px] flex items-center space-x-1.5 cursor-pointer btn-press border border-transparent hover:border-[rgba(255,255,255,0.06)]"
            title="Privacy & Security Details"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#30d158]" />
            <span className="font-normal">Private</span>
          </button>

          {user && (
            <>
              {currentTab === 'journal' && (
                <button
                  id="new-reflection-btn"
                  onClick={onNewEntry}
                  className="h-8 px-3 text-[13px] font-medium text-[#121214] bg-[#f5f5f7] hover:bg-[#e5e5ea] rounded-[8px] flex items-center space-x-1.5 transition-all cursor-pointer btn-press shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Entry</span>
                </button>
              )}

              {/* User Avatar & Logout */}
              <div className="flex items-center space-x-1.5 pl-1.5 border-l border-[rgba(255,255,255,0.08)]">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="w-7 h-7 rounded-full border border-[rgba(255,255,255,0.1)] object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-[#1c1c20] border border-[rgba(255,255,255,0.08)] flex items-center justify-center text-[12px] font-medium text-[#86868b]">
                    {user.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}

                <button
                  id="sign-out-btn"
                  onClick={onLogout}
                  className="w-7 h-7 text-[#86868b] hover:text-[#f5f5f7] hover:bg-[#1c1c20] rounded-[6px] transition-colors flex items-center justify-center cursor-pointer btn-press"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 2. MOBILE TOP BAR (< 768px) - Intentional Native App Shell */}
      <div className="md:hidden flex flex-col">
        {/* Top Header Row: [Home] ... [Section Title] ... [Action/More] */}
        <div className="h-14 px-3 sm:px-4 flex items-center justify-between relative border-b border-[rgba(255,255,255,0.05)]">
          {/* Left: Home Button (Apple HIG ~44px touch target) */}
          <button
            id="mobile-nav-home-btn"
            onClick={onNavigateHome}
            className="w-10 h-10 rounded-xl bg-[#1c1c20] active:bg-[#28282e] border border-[rgba(255,255,255,0.08)] flex items-center justify-center text-[#f5f5f7] transition-all cursor-pointer shadow-xs active:scale-95"
            aria-label="Navigate to Home"
            title="Home"
          >
            <Home className="w-4 h-4 text-[#0a84ff]" />
          </button>

          {/* Center: Current Section Title (Clear, non-duplicative, stable) */}
          <div className="flex-1 px-2 text-center overflow-hidden">
            <h1 className="text-[16px] font-semibold text-[#f5f5f7] tracking-tight truncate">
              {sectionTitle}
            </h1>
          </div>

          {/* Right: Actions / More Menu Button */}
          <div className="flex items-center space-x-1.5 relative">
            {user ? (
              <button
                id="mobile-nav-more-btn"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="w-10 h-10 rounded-xl bg-[#1c1c20] active:bg-[#28282e] border border-[rgba(255,255,255,0.08)] flex items-center justify-center text-[#f5f5f7] transition-all cursor-pointer shadow-xs active:scale-95 relative"
                aria-label="Open options menu"
                aria-expanded={isMobileMenuOpen}
              >
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Profile'}
                    className="w-5 h-5 rounded-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <MoreHorizontal className="w-4 h-4 text-[#86868b]" />
                )}
              </button>
            ) : (
              <button
                onClick={onOpenSecurityModal}
                className="w-10 h-10 rounded-xl bg-[#1c1c20] flex items-center justify-center text-[#30d158] border border-[rgba(255,255,255,0.08)]"
                title="Security info"
              >
                <ShieldCheck className="w-4 h-4" />
              </button>
            )}

            {/* Mobile Options Dropdown Sheet */}
            {isMobileMenuOpen && user && (
              <div
                ref={menuRef}
                className="absolute top-12 right-0 w-64 rounded-2xl bg-[#1c1c20]/98 border border-white/10 shadow-2xl backdrop-blur-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-1"
              >
                {/* User info snippet */}
                <div className="px-3 py-2 border-b border-white/[0.06] mb-1">
                  <p className="text-[13px] font-medium text-[#f5f5f7] truncate">
                    {user.displayName || 'Journal User'}
                  </p>
                  <p className="text-[11px] text-[#86868b] truncate">
                    {user.email || 'Authenticated'}
                  </p>
                </div>

                {/* New Reflection Quick Action */}
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onNewEntry();
                  }}
                  className="w-full h-10 px-3 rounded-xl hover:bg-white/[0.06] text-[13px] text-[#f5f5f7] flex items-center space-x-2.5 text-left cursor-pointer transition-colors"
                >
                  <Plus className="w-4 h-4 text-[#0a84ff]" />
                  <span>New Reflection</span>
                </button>

                {/* View Entries List */}
                {onOpenMobileEntries && (
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      onOpenMobileEntries();
                    }}
                    className="w-full h-10 px-3 rounded-xl hover:bg-white/[0.06] text-[13px] text-[#f5f5f7] flex items-center space-x-2.5 text-left cursor-pointer transition-colors"
                  >
                    <FileText className="w-4 h-4 text-[#86868b]" />
                    <span>Past Reflections ({entriesCount})</span>
                  </button>
                )}

                {/* Privacy & Security */}
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onOpenSecurityModal();
                  }}
                  className="w-full h-10 px-3 rounded-xl hover:bg-white/[0.06] text-[13px] text-[#f5f5f7] flex items-center space-x-2.5 text-left cursor-pointer transition-colors"
                >
                  <ShieldCheck className="w-4 h-4 text-[#30d158]" />
                  <span>Privacy & Security</span>
                </button>

                {/* Sign Out */}
                <div className="pt-1 border-t border-white/[0.06]">
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      onLogout();
                    }}
                    className="w-full h-10 px-3 rounded-xl hover:bg-red-500/10 text-[13px] text-[#ff453a] flex items-center space-x-2.5 text-left cursor-pointer transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile-First Segmented Navigation Control */}
        {user && (
          <nav 
            className="px-3 py-2 bg-[#121214]"
            aria-label="Mobile Navigation"
          >
            <div className="grid grid-cols-3 gap-1 bg-[#18181b] p-1 rounded-xl border border-white/[0.06]">
              {/* Tab 1: Journal */}
              <button
                id="mobile-nav-journal-tab"
                onClick={() => onSelectTab('journal')}
                className={`h-11 rounded-lg text-[13px] font-medium transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                  currentTab === 'journal'
                    ? 'bg-[#2a2a30] text-[#f5f5f7] shadow-sm font-semibold'
                    : 'text-[#86868b] hover:text-[#f5f5f7]'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Journal</span>
              </button>

              {/* Tab 2: Landscape */}
              <button
                id="mobile-nav-landscape-tab"
                onClick={() => onSelectTab('landscape')}
                className={`h-11 rounded-lg text-[13px] font-medium transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                  currentTab === 'landscape'
                    ? 'bg-[#2a2a30] text-[#f5f5f7] shadow-sm font-semibold'
                    : 'text-[#86868b] hover:text-[#f5f5f7]'
                }`}
              >
                <Compass className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Landscape</span>
              </button>

              {/* Tab 3: Tapes */}
              <button
                id="mobile-nav-tapes-tab"
                onClick={() => onSelectTab('tapes')}
                className={`h-11 rounded-lg text-[13px] font-medium transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                  currentTab === 'tapes'
                    ? 'bg-[#2a2a30] text-[#f5f5f7] shadow-sm font-semibold'
                    : 'text-[#86868b] hover:text-[#f5f5f7]'
                }`}
              >
                <Lock className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Tapes</span>
              </button>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
};


