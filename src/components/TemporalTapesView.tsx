import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, 
  RefreshCw, 
  AlertCircle,
  Clock,
  Sparkles,
  Lock,
  Unlock
} from 'lucide-react';
import { TemporalTape, EvaluateTapeResponse } from '../types';
import { fetchUserTapes, evaluateTapeUnlock } from '../services/tapeService';
import { CreateTapeModal } from './CreateTapeModal';
import { UnlockedTapeModal } from './UnlockedTapeModal';
import { formatConditionSummary, formatTapeDate, formatTapeDateTime } from '../utils/tapeFormatters';

interface TemporalTapesViewProps {
  userId: string;
}

export const TemporalTapesView: React.FC<TemporalTapesViewProps> = () => {
  const [tapes, setTapes] = useState<TemporalTape[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [selectedUnlockedTape, setSelectedUnlockedTape] = useState<TemporalTape | null>(null);

  // Newly sealed tape tracker for the quiet 2-second inline notice
  const [justSealedTapeId, setJustSealedTapeId] = useState<string | null>(null);

  // Individual evaluation loading state map { [tapeId]: boolean }
  const [evaluatingMap, setEvaluatingMap] = useState<Record<string, boolean>>({});
  // Per-tape progress feedback: { [tapeId]: { type: 'locked' | 'unlocked'; message: string; evaluatedAt: number } | null }
  const [tapeProgressFeedback, setTapeProgressFeedback] = useState<Record<string, { type: 'locked' | 'unlocked'; message: string; evaluatedAt: number } | null>>({});
  // Per-tape actual failure error: { [tapeId]: string | null }
  const [tapeErrors, setTapeErrors] = useState<Record<string, string | null>>({});

  const loadTapes = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const fetched = await fetchUserTapes();
      setTapes(fetched);
    } catch (err: any) {
      console.error('Failed to load temporal tapes:', err);
      setError(err.message || 'Unable to load Temporal Tapes. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTapes();
  }, [loadTapes]);

  const handleTapeCreated = (newTape: TemporalTape) => {
    setTapes((prev) => [newTape, ...prev]);
    setIsCreateModalOpen(false);
    setJustSealedTapeId(newTape.tapeId);
    setTimeout(() => {
      setJustSealedTapeId((current) => (current === newTape.tapeId ? null : current));
    }, 2400);
  };

  const handleEvaluate = async (tapeId: string) => {
    // 1. Prevent duplicate evaluation requests
    if (evaluatingMap[tapeId]) return;

    setEvaluatingMap((prev) => ({ ...prev, [tapeId]: true }));
    // Clear any previous error on this tape and stale global error
    setTapeErrors((prev) => ({ ...prev, [tapeId]: null }));
    setError(null);

    try {
      const result: EvaluateTapeResponse = await evaluateTapeUnlock(tapeId);
      
      // Update the specific tape in state with the fresh server response
      setTapes((prev) =>
        prev.map((tape) => (tape.tapeId === tapeId ? result.tape : tape))
      );

      // Clear any prior failure state
      setTapeErrors((prev) => ({ ...prev, [tapeId]: null }));

      if (result.eligible && result.status === 'unlocked') {
        // Unlock success
        setTapeProgressFeedback((prev) => ({
          ...prev,
          [tapeId]: {
            type: 'unlocked',
            message: result.userMessage || 'Condition satisfied. This tape is now unlocked.',
            evaluatedAt: result.evaluatedAt,
          },
        }));
        setSelectedUnlockedTape(result.tape);
      } else if (result.alreadyUnlocked) {
        // Already unlocked
        setTapeProgressFeedback((prev) => ({
          ...prev,
          [tapeId]: {
            type: 'unlocked',
            message: result.userMessage || 'This tape is already unlocked.',
            evaluatedAt: result.evaluatedAt,
          },
        }));
      } else {
        // Expected outcome: tape remains sealed
        // Do NOT show an error banner. Show calm informational progress result.
        setTapeProgressFeedback((prev) => ({
          ...prev,
          [tapeId]: {
            type: 'locked',
            message: result.userMessage || result.reason || 'Your tape remains securely sealed. Continue journaling to build progress.',
            evaluatedAt: result.evaluatedAt,
          },
        }));
      }
    } catch (err: any) {
      console.error('Failed to evaluate tape:', err);
      // Actual failure (network failure, 401 auth, 404 not found, 500 server error)
      let friendlyError = 'Unable to check tape progress right now. Please check your connection and try again.';
      if (err.errorCode === 'UNAUTHORIZED' || err.message?.includes('Unauthorized')) {
        friendlyError = 'Please sign in to check tape progress.';
      } else if (err.errorCode === 'NOT_FOUND' || err.message?.includes('not found')) {
        friendlyError = 'Tape not found or unauthorized.';
      }
      setTapeErrors((prev) => ({ ...prev, [tapeId]: friendlyError }));
    } finally {
      setEvaluatingMap((prev) => ({ ...prev, [tapeId]: false }));
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto scroll-touch bg-[#121214] text-[#f5f5f7]">
      <div className="max-w-2xl w-full mx-auto px-4 sm:px-8 py-6 sm:py-10 space-y-6 sm:space-y-8 safe-area-bottom">
        
        {/* Main View Header */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-[24px] sm:text-[30px] font-semibold tracking-tight text-[#f5f5f7]">
              Temporal Tapes
            </h1>
            <div className="flex items-center space-x-2">
              <button
                onClick={loadTapes}
                disabled={isLoading}
                className="h-9 w-9 sm:h-8 sm:w-8 flex items-center justify-center text-[#86868b] hover:text-[#f5f5f7] hover:bg-[#1c1c20] rounded-[10px] transition-colors cursor-pointer disabled:opacity-40 btn-press"
                title="Refresh tapes"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                id="create-tape-btn"
                onClick={() => setIsCreateModalOpen(true)}
                className="h-9 sm:h-8 px-3.5 sm:px-4 bg-[#f5f5f7] hover:bg-[#e5e5ea] active:bg-[#d1d1d6] text-[#121214] text-[13px] font-medium rounded-[10px] sm:rounded-[8px] flex items-center space-x-1.5 transition-colors cursor-pointer btn-press shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Seal a Tape</span>
              </button>
            </div>
          </div>
          <p className="text-[13.5px] sm:text-[14px] text-[#86868b] leading-relaxed">
            Leave something meaningful for the version of you who comes next.
          </p>
        </div>

        {/* Global Connection / Auth Error State */}
        {error && (
          <div className="p-4 bg-[#1c1c20] border border-[#ff453a]/30 rounded-[12px] text-[13px] text-[#ff453a] flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={loadTapes}
              className="px-3 py-1 bg-[#242428] text-[#f5f5f7] rounded-[6px] text-xs cursor-pointer btn-press"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading State */}
        {isLoading && tapes.length === 0 && (
          <div className="py-24 text-center text-[13px] text-[#86868b] animate-pulse">
            Reading archives...
          </div>
        )}

        {/* Empty State */}
        {!isLoading && tapes.length === 0 && (
          <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-14 h-14 rounded-full border border-[rgba(255,255,255,0.08)] bg-[#18181c] flex items-center justify-center text-[#86868b]">
              <Lock className="w-6 h-6 text-[#86868b]" />
            </div>
            
            <div className="space-y-1 max-w-sm">
              <h3 className="text-[17px] font-semibold text-[#f5f5f7]">
                Nothing sealed yet
              </h3>
              <p className="text-[13.5px] text-[#86868b] leading-relaxed">
                Write something your future self should receive when the time is right.
              </p>
            </div>

            <div className="pt-2">
              <button
                id="empty-create-tape-btn"
                onClick={() => setIsCreateModalOpen(true)}
                className="h-9 px-4 bg-[#f5f5f7] hover:bg-[#e5e5ea] text-[#121214] text-[13px] font-medium rounded-[8px] transition-colors cursor-pointer btn-press shadow-xs"
              >
                Seal your first tape
              </button>
            </div>
          </div>
        )}

        {/* Single Column Tape List */}
        {!isLoading && tapes.length > 0 && (
          <div className="space-y-4">
            {tapes.map((tape) => {
              const isUnlocked = tape.status === 'unlocked';
              const isEvaluating = evaluatingMap[tape.tapeId];
              const progress = tape.evaluationProgress;
              const obsCount = progress ? (progress.observationsRecorded ?? progress.currentObservationCount) : 0;
              const daysCount = progress ? (progress.daysElapsed ?? progress.currentStreakDays) : 0;
              const targetObs = progress?.observationsRequired ?? tape.condition.minObservations;
              const targetDays = progress?.daysRequired ?? tape.condition.sustainedDays;
              const isJustSealed = justSealedTapeId === tape.tapeId;

              if (isUnlocked) {
                // UNLOCKED TAPE CARD (Discovered Artifact)
                return (
                  <div
                    key={tape.tapeId}
                    className="p-4 sm:p-6 rounded-[20px] sm:rounded-[16px] bg-[#18181c] border border-[rgba(255,255,255,0.07)] text-[#f5f5f7] space-y-4 shadow-sm"
                  >
                    {/* Top Row: Status left, Date right */}
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#30d158]" />
                        <span className="text-[11px] font-semibold tracking-wider uppercase text-[#30d158]">
                          Unlocked
                        </span>
                      </div>
                      <span className="text-[#86868b]">
                        Opened {formatTapeDate(tape.unlockedAt)}
                      </span>
                    </div>

                    {/* Title */}
                    <div>
                      <h2 className="text-[18px] font-semibold text-[#f5f5f7] tracking-tight">
                        {tape.title}
                      </h2>
                      {tape.recipientNote && (
                        <p className="mt-1 text-[13px] text-[#86868b] italic">
                          &ldquo;{tape.recipientNote}&rdquo;
                        </p>
                      )}
                    </div>

                    {/* Verification info */}
                    <p className="text-[12.5px] text-[#86868b] leading-relaxed">
                      Unlocked after {tape.unlockEvidence?.observationCount || obsCount || tape.condition.minObservations} qualifying observations across {tape.unlockEvidence?.currentStreakDays || daysCount || tape.condition.sustainedDays} {targetDays === 1 ? 'day' : 'days'}.
                    </p>

                    {/* Open and read button */}
                    <div className="pt-1">
                      <button
                        id={`open-tape-btn-${tape.tapeId}`}
                        onClick={() => setSelectedUnlockedTape(tape)}
                        className="h-10 sm:h-8 px-4 bg-[#f5f5f7] hover:bg-[#e5e5ea] active:bg-[#d1d1d6] text-[#121214] text-[13px] font-medium rounded-[10px] sm:rounded-[8px] transition-colors cursor-pointer btn-press flex items-center space-x-1.5 shadow-xs"
                      >
                        <Unlock className="w-3.5 h-3.5" />
                        <span>Read Message</span>
                      </button>
                    </div>
                  </div>
                );
              }

              // SEALED TAPE CARD
              const feedback = tapeProgressFeedback[tape.tapeId];
              const cardError = tapeErrors[tape.tapeId];

              // Calculate evidence display values cleanly
              const latestScore = progress?.currentScore ?? progress?.currentMetricAverage;
              const currentScoreDisplay = latestScore !== null && latestScore !== undefined
                ? `${typeof latestScore === 'number' ? latestScore.toFixed(1) : latestScore}/10`
                : '—';
              const operatorSymbol = tape.condition.operator === 'lte' ? '≤' : '≥';
              const lastCheckedTime = feedback?.evaluatedAt || progress?.lastEvaluatedAt;

              return (
                <div
                  key={tape.tapeId}
                  className="p-4 sm:p-6 rounded-[20px] sm:rounded-[16px] bg-[#161619] border border-[rgba(255,255,255,0.06)] text-[#f5f5f7] space-y-4"
                >
                  {/* Top Row: Status left, Date right */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#ff9f0a]" />
                      <span className="text-[11px] font-semibold tracking-wider uppercase text-[#ff9f0a]">
                        Sealed
                      </span>
                    </div>
                    <span className="text-[#86868b]">
                      Sealed {formatTapeDate(tape.sealedAt)}
                    </span>
                  </div>

                  {/* Title & optional newly sealed notice */}
                  <div>
                    <h2 className="text-[18px] font-semibold text-[#f5f5f7] tracking-tight">
                      {tape.title}
                    </h2>
                    {isJustSealed && (
                      <p className="text-[12px] text-[#0a84ff] mt-1 animate-sealed-notice">
                        Sealed securely.
                      </p>
                    )}
                    {tape.recipientNote && (
                      <p className="mt-1 text-[13px] text-[#86868b] italic">
                        &ldquo;{tape.recipientNote}&rdquo;
                      </p>
                    )}
                  </div>

                  {/* Condition label & Evidence numbers */}
                  <div className="space-y-1.5 text-xs text-[#86868b]">
                    <span className="block text-[#d0d0d8] font-normal">
                      Condition: {formatConditionSummary(tape.condition)}
                    </span>

                    {/* Evidence & Progress metrics */}
                    <div className="space-y-1 pt-0.5">
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        <div>
                          Observations: <span className="text-[#f5f5f7] font-medium">{obsCount} of {targetObs}</span>
                        </div>
                        <div>
                          Qualifying days: <span className="text-[#f5f5f7] font-medium">{daysCount} of {targetDays}</span>
                        </div>
                        <div>
                          Current score: <span className="text-[#f5f5f7] font-medium">{currentScoreDisplay}</span> <span className="text-[#636366]">(requires {operatorSymbol} {tape.condition.threshold}/10)</span>
                        </div>
                      </div>
                      {lastCheckedTime && (
                        <div className="text-[11px] text-[#636366]">
                          Last evaluated {formatTapeDateTime(lastCheckedTime)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Calm Informational Progress Result (shown after checking if still sealed) */}
                  {feedback && feedback.type === 'locked' && (
                    <div className="p-3.5 bg-[#1c1c20] border border-[rgba(255,255,255,0.06)] rounded-[12px] text-[12px] space-y-1.5">
                      <div className="flex items-center justify-between text-[#86868b]">
                        <div className="flex items-center space-x-1.5">
                          <Clock className="w-3 h-3 text-[#ff9f0a]" />
                          <span className="font-semibold text-[#f5f5f7] text-[11px] uppercase tracking-wider">Evaluation Update</span>
                        </div>
                        <span className="text-[11px] text-[#636366]">
                          {formatTapeDateTime(feedback.evaluatedAt)}
                        </span>
                      </div>
                      <p className="leading-relaxed text-[#d0d0d8]">
                        {feedback.message}
                      </p>
                    </div>
                  )}

                  {/* Actual Failure Error Callout with Retry Option */}
                  {cardError && (
                    <div className="p-3 bg-[#1e1416] border border-[#ff453a]/30 rounded-[10px] text-[12px] text-[#ff453a] flex items-center justify-between space-x-3">
                      <div className="flex items-center space-x-2 min-w-0">
                        <AlertCircle className="w-4 h-4 shrink-0 text-[#ff453a]" />
                        <span className="leading-snug">{cardError}</span>
                      </div>
                      <button
                        id={`retry-tape-eval-${tape.tapeId}`}
                        onClick={() => handleEvaluate(tape.tapeId)}
                        disabled={isEvaluating}
                        className="shrink-0 px-3 py-1.5 bg-[#2e191d] hover:bg-[#3d2026] text-rose-200 text-xs rounded-[8px] font-medium cursor-pointer transition-colors btn-press disabled:opacity-50"
                      >
                        {isEvaluating ? 'Checking…' : 'Retry'}
                      </button>
                    </div>
                  )}

                  {/* Check progress button */}
                  <div className="pt-1">
                    <button
                      id={`check-progress-btn-${tape.tapeId}`}
                      onClick={() => handleEvaluate(tape.tapeId)}
                      disabled={isEvaluating}
                      className="h-10 sm:h-8 px-4 bg-[#1c1c20] hover:bg-[#242428] active:bg-[#2c2c32] text-[#f5f5f7] border border-[rgba(255,255,255,0.08)] text-[12px] font-medium rounded-[10px] sm:rounded-[8px] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed btn-press flex items-center space-x-1.5"
                    >
                      <Clock className="w-3.5 h-3.5 text-[#86868b]" />
                      <span>{isEvaluating ? 'Checking…' : 'Check progress'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Tape Modal */}
      <CreateTapeModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onTapeCreated={handleTapeCreated}
      />

      {/* Unlocked Tape Reading Modal */}
      <UnlockedTapeModal
        tape={selectedUnlockedTape}
        onClose={() => setSelectedUnlockedTape(null)}
      />
    </div>
  );
};

