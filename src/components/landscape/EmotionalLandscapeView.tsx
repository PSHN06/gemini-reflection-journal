import React, { useState, useMemo, useEffect, useRef } from 'react';
import { LandscapeNode } from '../../types/landscape';
import { generateEmotionalLandscape } from '../../services/emotionalLandscapeEngine';
import {
  generatePersonalAverageLandscape,
  calculatePeriodRange,
  shiftPeriod,
  PatternTimePeriod,
} from '../../services/personalAverageEngine';
import {
  EmotionalLandscapeCanvas,
  EmotionalLandscapeCanvasHandle,
} from './EmotionalLandscapeCanvas';
import { EmotionalLandscape2DFallback } from './EmotionalLandscape2DFallback';
import { NodeDetailInspector } from './NodeDetailInspector';
import { JournalEntry, TelemetryMetrics } from '../../types';
import {
  RotateCcw,
  Activity,
  PenTool,
  Feather,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Layers,
  FileText,
  Calendar,
  Plus,
  Minus,
  Maximize2,
} from 'lucide-react';

interface EmotionalLandscapeViewProps {
  entry?: JournalEntry | null;
  entries?: JournalEntry[];
  onSelectEntry?: (entry: JournalEntry) => void;
  telemetry?: TelemetryMetrics | null;
  onReturnToJournal: () => void;
  initialMode?: 'entry' | 'patterns';
}

export const EmotionalLandscapeView: React.FC<EmotionalLandscapeViewProps> = ({
  entry,
  entries = [],
  onSelectEntry,
  telemetry,
  onReturnToJournal,
  initialMode = 'entry',
}) => {
  // Mode: 'entry' (This Entry) vs 'patterns' (My Patterns / Personal Average Map)
  const [viewMode, setViewMode] = useState<'entry' | 'patterns'>(initialMode);

  // Time Period for Personal Average Map: 'daily' | 'weekly' | 'monthly'
  const [patternPeriod, setPatternPeriod] = useState<PatternTimePeriod>('weekly');

  // Selected Reference Date for period shifting
  const [referenceDate, setReferenceDate] = useState<Date>(() => new Date());

  // Period Range Calculation
  const periodRange = useMemo(() => {
    return calculatePeriodRange(patternPeriod, referenceDate);
  }, [patternPeriod, referenceDate]);

  // Handle Period Navigation
  const handleShiftPeriod = (direction: -1 | 1) => {
    setReferenceDate((current) => shiftPeriod(patternPeriod, current, direction));
    setSelectedNodeId(null);
  };

  const handleResetToToday = () => {
    setReferenceDate(new Date());
    setSelectedNodeId(null);
  };

  // 1. Generate Entry-Specific Map
  const entryLandscapeData = useMemo(() => {
    if (!entry) return null;
    return generateEmotionalLandscape(entry, telemetry);
  }, [entry, telemetry]);

  // 2. Generate Personal Average Map
  const aggregateLandscapeData = useMemo(() => {
    return generatePersonalAverageLandscape(entries, periodRange, telemetry);
  }, [entries, periodRange, telemetry]);

  // Active Landscape Data based on current mode
  const activeLandscapeData = useMemo(() => {
    if (viewMode === 'entry') {
      return entryLandscapeData;
    }
    return aggregateLandscapeData;
  }, [viewMode, entryLandscapeData, aggregateLandscapeData]);

  const canvasRef = useRef<EmotionalLandscapeCanvasHandle>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<LandscapeNode | null>(null);
  const [zoomLevel, setZoomLevel] = useState<'overview' | 'medium' | 'close'>('overview');

  // Detect OS prefers-reduced-motion
  const [isReducedMotion, setIsReducedMotion] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  });

  // Detect WebGL capability safely
  const [isWebGLSupported, setIsWebGLSupported] = useState<boolean>(true);

  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl =
        canvas.getContext('webgl2') ||
        canvas.getContext('webgl') ||
        canvas.getContext('experimental-webgl');
      setIsWebGLSupported(Boolean(gl));
    } catch {
      setIsWebGLSupported(false);
    }
  }, []);

  // Keyboard navigation: Escape returns to overview and closes inspector
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedNodeId(null);
        setZoomLevel('overview');
        canvasRef.current?.fitView();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const selectedNode = useMemo(() => {
    if (!activeLandscapeData) return null;
    return activeLandscapeData.nodes.find((n) => n.id === selectedNodeId) || null;
  }, [activeLandscapeData, selectedNodeId]);

  // Find most recent entry date to help empty state navigation
  const latestEntryDate = useMemo(() => {
    if (!entries || entries.length === 0) return null;
    const sorted = [...entries].sort(
      (a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt)
    );
    return new Date(sorted[0].updatedAt || sorted[0].createdAt);
  }, [entries]);

  return (
    <div className="w-full h-full relative overflow-hidden bg-[#04060a] flex flex-col select-none">
      {/* 1. Refined Cinematic Header Bar (Solid/isolated from graph canvas) */}
      <header className="px-3.5 sm:px-6 py-2.5 sm:py-3 border-b border-white/[0.06] bg-[#070912]/95 backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-2.5 shrink-0 z-20 select-none">
        {/* Left: Brand Identity & Mode Switcher */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 min-w-0">
          {/* Main Title & Subtitle */}
          <div className="mr-1">
            <h1 className="text-[14.5px] sm:text-[16px] font-semibold text-[#f5f5f7] tracking-tight flex items-center space-x-2">
              <span>Emotional Landscape</span>
            </h1>
            <p className="text-[11px] text-[#86868b] hidden lg:block leading-tight font-normal">
              A 3D emotional neural map reflecting recurring patterns in your reflections.
            </p>
          </div>

          {/* Dual Visualization Mode Switcher: [This Entry] [My Patterns] */}
          <div
            className="flex items-center p-0.5 rounded-[10px] bg-[#141418]/90 backdrop-blur-md border border-[rgba(255,255,255,0.08)] shadow-lg"
            role="tablist"
            aria-label="Map Mode Switcher"
          >
            <button
              id="mode-this-entry-btn"
              role="tab"
              aria-selected={viewMode === 'entry'}
              onClick={() => {
                setViewMode('entry');
                setSelectedNodeId(null);
              }}
              className={`h-7 px-2.5 sm:px-3 rounded-[8px] text-[12px] font-medium transition-all flex items-center space-x-1.5 cursor-pointer ${
                viewMode === 'entry'
                  ? 'bg-[#27272a] text-[#f5f5f7] shadow-sm'
                  : 'text-[#86868b] hover:text-[#f5f5f7]'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>This Entry</span>
            </button>

            <button
              id="mode-my-patterns-btn"
              role="tab"
              aria-selected={viewMode === 'patterns'}
              onClick={() => {
                setViewMode('patterns');
                setSelectedNodeId(null);
              }}
              className={`h-7 px-2.5 sm:px-3 rounded-[8px] text-[12px] font-medium transition-all flex items-center space-x-1.5 cursor-pointer ${
                viewMode === 'patterns'
                  ? 'bg-[#27272a] text-[#f5f5f7] shadow-sm'
                  : 'text-[#86868b] hover:text-[#f5f5f7]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>My Patterns</span>
            </button>
          </div>

          {/* Conditional Sub-controls based on Mode */}
          {viewMode === 'entry' ? (
            /* Entry Selector when in "This Entry" mode */
            entries && entries.length > 1 && onSelectEntry && entry ? (
              <div className="flex items-center space-x-2 px-2.5 py-1 rounded-[10px] bg-[#141418]/85 backdrop-blur-md border border-[rgba(255,255,255,0.08)] text-[12px] text-[#86868b]">
                <select
                  value={entry.id}
                  onChange={(e) => {
                    const target = entries.find((item) => item.id === e.target.value);
                    if (target) onSelectEntry(target);
                    setSelectedNodeId(null);
                  }}
                  className="bg-transparent text-[#f5f5f7] font-medium text-[12px] cursor-pointer outline-none max-w-[170px] sm:max-w-[210px] truncate pr-2 py-0.5"
                  title="Select reflection to map"
                >
                  {entries.map((item) => (
                    <option key={item.id} value={item.id} className="bg-[#1a1b22] text-[#f5f5f7]">
                      {item.title || 'Untitled Reflection'}
                    </option>
                  ))}
                </select>
              </div>
            ) : null
          ) : (
            /* Time Window Switcher & Period Stepper when in "My Patterns" mode */
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* [Daily] [Weekly] [Monthly] Segmented Control */}
              <div
                className="flex items-center p-0.5 rounded-[10px] bg-[#141418]/90 backdrop-blur-md border border-[rgba(255,255,255,0.08)] shadow-lg"
                role="tablist"
                aria-label="Time Window Switcher"
              >
                {(['daily', 'weekly', 'monthly'] as PatternTimePeriod[]).map((period) => (
                  <button
                    key={period}
                    id={`pattern-period-${period}-btn`}
                    role="tab"
                    aria-selected={patternPeriod === period}
                    onClick={() => {
                      setPatternPeriod(period);
                      setSelectedNodeId(null);
                    }}
                    className={`h-7 px-2.5 rounded-[8px] text-[11.5px] font-medium transition-all capitalize cursor-pointer ${
                      patternPeriod === period
                        ? 'bg-[#27272a] text-[#f5f5f7] shadow-sm'
                        : 'text-[#86868b] hover:text-[#f5f5f7]'
                    }`}
                  >
                    {period}
                  </button>
                ))}
              </div>

              {/* Period Stepper: < [ Period Label ] > */}
              <div className="flex items-center px-1.5 py-0.5 rounded-[10px] bg-[#141418]/90 backdrop-blur-md border border-[rgba(255,255,255,0.08)] text-[12px] text-[#86868b] shadow-lg">
                <button
                  onClick={() => handleShiftPeriod(-1)}
                  className="p-1 text-[#86868b] hover:text-[#f5f5f7] hover:bg-[#202026] rounded-[6px] transition-colors cursor-pointer"
                  title="Previous Period"
                  aria-label="Previous Period"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={handleResetToToday}
                  className="px-2 py-0.5 text-[11.5px] font-medium text-[#f5f5f7] hover:text-white transition-colors cursor-pointer text-center min-w-[100px]"
                  title="Click to return to present period"
                >
                  {periodRange.periodLabel}
                </button>

                <button
                  onClick={() => handleShiftPeriod(1)}
                  disabled={periodRange.hasFutureBound}
                  className={`p-1 rounded-[6px] transition-colors ${
                    periodRange.hasFutureBound
                      ? 'text-[#3f3f46] cursor-not-allowed'
                      : 'text-[#86868b] hover:text-[#f5f5f7] hover:bg-[#202026] cursor-pointer'
                  }`}
                  title={
                    periodRange.hasFutureBound ? 'Cannot navigate past present' : 'Next Period'
                  }
                  aria-label="Next Period"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Return to Journal & Accessibility */}
        <div className="flex items-center space-x-2">
          {/* Return to Written Journal */}
          <button
            onClick={onReturnToJournal}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-[10px] bg-[#141418]/85 backdrop-blur-md border border-[rgba(255,255,255,0.08)] hover:bg-[#202026] text-[#86868b] hover:text-[#f5f5f7] text-[12px] font-medium transition-colors cursor-pointer"
            title="Return to Journal"
          >
            <PenTool className="w-3.5 h-3.5 text-[#94a3b8]" />
            <span className="hidden sm:inline">Written Journal</span>
          </button>

          {/* Reduced Motion Toggle */}
          <button
            onClick={() => setIsReducedMotion(!isReducedMotion)}
            className={`p-2 rounded-[10px] backdrop-blur-md border transition-colors cursor-pointer ${
              isReducedMotion
                ? 'bg-[#27272a] text-[#94a3b8] border-[rgba(255,255,255,0.18)]'
                : 'bg-[#141418]/85 border-[rgba(255,255,255,0.08)] text-[#86868b] hover:text-[#f5f5f7]'
            }`}
            title={isReducedMotion ? 'Motion Stillness (Active)' : 'Reduce Motion'}
            aria-label="Toggle reduced motion"
          >
            <Activity className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* 2. Main Dedicated Viewport & Dedicated Inspector Panel */}
      <main className="flex-1 min-h-0 relative flex flex-col lg:flex-row p-3 sm:p-4 gap-3 sm:gap-4 overflow-hidden">
        {/* Dedicated 3D Graph Frame (Strictly clipped container with Apple obsidian aesthetic) */}
        <div
          id="emotional-landscape-viewport-frame"
          className="relative flex-1 min-w-0 h-full rounded-2xl sm:rounded-[22px] border border-white/[0.08] bg-[#020408] overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.85)] flex flex-col"
        >
          {/* Main 3D Canvas / Dynamic Empty States */}
          <div className="flex-1 w-full min-h-0 relative overflow-hidden">
            {/* Case A: "This Entry" mode with empty or insufficient prose */}
            {viewMode === 'entry' && (!activeLandscapeData || !activeLandscapeData.hasSufficientData) ? (
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-[#07080d] text-[#f5f5f7] select-none">
                <div className="max-w-md space-y-6 p-8 sm:p-10 rounded-[24px] bg-[#13141a]/95 border border-[rgba(255,255,255,0.08)] shadow-2xl backdrop-blur-xl">
                  <div className="w-12 h-12 rounded-full bg-[#1e2029] border border-[rgba(255,255,255,0.08)] flex items-center justify-center mx-auto text-[#94a3b8]">
                    <Feather className="w-5 h-5" />
                  </div>
                  <div className="space-y-2.5">
                    <h2 className="text-[20px] font-medium tracking-tight text-[#f5f5f7]">
                      Awaiting Your Reflection
                    </h2>
                    <p className="text-[14px] text-[#86868b] leading-relaxed">
                      The 3D Emotional Landscape does not manufacture artificial feelings. It takes
                      form as your reflection deepens, mapping genuine tensions, quiet reliefs, and
                      moments of meaning in your words.
                    </p>
                  </div>
                  <button
                    onClick={onReturnToJournal}
                    className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-[12px] bg-[#27272a] hover:bg-[#3f3f46] text-[#f5f5f7] border border-[rgba(255,255,255,0.1)] text-[13px] font-medium transition-all cursor-pointer shadow-lg active:scale-95"
                  >
                    <PenTool className="w-4 h-4 text-[#94a3b8]" />
                    <span>Write in Journal</span>
                  </button>
                </div>
              </div>
            ) : viewMode === 'patterns' &&
              (!activeLandscapeData || !activeLandscapeData.hasSufficientData) ? (
              /* Case B: "My Patterns" mode with no entries or insufficient patterns */
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-[#07080d] text-[#f5f5f7] select-none">
                <div className="max-w-md space-y-6 p-8 sm:p-10 rounded-[24px] bg-[#13141a]/95 border border-[rgba(255,255,255,0.08)] shadow-2xl backdrop-blur-xl">
                  <div className="w-12 h-12 rounded-full bg-[#1e2029] border border-[rgba(255,255,255,0.08)] flex items-center justify-center mx-auto text-[#94a3b8]">
                    <Calendar className="w-5 h-5" />
                  </div>

                  <div className="space-y-2">
                    <h2 className="text-[20px] font-medium tracking-tight text-[#f5f5f7]">
                      {activeLandscapeData?.emptyReason === 'insufficient_patterns'
                        ? 'Fledgling Patterns'
                        : `No Reflections in ${periodRange.periodLabel}`}
                    </h2>
                    <p className="text-[14px] text-[#86868b] leading-relaxed">
                      {activeLandscapeData?.emptyReason === 'insufficient_patterns'
                        ? 'Not enough journal patterns yet. More reflections are needed before meaningful recurring emotional and cognitive patterns can be synthesized.'
                        : `No journal reflections were recorded between ${periodRange.periodDateRange}. Personal averages synthesize patterns across recurring reflections.`}
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
                    {latestEntryDate && (
                      <button
                        onClick={() => {
                          setReferenceDate(latestEntryDate);
                          setSelectedNodeId(null);
                        }}
                        className="w-full sm:w-auto px-4 py-2 rounded-[10px] bg-[#1c1d24] hover:bg-[#252630] text-[#f5f5f7] border border-[rgba(255,255,255,0.08)] text-[12.5px] font-medium transition-colors cursor-pointer"
                      >
                        Jump to Latest Reflections
                      </button>
                    )}
                    <button
                      onClick={onReturnToJournal}
                      className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 px-4 py-2 rounded-[10px] bg-[#27272a] hover:bg-[#3f3f46] text-[#f5f5f7] text-[12.5px] font-medium transition-colors cursor-pointer shadow-sm"
                    >
                      <PenTool className="w-3.5 h-3.5 text-[#94a3b8]" />
                      <span>Write Reflection</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : activeLandscapeData ? (
              /* Case C: Active 3D WebGL Canvas or 2D Fallback */
              <>
                {isWebGLSupported ? (
                  <EmotionalLandscapeCanvas
                    ref={canvasRef}
                    landscapeData={activeLandscapeData}
                    selectedNodeId={selectedNodeId}
                    onSelectNode={(node) => {
                      setSelectedNodeId(node ? node.id : null);
                      if (node) setZoomLevel('close');
                    }}
                    zoomLevel={zoomLevel}
                    isReducedMotion={isReducedMotion}
                    onHoverNode={(node) => setHoveredNode(node)}
                  />
                ) : (
                  <EmotionalLandscape2DFallback
                    landscapeData={activeLandscapeData}
                    selectedNodeId={selectedNodeId}
                    onSelectNode={(node) => {
                      setSelectedNodeId(node ? node.id : null);
                      if (node) setZoomLevel('close');
                    }}
                    onHoverNode={(node) => setHoveredNode(node)}
                  />
                )}
              </>
            ) : null}
          </div>

          {/* Dedicated Bottom Controls Bar (Inside UI frame, never overlapping nodes or labels) */}
          <footer
            id="landscape-bottom-toolbar"
            className="h-12 px-3 sm:px-4 bg-[#080b12]/95 border-t border-white/[0.06] backdrop-blur-md flex items-center justify-between shrink-0 z-10 select-none text-[12px]"
          >
            {/* Left: Predictable Zoom & Fit Controls */}
            <div className="flex items-center space-x-1.5" role="toolbar" aria-label="3D View Controls">
              <button
                id="zoom-in-btn"
                onClick={() => canvasRef.current?.zoomIn()}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[#94a3b8] hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer active:scale-95"
                title="Zoom In (+)"
                aria-label="Zoom In"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <button
                id="zoom-out-btn"
                onClick={() => canvasRef.current?.zoomOut()}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[#94a3b8] hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer active:scale-95"
                title="Zoom Out (-)"
                aria-label="Zoom Out"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <div className="w-[1px] h-3.5 bg-white/[0.1] mx-0.5" />
              <button
                id="zoom-fit-btn"
                onClick={() => canvasRef.current?.fitView()}
                className="h-7 px-2.5 rounded-lg flex items-center space-x-1.5 text-[#94a3b8] hover:text-white hover:bg-white/[0.08] text-[11.5px] font-medium transition-colors cursor-pointer active:scale-95"
                title="Fit View (Center Map)"
                aria-label="Fit to View"
              >
                <Maximize2 className="w-3 h-3" />
                <span className="hidden sm:inline">Fit View</span>
              </button>
              <button
                id="reset-view-btn"
                onClick={() => canvasRef.current?.resetCamera()}
                className="h-7 px-2.5 rounded-lg flex items-center space-x-1.5 text-[#94a3b8] hover:text-white hover:bg-white/[0.08] text-[11.5px] font-medium transition-colors cursor-pointer active:scale-95"
                title="Reset Camera"
                aria-label="Reset Camera"
              >
                <RotateCcw className="w-3 h-3" />
                <span className="hidden md:inline">Reset</span>
              </button>
            </div>

            {/* Center: Spatial Interaction Guide */}
            <div className="hidden lg:flex items-center space-x-2 text-[11px] text-[#64748b]">
              <span>Orbit: Drag</span>
              <span>•</span>
              <span>Zoom: Pinch / Scroll</span>
              <span>•</span>
              <span>Inspect: Click Node</span>
            </div>

            {/* Right: Camera Experience Modes (Overview, Orbit, Immerse) */}
            <div className="flex items-center p-0.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[11px] font-medium text-[#86868b]">
              <button
                onClick={() => {
                  setZoomLevel('overview');
                  setSelectedNodeId(null);
                  canvasRef.current?.fitView();
                }}
                className={`px-2.5 py-1 rounded-[6px] transition-colors cursor-pointer ${
                  zoomLevel === 'overview' && !selectedNodeId
                    ? 'bg-[#27272a] text-[#f5f5f7] shadow-sm'
                    : 'hover:text-[#f5f5f7]'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => {
                  setZoomLevel('medium');
                  setSelectedNodeId(null);
                }}
                className={`px-2.5 py-1 rounded-[6px] transition-colors cursor-pointer ${
                  zoomLevel === 'medium' && !selectedNodeId
                    ? 'bg-[#27272a] text-[#f5f5f7] shadow-sm'
                    : 'hover:text-[#f5f5f7]'
                }`}
              >
                Orbit
              </button>
              <button
                onClick={() => {
                  setZoomLevel('close');
                  if (!selectedNodeId && activeLandscapeData && activeLandscapeData.nodes.length > 0) {
                    setSelectedNodeId(activeLandscapeData.nodes[0].id);
                  }
                }}
                className={`px-2.5 py-1 rounded-[6px] transition-colors cursor-pointer ${
                  zoomLevel === 'close' || selectedNodeId
                    ? 'bg-[#27272a] text-[#f5f5f7] shadow-sm'
                    : 'hover:text-[#f5f5f7]'
                }`}
              >
                Immerse
              </button>
            </div>
          </footer>
        </div>

        {/* Mobile Node Inspector Bottom Sheet */}
        {selectedNode && activeLandscapeData && (
          <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end animate-in fade-in duration-200">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
              onClick={() => {
                setSelectedNodeId(null);
                setZoomLevel('overview');
              }}
            />
            <div className="relative w-full max-h-[82dvh] rounded-t-[24px] bg-[#0c101a] border-t border-white/[0.12] shadow-2xl flex flex-col overflow-hidden safe-area-bottom animate-in slide-in-from-bottom duration-250">
              {/* Drag handle */}
              <div className="pt-2.5 pb-1 flex justify-center shrink-0">
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>
              <div className="flex-1 overflow-y-auto">
                <NodeDetailInspector
                  node={selectedNode}
                  connections={activeLandscapeData.connections}
                  allNodes={activeLandscapeData.nodes}
                  onClose={() => {
                    setSelectedNodeId(null);
                    setZoomLevel('overview');
                  }}
                  onSelectNode={(node) => {
                    setSelectedNodeId(node.id);
                    setZoomLevel('close');
                  }}
                  className="w-full p-4 sm:p-6 text-[#f5f5f7] space-y-4 select-text flex flex-col justify-between"
                />
              </div>
            </div>
          </div>
        )}

        {/* Dedicated Side Panel Inspector Dock (Desktop only) */}
        {selectedNode && activeLandscapeData && (
          <aside
            id="emotional-landscape-inspector-dock"
            className="hidden lg:flex w-96 xl:w-[410px] h-full rounded-2xl sm:rounded-[22px] border border-white/[0.08] bg-[#090d16]/95 backdrop-blur-2xl shadow-[0_16px_48px_rgba(0,0,0,0.85)] overflow-hidden shrink-0 z-20 flex-col animate-in slide-in-from-right-4 duration-200"
          >
            <NodeDetailInspector
              node={selectedNode}
              connections={activeLandscapeData.connections}
              allNodes={activeLandscapeData.nodes}
              onClose={() => {
                setSelectedNodeId(null);
                setZoomLevel('overview');
              }}
              onSelectNode={(node) => {
                setSelectedNodeId(node.id);
                setZoomLevel('close');
              }}
              className="w-full h-full p-5 sm:p-6 text-[#f5f5f7] space-y-4 overflow-y-auto select-text flex flex-col justify-between"
            />
          </aside>
        )}
      </main>
    </div>
  );
};
