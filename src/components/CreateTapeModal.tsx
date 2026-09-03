import React, { useState } from 'react';
import { Lock, X, Check, Shield, Sparkles, AlertCircle, ArrowRight, ArrowLeft } from 'lucide-react';
import { TapeUnlockCondition, TemporalTape } from '../types';
import { sealTemporalTape } from '../services/tapeService';
import { formatConditionSummary } from '../utils/tapeFormatters';

interface CreateTapeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTapeCreated: (tape: TemporalTape) => void;
}

interface PresetOption {
  id: string;
  name: string;
  tagline: string;
  condition: TapeUnlockCondition;
}

const PRESETS: PresetOption[] = [
  {
    id: 'calm',
    name: 'When calm returns',
    tagline: 'Stress drops to quiet levels across a full week.',
    condition: {
      metric: 'stressIndex',
      operator: 'lte',
      threshold: 4,
      sustainedDays: 7,
      minObservations: 5,
      minConfidence: 0.70,
    },
  },
  {
    id: 'focus',
    name: 'When focus comes back',
    tagline: 'Sustained clarity and direction across 5 days.',
    condition: {
      metric: 'focusIndex',
      operator: 'gte',
      threshold: 7,
      sustainedDays: 5,
      minObservations: 4,
      minConfidence: 0.70,
    },
  },
  {
    id: 'creativity',
    name: 'When creativity feels alive',
    tagline: 'High creative flow captured across 5 days.',
    condition: {
      metric: 'creativityIndex',
      operator: 'gte',
      threshold: 7,
      sustainedDays: 5,
      minObservations: 4,
      minConfidence: 0.70,
    },
  },
];

export const CreateTapeModal: React.FC<CreateTapeModalProps> = ({
  isOpen,
  onClose,
  onTapeCreated,
}) => {
  const [step, setStep] = useState<'compose' | 'confirm' | 'success'>('compose');
  const [title, setTitle] = useState('');
  const [sealedProse, setSealedProse] = useState('');
  const [recipientNote, setRecipientNote] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<string>('calm');

  // Custom condition state
  const [isCustom, setIsCustom] = useState(false);
  const [customMetric, setCustomMetric] = useState<'stressIndex' | 'focusIndex' | 'creativityIndex'>('stressIndex');
  const [customOperator, setCustomOperator] = useState<'lte' | 'gte'>('lte');
  const [customThreshold, setCustomThreshold] = useState<number>(4);
  const [customDays, setCustomDays] = useState<number>(7);
  const [customObservations, setCustomObservations] = useState<number>(5);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentCondition: TapeUnlockCondition = isCustom
    ? {
        metric: customMetric,
        operator: customOperator,
        threshold: customThreshold,
        sustainedDays: customDays,
        minObservations: customObservations,
        minConfidence: 0.70,
      }
    : (PRESETS.find((p) => p.id === selectedPreset)?.condition || PRESETS[0].condition);

  const wordCount = sealedProse.trim() ? sealedProse.trim().split(/\s+/).length : 0;

  const handleProceedToConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!title.trim()) {
      setErrorMessage('Please give your Temporal Tape a title.');
      return;
    }
    if (!sealedProse.trim()) {
      setErrorMessage('Please write something for your future self.');
      return;
    }

    setStep('confirm');
  };

  const handleSealTape = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const created = await sealTemporalTape({
        title: title.trim(),
        sealedProse: sealedProse.trim(),
        recipientNote: recipientNote.trim() || undefined,
        condition: currentCondition,
      });

      // Clear private reflection from state immediately upon successful sealing
      setSealedProse('');
      setTitle('');
      setRecipientNote('');
      setStep('success');

      // Notify parent
      onTapeCreated(created);
    } catch (err: any) {
      console.error('Failed to seal tape:', err);
      setErrorMessage(err.message || 'Failed to seal tape. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    // Reset state on close
    setStep('compose');
    setTitle('');
    setSealedProse('');
    setRecipientNote('');
    setErrorMessage(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-slate-950/80 backdrop-blur-md">
      <div 
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-tape-title"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 id="create-tape-title" className="text-base font-medium text-slate-100 font-['Outfit']">
                {step === 'compose' && 'Seal a Temporal Tape'}
                {step === 'confirm' && 'Confirm Seal Protocol'}
                {step === 'success' && 'Tape Sealed'}
              </h3>
              <p className="text-xs text-slate-400">
                {step === 'compose' && 'Written for your future self.'}
                {step === 'confirm' && 'Verify parameters before irreversible sealing.'}
                {step === 'success' && 'Your words are safely stored.'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {errorMessage && (
            <div className="mb-4 p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-xs text-rose-300 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* STEP 1: COMPOSE */}
          {step === 'compose' && (
            <form onSubmit={handleProceedToConfirm} className="space-y-5">
              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Tape Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Note to me when the storm passes"
                  maxLength={200}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400/50 focus:ring-1 focus:ring-amber-400/30 transition-all"
                  required
                />
              </div>

              {/* Reflection Prose */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-slate-300">
                    Your Sealed Reflection
                  </label>
                  <span className="text-[11px] text-slate-500">
                    {wordCount} {wordCount === 1 ? 'word' : 'words'}
                  </span>
                </div>
                <textarea
                  value={sealedProse}
                  onChange={(e) => setSealedProse(e.target.value)}
                  placeholder="What does your present self need your future self to remember? What truth, promise, or perspective belongs here?"
                  rows={6}
                  maxLength={50000}
                  className="w-full px-3.5 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400/50 focus:ring-1 focus:ring-amber-400/30 transition-all leading-relaxed resize-y font-mono text-xs sm:text-sm sm:font-sans"
                  required
                />
              </div>

              {/* Optional Recipient Note */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Recipient Note <span className="text-slate-500 font-normal">(Visible on the exterior while sealed)</span>
                </label>
                <input
                  type="text"
                  value={recipientNote}
                  onChange={(e) => setRecipientNote(e.target.value)}
                  placeholder="e.g., Open this on a quiet evening when you feel grounded again."
                  maxLength={500}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400/50 focus:ring-1 focus:ring-amber-400/30 transition-all"
                />
              </div>

              {/* Unlock Condition Presets */}
              <div className="pt-2 border-t border-slate-800/80">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-slate-300">
                    Unlock Condition Preset
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCustom(!isCustom)}
                    className="text-xs text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
                  >
                    {isCustom ? 'Use Presets' : 'Custom Condition'}
                  </button>
                </div>

                {!isCustom ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {PRESETS.map((preset) => {
                      const isSelected = selectedPreset === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setSelectedPreset(preset.id)}
                          className={`p-3 text-left rounded-xl border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-amber-500/10 border-amber-500/40 text-amber-200 shadow-sm'
                              : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold">{preset.name}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                          </div>
                          <p className="text-[11px] text-slate-400 leading-tight">
                            {preset.tagline}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  /* Custom condition editor */
                  <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                      <div>
                        <label className="text-slate-400 block mb-1">Metric</label>
                        <select
                          value={customMetric}
                          onChange={(e) => setCustomMetric(e.target.value as any)}
                          className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200"
                        >
                          <option value="stressIndex">Stress Index</option>
                          <option value="focusIndex">Focus Index</option>
                          <option value="creativityIndex">Creativity Index</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-slate-400 block mb-1">Operator & Target</label>
                        <div className="flex space-x-1">
                          <select
                            value={customOperator}
                            onChange={(e) => setCustomOperator(e.target.value as any)}
                            className="w-14 px-1 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-center"
                          >
                            <option value="lte">≤</option>
                            <option value="gte">≥</option>
                          </select>
                          <input
                            type="number"
                            min={1}
                            max={10}
                            value={customThreshold}
                            onChange={(e) => setCustomThreshold(Number(e.target.value))}
                            className="w-16 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-center"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-slate-400 block mb-1">Sustained Days</label>
                        <input
                          type="number"
                          min={0}
                          max={30}
                          value={customDays}
                          onChange={(e) => setCustomDays(Number(e.target.value))}
                          className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-center"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
                      <span>Minimum Entries Required:</span>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={customObservations}
                        onChange={(e) => setCustomObservations(Number(e.target.value))}
                        className="w-16 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-center"
                      />
                    </div>
                  </div>
                )}

                {/* Plain-Language Condition Statement */}
                <div className="mt-3 p-3 bg-slate-950/40 border border-slate-800/60 rounded-xl flex items-start space-x-2.5">
                  <Sparkles className="w-4 h-4 text-amber-400/80 shrink-0 mt-0.5" />
                  <div className="text-xs text-slate-400 leading-relaxed">
                    <span className="text-slate-200 font-medium">Condition: </span>
                    {formatConditionSummary(currentCondition)}.
                    <p className="mt-1 text-[11px] text-slate-500">
                      This tape will become available when your recent journal-derived signals consistently match this condition.
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center space-x-1.5 px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-semibold rounded-xl shadow-lg shadow-amber-400/20 active:scale-95 transition-all cursor-pointer"
                >
                  <span>Review & Seal</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: CONFIRM */}
          {step === 'confirm' && (
            <div className="space-y-5">
              <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                <div className="flex items-center space-x-2 text-amber-400 mb-2">
                  <Shield className="w-4 h-4" />
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    Irreversible Sealing Protocol
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Once sealed, this tape will be cryptographically locked on the server. Its text will be completely withheld from the browser until your journal entries objectively verify your condition.
                </p>
              </div>

              {/* Review Summary */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-slate-500 block">Title</span>
                  <span className="text-sm font-medium text-slate-100">{title}</span>
                </div>

                {recipientNote && (
                  <div>
                    <span className="text-[11px] uppercase tracking-wider text-slate-500 block">Recipient Note</span>
                    <span className="text-xs text-slate-300 italic">{recipientNote}</span>
                  </div>
                )}

                <div>
                  <span className="text-[11px] uppercase tracking-wider text-slate-500 block">Condition</span>
                  <span className="text-xs text-amber-300 font-medium">
                    {formatConditionSummary(currentCondition)}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] uppercase tracking-wider text-slate-500 block">Length</span>
                  <span className="text-xs text-slate-300">
                    {wordCount} words
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep('compose')}
                  disabled={isSubmitting}
                  className="flex items-center space-x-1 px-3.5 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Edit</span>
                </button>

                <button
                  type="button"
                  onClick={handleSealTape}
                  disabled={isSubmitting}
                  className="flex items-center space-x-2 px-6 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-amber-400/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Lock className="w-4 h-4" />
                  <span>{isSubmitting ? 'Sealing...' : 'Seal this tape'}</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: SUCCESS */}
          {step === 'success' && (
            <div className="py-6 text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-semibold text-slate-100 font-['Outfit']">
                  Tape Sealed
                </h4>
                <p className="mt-1.5 text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                  Sealed. Your future self will receive it when the condition is met.
                </p>
              </div>
              <div className="pt-4">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
