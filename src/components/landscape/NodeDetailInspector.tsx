import React from 'react';
import { LandscapeNode, LandscapeConnection } from '../../types/landscape';
import { X, Quote, ArrowLeft } from 'lucide-react';

export interface NodeDetailInspectorProps {
  node: LandscapeNode;
  connections: LandscapeConnection[];
  allNodes: LandscapeNode[];
  onClose: () => void;
  onSelectNode: (node: LandscapeNode) => void;
  className?: string;
}

export const NodeDetailInspector: React.FC<NodeDetailInspectorProps> = ({
  node,
  connections,
  allNodes,
  onClose,
  onSelectNode,
  className,
}) => {
  const nodeMap = new Map<string, LandscapeNode>();
  allNodes.forEach((n) => nodeMap.set(n.id, n));

  // Find all connections relevant to this node
  const relevantConns = connections.filter(
    (c) => c.sourceId === node.id || c.targetId === node.id
  );

  const formatFormName = (form: string) => {
    return form
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

  return (
    <div
      className={
        className ||
        'w-full h-full bg-[#0a0d14]/95 backdrop-blur-2xl p-5 sm:p-6 text-[#f5f5f7] space-y-4 overflow-y-auto select-text flex flex-col justify-between'
      }
      role="dialog"
      aria-labelledby="node-inspector-title"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 pb-3 border-b border-[rgba(255,255,255,0.06)]">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <span
              className="w-2.5 h-2.5 rounded-full inline-block"
              style={{ backgroundColor: node.colorSpec.rimColor }}
            />
            <span className="text-[11px] uppercase tracking-wider text-[#86868b] font-medium">
              {node.category.replace('_', ' ')}
            </span>
            {node.aggregateMeta && (
              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-[#2d2419] text-[#edd4ad] border border-[#5c4426]">
                {node.aggregateMeta.frequencyPercentage}% of reflections
              </span>
            )}
          </div>
          <h3
            id="node-inspector-title"
            className="text-[18px] font-semibold text-[#f5f5f7] tracking-tight leading-snug"
          >
            {node.shortLabel}
          </h3>
          {node.aggregateMeta && (
            <p className="text-[11.5px] text-[#a1a1aa] mt-0.5">
              Identified in {node.aggregateMeta.entryCount} of {node.aggregateMeta.totalEntriesInPeriod} reflections
            </p>
          )}
        </div>

        <button
          onClick={onClose}
          className="p-1.5 text-[#86868b] hover:text-[#f5f5f7] hover:bg-[#202026] rounded-[8px] transition-colors cursor-pointer"
          aria-label="Close details"
          title="Return to Overview (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Experiential Atmosphere & Narrative Significance */}
      <div className="space-y-2">
        <p className="text-[13.5px] text-[#d4d4d8] leading-relaxed font-normal">
          {node.experientialAtmosphere}
        </p>
        {node.narrativeSignificance && node.narrativeSignificance !== node.experientialAtmosphere && (
          <p className="text-[12px] text-[#9ca3af] leading-relaxed">
            {node.narrativeSignificance}
          </p>
        )}
      </div>

      {/* Grounded Verbatim Passage or Cross-Reflection Excerpts */}
      {node.aggregateMeta && node.aggregateMeta.representativeQuotes.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center space-x-1.5 text-[11px] text-[#a1a1aa] font-medium">
            <Quote className="w-3 h-3 text-[#94a3b8]" />
            <span>Cross-Reflection Excerpts:</span>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {node.aggregateMeta.representativeQuotes.map((item, idx) => (
              <div
                key={idx}
                className="p-3 rounded-[12px] bg-[#1a1a20] border border-[rgba(255,255,255,0.05)] space-y-1"
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-medium text-[#e2e8f0] truncate max-w-[210px]">
                    {item.entryTitle}
                  </span>
                  <span className="text-[#86868b] text-[10.5px] font-mono">{item.dateStr}</span>
                </div>
                <p className="text-[12px] text-[#d4d4d8] italic leading-relaxed pl-2 border-l-2 border-[#71717a]">
                  &ldquo;{item.quote}&rdquo;
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-3.5 rounded-[14px] bg-[#1a1a20] border border-[rgba(255,255,255,0.05)] space-y-1.5">
          <div className="flex items-center space-x-1.5 text-[11px] text-[#a1a1aa] font-medium">
            <Quote className="w-3 h-3 text-[#94a3b8]" />
            <span>Grounded in your writing:</span>
          </div>
          <p className="text-[13px] text-[#e2e8f0] italic leading-relaxed pl-2.5 border-l-2 border-[#71717a]">
            &ldquo;{node.groundedQuote}&rdquo;
          </p>
        </div>
      )}

      {/* Related Concepts if Aggregate */}
      {node.aggregateMeta && node.aggregateMeta.relatedConcepts.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <span className="text-[11px] text-[#86868b] block font-medium">Co-Occurring Themes</span>
          <div className="flex flex-wrap gap-1.5">
            {node.aggregateMeta.relatedConcepts.map((concept) => (
              <span
                key={concept}
                className="px-2 py-0.5 rounded-[6px] bg-[#1e1e24] text-[#d4d4d8] border border-[rgba(255,255,255,0.06)] text-[11px]"
              >
                {concept}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Visual Character & Organic Qualities */}
      <div className="grid grid-cols-2 gap-2 text-[12px]">
        <div className="p-2.5 rounded-[10px] bg-[#1a1a20]/60 border border-[rgba(255,255,255,0.04)] space-y-0.5">
          <span className="text-[11px] text-[#86868b] block">Organic Form</span>
          <span className="font-medium text-[#f5f5f7]">{formatFormName(node.outerForm)}</span>
        </div>
        <div className="p-2.5 rounded-[10px] bg-[#1a1a20]/60 border border-[rgba(255,255,255,0.04)] space-y-0.5">
          <span className="text-[11px] text-[#86868b] block">Surface Dynamic</span>
          <span className="font-medium text-[#f5f5f7]">{formatFormName(node.surfaceBehavior)}</span>
        </div>
        <div className="p-2.5 rounded-[10px] bg-[#1a1a20]/60 border border-[rgba(255,255,255,0.04)] space-y-0.5">
          <span className="text-[11px] text-[#86868b] block">Material Texture</span>
          <span className="font-medium text-[#f5f5f7]">{formatFormName(node.materialType)}</span>
        </div>
        <div className="p-2.5 rounded-[10px] bg-[#1a1a20]/60 border border-[rgba(255,255,255,0.04)] space-y-0.5">
          <span className="text-[11px] text-[#86868b] block">Emotional Calmness</span>
          <div className="flex items-center space-x-2 mt-0.5">
            <div className="flex-1 h-1.5 bg-[#27272a] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#94a3b8] rounded-full"
                style={{ width: `${Math.round(node.calmness * 100)}%` }}
              />
            </div>
            <span className="text-[10.5px] text-[#86868b] font-mono">
              {Math.round(node.calmness * 10)}/10
            </span>
          </div>
        </div>
      </div>

      {/* Relational Strands */}
      {relevantConns.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-[rgba(255,255,255,0.06)]">
          <span className="text-[11.5px] font-medium text-[#86868b] block">
            Atmospheric Resonance
          </span>
          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
            {relevantConns.map((conn) => {
              const otherNodeId = conn.sourceId === node.id ? conn.targetId : conn.sourceId;
              const otherNode = nodeMap.get(otherNodeId);
              if (!otherNode) return null;

              return (
                <button
                  key={conn.id}
                  onClick={() => onSelectNode(otherNode)}
                  className="w-full text-left p-2.5 rounded-[10px] bg-[#1a1a20] hover:bg-[#222228] transition-colors border border-[rgba(255,255,255,0.04)] text-[12px] group cursor-pointer"
                >
                  <div className="flex items-center justify-between text-[#86868b] group-hover:text-[#f5f5f7] mb-1">
                    <span className="font-medium text-[#f5f5f7]">{otherNode.shortLabel}</span>
                    <span className="text-[10px] uppercase tracking-wider text-[#94a3b8]">
                      {conn.relationshipType.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-[11.5px] text-[#86868b] leading-relaxed">
                    {conn.resonanceExplanation}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Return to Overview Button */}
      <div className="pt-2 border-t border-[rgba(255,255,255,0.06)] flex justify-end">
        <button
          onClick={onClose}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-[8px] bg-[#27272a] hover:bg-[#3f3f46] text-[#f5f5f7] text-[12px] font-medium transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Overview</span>
        </button>
      </div>
    </div>
  );
};
