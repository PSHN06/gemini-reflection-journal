import React, { useState } from 'react';
import { 
  ShieldCheck, 
  AlertCircle,
  ArrowRight,
  Lock
} from 'lucide-react';

interface LandingPageProps {
  onSignIn: () => Promise<void>;
  onExploreDemo?: () => void;
  isLoading: boolean;
  authError: string | null;
  onOpenSecurityModal: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onSignIn,
  onExploreDemo,
  isLoading,
  authError,
  onOpenSecurityModal,
}) => {
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleSignInClick = async () => {
    try {
      setIsSigningIn(true);
      await onSignIn();
    } catch (err) {
      console.error('Sign-in error:', err);
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex flex-col justify-between bg-[#121214] text-[#f5f5f7]">
      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center max-w-xl mx-auto w-full">
        {/* Subtle Icon Mark */}
        <div className="w-12 h-12 rounded-2xl bg-[#18181c] border border-[rgba(255,255,255,0.08)] flex items-center justify-center text-[#f5f5f7] mb-6 shadow-sm">
          <svg className="w-6 h-6 text-[#f5f5f7]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L4 21l3.52-.92C9.06 20.61 10.49 21 12 21c4.97 0 9-4.03 9-9s-4.03-9-9-9z" />
            <path d="M8 12h.01" />
            <path d="M12 12h.01" />
            <path d="M16 12h.01" />
          </svg>
        </div>

        {/* Title */}
        <h1 className="text-[32px] sm:text-[40px] font-semibold tracking-tight text-[#f5f5f7] leading-tight">
          Reflections
        </h1>

        {/* Elegant Tagline */}
        <p className="mt-3 text-[16px] text-[#86868b] leading-relaxed max-w-md font-normal">
          A quiet space to unpack thoughts, cultivate clarity, and leave messages for who you will become.
        </p>

        {/* Auth Error Banner */}
        {authError && (
          <div className="mt-6 max-w-md w-full p-3.5 bg-[#1c1c20] border border-[#ff453a]/30 rounded-[12px] flex items-start space-x-2.5 text-left">
            <AlertCircle className="w-4 h-4 text-[#ff453a] shrink-0 mt-0.5" />
            <div className="text-[12.5px] text-[#ff453a]">
              <span className="font-semibold block mb-0.5">Authentication notice</span>
              {authError}
            </div>
          </div>
        )}

        {/* Simple Sign In Card */}
        <div className="mt-8 w-full max-w-sm bg-[#18181c] border border-[rgba(255,255,255,0.07)] rounded-[20px] p-6 sm:p-7 shadow-xl space-y-4">
          <button
            id="google-signin-btn"
            onClick={handleSignInClick}
            disabled={isLoading || isSigningIn}
            className="w-full h-11 bg-[#f5f5f7] hover:bg-[#e5e5ea] text-[#121214] font-medium text-[14px] rounded-[10px] flex items-center justify-center space-x-2.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed btn-press shadow-xs"
          >
            {/* Clean Google 'G' Mark */}
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>
              {isSigningIn || isLoading ? 'Authenticating...' : 'Sign in with Google'}
            </span>
          </button>

          {onExploreDemo && (
            <button
              id="explore-demo-landscape-btn"
              onClick={onExploreDemo}
              className="w-full h-10 bg-[#24242a] hover:bg-[#2c2c34] text-[#f5f5f7] font-medium text-[13px] rounded-[10px] flex items-center justify-center space-x-2 transition-colors cursor-pointer border border-[rgba(255,255,255,0.08)] btn-press"
            >
              <span>Explore 3D Landscape Preview</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#a1a1aa]" />
            </button>
          )}

          <p className="text-[12px] text-[#86868b] leading-relaxed">
            Private, passwordless access. Your entries are isolated strictly to your account.
          </p>
        </div>

        {/* Reassurance pill */}
        <div className="mt-8">
          <button
            onClick={onOpenSecurityModal}
            className="inline-flex items-center space-x-1.5 text-[12.5px] text-[#86868b] hover:text-[#f5f5f7] transition-colors cursor-pointer"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#30d158]" />
            <span>Strict owner-bound Firestore isolation</span>
            <span>&middot;</span>
            <span className="underline underline-offset-4">Security details</span>
          </button>
        </div>
      </div>

      {/* Minimal Footer */}
      <footer className="py-6 text-center text-[12px] text-[#636366] border-t border-[rgba(255,255,255,0.04)]">
        Private Journaling &middot; Protected by Cloud Firestore Security Rules
      </footer>
    </div>
  );
};
