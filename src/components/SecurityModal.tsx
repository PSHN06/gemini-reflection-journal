import React from 'react';
import { ShieldCheck, X, Lock, Key, Database, Server } from 'lucide-react';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <div className="bg-[#1c1c20] border border-[rgba(255,255,255,0.08)] rounded-[20px] max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-modal-enter text-[#f5f5f7]">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-[rgba(255,255,255,0.06)] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-[8px] bg-[#30d158]/10 text-[#30d158]">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-[16px] font-semibold text-[#f5f5f7] tracking-tight">
                Security & Data Isolation
              </h3>
              <p className="text-[12px] text-[#86868b]">
                Multi-tenant Firestore rules and secret isolation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#86868b] hover:text-[#f5f5f7] hover:bg-[#242428] rounded-[8px] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-[#86868b] flex-1">
          {/* Active User Isolation */}
          <div className="p-4 bg-[#121214] border border-[rgba(255,255,255,0.06)] rounded-[14px] space-y-2">
            <div className="flex items-center space-x-2 text-[#30d158] font-medium text-[13px]">
              <Lock className="w-3.5 h-3.5" />
              <span>Owner-Bound Collection Path</span>
            </div>
            <p className="text-[#86868b] leading-relaxed">
              Your journal entries and conversations are isolated under your verified Firebase Auth UID:
            </p>
            <div className="p-2.5 bg-[#18181c] rounded-[8px] font-mono text-[11px] text-[#f5f5f7] overflow-x-auto">
              /users/{userId || '{YOUR_VERIFIED_UID}'}/entries/*
            </div>
          </div>

          {/* Firestore Security Rules Block */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-[#f5f5f7] font-medium text-[13px]">
              <Database className="w-3.5 h-3.5 text-[#ff9f0a]" />
              <span>Active Firestore Security Rules (firestore.rules)</span>
            </div>
            <pre className="p-3.5 bg-[#121214] border border-[rgba(255,255,255,0.06)] rounded-[12px] font-mono text-[11px] text-[#d0d0d8] overflow-x-auto leading-relaxed">
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
            <div className="p-3.5 bg-[#121214] border border-[rgba(255,255,255,0.06)] rounded-[12px]">
              <div className="flex items-center space-x-2 text-[#f5f5f7] font-medium mb-1">
                <Server className="w-3.5 h-3.5 text-[#0a84ff]" />
                <span>Server-Side Secret Proxy</span>
              </div>
              <p className="text-[11.5px] text-[#86868b] leading-relaxed">
                The Gemini API Key is never sent to browsers. All requests are securely proxied via server endpoints.
              </p>
            </div>

            <div className="p-3.5 bg-[#121214] border border-[rgba(255,255,255,0.06)] rounded-[12px]">
              <div className="flex items-center space-x-2 text-[#f5f5f7] font-medium mb-1">
                <Key className="w-3.5 h-3.5 text-[#a78bfa]" />
                <span>Federated Google Sign-In</span>
              </div>
              <p className="text-[11.5px] text-[#86868b] leading-relaxed">
                Passwordless authentication delegates credential handling securely to Google Identity Services.
              </p>
            </div>
          </div>

          {/* Temporal Tapes Zero-Leakage Guarantee */}
          <div className="p-4 bg-[#121214] border border-[rgba(255,255,255,0.06)] rounded-[14px] space-y-1.5">
            <div className="flex items-center space-x-2 text-[#ff9f0a] font-medium text-[13px]">
              <Lock className="w-3.5 h-3.5" />
              <span>Temporal Tapes Zero-Leakage Guarantee</span>
            </div>
            <p className="text-[11.5px] text-[#86868b] leading-relaxed">
              While a Temporal Tape is in <code className="text-[#f5f5f7] font-mono">sealed</code> status, the backend server completely withholds <code className="text-[#f5f5f7] font-mono">sealedProse</code> from all client responses. Private text is revealed only once the deterministic evaluator verifies the unlock condition.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-[rgba(255,255,255,0.06)] flex justify-end">
          <button
            onClick={onClose}
            className="h-8 px-4 bg-[#f5f5f7] hover:bg-[#e5e5ea] text-[#121214] text-[13px] font-medium rounded-[8px] transition-colors cursor-pointer btn-press shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
