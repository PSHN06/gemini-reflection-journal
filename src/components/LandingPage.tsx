import React, { useState } from 'react';
import { 
  Sparkles, 
  ShieldCheck, 
  Lock, 
  Database, 
  Cpu, 
  ArrowRight, 
  BookOpen, 
  CheckCircle2, 
  Layers,
  AlertCircle
} from 'lucide-react';

interface LandingPageProps {
  onSignIn: () => Promise<void>;
  isLoading: boolean;
  authError: string | null;
  onOpenSecurityModal: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onSignIn,
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
    <div className="min-h-[calc(100vh-4rem)] flex flex-col justify-between bg-slate-950 text-slate-100">
      {/* Hero Section */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16 flex flex-col items-center text-center">
        {/* Security badge pill */}
        <button
          onClick={onOpenSecurityModal}
          className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs text-amber-300 mb-8 hover:border-slate-700 transition-colors cursor-pointer"
        >
          <ShieldCheck className="w-4 h-4 text-amber-400" />
          <span>Strict Owner-Bound Cloud Firestore Isolation</span>
          <span className="text-slate-500">•</span>
          <span className="text-slate-400 hover:underline">Learn more</span>
        </button>

        {/* Main Title */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white max-w-3xl font-['Outfit']">
          Deep Personal Reflections Powered by{' '}
          <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-200 bg-clip-text text-transparent">
            Gemini 3.6 Flash
          </span>
        </h1>

        <p className="mt-6 text-lg text-slate-300 max-w-2xl leading-relaxed font-light">
          A private, multi-turn journaling space designed to unpack complex thoughts, brainstorm solutions, and synthesize key takeaways. All entries are encrypted and securely locked to your Google identity in Cloud Firestore.
        </p>

        {/* Auth Error Banner */}
        {authError && (
          <div className="mt-6 max-w-md w-full p-4 bg-rose-950/50 border border-rose-800/80 rounded-xl flex items-start space-x-3 text-left">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="text-xs text-rose-200">
              <span className="font-semibold block mb-0.5">Authentication Error</span>
              {authError}
            </div>
          </div>
        )}

        {/* Sign In CTA Card */}
        <div className="mt-8 flex flex-col sm:flex-row items-center gap-4">
          <button
            id="google-signin-btn"
            onClick={handleSignInClick}
            disabled={isLoading || isSigningIn}
            className="flex items-center space-x-3 px-8 py-4 bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-base rounded-xl shadow-lg shadow-amber-400/20 hover:shadow-amber-400/30 active:scale-98 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {/* Google Vector Icon */}
            <svg className="w-5 h-5" viewBox="0 0 24 24">
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
            <ArrowRight className="w-4 h-4 text-slate-900" />
          </button>
        </div>

        <p className="mt-3 text-xs text-slate-500">
          Passwordless federated identity. No passwords stored in application code.
        </p>

        {/* Feature Highlights Grid */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl text-left">
          {/* Feature 1 */}
          <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-slate-100 font-['Outfit']">
              Multi-Turn Gemini Dialogue
            </h3>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              Engage in interactive back-and-forth reflections. Gemini remembers your previous context within each session to provide tailored questions, summaries, and action steps.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4">
              <Database className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-slate-100 font-['Outfit']">
              Cloud Firestore Storage
            </h3>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              Every prompt, response, and journal entry is automatically synchronized to Cloud Firestore under strict owner-bound rules (<code className="text-emerald-300 text-xs">/users/{'{uid}'}/entries</code>).
            </p>
          </div>

          {/* Feature 3 */}
          <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-4">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-slate-100 font-['Outfit']">
              Strict Data Isolation
            </h3>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              Zero cross-user data leakage. Gemini API keys are shielded behind an Express proxy and Google Secret Manager, never exposed to client browsers.
            </p>
          </div>
        </div>

        {/* Workflow Showcase */}
        <div className="mt-14 max-w-4xl w-full p-6 bg-slate-900/40 border border-slate-800/80 rounded-2xl text-left">
          <h4 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-4">
            Application Lifecycle & Security Pipeline
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="flex items-start space-x-2.5">
              <div className="w-6 h-6 rounded-full bg-slate-800 text-amber-400 flex items-center justify-center text-xs font-bold shrink-0">1</div>
              <div>
                <p className="text-xs font-medium text-slate-200">Google Sign-In</p>
                <p className="text-[11px] text-slate-400">Firebase Auth token issued</p>
              </div>
            </div>
            <div className="flex items-start space-x-2.5">
              <div className="w-6 h-6 rounded-full bg-slate-800 text-amber-400 flex items-center justify-center text-xs font-bold shrink-0">2</div>
              <div>
                <p className="text-xs font-medium text-slate-200">Write Reflections</p>
                <p className="text-[11px] text-slate-400">Multi-turn journal entries</p>
              </div>
            </div>
            <div className="flex items-start space-x-2.5">
              <div className="w-6 h-6 rounded-full bg-slate-800 text-amber-400 flex items-center justify-center text-xs font-bold shrink-0">3</div>
              <div>
                <p className="text-xs font-medium text-slate-200">Gemini 3.6 Flash</p>
                <p className="text-[11px] text-slate-400">Fallback ladder synthesis</p>
              </div>
            </div>
            <div className="flex items-start space-x-2.5">
              <div className="w-6 h-6 rounded-full bg-slate-800 text-amber-400 flex items-center justify-center text-xs font-bold shrink-0">4</div>
              <div>
                <p className="text-xs font-medium text-slate-200">Isolated Firestore</p>
                <p className="text-[11px] text-slate-400">Realtime synced & isolated</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500">
        <p>Gemini Reflection Journal • Protected by Firebase Security Rules & Google Cloud Secret Manager</p>
      </footer>
    </div>
  );
};
