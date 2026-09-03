import React from 'react';
import { ShieldCheck, X, Lock, Key, Database, Server, CheckCircle2 } from 'lucide-react';

interface SecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
}

export const SecurityModal: React.FC<SecurityModalProps> = ({
  isOpen,
  onClose,
  userId,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-100 font-['Outfit']">
                Security & Data Isolation Model
              </h3>
              <p className="text-xs text-slate-400">
                End-to-end multi-tenant isolation and credential protection
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-300">
          {/* Active User Isolation */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center space-x-2 text-emerald-400 font-semibold">
              <Lock className="w-4 h-4" />
              <span>Owner-Bound Collection Path</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Your journal entries and conversations with Gemini are stored under your verified Firebase Auth UID:
            </p>
            <div className="p-2.5 bg-slate-900 rounded-lg font-mono text-[11px] text-amber-300 overflow-x-auto">
              /users/{userId || '{YOUR_VERIFIED_UID}'}/entries/*
            </div>
          </div>

          {/* Firestore Security Rules Block */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-slate-200 font-semibold">
              <Database className="w-4 h-4 text-amber-400" />
              <span>Active Firestore Security Rules (firestore.rules)</span>
            </div>
            <pre className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl font-mono text-[11px] text-slate-300 overflow-x-auto leading-relaxed">
{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      match /entries/{entryId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
      match /interactions/{interactionId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}`}
            </pre>
          </div>

          {/* Defense in Depth Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl">
              <div className="flex items-center space-x-2 text-slate-200 font-medium mb-1">
                <Server className="w-4 h-4 text-blue-400" />
                <span>Backend Secret Proxy</span>
              </div>
              <p className="text-[11px] text-slate-400">
                The Gemini API Key is never passed to client browsers. Requests are securely proxied via server-side endpoints.
              </p>
            </div>

            <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl">
              <div className="flex items-center space-x-2 text-slate-200 font-medium mb-1">
                <Key className="w-4 h-4 text-purple-400" />
                <span>Federated Google Sign-In</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Passwordless authentication delegates credential storage to Google Identity Services with automatic token lifecycle.
              </p>
            </div>
          </div>

          {/* Environment & Secrets Info */}
          <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center space-x-2 text-amber-400 font-medium">
              <Key className="w-4 h-4" />
              <span>Environment Configuration (.env)</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Secrets like <code className="text-amber-300 font-mono">GEMINI_API_KEY</code> are stored in the root <code className="text-amber-300 font-mono">.env</code> file on the server. The backend dynamically reloads environment changes so updates take effect immediately without rebuilding.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-xl text-xs transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
