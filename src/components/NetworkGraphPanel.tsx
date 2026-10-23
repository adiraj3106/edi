import { useState, useEffect, useRef, useMemo } from 'react';
import { useClaims } from '../context/ClaimsContext';
import {
  Network,
  User,
  MapPin,
  FileText,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Eye,
  Loader2,
} from 'lucide-react';

const API_BASE_URL = 'http://localhost:8000';

/**
 * Deterministic string hash for position seeding (no Math.random)
 */
function hashNodeId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Formats risk score (accepts 0-1 or 0-100)
 */
function formatRiskPercent(value: any): string {
  if (typeof value !== 'number' || isNaN(value)) return 'N/A';
  if (value <= 1.0) return `${Math.round(value * 100)}%`;
  return `${Math.round(value)}%`;
}

/**
 * Formats entity kind into human readable label
 */
function formatNodeKind(kind: any): string {
  switch (kind) {
    case 'claim':
      return 'Claim Entity';
    case 'farmer':
      return 'Producer / Farmer';
    case 'assessor':
      return 'Loss Adjuster';
    case 'zone':
      return 'PMFBY Zone Cluster';
    case 'farmland':
      return 'PMFBY Farmland Parcel';
    default:
      return typeof kind === 'string' ? kind.charAt(0).toUpperCase() + kind.slice(1) : String(kind);
  }
}

/**
 * Formats edge relationship kind
 */
function formatEdgeKind(kind: any): string {
  switch (kind) {
    case 'filed_by':
      return 'Filed By';
    case 'assessed_by':
    case 'verified_by':
      return 'Verified By';
    case 'located_on':
      return 'Located On';
    case 'in_zone':
      return 'In Zone';
    case 'family_claim':
      return 'Family Claim';
    case 'owns':
      return 'Owns / Operates';
    case 'co_assessed':
      return 'Co-Assessed Claim';
    case 'adjacent_to':
      return 'Parcel Adjacency';
    default:
      return typeof kind === 'string' ? kind.replace(/_/g, ' ') : String(kind);
  }
}

export interface NetworkGraphPanelProps {
  claimId?: string;
  graph?: any;
  onSelectClaimNode?: (id: string) => void;
}

export function NetworkGraphPanel({
  claimId: propClaimId,
  graph: propGraph,
  onSelectClaimNode,
}: NetworkGraphPanelProps = {}) {
  const claimsContext = useClaims();

  const selectedClaim = claimsContext?.selectedClaim;
  const selectClaim = claimsContext?.selectClaim ?? onSelectClaimNode;
  const claimId = propClaimId ?? selectedClaim?.metadata?.claimId ?? claimsContext?.state?.selectedClaimId ?? null;

  // Graph state: retains previous graph while loading new graph
  const [networkGraph, setNetworkGraph] = useState<any>(propGraph ?? null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Manual Drag overrides: reset on graph change
  const [draggedPositions, setDraggedPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Hover & selection
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<any>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Viewport zoom & pan
  const [showAnomalousOnly, setShowAnomalousOnly] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const svgRef = useRef<SVGSVGElement | null>(null);

  // ── 1. FETCH /claims/{id}/network ONCE PER SELECTED CLAIM ID ───────────
  // Note: useEffect depends ONLY on claimId
  useEffect(() => {
    if (!claimId) return;

    let isMounted = true;
    setIsLoading(true);

    fetch(`${API_BASE_URL}/claims/${claimId}/network`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (isMounted) {
          setNetworkGraph(data);
          setIsLoading(false);
          setDraggedPositions({});
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Failed to fetch claim network:', err);
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [claimId]);

  // ── 2. COMPUTE DETERMINISTIC LAYOUT ONCE PER FETCHED GRAPH WITH useMemo ──
  // Claim at the center, farmer/assessor/zone in an inner ring,
  // other claims in an outer ring, positions seeded from node IDs, NO Math.random.
  const activeGraph = propGraph ?? networkGraph;

  const { nodes, edges, nodePositions } = useMemo(() => {
    if (!activeGraph || !activeGraph.nodes || activeGraph.nodes.length === 0) {
      return { nodes: [], edges: [], nodePositions: {} };
    }

    const rawNodes = activeGraph.nodes.map((n: any) => ({
      id: String(n.id),
      label: String(n.label || n.id),
      kind: String(n.kind || n.type || 'claim'),
      type: String(n.type || n.kind || 'claim'),
      risk_score:
        typeof n.risk_score === 'number'
          ? n.risk_score
          : typeof n.riskScore === 'number'
          ? n.riskScore <= 1
            ? n.riskScore * 100
            : n.riskScore
          : null,
      riskScore:
        typeof n.riskScore === 'number'
          ? n.riskScore
          : typeof n.risk_score === 'number'
          ? n.risk_score / 100.0
          : null,
      riskTier: n.triage_tier || n.riskTier || null,
      communityClusterId: n.communityClusterId || null,
    }));

    const rawEdges = (activeGraph.edges || []).map((e: any) => ({
      source: String(e.source),
      target: String(e.target),
      kind: String(e.relationship || e.kind || 'connected_to'),
      relationship: String(e.relationship || e.kind || 'connected_to'),
      weight: typeof e.weight === 'number' ? e.weight : 1.0,
      isAnomalous: Boolean(e.is_anomalous ?? e.isAnomalous),
    }));

    const width = 800;
    const height = 500;
    const centerX = width / 2;
    const centerY = height / 2;

    const positions: Record<string, { x: number; y: number }> = {};

    // 1. Center node: the main claim
    const mainClaimNode =
      rawNodes.find((n: any) => n.id === claimId) ||
      rawNodes.find((n: any) => n.kind === 'claim' || n.type === 'claim') ||
      rawNodes[0];

    if (mainClaimNode) {
      positions[mainClaimNode.id] = { x: centerX, y: centerY };
    }

    // 2. Inner ring: farmer, assessor, zone / farmland
    const innerKinds = new Set(['farmer', 'assessor', 'zone', 'farmland']);
    const innerRingNodes = rawNodes.filter(
      (n: any) => n.id !== mainClaimNode?.id && (innerKinds.has(n.kind) || innerKinds.has(n.type))
    );

    innerRingNodes.sort((a: any, b: any) => a.id.localeCompare(b.id));
    const innerTotal = innerRingNodes.length;

    innerRingNodes.forEach((node: any, idx: number) => {
      const baseAngle = innerTotal > 0 ? (idx / innerTotal) * 2 * Math.PI - Math.PI / 2 : 0;
      const seed = hashNodeId(node.id);
      const radiusJitter = (seed % 21) - 10; // deterministic -10 to +10 px
      let baseRadius = 140;
      if (node.kind === 'assessor' || node.type === 'assessor') baseRadius = 135;
      if (node.kind === 'zone' || node.type === 'zone' || node.kind === 'farmland') baseRadius = 145;
      const radius = baseRadius + radiusJitter;

      positions[node.id] = {
        x: Math.round(centerX + radius * Math.cos(baseAngle)),
        y: Math.round(centerY + radius * Math.sin(baseAngle)),
      };
    });

    // 3. Outer ring: other claims
    const outerRingNodes = rawNodes.filter(
      (n: any) => n.id !== mainClaimNode?.id && !innerKinds.has(n.kind) && !innerKinds.has(n.type)
    );

    outerRingNodes.sort((a: any, b: any) => a.id.localeCompare(b.id));
    const outerTotal = outerRingNodes.length;

    outerRingNodes.forEach((node: any, idx: number) => {
      const baseAngle = outerTotal > 0 ? (idx / outerTotal) * 2 * Math.PI - Math.PI / 2 : 0;
      const seed = hashNodeId(node.id);
      const radiusJitter = (seed % 31) - 15; // deterministic -15 to +15 px
      const radius = 220 + radiusJitter;

      positions[node.id] = {
        x: Math.round(centerX + radius * Math.cos(baseAngle)),
        y: Math.round(centerY + radius * Math.sin(baseAngle)),
      };
    });

    return {
      nodes: rawNodes,
      edges: rawEdges,
      nodePositions: positions,
    };
  }, [activeGraph, claimId]);

  // Mouse drag handlers
  const handleMouseDownNode = (e: any, nodeId: string) => {
    e.stopPropagation();
    setDraggedNodeId(nodeId);

    if (!svgRef.current) return;
    const svgRect = svgRef.current.getBoundingClientRect();
    const clickX = (e.clientX - svgRect.left - panOffset.x) / zoomLevel;
    const clickY = (e.clientY - svgRect.top - panOffset.y) / zoomLevel;

    const currentPos = draggedPositions[nodeId] || nodePositions[nodeId] || { x: 400, y: 250 };
    setDragOffset({
      x: clickX - currentPos.x,
      y: clickY - currentPos.y,
    });
  };

  const handleMouseMoveCanvas = (e: any) => {
    if (draggedNodeId) {
      if (!svgRef.current) return;
      const svgRect = svgRef.current.getBoundingClientRect();
      const currentX = (e.clientX - svgRect.left - panOffset.x) / zoomLevel;
      const currentY = (e.clientY - svgRect.top - panOffset.y) / zoomLevel;

      setDraggedPositions((prev) => ({
        ...prev,
        [draggedNodeId]: {
          x: Math.max(40, Math.min(760, currentX - dragOffset.x)),
          y: Math.max(40, Math.min(460, currentY - dragOffset.y)),
        },
      }));
    } else if (isPanning) {
      setPanOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
  };

  const handleMouseUpCanvas = () => {
    setDraggedNodeId(null);
    setIsPanning(false);
  };

  const handleStartPan = (e: any) => {
    if (e.target === svgRef.current || e.target?.tagName === 'svg' || e.target?.tagName === 'rect') {
      setIsPanning(true);
      setPanStart({
        x: e.clientX - panOffset.x,
        y: e.clientY - panOffset.y,
      });
    }
  };

  const resetView = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
    setDraggedPositions({});
  };

  // Filter edges if showAnomalousOnly is active
  const filteredEdges = useMemo(() => {
    if (!edges) return [];
    if (showAnomalousOnly) {
      return edges.filter((e: any) => e.isAnomalous);
    }
    return edges;
  }, [edges, showAnomalousOnly]);

  // ── 3. EMPTY & LOADING INITIAL STATES ─────────────────────────────────
  if (!activeGraph && isLoading) {
    return (
      <div className="flex h-full min-h-[500px] w-full flex-col items-center justify-center rounded-xl border border-dashed border-[#CBD5E1] dark:border-[#334155] bg-[#F8FAFC]/60 dark:bg-[#0F172A]/40 p-8 text-center shadow-inner">
        <div className="relative mb-5 flex h-20 w-20 items-center justify-center rounded-2xl border border-forest-600/30 bg-forest-500/10 p-4">
          <Loader2 className="h-10 w-10 text-forest-600 animate-spin" />
        </div>
        <h3 className="font-serif text-lg font-bold text-[#0F172A] dark:text-white mb-2">
          Loading Network Topology...
        </h3>
        <p className="max-w-md text-sm text-[#64748B] dark:text-[#94A3B8] font-sans leading-relaxed mb-4">
          Fetching claim relationship network from AgriGuard backend...
        </p>
      </div>
    );
  }

  if (!activeGraph || nodes.length === 0) {
    return (
      <div className="flex h-full min-h-[500px] w-full flex-col items-center justify-center rounded-xl border border-dashed border-[#CBD5E1] dark:border-[#334155] bg-[#F8FAFC]/60 dark:bg-[#0F172A]/40 p-8 text-center shadow-inner">
        <div className="relative mb-5 flex h-20 w-20 items-center justify-center rounded-2xl border border-forest-600/30 bg-forest-500/10 p-4">
          <Network className="h-10 w-10 text-forest-600 animate-pulse" />
        </div>
        <h3 className="font-serif text-lg font-bold text-[#0F172A] dark:text-white mb-2">
          Network Topology Analyzer
        </h3>
        <p className="max-w-md text-sm text-[#64748B] dark:text-[#94A3B8] font-sans leading-relaxed mb-4">
          Select a claim from the ledger to inspect graph topology, shared adjuster connections, and collusion subgraphs.
        </p>
        <div className="flex items-center gap-2 rounded-lg bg-white dark:bg-[#1E293B] px-3.5 py-2 text-xs font-mono text-[#475569] dark:text-[#CBD5E1] border border-[#CBD5E1] dark:border-[#334155] shadow-sm">
          <span>Awaiting claim network data...</span>
        </div>
      </div>
    );
  }

  const hoveredNode = nodes.find((n: any) => n.id === hoveredNodeId);

  return (
    <div className="flex flex-col h-full w-full bg-[#0F172A] text-white rounded-xl border border-[#1E293B] shadow-2xl overflow-hidden font-sans select-none relative">
      
      {/* ── TOP GRAPH CONTROL BAR ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1E293B] bg-[#1E293B]/80 px-4 py-3 z-10 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-forest-600/20 text-forest-500 border border-forest-600/30">
            <Network className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-serif text-sm font-bold text-white flex items-center gap-2">
              Graph Topology & Collusion Network
              {isLoading && (
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-forest-600/20 text-forest-300 border border-forest-600/40 text-[10px] font-mono animate-pulse">
                  <span className="h-1.5 w-1.5 rounded-full bg-forest-400 animate-ping inline-block" />
                  Loading...
                </span>
              )}
            </h3>
            <p className="text-[11px] text-[#94A3B8] font-mono">
              {nodes.length} Nodes • {edges.length} Edges • Claim: {claimId || 'N/A'}
            </p>
          </div>
        </div>

        {/* Action Toggles */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAnomalousOnly(!showAnomalousOnly)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono font-medium border transition-all ${
              showAnomalousOnly
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                : 'bg-[#0F172A] text-[#94A3B8] border-[#334155] hover:text-white'
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>{showAnomalousOnly ? 'Showing Anomalies Only' : 'All Links'}</span>
          </button>

          <button
            onClick={() => setShowLabels(!showLabels)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono font-medium border transition-all ${
              showLabels
                ? 'bg-forest-600/20 text-forest-300 border-forest-600/40'
                : 'bg-[#0F172A] text-[#94A3B8] border-[#334155] hover:text-white'
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            <span>Labels</span>
          </button>

          <div className="flex items-center border border-[#334155] rounded-lg bg-[#0F172A] p-0.5">
            <button
              onClick={() => setZoomLevel((z) => Math.min(2, z + 0.15))}
              className="p-1 text-[#94A3B8] hover:text-white rounded transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setZoomLevel((z) => Math.max(0.6, z - 0.15))}
              className="p-1 text-[#94A3B8] hover:text-white rounded transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={resetView}
              className="p-1 text-[#94A3B8] hover:text-white rounded transition-colors border-l border-[#334155]"
              title="Reset View"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── CANVAS VIEWPORT & INTERACTIVE SVG TOPOLOGY ───────────────────── */}
      <div
        className="relative flex-1 w-full min-h-[460px] bg-[#090D16] overflow-hidden cursor-grab active:cursor-grabbing"
        onMouseDown={handleStartPan}
        onMouseMove={handleMouseMoveCanvas}
        onMouseUp={handleMouseUpCanvas}
      >
        {/* Background Grid Pattern */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#334155" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* Main SVG Render Container */}
        <svg
          ref={svgRef}
          className="w-full h-full min-h-[460px]"
          viewBox="0 0 800 500"
          preserveAspectRatio="xMidYMid meet"
        >
          <g transform={`translate(${panOffset.x}, ${panOffset.y}) scale(${zoomLevel})`}>
            
            {/* ── EDGES LAYER ────────────────────────────────────────────── */}
            {filteredEdges.map((edge: any, idx: number) => {
              const sourcePos = draggedPositions[edge.source] || nodePositions[edge.source];
              const targetPos = draggedPositions[edge.target] || nodePositions[edge.target];
              if (!sourcePos || !targetPos) return null;

              const isHighlighted =
                hoveredNodeId === edge.source ||
                hoveredNodeId === edge.target ||
                hoveredEdge === edge;

              return (
                <g key={`edge-${idx}`}>
                  {/* Outer glow line for anomalous collusion edges */}
                  {edge.isAnomalous && (
                    <line
                      x1={sourcePos.x}
                      y1={sourcePos.y}
                      x2={targetPos.x}
                      y2={targetPos.y}
                      stroke="#EF4444"
                      strokeWidth={isHighlighted ? 6 : 4}
                      strokeOpacity="0.4"
                    />
                  )}

                  {/* Main Line */}
                  <line
                    x1={sourcePos.x}
                    y1={sourcePos.y}
                    x2={targetPos.x}
                    y2={targetPos.y}
                    stroke={
                      edge.isAnomalous
                        ? '#EF4444'
                        : isHighlighted
                        ? '#2A8E58'
                        : '#334155'
                    }
                    strokeWidth={edge.isAnomalous ? 2.5 : isHighlighted ? 2.5 : 1.5}
                    strokeDasharray={edge.isAnomalous ? '6,4' : 'none'}
                    onMouseEnter={() => setHoveredEdge(edge)}
                    onMouseLeave={() => setHoveredEdge(null)}
                    className="transition-all duration-200 cursor-pointer"
                  />

                  {/* Midpoint Relationship Badge */}
                  {showLabels && (
                    <g
                      transform={`translate(${(sourcePos.x + targetPos.x) / 2}, ${
                        (sourcePos.y + targetPos.y) / 2
                      })`}
                    >
                      <rect
                        x="-32"
                        y="-10"
                        width="64"
                        height="18"
                        rx="4"
                        fill="#0F172A"
                        stroke={edge.isAnomalous ? '#EF4444' : '#334155'}
                        strokeWidth="1"
                      />
                      <text
                        x="0"
                        y="2"
                        textAnchor="middle"
                        fill={edge.isAnomalous ? '#FCA5A5' : '#94A3B8'}
                        fontSize="9"
                        fontFamily="monospace"
                        fontWeight="bold"
                      >
                        {formatEdgeKind(edge.kind)}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* ── NODES LAYER ────────────────────────────────────────────── */}
            {nodes.map((node: any) => {
              const pos = draggedPositions[node.id] || nodePositions[node.id] || { x: 400, y: 250 };
              const isSelected = selectedNodeId === node.id || claimId === node.id;
              const isHovered = hoveredNodeId === node.id;
              const isAssessorHub = node.kind === 'assessor' || node.type === 'assessor';

              // Theme palette matching entity type
              let fillBg = '#1E293B';
              let strokeColor = '#64748B';
              let iconColor = '#94A3B8';

              const nodeKind = node.kind || node.type;
              switch (nodeKind) {
                case 'claim':
                  const isHighRisk = node.riskTier === 'investigate' || (typeof node.risk_score === 'number' && node.risk_score >= 70);
                  fillBg = isHighRisk ? '#451A03' : '#0B2619';
                  strokeColor = isHighRisk ? '#EF4444' : '#2A8E58';
                  iconColor = isHighRisk ? '#FCA5A5' : '#A7F3D0';
                  break;
                case 'farmer':
                  fillBg = '#14532D';
                  strokeColor = '#22C55E';
                  iconColor = '#86EFAC';
                  break;
                case 'assessor':
                  fillBg = '#78350F';
                  strokeColor = '#F59E0B';
                  iconColor = '#FDE68A';
                  break;
                case 'zone':
                case 'farmland':
                  fillBg = '#365314';
                  strokeColor = '#84CC16';
                  iconColor = '#D9F99D';
                  break;
              }

              return (
                <g
                  key={`node-${node.id}`}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  onMouseDown={(e) => handleMouseDownNode(e, node.id)}
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                  onClick={() => {
                    setSelectedNodeId(node.id);
                    if ((node.kind === 'claim' || node.type === 'claim') && selectClaim) {
                      selectClaim(node.id);
                    }
                  }}
                  className="cursor-pointer transition-transform hover:scale-110"
                >
                  {/* Outer Pulsing Glow for High Risk / Assessor Hub */}
                  {(isAssessorHub || isSelected || isHovered) && (
                    <circle
                      r={isAssessorHub ? 32 : 28}
                      fill="none"
                      stroke={isAssessorHub ? '#F59E0B' : strokeColor}
                      strokeWidth="2"
                      strokeOpacity="0.4"
                    />
                  )}

                  {/* Main Node Circle */}
                  <circle
                    r={isSelected ? 24 : 20}
                    fill={fillBg}
                    stroke={isHovered ? '#FFFFFF' : strokeColor}
                    strokeWidth={isSelected ? 3 : 2}
                    className="shadow-lg transition-all"
                  />

                  {/* Center Entity Glyph */}
                  <g transform="translate(-8, -8)">
                    {(nodeKind === 'claim') && <FileText className="h-4 w-4" style={{ color: iconColor }} />}
                    {(nodeKind === 'farmer') && <User className="h-4 w-4" style={{ color: iconColor }} />}
                    {(nodeKind === 'assessor') && <AlertTriangle className="h-4 w-4" style={{ color: iconColor }} />}
                    {(nodeKind === 'zone' || nodeKind === 'farmland') && <MapPin className="h-4 w-4" style={{ color: iconColor }} />}
                  </g>

                  {/* Node Label Below */}
                  {showLabels && (
                    <g transform="translate(0, 32)">
                      <rect
                        x="-48"
                        y="-10"
                        width="96"
                        height="18"
                        rx="4"
                        fill="#0F172A"
                        fillOpacity="0.9"
                        stroke={strokeColor}
                        strokeWidth="0.8"
                      />
                      <text
                        x="0"
                        y="2"
                        textAnchor="middle"
                        fill="#F8FAFC"
                        fontSize="10"
                        fontFamily="sans-serif"
                        fontWeight="600"
                        className="pointer-events-none"
                      >
                        {node.label.length > 15 ? `${node.label.substring(0, 13)}…` : node.label}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {/* ── DYNAMIC HOVER TOOLTIP IN OVERLAY ──────────────────────────────── */}
        {hoveredNode && (
          <div className="absolute bottom-4 left-4 z-20 max-w-xs rounded-xl border border-[#334155] bg-[#1E293B]/95 p-3.5 text-xs text-white shadow-2xl backdrop-blur-md space-y-2 pointer-events-none">
            <div className="flex items-center justify-between border-b border-[#334155] pb-2">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#A78BFA]">
                {formatNodeKind(hoveredNode.kind || hoveredNode.type)}
              </span>
              {hoveredNode.riskTier && (
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${hoveredNode.riskTier === 'investigate' ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                  {hoveredNode.riskTier}
                </span>
              )}
            </div>

            <div className="font-semibold text-sm text-white">
              {hoveredNode.label}
            </div>

            <div className="text-[11px] text-[#94A3B8] font-mono space-y-1">
              <div>ID: <span className="text-white">{hoveredNode.id}</span></div>
              {hoveredNode.risk_score !== null && hoveredNode.risk_score !== undefined && (
                <div>Risk Score: <span className="text-amber-400 font-bold">{formatRiskPercent(hoveredNode.risk_score)}</span></div>
              )}
              {hoveredNode.communityClusterId && (
                <div>Community Cluster: <span className="text-forest-400">{hoveredNode.communityClusterId}</span></div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── BOTTOM LEGEND FOOTER ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#1E293B] bg-[#1E293B]/80 px-4 py-2.5 text-xs font-mono text-[#94A3B8]">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-[#14532D] border border-[#22C55E]" />
            <span>Producer</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-[#78350F] border border-[#F59E0B]" />
            <span>Adjuster Hub</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-[#0B2619] border border-[#2A8E58]" />
            <span>Claim Entity</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-[#365314] border border-[#84CC16]" />
            <span>PMFBY Zone / Parcel</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-5 bg-red-500 rounded animate-pulse" />
            <span className="text-red-400 font-bold">Flagged Collusion Link</span>
          </div>
        </div>

        <div className="text-[11px] text-[#64748B]">
          Drag nodes to rearrange • Click claim node to inspect
        </div>
      </div>

    </div>
  );
}

export default NetworkGraphPanel;
