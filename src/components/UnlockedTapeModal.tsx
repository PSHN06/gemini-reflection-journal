import React, { useState } from 'react';
import { X, ChevronDown, ChevronUp } from 'lucide-react';
import { TemporalTape } from '../types';
import { 
  formatTapeDate, 
  formatConditionSummary, 
  formatMetricName, 
  formatUnlockEvidenceExplanation 
} from '../utils/tapeFormatters';

interface UnlockedTapeModalProps {
  tape: TemporalTape | null;
  onClose: () => void;
}

export const UnlockedTapeModal: React.FC<UnlockedTapeModalProps> = ({
  tape,
  onClose,
}) => {
  const [isEvidenceExpanded, setIsEvidenceExpanded] = useState(false);

  if (!tape) return null;

  const evidence = tape.unlockEvidence;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black/60 backdrop-blur-md">
      <div 
        className="relative w-full max-w-2xl bg-[#1c1c20] border border-[rgba(255,255,255,0.08)] rounded-[20px] shadow-2xl overflow-hidden flex flex-col my-auto animate-modal-enter"
        role="dialog"
        aria-modal="true"
        aria-labelledby="unlocked-tape-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[rgba(255,255,255,0.06)]">
          <div>
            <h2 id="unlocked-tape-title" className="text-[18px] font-semibold text-[#f5f5f7] tracking-tight">
              {tape.title}
            </h2>
            <p className="text-[12.5px] text-[#86868b] mt-0.5">
              Written {formatTapeDate(tape.sealedAt)} &middot; Unlocked {formatTapeDate(tape.unlockedAt)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#86868b] hover:text-[#f5f5f7] hover:bg-[#242428] rounded-[8px] transition-colors cursor-pointer btn-press"
            aria-label="Close reflection"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Area - Letter Experience */}
        <div className="p-6 sm:p-8 space-y-6 max-h-[75vh] overflow-y-auto flex-1">
          {/* Recipient Note if present */}
          {tape.recipientNote && (
            <div className="text-[13px] italic text-[#86868b] pb-2 border-b border-[rgba(255,255,255,0.06)]">
              Exterior note: &ldquo;{tape.recipientNote}&rdquo;
            </div>
          )}

          {/* Sealed Prose Main Body - Letter Experience */}
          <div className="max-w-[65ch]">
            <div className="prose-text text-[17px] leading-[1.75] text-[#f5f5f7] whitespace-pre-wrap font-normal selection:bg-[#0a84ff]/30">
              {tape.sealedProse || (
                <span className="text-[#86868b] italic">
                  No text was recorded for this tape.
                </span>
              )}
            </div>
          </div>

          {/* Quiet Expandable Verification / Evidence Section */}
          <div className="pt-6 border-t border-[rgba(255,255,255,0.06)]">
            <button
              type="button"
              onClick={() => setIsEvidenceExpanded(!isEvidenceExpanded)}
              className="w-full flex items-center justify-between text-left py-2 text-[#86868b] hover:text-[#f5f5f7] transition-colors cursor-pointer group"
            >
              <span className="text-[12px] font-medium text-[#86868b] group-hover:text-[#f5f5f7]">
                Verification details
              </span>
              {isEvidenceExpanded ? (
                <ChevronUp className="w-4 h-4 text-[#86868b] group-hover:text-[#f5f5f7]" />
              ) : (
                <ChevronDown className="w-4 h-4 text-[#86868b] group-hover:text-[#f5f5f7]" />
              )}
            </button>

            {isEvidenceExpanded && (
              <div className="mt-3 p-4 bg-[#121214] border border-[rgba(255,255,255,0.06)] rounded-[12px] space-y-3">
                <div>
                  <span className="text-[11px] text-[#86868b] block">Condition Set</span>
                  <p className="text-[13px] text-[#f5f5f7] mt-0.5">
                    {formatConditionSummary(tape.condition)}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[rgba(255,255,255,0.06)]">
                  <div>
                    <span className="text-[11px] text-[#86868b] block">Measured Signal</span>
                    <p className="text-[13px] text-[#f5f5f7] mt-0.5">
                      {formatMetricName(tape.condition.metric)}
                    </p>
                  </div>
                  {evidence?.confidence !== undefined && (
                    <div>
                      <span className="text-[11px] text-[#86868b] block">Evaluator Confidence</span>
                      <p className="text-[13px] text-[#f5f5f7] mt-0.5">
                        {Math.round(evidence.confidence * 100)}%
                      </p>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-[rgba(255,255,255,0.06)]">
                  <span className="text-[11px] text-[#86868b] block">Verification Summary</span>
                  <p className="text-[12.5px] text-[#86868b] leading-relaxed mt-0.5">
                    {formatUnlockEvidenceExplanation(evidence)}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-[rgba(255,255,255,0.06)]">
          <button
            onClick={onClose}
            className="h-8 px-4 bg-[#f5f5f7] hover:bg-[#e5e5ea] text-[#121214] text-[13px] font-medium rounded-[8px] transition-colors cursor-pointer btn-press shadow-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
