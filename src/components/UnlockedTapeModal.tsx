import React from 'react';
import { Unlock, X, Calendar, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';
import { TemporalTape } from '../types';
import { formatTapeDate, formatTapeDateTime, formatUnlockEvidenceExplanation, formatConditionSummary } from '../utils/tapeFormatters';

interface UnlockedTapeModalProps {
  tape: TemporalTape | null;
  onClose: () => void;
}

export const UnlockedTapeModal: React.FC<UnlockedTapeModalProps> = ({
  tape,
  onClose,
}) => {
  if (!tape) return null;

  const isUnlocked = tape.status === 'unlocked';
  const evidence = tape.unlockEvidence;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-slate-950/85 backdrop-blur-md">
      <div 
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="unlocked-tape-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Unlock className="w-4 h-4" />
            </div>
            <div>
              <h3 id="unlocked-tape-title" className="text-base font-medium text-slate-100 font-['Outfit']">
                {tape.title}
              </h3>
              <p className="text-xs text-slate-400 flex items-center space-x-2">
                <span>Written {formatTapeDate(tape.sealedAt)}</span>
                <span>•</span>
                <span className="text-emerald-400">Unlocked {formatTapeDate(tape.unlockedAt)}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            aria-label="Close reflection"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Recipient Note if present */}
          {tape.recipientNote && (
            <div className="p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-xl">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
                Recipient Note
              </div>
              <p className="text-xs text-slate-300 italic">
                "{tape.recipientNote}"
              </p>
            </div>
          )}

          {/* Sealed Prose Main Body */}
          <div className="p-6 bg-slate-950 border border-slate-800/80 rounded-xl">
            <div className="text-[10px] uppercase tracking-wider text-amber-400/80 font-semibold mb-3 flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Delivered Reflection</span>
            </div>
            <div className="text-sm text-slate-100 leading-relaxed whitespace-pre-wrap font-serif sm:text-base">
              {tape.sealedProse || (
                <span className="text-slate-500 italic">
                  No text was recorded for this tape.
                </span>
              )}
            </div>
          </div>

          {/* Deterministic Verification & Evidence Block */}
          <div className="p-4 bg-emerald-950/20 border border-emerald-800/40 rounded-xl space-y-2.5">
            <div className="flex items-center space-x-2 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">
                Deterministic Verification
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {formatUnlockEvidenceExplanation(evidence)}
            </p>
            <div className="pt-2 border-t border-emerald-900/40 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
              <span>
                <strong className="text-slate-200">Condition:</strong> {formatConditionSummary(tape.condition)}
              </span>
              {evidence?.confidence !== undefined && (
                <span>
                  <strong className="text-slate-200">Confidence:</strong> {Math.round(evidence.confidence * 100)}%
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 pt-1">
              Your recent journal-derived signals satisfied the condition you selected.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end px-6 py-3 border-t border-slate-800 bg-slate-900/40">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
