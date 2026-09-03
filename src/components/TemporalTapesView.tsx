import React, { useState, useEffect, useCallback } from 'react';
import { 
  Lock, 
  Unlock, 
  Plus, 
  RefreshCw, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  ChevronRight,
  Shield,
  Activity
} from 'lucide-react';
import { TemporalTape, EvaluateTapeResponse } from '../types';
import { fetchUserTapes, evaluateTapeUnlock } from '../services/tapeService';
import { CreateTapeModal } from './CreateTapeModal';
import { UnlockedTapeModal } from './UnlockedTapeModal';
import { formatConditionSummary, formatTapeDate, formatUnlockEvidenceExplanation } from '../utils/tapeFormatters';

interface TemporalTapesViewProps {
  userId: string;
}

export const TemporalTapesView: React.FC<TemporalTapesViewProps> = ({ userId }) => {
  const [tapes, setTapes] = useState<TemporalTape[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [selectedUnlockedTape, setSelectedUnlockedTape] = useState<TemporalTape | null>(null);

  // Individual evaluation loading state map { [tapeId]: boolean }
  const [evaluatingMap, setEvaluatingMap] = useState<Record<string, boolean>>({});
  const [evaluationFeedback, setEvaluationFeedback] = useState<{ tapeId: string; message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Filter tab: 'all' | 'sealed' | 'unlocked'
  const [filter, setFilter] = useState<'all' | 'sealed' | 'unlocked'>('all');

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
  };

  const handleEvaluate = async (tapeId: string) => {
    setEvaluatingMap((prev) => ({ ...prev, [tapeId]: true }));
    setEvaluationFeedback(null);

    try {
      const result: EvaluateTapeResponse = await evaluateTapeUnlock(tapeId);
      
      // Update the specific tape in state with the fresh server response
      setTapes((prev) =>
        prev.map((tape) => (tape.tapeId === tapeId ? result.tape : tape))
      );

      if (result.eligible && result.status === 'unlocked') {
        setEvaluationFeedback({
          tapeId,
          message: 'Condition satisfied! This tape is now unlocked.',
          type: 'success',
        });
        // If newly unlocked, open the reflection for the user
        setSelectedUnlockedTape(result.tape);
      } else if (result.alreadyUnlocked) {
        setEvaluationFeedback({
          tapeId,
          message: 'This tape was already unlocked.',
          type: 'info',
        });
      } else {
        setEvaluationFeedback({
          tapeId,
          message: result.reason || 'Telemetry evaluated. Condition is not yet satisfied.',
          type: 'info',
        });
      }
    } catch (err: any) {
      console.error('Failed to evaluate tape:', err);
      setEvaluationFeedback({
        tapeId,
        message: err.message || 'Evaluation failed. Please try again.',
        type: 'error',
      });
    } finally {
      setEvaluatingMap((prev) => ({ ...prev, [tapeId]: false }));
    }
  };

  const filteredTapes = tapes.filter((tape) => {
    if (filter === 'sealed') return tape.status === 'sealed' || tape.status === 'evaluating';
    if (filter === 'unlocked') return tape.status === 'unlocked';
    return true;
  });

  const sealedCount = tapes.filter((t) => t.status === 'sealed' || t.status === 'evaluating').length;
  const unlockedCount = tapes.filter((t) => t.status === 'unlocked').length;

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-slate-950 text-slate-100">
      <div className="max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center space-x-2 mb-1">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-['Outfit'] text-slate-100">
                Temporal Tapes
              </h1>
              <span className="px-2 py-0.5 text-[11px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20 rounded-full">
                Deterministic
              </span>
            </div>
            <p className="text-sm text-slate-400 max-w-xl">
              Leave something meaningful for the version of you who comes next.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={loadTapes}
              disabled={isLoading}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-slate-800 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              title="Refresh tapes"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
            </button>
            <button
              id="create-tape-btn"
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center space-x-2 px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-amber-400/20 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create a tape</span>
            </button>
          </div>
        </div>

        {/* Filter Navigation */}
        {tapes.length > 0 && (
          <div className="flex items-center space-x-2 border-b border-slate-800/80 pb-3">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                filter === 'all'
                  ? 'bg-slate-800 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({tapes.length})
            </button>
            <button
              onClick={() => setFilter('sealed')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                filter === 'sealed'
                  ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Sealed ({sealedCount})</span>
            </button>
            <button
              onClick={() => setFilter('unlocked')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                filter === 'unlocked'
                  ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>Unlocked ({unlockedCount})</span>
            </button>
          </div>
        )}

        {/* Global Feedback Banner */}
        {evaluationFeedback && (
          <div
            className={`p-3.5 rounded-xl border text-xs flex items-start justify-between space-x-2 transition-all ${
              evaluationFeedback.type === 'success'
                ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                : evaluationFeedback.type === 'error'
                ? 'bg-rose-950/40 border-rose-800/60 text-rose-300'
                : 'bg-slate-900 border-slate-800 text-slate-300'
            }`}
          >
            <div className="flex items-start space-x-2">
              {evaluationFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <Activity className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              )}
              <span>{evaluationFeedback.message}</span>
            </div>
            <button
              onClick={() => setEvaluationFeedback(null)}
              className="text-slate-500 hover:text-slate-300 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="p-4 bg-rose-950/40 border border-rose-800/60 rounded-xl text-xs text-rose-300 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={loadTapes}
              className="px-3 py-1 bg-rose-900/60 hover:bg-rose-900 text-rose-200 rounded-lg text-xs cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading State */}
        {isLoading && tapes.length === 0 && (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center animate-pulse mb-3">
              <Lock className="w-5 h-5" />
            </div>
            <p className="text-xs text-slate-400">Reading your temporal archives...</p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && tapes.length === 0 && (
          <div className="py-20 flex flex-col items-center justify-center text-center border border-dashed border-slate-800 rounded-2xl bg-slate-900/20 p-8">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-4">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold text-slate-100 font-['Outfit']">
              Nothing sealed yet.
            </h3>
            <p className="mt-2 text-xs text-slate-400 max-w-sm leading-relaxed">
              Write something your future self should receive when the time is right.
            </p>
            <button
              id="empty-create-tape-btn"
              onClick={() => setIsCreateModalOpen(true)}
              className="mt-6 flex items-center space-x-1.5 px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-400/20 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create a tape</span>
            </button>
          </div>
        )}

        {/* Tape Grid / List */}
        {!isLoading && filteredTapes.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTapes.map((tape) => {
              const isUnlocked = tape.status === 'unlocked';
              const isEvaluating = evaluatingMap[tape.tapeId];
              const progress = tape.evaluationProgress;

              return (
                <div
                  key={tape.tapeId}
                  className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                    isUnlocked
                      ? 'bg-slate-900/80 border-emerald-500/30 shadow-md shadow-emerald-500/5'
                      : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div>
                    {/* Top Row: Status badge & Dates */}
                    <div className="flex items-center justify-between mb-3">
                      {isUnlocked ? (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 text-[11px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 rounded-full">
                          <Unlock className="w-3 h-3 text-emerald-400" />
                          <span>Unlocked</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 text-[11px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20 rounded-full">
                          <Lock className="w-3 h-3 text-amber-400" />
                          <span>Sealed</span>
                        </span>
                      )}

                      <span className="text-[11px] text-slate-500">
                        {isUnlocked ? `Opened ${formatTapeDate(tape.unlockedAt)}` : `Sealed ${formatTapeDate(tape.sealedAt)}`}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="text-base font-semibold text-slate-100 font-['Outfit'] mb-1.5 line-clamp-1">
                      {tape.title}
                    </h3>

                    {/* Recipient Note if available */}
                    {tape.recipientNote && (
                      <p className="text-xs text-slate-400 italic mb-3 line-clamp-2">
                        "{tape.recipientNote}"
                      </p>
                    )}

                    {/* Condition Summary */}
                    <div className="p-2.5 bg-slate-950/70 border border-slate-800/80 rounded-xl mb-4 text-xs">
                      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium mb-0.5">
                        Unlock Condition
                      </div>
                      <div className="text-slate-300 font-medium text-[11px] sm:text-xs">
                        {formatConditionSummary(tape.condition)}
                      </div>
                    </div>

                    {/* Sealed Progress Info */}
                    {!isUnlocked && progress && (
                      <div className="mb-4 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-400">Progress</span>
                          <span className="text-amber-300 font-medium">
                            {progress.satisfactionPercentage}%
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-300"
                            style={{ width: `${Math.max(4, Math.min(100, progress.satisfactionPercentage))}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                          <span>Streak: {progress.currentStreakDays}d / {tape.condition.sustainedDays}d</span>
                          <span>Entries: {progress.currentObservationCount} / {tape.condition.minObservations}</span>
                        </div>
                        {progress.lastReason && (
                          <p className="text-[10px] text-slate-500 italic line-clamp-1 pt-0.5">
                            {progress.lastReason}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Unlocked Evidence Info */}
                    {isUnlocked && (
                      <div className="mb-4 p-2.5 bg-emerald-950/20 border border-emerald-900/30 rounded-xl text-xs text-slate-300">
                        <p className="text-[11px] text-emerald-300">
                          {formatUnlockEvidenceExplanation(tape.unlockEvidence)}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Actions Bottom Bar */}
                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                    {isUnlocked ? (
                      <button
                        onClick={() => setSelectedUnlockedTape(tape)}
                        className="w-full flex items-center justify-center space-x-1.5 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold rounded-xl transition-all cursor-pointer"
                      >
                        <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Open Tape</span>
                        <ChevronRight className="w-3.5 h-3.5 ml-1" />
                      </button>
                    ) : (
                      <div className="w-full flex items-center justify-between">
                        <span className="text-[11px] text-slate-500 flex items-center space-x-1">
                          <Shield className="w-3 h-3 text-slate-500" />
                          <span>Protected</span>
                        </span>
                        <button
                          onClick={() => handleEvaluate(tape.tapeId)}
                          disabled={isEvaluating}
                          className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <Activity className={`w-3.5 h-3.5 text-amber-400 ${isEvaluating ? 'animate-pulse' : ''}`} />
                          <span>{isEvaluating ? 'Evaluating...' : 'Check progress'}</span>
                        </button>
                      </div>
                    )}
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
