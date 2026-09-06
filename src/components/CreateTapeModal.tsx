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
  isDemo?: boolean;
}

const PRODUCTION_PRESETS: PresetOption[] = [
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

const DEMO_PRESET: PresetOption = {
  id: 'demo',
  name: 'Demo — unlocks quickly (for testing)',
  tagline: 'For demonstration only. Unlocks after 2 qualifying journal analyses.',
  isDemo: true,
  condition: {
    metric: 'focusIndex',
    operator: 'gte',
    threshold: 1,
    sustainedDays: 1,
    minObservations: 2,
    minConfidence: 0.50,
  },
};

const ALL_PRESETS: PresetOption[] = [...PRODUCTION_PRESETS, DEMO_PRESET];

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
    : (ALL_PRESETS.find((p) => p.id === selectedPreset)?.condition || PRODUCTION_PRESETS[0].condition);

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
      handleClose();
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black/60 backdrop-blur-md">
      <div 
        className="relative w-full max-w-2xl bg-[#1c1c20] border border-[rgba(255,255,255,0.08)] rounded-[20px] shadow-2xl overflow-hidden flex flex-col my-auto animate-modal-enter"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-tape-title"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[rgba(255,255,255,0.06)]">
          <div>
            <h2 id="create-tape-title" className="text-[17px] font-semibold text-[#f5f5f7] tracking-tight">
              {step === 'compose' ? 'Seal a Temporal Tape' : 'Confirm Sealing'}
            </h2>
            <p className="text-[12.5px] text-[#86868b] mt-0.5">
              {step === 'compose' 
                ? 'Leave a message for your future self.' 
                : 'Review parameters before irreversible sealing.'}
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="p-1.5 text-[#86868b] hover:text-[#f5f5f7] hover:bg-[#242428] rounded-[8px] transition-colors cursor-pointer disabled:opacity-50 btn-press"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 max-h-[75vh]">
          {errorMessage && (
            <div className="mb-5 p-3.5 bg-[#1c1c20] border border-[#ff453a]/30 rounded-[12px] text-[13px] text-[#ff453a] flex items-start space-x-2.5">
              <AlertCircle className="w-4 h-4 text-[#ff453a] shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* STEP 1: COMPOSE */}
          {step === 'compose' && (
            <form onSubmit={handleProceedToConfirm} className="space-y-5">
              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-[#f5f5f7] block">
                  Tape Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. When the dust settles"
                  maxLength={200}
                  className="w-full px-3.5 py-2.5 bg-[#121214] border border-[rgba(255,255,255,0.06)] focus:border-[rgba(255,255,255,0.15)] rounded-[10px] text-[14px] text-[#f5f5f7] placeholder-[#636366] focus:outline-none transition-colors"
                  required
                />
              </div>

              {/* Reflection Prose with Serif Font Stack */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[12px] font-medium text-[#f5f5f7] block">
                    Your Message
                  </label>
                  <span className="text-[11.5px] text-[#636366]">
                    {wordCount} {wordCount === 1 ? 'word' : 'words'}
                  </span>
                </div>
                <textarea
                  value={sealedProse}
                  onChange={(e) => setSealedProse(e.target.value)}
                  placeholder="What does your present self need your future self to remember? What truth or perspective belongs here?"
                  rows={6}
                  maxLength={50000}
                  className="w-full p-4 bg-[#121214] border border-[rgba(255,255,255,0.06)] focus:border-[rgba(255,255,255,0.15)] rounded-[12px] prose-text text-[15.5px] text-[#f5f5f7] placeholder-[#636366] focus:outline-none transition-colors resize-y leading-relaxed"
                  required
                />
              </div>

              {/* Optional Recipient Note */}
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-[#f5f5f7] block">
                  Exterior Note <span className="text-[#86868b] font-normal">(visible while sealed)</span>
                </label>
                <input
                  type="text"
                  value={recipientNote}
                  onChange={(e) => setRecipientNote(e.target.value)}
                  placeholder="e.g. Open when you feel grounded again."
                  maxLength={500}
                  className="w-full px-3.5 py-2 bg-[#121214] border border-[rgba(255,255,255,0.06)] focus:border-[rgba(255,255,255,0.15)] rounded-[10px] text-[13px] text-[#f5f5f7] placeholder-[#636366] focus:outline-none transition-colors"
                />
              </div>

              {/* Unlock Condition Presets */}
              <div className="pt-4 border-t border-[rgba(255,255,255,0.06)] space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[12px] font-medium text-[#f5f5f7] block">
                    Unlock Condition
                  </label>
                </div>

                {!isCustom ? (
                  <div className="space-y-3">
                    {/* Three Production Presets */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {PRODUCTION_PRESETS.map((preset) => {
                        const isSelected = selectedPreset === preset.id;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => setSelectedPreset(preset.id)}
                            className={`p-3 text-left rounded-[12px] border transition-colors cursor-pointer btn-press ${
                              isSelected
                                ? 'bg-[#242428] border-[#0a84ff] text-[#f5f5f7]'
                                : 'bg-[#121214] border-[rgba(255,255,255,0.06)] text-[#86868b] hover:text-[#f5f5f7]'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[13px] font-medium text-[#f5f5f7]">{preset.name}</span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-[#0a84ff] shrink-0" />}
                            </div>
                            <p className="text-[11.5px] leading-snug text-[#86868b]">
                              {preset.tagline}
                            </p>
                          </button>
                        );
                      })}
                    </div>

                    {/* Demo Preset */}
                    <div className="pt-2 border-t border-[rgba(255,255,255,0.04)]">
                      <button
                        type="button"
                        onClick={() => setSelectedPreset(DEMO_PRESET.id)}
                        className={`w-full p-2.5 text-left rounded-[10px] border transition-colors cursor-pointer flex items-center justify-between btn-press ${
                          selectedPreset === DEMO_PRESET.id
                            ? 'bg-[#242428] border-[#86868b] text-[#f5f5f7]'
                            : 'bg-[#121214] border-[rgba(255,255,255,0.06)] text-[#86868b] hover:text-[#f5f5f7]'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <span className="text-[12px] font-medium text-[#f5f5f7]">
                            {DEMO_PRESET.name}
                          </span>
                          <p className="text-[11.5px] text-[#86868b]">
                            {DEMO_PRESET.tagline}
                          </p>
                        </div>
                        {selectedPreset === DEMO_PRESET.id && (
                          <Check className="w-3.5 h-3.5 text-[#f5f5f7] shrink-0 ml-2" />
                        )}
                      </button>
                    </div>

                    {/* Quiet text link for custom condition */}
                    <div className="text-right pt-1">
                      <button
                        type="button"
                        onClick={() => setIsCustom(true)}
                        className="text-[12px] text-[#86868b] hover:text-[#f5f5f7] underline underline-offset-4 cursor-pointer"
                      >
                        Configure custom condition
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Custom condition editor */
                  <div className="p-4 bg-[#121214] border border-[rgba(255,255,255,0.06)] rounded-[12px] space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <label className="text-[11px] text-[#86868b] block mb-1">Metric</label>
                        <select
                          value={customMetric}
                          onChange={(e) => setCustomMetric(e.target.value as any)}
                          className="w-full p-2 bg-[#1c1c20] border border-[rgba(255,255,255,0.08)] rounded-[8px] text-[#f5f5f7]"
                        >
                          <option value="stressIndex">Stress Index</option>
                          <option value="focusIndex">Focus Index</option>
                          <option value="creativityIndex">Creativity Index</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] text-[#86868b] block mb-1">Operator & Target</label>
                        <div className="flex space-x-1">
                          <select
                            value={customOperator}
                            onChange={(e) => setCustomOperator(e.target.value as any)}
                            className="w-14 p-2 bg-[#1c1c20] border border-[rgba(255,255,255,0.08)] rounded-[8px] text-[#f5f5f7] text-center"
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
                            className="w-16 p-2 bg-[#1c1c20] border border-[rgba(255,255,255,0.08)] rounded-[8px] text-[#f5f5f7] text-center"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[11px] text-[#86868b] block mb-1">Sustained Days</label>
                        <input
                          type="number"
                          min={0}
                          max={30}
                          value={customDays}
                          onChange={(e) => setCustomDays(Number(e.target.value))}
                          className="w-full p-2 bg-[#1c1c20] border border-[rgba(255,255,255,0.08)] rounded-[8px] text-[#f5f5f7] text-center"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-[rgba(255,255,255,0.06)] text-[12px] text-[#86868b]">
                      <span>Minimum Observations:</span>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={customObservations}
                        onChange={(e) => setCustomObservations(Number(e.target.value))}
                        className="w-16 p-1.5 bg-[#1c1c20] border border-[rgba(255,255,255,0.08)] rounded-[8px] text-[#f5f5f7] text-center"
                      />
                    </div>
                    <div className="text-right pt-1">
                      <button
                        type="button"
                        onClick={() => setIsCustom(false)}
                        className="text-[12px] text-[#86868b] hover:text-[#f5f5f7] underline underline-offset-4 cursor-pointer"
                      >
                        Use standard presets
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end space-x-2.5 pt-4 border-t border-[rgba(255,255,255,0.06)]">
                <button
                  type="button"
                  onClick={handleClose}
                  className="h-8 px-3.5 text-[13px] text-[#86868b] hover:text-[#f5f5f7] rounded-[8px] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-8 px-4 bg-[#f5f5f7] hover:bg-[#e5e5ea] text-[#121214] text-[13px] font-medium rounded-[8px] transition-colors cursor-pointer btn-press shadow-xs"
                >
                  Continue
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: CONFIRM (Irreversible sealing) */}
          {step === 'confirm' && (
            <div className="space-y-5">
              {/* Summary card */}
              <div className="p-4 bg-[#121214] border border-[rgba(255,255,255,0.06)] rounded-[14px] space-y-3">
                <div>
                  <span className="text-[11px] text-[#86868b] block">Title</span>
                  <span className="text-[15px] font-medium text-[#f5f5f7]">{title}</span>
                </div>

                {recipientNote && (
                  <div>
                    <span className="text-[11px] text-[#86868b] block">Exterior Note</span>
                    <span className="text-[13px] text-[#86868b] italic">&ldquo;{recipientNote}&rdquo;</span>
                  </div>
                )}

                <div>
                  <span className="text-[11px] text-[#86868b] block">Unlock Condition</span>
                  <span className="text-[13px] text-[#f5f5f7] font-medium">
                    {formatConditionSummary(currentCondition)}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] text-[#86868b] block">Length</span>
                  <span className="text-[12px] text-[#f5f5f7]">
                    {wordCount} words
                  </span>
                </div>
              </div>

              {/* Strict Warning */}
              <div className="p-4 bg-[#18181c] border-l-2 border-[#ff9f0a] rounded-r-[12px]">
                <p className="text-[13px] text-[#f5f5f7] leading-relaxed">
                  Once sealed, this tape cannot be read by anyone — including you — until the condition is met. The content is preserved securely.
                </p>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-[rgba(255,255,255,0.06)]">
                <button
                  type="button"
                  onClick={() => setStep('compose')}
                  disabled={isSubmitting}
                  className="text-[13px] text-[#86868b] hover:text-[#f5f5f7] cursor-pointer"
                >
                  Back to edit
                </button>

                <button
                  type="button"
                  onClick={handleSealTape}
                  disabled={isSubmitting}
                  className="w-full sm:w-auto h-9 px-5 bg-[#ff9f0a] hover:bg-[#e08c07] text-[#121214] text-[13px] font-medium rounded-[8px] transition-colors cursor-pointer disabled:opacity-50 btn-press shadow-xs"
                >
                  {isSubmitting ? 'Sealing...' : 'Seal this tape'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
