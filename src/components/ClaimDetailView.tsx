import { useClaims } from '../context/ClaimsContext';
import {
  Network,
  FileText,
  Camera,
  AlertTriangle,
  CheckCircle2,
  MapPin,
  User,
  ShieldAlert,
  Layers,
  Activity,
  FileSpreadsheet,
  Zap,
  Pin,
  X,
  ShieldCheck,
  Globe,
  Info,
  Cpu
} from 'lucide-react';

/**
 * Formats a raw number as INR currency.
 */
function formatInr(amount: any) {
  if (typeof amount !== 'number') return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}


/**
 * Formats decimal score (0.0 - 1.0) as percentage string.
 */
function formatPercent(value: any) {
  if (typeof value !== 'number') return '0%';
  return `${Math.round(value * 100)}%`;
}

/**
 * ClaimDetailView — AgriGuard Deep-Dive Detail Inspector
 * Dissects fraud explainability across GNN, NLP, and CV tri-pillar models.
 */
export interface ClaimDetailViewProps {
  claim?: any;
  onClose?: () => void;
}

export function ClaimDetailView({ claim: propClaim, onClose }: ClaimDetailViewProps = {}) {
  const claimsContext = useClaims();
  
  // Support both context-driven state and direct prop usage
  const selectedClaim = propClaim ?? claimsContext?.selectedClaim;
  const togglePinClaim = claimsContext?.togglePinClaim;
  const setInvestigatorNotes = claimsContext?.setInvestigatorNotes;
  const selectClaim = claimsContext?.selectClaim;

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else if (selectClaim) {
      selectClaim(null);
    }
  };

  // ── 1. EMPTY STATE PLACEHOLDER ───────────────────────────────────────────
  if (!selectedClaim) {
    return (
      <div className="flex h-full min-h-[520px] w-full flex-col items-center justify-center rounded-xl border border-dashed border-[#D1D5DB] bg-[#F9FAFB]/70 dark:border-[#374151] dark:bg-[#111827]/40 p-8 text-center shadow-inner transition-all">
        <div className="relative mb-5 flex h-20 w-20 items-center justify-center rounded-2xl border border-forest-600/30 bg-forest-100 dark:bg-forest-900/40 p-4 shadow-lg shadow-forest-900/5 dark:border-forest-600/40">
          <ShieldAlert className="h-10 w-10 text-forest-600 dark:text-forest-400 animate-pulse" />
          <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-forest-600 text-white shadow-md border-2 border-white dark:border-[#111827]">
            <Activity className="h-3.5 w-3.5" />
          </div>
        </div>

        <h3 className="font-serif text-lg font-bold tracking-tight text-[#111827] dark:text-[#F3F4F6] mb-1.5">
          Risk Anomaly Deep-Dive Inspector
        </h3>
        
        <p className="max-w-md text-sm text-[#4B5563] dark:text-[#9CA3AF] leading-relaxed font-sans mb-6">
          Select a claim from the ledger to inspect risk anomalies
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg bg-white dark:bg-[#1F2937] px-3.5 py-2 text-xs font-mono text-[#374151] dark:text-[#D1D5DB] border border-[#E5E7EB] dark:border-[#374151] shadow-sm">
            <span>Awaiting claim selection from active ledger...</span>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-3 gap-3 w-full max-w-lg text-left">
          <div className="p-3 rounded-lg bg-white/60 dark:bg-[#1F2937]/50 border border-[#E5E7EB] dark:border-[#374151]">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-forest-600 dark:text-forest-400 uppercase font-mono">
              <Network className="h-3.5 w-3.5" /> GNN Network
            </div>
            <p className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF] mt-1">Graph links & shared adjuster hubs</p>
          </div>
          <div className="p-3 rounded-lg bg-white/60 dark:bg-[#1F2937]/50 border border-[#E5E7EB] dark:border-[#374151]">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#0984E3] uppercase font-mono">
              <FileText className="h-3.5 w-3.5" /> NLP Telemetry
            </div>
            <p className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF] mt-1">Satellite NDVI vs narrative similarity</p>
          </div>
          <div className="p-3 rounded-lg bg-white/60 dark:bg-[#1F2937]/50 border border-[#E5E7EB] dark:border-[#374151]">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#E17055] uppercase font-mono">
              <Camera className="h-3.5 w-3.5" /> CV Imagery
            </div>
            <p className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF] mt-1">EXIF metadata & ELA tampering detection</p>
          </div>
        </div>
      </div>
    );
  }

  const { metadata, riskScore, anomalies, investigatorNotes, isPinned, lastAnalyzedAt } = selectedClaim;

  // Extract pillar anomalies
  const gnnAnomaly = anomalies?.find((a: any) => a.pillar === 'gnn');
  const nlpAnomaly = anomalies?.find((a: any) => a.pillar === 'nlp');
  const cvAnomaly = anomalies?.find((a: any) => a.pillar === 'cv');

  // Severity helper styles
  const getSeverityBadge = (severity: any) => {
    switch (severity) {
      case 'critical':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-red-500/15 dark:bg-red-500/25 px-2 py-0.5 font-mono text-[10px] font-bold text-red-700 dark:text-red-300 border border-red-500/30 uppercase tracking-wider">
            <AlertTriangle className="h-3 w-3" /> Critical Anomaly
          </span>
        );
      case 'high':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 dark:bg-amber-500/25 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-700 dark:text-amber-300 border border-amber-500/30 uppercase tracking-wider">
            <AlertTriangle className="h-3 w-3" /> High Risk
          </span>
        );
      case 'medium':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-yellow-500/15 dark:bg-yellow-500/25 px-2 py-0.5 font-mono text-[10px] font-bold text-yellow-800 dark:text-yellow-300 border border-yellow-500/30 uppercase tracking-wider">
            <Info className="h-3 w-3" /> Medium Warning
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 dark:bg-emerald-500/25 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 uppercase tracking-wider">
            <CheckCircle2 className="h-3 w-3" /> Low Risk / Normal
          </span>
        );
    }
  };

  const getTierBadge = (tier: any) => {
    switch (tier) {
      case 'investigate':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white shadow-sm uppercase font-mono tracking-wider">
            <ShieldAlert className="h-3.5 w-3.5" /> INVESTIGATE
          </span>
        );
      case 'review':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-3 py-1 text-xs font-bold text-white shadow-sm uppercase font-mono tracking-wider">
            <AlertTriangle className="h-3.5 w-3.5" /> REVIEW REQUIRED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white shadow-sm uppercase font-mono tracking-wider">
            <ShieldCheck className="h-3.5 w-3.5" /> SAFE / CLEARED
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-white dark:bg-[#0F172A] text-[#1E293B] dark:text-[#F1F5F9] rounded-xl border border-[#E2E8F0] dark:border-[#1E293B] shadow-xl overflow-hidden font-sans">
      
      {/* ── HEADER BAR ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E2E8F0] dark:border-[#1E293B] bg-[#F8FAFC] dark:bg-[#1E293B]/60 p-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0F291E] text-white font-mono text-sm font-bold shadow-md border border-[#164E33]">
            AG
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-mono text-lg font-bold tracking-tight text-[#0F172A] dark:text-white">
                {metadata.claimId}
              </h2>
              {getTierBadge(riskScore.tier)}
            </div>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8] font-mono mt-0.5">
              Policy #{metadata.policyNumber} • {metadata.policyType}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {togglePinClaim && (
            <button
              onClick={() => togglePinClaim(metadata.claimId)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors ${
                isPinned
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300'
                  : 'bg-white dark:bg-[#1E293B] border-[#CBD5E1] dark:border-[#334155] text-[#475569] dark:text-[#CBD5E1] hover:bg-[#F1F5F9]'
              }`}
            >
              <Pin className={`h-3.5 w-3.5 ${isPinned ? 'fill-amber-500 text-amber-500' : ''}`} />
              <span>{isPinned ? 'Pinned' : 'Pin Claim'}</span>
            </button>
          )}
          
          <button
            onClick={handleClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#CBD5E1] dark:border-[#334155] bg-white dark:bg-[#1E293B] text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white hover:bg-[#F1F5F9] dark:hover:bg-[#334155] transition-colors"
            title="Close inspector"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        
        {/* ── METRICS SUMMARY & RISK SCORE BANNER ────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          
          {/* Composite Score Card */}
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 dark:bg-red-950/20 p-4 relative overflow-hidden dark:border-red-500/30">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
                Fused Composite Risk
              </span>
              <Activity className="h-4 w-4 text-red-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-mono text-3xl font-extrabold text-red-600 dark:text-red-400">
                {formatPercent(riskScore.composite)}
              </span>
              <span className="text-xs font-mono text-[#64748B] dark:text-[#94A3B8]">
                ({formatPercent(riskScore.confidence)} confidence)
              </span>
            </div>
            <div className="mt-2 w-full bg-[#E2E8F0] dark:bg-[#334155] h-2 rounded-full overflow-hidden">
              <div
                className="h-full bg-red-600 rounded-full"
                style={{ width: `${riskScore.composite * 100}%` }}
              />
            </div>
          </div>

          {/* Financial Liability Card */}
          <div className="rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#1E293B]/40 p-4">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8] block">
              Claimed Indemnity Value
            </span>
            <div className="mt-2 font-mono text-2xl font-bold text-[#0F172A] dark:text-white">
              {formatInr(metadata.claimAmountUsd)}
            </div>
            <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-1 font-mono">
              Policy Liability: {formatInr(metadata.policyValueUsd)}
            </p>
          </div>

          {/* Crop & Peril Card */}
          <div className="rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#1E293B]/40 p-4">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8] block">
              Insured Commodity & Peril
            </span>
            <div className="mt-2 font-semibold text-sm text-[#0F172A] dark:text-white flex items-center gap-1.5">
              <Zap className="h-4 w-4 text-amber-500" />
              <span>{metadata.cropType}</span>
            </div>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-1">
              Peril: <strong className="text-[#334155] dark:text-[#E2E8F0] font-medium">{metadata.perilType}</strong> ({metadata.cropYear})
            </p>
          </div>

          {/* Location & Assessor Card */}
          <div className="rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#1E293B]/40 p-4">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8] block">
              Parcel & Assessor Metadata
            </span>
            <div className="mt-1 text-xs text-[#334155] dark:text-[#E2E8F0] space-y-1">
              <div className="flex items-center gap-1">
                <User className="h-3.5 w-3.5 text-[#64748B]" />
                <span className="truncate">{metadata.farmerName} ({metadata.farmerId})</span>
              </div>
              <div className="flex items-center gap-1 text-[11px] font-mono text-[#64748B] dark:text-[#94A3B8]">
                <MapPin className="h-3.5 w-3.5 text-[#10B981]" />
                <span>PMFBY Farmland Parcel ({metadata.parcel.insuredAcres} ac) • District: {metadata.parcel.stateAbbrev} • Taluka: {metadata.parcel.countyFips}</span>
              </div>
            </div>
          </div>

        </div>

        {/* ── TRI-PILLAR EXPLAINABILITY SECTION ─────────────────────────────── */}
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] dark:border-[#334155] pb-2">
            <h3 className="font-serif text-sm font-bold uppercase tracking-wider text-[#0F172A] dark:text-white flex items-center gap-2">
              <Layers className="h-4 w-4 text-[#10B981]" />
              <span>Tri-Pillar Anomaly Dissection</span>
            </h3>
            <span className="text-xs font-mono text-[#64748B] dark:text-[#94A3B8]">
              GNN • NLP • Computer Vision Fusion Engine
            </span>
          </div>

          <div className="grid grid-cols-1 gap-6">

            {/* ═════════════════════════════════════════════════════════════════
                PILLAR 1: GNN NETWORK ANOMALIES (Graph connections, shared adjusters)
               ═════════════════════════════════════════════════════════════════ */}
            <div className="rounded-xl border border-forest-600/30 bg-white dark:bg-[#1E293B]/70 p-5 shadow-sm space-y-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-forest-600" />
              
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] dark:border-[#334155]/60 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-forest-600/15 text-forest-600 dark:text-forest-400">
                    <Network className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="font-serif font-bold text-base text-[#0F172A] dark:text-white flex items-center gap-2">
                      1. GNN Network Anomalies
                    </h4>
                    <p className="text-xs text-[#64748B] dark:text-[#94A3B8] font-mono">
                      Graph Neural Topology • Shared Adjusters • Spatial Clustering
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {gnnAnomaly && getSeverityBadge(gnnAnomaly.severity)}
                  <span className="rounded-full bg-forest-600/10 px-2.5 py-1 text-xs font-mono font-bold text-forest-600 dark:text-forest-400">
                    Raw Risk: {formatPercent(riskScore.pillars.gnn.raw)} (Weight: {formatPercent(riskScore.pillars.gnn.fusionWeight)})
                  </span>
                </div>
              </div>

              {/* Anomaly Body & Description */}
              {gnnAnomaly ? (
                <div className="space-y-4">
                  <div>
                    <h5 className="font-semibold text-sm text-[#0F172A] dark:text-white mb-1">
                      {gnnAnomaly.title}
                    </h5>
                    <p className="text-xs text-[#475569] dark:text-[#CBD5E1] leading-relaxed">
                      {gnnAnomaly.description}
                    </p>
                  </div>

                  {/* High-Density Technical Metric Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#F8FAFC] dark:bg-[#0F172A]/60 p-3.5 rounded-lg border border-[#E2E8F0] dark:border-[#334155]/80">
                    <div>
                      <span className="text-[10px] font-mono uppercase text-[#64748B] dark:text-[#94A3B8] block">
                        Assessor Hub Flag
                      </span>
                      <span className={`inline-flex items-center gap-1 text-xs font-bold mt-1 font-mono ${gnnAnomaly.sharedAssessorFlag ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {gnnAnomaly.sharedAssessorFlag ? '⚠️ FLAGGED HUB' : '✓ Normal Load'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-mono uppercase text-[#64748B] dark:text-[#94A3B8] block">
                        District Claims (24mo)
                      </span>
                      <span className="text-xs font-mono font-bold text-[#0F172A] dark:text-white mt-1 block">
                        {gnnAnomaly.assessorClaimCountInCounty24Mo} Claims
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-mono uppercase text-[#64748B] dark:text-[#94A3B8] block">
                        Spatial Proximity
                      </span>
                      <span className="text-xs font-mono font-bold text-[#0F172A] dark:text-white mt-1 block">
                        {gnnAnomaly.multiClaimProximityKm} km Avg Dist
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-mono uppercase text-[#64748B] dark:text-[#94A3B8] block">
                        GNN Cluster ID
                      </span>
                      <span className="inline-block mt-1 font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-forest-600/15 text-forest-600 dark:text-forest-400">
                        {gnnAnomaly.communityClusterId || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8] italic">
                  No structural network anomalies flagged by GNN graph analysis.
                </p>
              )}
            </div>

            {/* ═════════════════════════════════════════════════════════════════
                PILLAR 2: NLP TEXT-MISMATCH NOTES (Satellite vs Adjuster notes)
               ═════════════════════════════════════════════════════════════════ */}
            <div className="rounded-xl border border-[#0984E3]/30 bg-white dark:bg-[#1E293B]/70 p-5 shadow-sm space-y-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-[#0984E3]" />

              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] dark:border-[#334155]/60 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0984E3]/15 text-[#0984E3]">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="font-serif font-bold text-base text-[#0F172A] dark:text-white flex items-center gap-2">
                      2. NLP Text-Mismatch Notes
                    </h4>
                    <p className="text-xs text-[#64748B] dark:text-[#94A3B8] font-mono">
                      Satellite Telemetry • Adjuster Narrative • Contradiction Analysis
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {nlpAnomaly && getSeverityBadge(nlpAnomaly.severity)}
                  <span className="rounded-full bg-[#0984E3]/10 px-2.5 py-1 text-xs font-mono font-bold text-[#0984E3]">
                    Not yet available
                  </span>
                </div>
              </div>

              {/* Anomaly Body */}
              {nlpAnomaly ? (
                <div className="space-y-4">
                  <div>
                    <h5 className="font-semibold text-sm text-[#0F172A] dark:text-white mb-1">
                      {nlpAnomaly.title}
                    </h5>
                    <p className="text-xs text-[#475569] dark:text-[#CBD5E1] leading-relaxed">
                      {nlpAnomaly.description}
                    </p>
                  </div>

                  {/* Similarity Metric Gauge */}
                  <div className="flex items-center justify-between bg-[#0984E3]/10 border border-[#0984E3]/20 rounded-lg p-3 text-xs">
                    <div className="flex items-center gap-2">
                      <Cpu className="h-4 w-4 text-[#0984E3]" />
                      <span className="font-medium text-[#0F172A] dark:text-white">
                        Satellite-Narrative Cosine Similarity:
                      </span>
                    </div>
                    <span className="font-mono font-bold px-2 py-0.5 rounded text-xs bg-[#0984E3]/20 text-[#0984E3]">
                      Not yet available
                    </span>
                  </div>

                  {/* Dual Column Text Contradictions Comparison */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Adjuster Report Contradictions */}
                    <div className="rounded-lg border border-red-500/20 bg-red-50/50 dark:bg-red-950/20 p-3.5 space-y-2">
                      <span className="text-[11px] font-mono font-bold text-red-700 dark:text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5" /> Adjuster Narrative Contradictions
                      </span>
                      <ul className="space-y-1.5">
                        {nlpAnomaly.adjusterContradictions?.map((phrase: any, idx: number) => (
                          <li key={idx} className="text-xs text-[#334155] dark:text-[#E2E8F0] flex items-start gap-1.5 font-sans">
                            <span className="text-red-500 font-bold">•</span>
                            <span className="italic">"{phrase}"</span>
                          </li>
                        )) ?? <li className="text-xs text-[#64748B]">No contradictions listed</li>}
                      </ul>
                    </div>

                    {/* Satellite Telemetry Facts */}
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20 p-3.5 space-y-2">
                      <span className="text-[11px] font-mono font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Globe className="h-3.5 w-3.5" /> Satellite Telemetry Evidence (Sentinel-2 / MODIS)
                      </span>
                      <ul className="space-y-1.5">
                        {nlpAnomaly.satelliteKeyPhrases?.map((phrase: any, idx: number) => (
                          <li key={idx} className="text-xs text-[#334155] dark:text-[#E2E8F0] flex items-start gap-1.5 font-mono">
                            <span className="text-emerald-500 font-bold">✓</span>
                            <span>{phrase}</span>
                          </li>
                        )) ?? <li className="text-xs text-[#64748B]">No telemetry data listed</li>}
                      </ul>
                    </div>

                  </div>

                  {/* Entity Mismatches Table */}
                  {nlpAnomaly.entityMismatches && nlpAnomaly.entityMismatches.length > 0 && (
                    <div className="rounded-lg border border-[#E2E8F0] dark:border-[#334155] overflow-hidden">
                      <div className="bg-[#F8FAFC] dark:bg-[#0F172A] px-3.5 py-2 text-[11px] font-mono font-bold uppercase text-[#64748B] border-b border-[#E2E8F0] dark:border-[#334155]">
                        Entity Discrepancy Matrix
                      </div>
                      <div className="divide-y divide-[#E2E8F0] dark:divide-[#334155] text-xs">
                        {nlpAnomaly.entityMismatches.map((item: any, idx: number) => (
                          <div key={idx} className="p-3 grid grid-cols-3 gap-2">
                            <span className="font-mono font-semibold text-[#0F172A] dark:text-white">{item.field}</span>
                            <span className="text-red-600 dark:text-red-400 font-mono">Claimed: {item.claimValue}</span>
                            <span className="text-[#475569] dark:text-[#CBD5E1]">Narrative: {item.narrativeValue}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              ) : (
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8] italic">
                  No text discrepancies detected between satellite telemetry and adjuster notes.
                </p>
              )}
            </div>

            {/* ═════════════════════════════════════════════════════════════════
                PILLAR 3: CV IMAGE-MISMATCH NOTES (EXIF metadata, ELA tampering)
               ═════════════════════════════════════════════════════════════════ */}
            <div className="rounded-xl border border-[#E17055]/30 bg-white dark:bg-[#1E293B]/70 p-5 shadow-sm space-y-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-[#E17055]" />

              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] dark:border-[#334155]/60 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E17055]/15 text-[#E17055]">
                    <Camera className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="font-serif font-bold text-base text-[#0F172A] dark:text-white flex items-center gap-2">
                      3. CV Image-Mismatch Notes
                    </h4>
                    <p className="text-xs text-[#64748B] dark:text-[#94A3B8] font-mono">
                      EXIF Metadata Analysis • Error-Level Analysis (ELA) • Image Reuse
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {cvAnomaly && getSeverityBadge(cvAnomaly.severity)}
                  <span className="rounded-full bg-[#E17055]/10 px-2.5 py-1 text-xs font-mono font-bold text-[#E17055]">
                    Not yet available
                  </span>
                </div>
              </div>

              {/* Anomaly Body */}
              {cvAnomaly ? (
                <div className="space-y-4">
                  <div>
                    <h5 className="font-semibold text-sm text-[#0F172A] dark:text-white mb-1">
                      {cvAnomaly.title}
                    </h5>
                    <p className="text-xs text-[#475569] dark:text-[#CBD5E1] leading-relaxed">
                      {cvAnomaly.description}
                    </p>
                  </div>

                  {/* Technical Image Metrics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#F8FAFC] dark:bg-[#0F172A]/60 p-3.5 rounded-lg border border-[#E2E8F0] dark:border-[#334155]/80">
                    <div>
                      <span className="text-[10px] font-mono uppercase text-[#64748B] dark:text-[#94A3B8] block">
                        EXIF Metadata Integrity
                      </span>
                      <span className="text-xs font-mono font-bold mt-1 block text-[#64748B] dark:text-[#94A3B8]">
                        Not yet available
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-mono uppercase text-[#64748B] dark:text-[#94A3B8] block">
                        GPS Centroid Discrepancy
                      </span>
                      <span className="text-xs font-mono font-bold mt-1 block text-[#64748B] dark:text-[#94A3B8]">
                        Not yet available
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-mono uppercase text-[#64748B] dark:text-[#94A3B8] block">
                        ELA Manipulation Score
                      </span>
                      <span className="text-xs font-mono font-bold text-[#64748B] dark:text-[#94A3B8] mt-1 block">
                        Not yet available
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-mono uppercase text-[#64748B] dark:text-[#94A3B8] block">
                        Reused Image Detection
                      </span>
                      <span className="text-xs font-mono font-bold text-[#64748B] dark:text-[#94A3B8] mt-1 block">
                        Not yet available
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8] italic">
                  No image metadata or visual manipulation anomalies flagged.
                </p>
              )}
            </div>

          </div>
        </div>

        {/* ── INVESTIGATOR FIELD NOTES & AUDIT TRAIL ────────────────────────── */}
        <div className="rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#1E293B]/40 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-serif text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-white flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-[#10B981]" />
              <span>SIU Investigator Field Notes</span>
            </h4>
            <span className="text-[11px] font-mono text-[#64748B] dark:text-[#94A3B8]">
              Analyzed: {new Date(lastAnalyzedAt).toLocaleString()}
            </span>
          </div>

          <textarea
            rows={3}
            value={investigatorNotes ?? ''}
            onChange={(e) => setInvestigatorNotes && setInvestigatorNotes(metadata.claimId, e.target.value)}
            placeholder="Record SIU field verification findings, NOAA radar cross-checks, or referral notes..."
            className="w-full rounded-lg border border-[#CBD5E1] dark:border-[#334155] bg-white dark:bg-[#0F172A] p-3 text-xs text-[#0F172A] dark:text-white placeholder-[#94A3B8] focus:border-[#10B981] focus:ring-1 focus:ring-[#10B981] focus:outline-none transition-all font-sans"
          />

          <div className="flex items-center justify-between text-[11px] text-[#64748B] dark:text-[#94A3B8] font-mono pt-1">
            <span>Audit Trail Engine: AgriGuard Fusion v4.2</span>
            <span>CLU: {metadata.parcel.cluTractId}</span>
          </div>
        </div>

      </div>
    </div>
  );
}

export default ClaimDetailView;
