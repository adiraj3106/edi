// ═══════════════════════════════════════════════════════════════════════════════
// AgriGuard — Dashboard Layout Component
// Enterprise Asymmetric High-Density Risk Analytics Dashboard
// Palette: Earthy Enterprise (Forest Green, Charcoal/Slate, Wheat, Off-White)
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { useClaims } from '../context/ClaimsContext';
import {
  formatInr,
  formatRiskPercent,
} from '../utils/formatters';
import {
  ShieldAlert,
  Search,
  Filter,
  RotateCcw,
  Pin,
  ChevronRight,
  X,
  FileText,
  Network,
  Eye,
  Activity,
  Layers,
  Minimize2,
} from 'lucide-react';
import { NetworkGraphPanel } from './NetworkGraphPanel';



export function DashboardLayout() {
  const {
    state,
    filteredClaims,
    selectedClaim,
    stats,
    selectClaim,
    updateFilters,
    resetFilters,
    setSort,
    toggleSortDirection,
    toggleDetailPanel,
    toggleNetworkPanel,
    togglePinClaim,
    setInvestigatorNotes,
  } = useClaims();

  const [activeTab, setActiveTab] = useState<'claims' | 'analytics' | 'network'>('claims');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedAnomalyPillar, setSelectedAnomalyPillar] = useState<'all' | 'gnn' | 'nlp' | 'cv'>('all');

  // Active filter state variables
  const currentSearch = state.filters.searchQuery;
  const activeTiers = state.filters.tiers;
  const isAllTiersActive = activeTiers.length === 0;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F7F5F0] text-[#1A1F25] font-sans antialiased select-none">
      {/* ── 1. FIXED NARROW SIDEBAR NAVIGATION ────────────────────────────────── */}
      <aside
        className={`flex flex-col justify-between border-r border-[#E1E6EB] bg-[#0B2619] text-[#E1E6EB] transition-all duration-300 z-30 ${
          sidebarCollapsed ? 'w-16' : 'w-64'
        }`}
      >
        {/* Top Header / Branding */}
        <div>
          <div className="flex h-14 items-center justify-between border-b border-[#123D29] px-4">
            {!sidebarCollapsed ? (
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded bg-[#2A8E58] text-white font-mono text-xs font-bold tracking-wider">
                  AG
                </div>
                <div>
                  <h1 className="font-serif text-sm font-semibold tracking-wide text-white">
                    AgriGuard
                  </h1>
                  <p className="text-[10px] uppercase font-mono tracking-widest text-[#7ACA9B]">
                    Risk Analytics v2.4
                  </p>
                </div>
              </div>
            ) : (
              <div className="mx-auto flex h-8 w-8 items-center justify-center rounded bg-[#2A8E58] text-white font-mono text-xs font-bold">
                AG
              </div>
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="text-[#7ACA9B] hover:text-white transition-colors p-1 rounded hover:bg-[#123D29]"
              title={sidebarCollapsed ? 'Expand Navigation' : 'Collapse Navigation'}
            >
              {sidebarCollapsed ? <ChevronRight size={16} /> : <Minimize2 size={14} />}
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="mt-4 px-2 space-y-1">
            <button
              onClick={() => setActiveTab('claims')}
              className={`flex w-full items-center gap-3 rounded px-3 py-2 text-xs font-medium transition-colors ${
                activeTab === 'claims'
                  ? 'bg-[#1A5438] text-white shadow-sm'
                  : 'text-[#9EAAB4] hover:bg-[#123D29] hover:text-white'
              }`}
            >
              <ShieldAlert size={16} className="text-[#4DAE78] shrink-0" />
              {!sidebarCollapsed && <span>Claims Triage</span>}
            </button>

            <button
              onClick={() => {
                setActiveTab('network');
                toggleNetworkPanel(true);
              }}
              className={`flex w-full items-center gap-3 rounded px-3 py-2 text-xs font-medium transition-colors ${
                activeTab === 'network'
                  ? 'bg-[#1A5438] text-white shadow-sm'
                  : 'text-[#9EAAB4] hover:bg-[#123D29] hover:text-white'
              }`}
            >
              <Network size={16} className="text-[#E0AD50] shrink-0" />
              {!sidebarCollapsed && <span>GNN Topology</span>}
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex w-full items-center gap-3 rounded px-3 py-2 text-xs font-medium transition-colors ${
                activeTab === 'analytics'
                  ? 'bg-[#1A5438] text-white shadow-sm'
                  : 'text-[#9EAAB4] hover:bg-[#123D29] hover:text-white'
              }`}
            >
              <Layers size={16} className="text-[#7ACA9B] shrink-0" />
              {!sidebarCollapsed && <span>Portfolio Analytics</span>}
            </button>
          </nav>

          {/* Quick Metrics Summary Sidebar Widget */}
          {!sidebarCollapsed && (
            <div className="mx-3 mt-6 rounded border border-[#123D29] bg-[#123D29]/40 p-3">
              <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-[#7ACA9B] mb-2">
                <span>Risk Distribution</span>
                <Activity size={12} />
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between items-center text-slate-300">
                  <span className="flex items-center gap-1.5 text-[#C0392B] font-medium">
                    <span className="h-2 w-2 rounded-full bg-[#C0392B]"></span>
                    Investigate
                  </span>
                  <span className="font-mono font-bold text-white">{stats.tierCounts.investigate}</span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span className="flex items-center gap-1.5 text-[#D69425] font-medium">
                    <span className="h-2 w-2 rounded-full bg-[#D69425]"></span>
                    Review
                  </span>
                  <span className="font-mono font-bold text-white">{stats.tierCounts.review}</span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span className="flex items-center gap-1.5 text-[#2A8E58] font-medium">
                    <span className="h-2 w-2 rounded-full bg-[#2A8E58]"></span>
                    Safe
                  </span>
                  <span className="font-mono font-bold text-white">{stats.tierCounts.safe}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Sidebar Status Footer */}
        <div className="border-t border-[#123D29] p-3 text-[11px] text-[#9EAAB4]">
          {!sidebarCollapsed ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between font-mono">
                <span>RMA Feed:</span>
                <span className="text-[#4DAE78] font-semibold flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#4DAE78] animate-pulse"></span>
                  CONNECTED
                </span>
              </div>
              <div className="text-[10px] text-[#7A8894] font-mono">
                Synced: 2026-09-03 20:07 UTC
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <span className="h-2 w-2 rounded-full bg-[#4DAE78]" title="RMA Connected"></span>
            </div>
          )}
        </div>
      </aside>

      {/* ── 2. MAIN CONTENT AREA (TOPBAR + HIGH DENSITY DUAL PANE GRID) ──────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Control Bar */}
        <header className="flex h-14 items-center justify-between border-b border-[#E1E6EB] bg-white px-6 shadow-xs">
          {/* Breadcrumb & Title */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-semibold uppercase text-[#5A6774] tracking-wider">
              FCIC RMA Portfolio /
            </span>
            <h2 className="font-serif text-base font-bold text-[#1A1F25]">
              Fraud Risk Assessment & Triage Workspace
            </h2>
          </div>

          {/* Metric Badges Strip */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 border-r border-[#E1E6EB] pr-4 text-xs font-mono">
              <span className="text-[#5A6774]">Total Indemnity Exposure:</span>
              <span className="font-bold text-[#1A1F25]">{formatInr(stats.totalExposureUsd)}</span>
            </div>
            <div className="flex items-center gap-2 border-r border-[#E1E6EB] pr-4 text-xs font-mono">
              <span className="text-[#5A6774]">Avg Risk Index:</span>
              <span className="font-bold text-[#C0392B]">{formatRiskPercent(stats.avgCompositeScore)}</span>
            </div>

            {/* Layout Toggle Actions */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => toggleDetailPanel()}
                className={`flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-medium transition-colors ${
                  state.isDetailPanelOpen
                    ? 'border-[#2A8E58] bg-[#EBF8F0] text-[#1A5438]'
                    : 'border-[#C2CBD3] bg-white text-[#414C58] hover:bg-[#F3F5F7]'
                }`}
              >
                <FileText size={14} />
                <span>Detail Inspector</span>
              </button>

              <button
                onClick={() => toggleNetworkPanel()}
                className={`flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-medium transition-colors ${
                  state.isNetworkPanelOpen
                    ? 'border-[#B87E1F] bg-[#FCF6EC] text-[#7A5213]'
                    : 'border-[#C2CBD3] bg-white text-[#414C58] hover:bg-[#F3F5F7]'
                }`}
              >
                <Network size={14} />
                <span>GNN Graph</span>
              </button>
            </div>
          </div>
        </header>

        {/* Filter & Toolbar Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E1E6EB] bg-[#EFEDE7] px-6 py-2.5">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A6774]" size={14} />
            <input
              type="text"
              value={currentSearch}
              onChange={(e) => updateFilters({ searchQuery: e.target.value })}
              placeholder="Search Claim ID, Producer Name, Assessor, District, Taluka..."
              className="w-full rounded border border-[#C2CBD3] bg-white pl-9 pr-3 py-1.5 text-xs text-[#1A1F25] placeholder-[#7A8894] focus:border-[#2A8E58] focus:outline-none focus:ring-1 focus:ring-[#2A8E58]"
            />
            {currentSearch && (
              <button
                onClick={() => updateFilters({ searchQuery: '' })}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#7A8894] hover:text-[#1A1F25]"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Quick Filter Buttons */}
          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1 bg-white border border-[#C2CBD3] rounded p-0.5">
              <button
                onClick={() => updateFilters({ tiers: [] })}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  isAllTiersActive
                    ? 'bg-[#1A5438] text-white font-semibold'
                    : 'text-[#414C58] hover:bg-[#F3F5F7]'
                }`}
              >
                All ({stats.totalClaims})
              </button>
              <button
                onClick={() => updateFilters({ tiers: ['investigate'] })}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  activeTiers.includes('investigate')
                    ? 'bg-[#C0392B] text-white font-semibold'
                    : 'text-[#C0392B] hover:bg-[#FADBD8]'
                }`}
              >
                Investigate ({stats.tierCounts.investigate})
              </button>
              <button
                onClick={() => updateFilters({ tiers: ['review'] })}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  activeTiers.includes('review')
                    ? 'bg-[#D69425] text-white font-semibold'
                    : 'text-[#996819] hover:bg-[#F8EDDA]'
                }`}
              >
                Review ({stats.tierCounts.review})
              </button>
              <button
                onClick={() => updateFilters({ tiers: ['safe'] })}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  activeTiers.includes('safe')
                    ? 'bg-[#2A8E58] text-white font-semibold'
                    : 'text-[#1A5438] hover:bg-[#D5F0DF]'
                }`}
              >
                Safe ({stats.tierCounts.safe})
              </button>
            </div>

            {/* Pinned Filter Toggle */}
            <button
              onClick={() => updateFilters({ pinnedOnly: !state.filters.pinnedOnly })}
              className={`flex items-center gap-1.5 rounded border px-2.5 py-1 font-medium transition-colors ${
                state.filters.pinnedOnly
                  ? 'border-[#B87E1F] bg-[#FCF6EC] text-[#7A5213]'
                  : 'border-[#C2CBD3] bg-white text-[#414C58] hover:bg-[#F3F5F7]'
              }`}
            >
              <Pin size={12} className={state.filters.pinnedOnly ? 'fill-[#7A5213]' : ''} />
              <span>Pinned Only</span>
            </button>

            {/* Reset Filters */}
            <button
              onClick={resetFilters}
              className="flex items-center gap-1 text-[#5A6774] hover:text-[#1A1F25] px-2 py-1"
              title="Reset Filters"
            >
              <RotateCcw size={12} />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* ── 3. ASYMMETRIC FLUID GRID (CLAIMS TABLE vs INSPECTOR PANEL) ────────── */}
        <div className="flex flex-1 overflow-hidden">
          {/* Main Left Pane: High Density Claims Table */}
          <main
            className={`flex-1 flex flex-col overflow-y-auto bg-white transition-all ${
              state.isDetailPanelOpen || state.isNetworkPanelOpen ? 'w-1/2 min-w-[520px]' : 'w-full'
            }`}
          >
            {filteredClaims.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 p-12 text-center text-[#5A6774]">
                <Filter size={32} className="mb-3 text-[#7A8894]" />
                <p className="font-serif text-base font-semibold">No claims match the active filter criteria.</p>
                <p className="text-xs mt-1 text-[#7A8894]">
                  Try adjusting your search query or clearing risk tier filters.
                </p>
                <button
                  onClick={resetFilters}
                  className="mt-4 rounded bg-[#1A5438] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#123D29]"
                >
                  Clear All Filters
                </button>
              </div>
            ) : (
              <div className="w-full">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#E1E6EB] bg-[#F7F5F0] font-mono text-[11px] uppercase text-[#5A6774] sticky top-0 z-10">
                      <th className="py-2.5 px-3 w-10 text-center">Pin</th>
                      <th
                        className="py-2.5 px-3 font-semibold cursor-pointer hover:text-[#1A1F25]"
                        onClick={() => {
                          setSort('claimId');
                          toggleSortDirection();
                        }}
                      >
                        Claim ID / Policy
                      </th>
                      <th className="py-2.5 px-3 font-semibold">Producer & Assessor</th>
                      <th className="py-2.5 px-3 font-semibold">Crop / Cause</th>
                      <th
                        className="py-2.5 px-3 font-semibold text-right cursor-pointer hover:text-[#1A1F25]"
                        onClick={() => {
                          setSort('claimAmountUsd');
                          toggleSortDirection();
                        }}
                      >
                        Claim Indemnity
                      </th>
                      <th
                        className="py-2.5 px-3 font-semibold text-center cursor-pointer hover:text-[#1A1F25]"
                        onClick={() => {
                          setSort('composite');
                          toggleSortDirection();
                        }}
                      >
                        Risk Index & Tier
                      </th>
                      <th className="py-2.5 px-3 font-semibold text-center">Pillar Anomalies</th>
                      <th className="py-2.5 px-3 font-semibold text-right pr-4">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E1E6EB]">
                    {filteredClaims.map((claim) => {
                      const isSelected = selectedClaim?.metadata.claimId === claim.metadata.claimId;
                      const gnnCount = claim.anomalies.filter((a) => a.pillar === 'gnn').length;
                      const nlpCount = claim.anomalies.filter((a) => a.pillar === 'nlp').length;
                      const cvCount = claim.anomalies.filter((a) => a.pillar === 'cv').length;

                      return (
                        <tr
                          key={claim.metadata.claimId}
                          onClick={() => selectClaim(claim.metadata.claimId)}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-[#EBF8F0] hover:bg-[#D5F0DF]'
                              : 'hover:bg-[#F7F5F0]'
                          }`}
                        >
                          {/* Pin Toggle */}
                          <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => togglePinClaim(claim.metadata.claimId)}
                              className="text-[#7A8894] hover:text-[#D69425] transition-colors"
                            >
                              <Pin
                                size={13}
                                className={claim.isPinned ? 'fill-[#D69425] text-[#D69425]' : ''}
                              />
                            </button>
                          </td>

                          {/* Claim ID & Policy */}
                          <td className="py-2.5 px-3">
                            <div className="font-mono font-bold text-[#1A1F25]">
                              {claim.metadata.claimId}
                            </div>
                            <div className="text-[10px] font-mono text-[#5A6774]">
                              {claim.metadata.policyNumber}
                            </div>
                          </td>

                          {/* Producer & Assessor */}
                          <td className="py-2.5 px-3">
                            <div className="font-medium text-[#1A1F25]">{claim.metadata.farmerName}</div>
                            <div className="text-[10px] text-[#5A6774]">
                              Adj: {claim.metadata.assessorName}
                            </div>
                          </td>

                          {/* Crop & Peril */}
                          <td className="py-2.5 px-3">
                            <div className="font-medium text-[#1A1F25]">{claim.metadata.cropType}</div>
                            <div className="text-[10px] text-[#5A6774]">{claim.metadata.perilType}</div>
                          </td>

                          {/* Indemnity Amount */}
                          <td className="py-2.5 px-3 text-right">
                            <div className="font-mono font-bold text-[#1A1F25]">
                              {formatInr(claim.metadata.claimAmountUsd)}
                            </div>
                            <div className="text-[10px] font-mono text-[#7A8894]">
                              Policy: {formatInr(claim.metadata.policyValueUsd)}
                            </div>
                          </td>

                          {/* Risk Index & Tier */}
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <span
                                className={`inline-flex items-center rounded px-2 py-0.5 font-mono text-xs font-bold uppercase tracking-wider ${
                                  claim.riskScore.tier === 'investigate'
                                    ? 'bg-[#FADBD8] text-[#C0392B]'
                                    : claim.riskScore.tier === 'review'
                                    ? 'bg-[#F8EDDA] text-[#996819]'
                                    : 'bg-[#D5F0DF] text-[#1A5438]'
                                }`}
                              >
                                {formatRiskPercent(claim.riskScore.composite)} ({claim.riskScore.tier})
                              </span>
                            </div>
                          </td>

                          {/* Pillar Anomaly Flags */}
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1 font-mono text-[10px]">
                              {gnnCount > 0 && (
                                <span
                                  className="rounded bg-forest-600/10 text-forest-600 px-1.5 py-0.5 font-semibold"
                                  title="GNN Anomaly"
                                >
                                  GNN:{gnnCount}
                                </span>
                              )}
                              {nlpCount > 0 && (
                                <span
                                  className="rounded bg-[#0984E3]/10 text-[#0984E3] px-1.5 py-0.5 font-semibold"
                                  title="NLP Anomaly"
                                >
                                  NLP:{nlpCount}
                                </span>
                              )}
                              {cvCount > 0 && (
                                <span
                                  className="rounded bg-[#E17055]/10 text-[#E17055] px-1.5 py-0.5 font-semibold"
                                  title="CV Anomaly"
                                >
                                  CV:{cvCount}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Inspect Action */}
                          <td className="py-2.5 px-3 text-right pr-4" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => selectClaim(claim.metadata.claimId)}
                              className="rounded border border-[#C2CBD3] bg-white px-2 py-1 text-[11px] font-medium text-[#414C58] hover:border-[#1A5438] hover:bg-[#EBF8F0] hover:text-[#1A5438] transition-colors"
                            >
                              Inspect →
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </main>

          {/* ── 4. RIGHT PANE: DETAIL INSPECTOR & NETWORK GRAPH PANEL ────────────── */}
          {state.isDetailPanelOpen && (
            <aside className="w-1/2 min-w-[480px] max-w-2xl border-l border-[#E1E6EB] bg-white flex flex-col overflow-y-auto shadow-md">
              {selectedClaim ? (
                <div className="flex flex-col flex-1 divide-y divide-[#E1E6EB]">
                  {/* Claim Inspector Header */}
                  <div className="p-5 bg-[#F7F5F0]">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-mono text-lg font-bold text-[#1A1F25]">
                            {selectedClaim.metadata.claimId}
                          </h3>
                          <span
                            className={`rounded px-2 py-0.5 font-mono text-xs font-bold uppercase tracking-wider ${
                              selectedClaim.riskScore.tier === 'investigate'
                                ? 'bg-[#C0392B] text-white'
                                : selectedClaim.riskScore.tier === 'review'
                                ? 'bg-[#D69425] text-white'
                                : 'bg-[#2A8E58] text-white'
                            }`}
                          >
                            {selectedClaim.riskScore.tier} Tier
                          </span>
                        </div>
                        <p className="text-xs text-[#5A6774] mt-1 font-mono">
                          Policy: {selectedClaim.metadata.policyNumber} ({selectedClaim.metadata.policyType})
                        </p>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => togglePinClaim(selectedClaim.metadata.claimId)}
                          className="p-1.5 text-[#5A6774] hover:text-[#D69425] rounded hover:bg-[#EFEDE7]"
                          title="Pin Claim"
                        >
                          <Pin
                            size={16}
                            className={selectedClaim.isPinned ? 'fill-[#D69425] text-[#D69425]' : ''}
                          />
                        </button>
                        <button
                          onClick={() => toggleDetailPanel(false)}
                          className="p-1.5 text-[#5A6774] hover:text-[#1A1F25] rounded hover:bg-[#EFEDE7]"
                          title="Close Inspector"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Quick Metadata Summary Grid */}
                    <div className="grid grid-cols-3 gap-3 mt-4 pt-3 border-t border-[#E1E6EB] text-xs">
                      <div>
                        <span className="text-[10px] font-mono text-[#7A8894] uppercase block">Producer</span>
                        <span className="font-semibold text-[#1A1F25]">{selectedClaim.metadata.farmerName}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-mono text-[#7A8894] uppercase block">Assessor</span>
                        <span className="font-semibold text-[#1A1F25]">{selectedClaim.metadata.assessorName}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-mono text-[#7A8894] uppercase block">Indemnity Claim</span>
                        <span className="font-mono font-bold text-[#C0392B]">
                          {formatInr(selectedClaim.metadata.claimAmountUsd)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Fused Risk Pillars Breakdown */}
                  <div className="p-5 space-y-3">
                    <h4 className="font-serif text-xs font-bold uppercase tracking-wider text-[#5A6774]">
                      Fused Anomaly Risk Breakdown
                    </h4>

                    <div className="grid grid-cols-3 gap-3">
                      {/* GNN Score Card */}
                      <div className="rounded border border-[#E1E6EB] bg-[#F7F5F0] p-3 text-center">
                        <span className="text-[10px] font-mono font-bold text-forest-600 uppercase block">
                          GNN Graph Risk
                        </span>
                        <span className="font-mono text-xl font-bold text-[#1A1F25]">
                          {formatRiskPercent(selectedClaim.riskScore.pillars.gnn.raw)}
                        </span>
                        <div className="w-full bg-[#E1E6EB] h-1.5 rounded-full mt-2 overflow-hidden">
                          <div
                            className="bg-forest-600 h-full"
                            style={{ width: `${selectedClaim.riskScore.pillars.gnn.raw * 100}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* NLP Score Card */}
                      <div className="rounded border border-[#E1E6EB] bg-[#F7F5F0] p-3 text-center">
                        <span className="text-[10px] font-mono font-bold text-[#0984E3] uppercase block">
                          NLP Text Discrepancy
                        </span>
                        <span className="font-mono text-xs font-bold text-[#5A6774] block mt-1">
                          Not yet available
                        </span>
                        <div className="w-full bg-[#E1E6EB] h-1.5 rounded-full mt-2 overflow-hidden">
                          <div
                            className="bg-[#0984E3] h-full"
                            style={{ width: '0%' }}
                          ></div>
                        </div>
                      </div>

                      {/* CV Score Card */}
                      <div className="rounded border border-[#E1E6EB] bg-[#F7F5F0] p-3 text-center">
                        <span className="text-[10px] font-mono font-bold text-[#E17055] uppercase block">
                          CV EXIF & Image Tampering
                        </span>
                        <span className="font-mono text-xs font-bold text-[#5A6774] block mt-1">
                          Not yet available
                        </span>
                        <div className="w-full bg-[#E1E6EB] h-1.5 rounded-full mt-2 overflow-hidden">
                          <div
                            className="bg-[#E17055] h-full"
                            style={{ width: '0%' }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Anomaly Explanability Cards */}
                  <div className="p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-serif text-xs font-bold uppercase tracking-wider text-[#5A6774]">
                        Explainable Anomaly Findings ({selectedClaim.anomalies.length})
                      </h4>
                      <div className="flex gap-1 text-[11px]">
                        <button
                          onClick={() => setSelectedAnomalyPillar('all')}
                          className={`px-2 py-0.5 rounded ${
                            selectedAnomalyPillar === 'all' ? 'bg-[#1A5438] text-white' : 'text-[#5A6774]'
                          }`}
                        >
                          All
                        </button>
                        <button
                          onClick={() => setSelectedAnomalyPillar('gnn')}
                          className={`px-2 py-0.5 rounded ${
                            selectedAnomalyPillar === 'gnn' ? 'bg-forest-600 text-white' : 'text-[#5A6774]'
                          }`}
                        >
                          GNN
                        </button>
                        <button
                          onClick={() => setSelectedAnomalyPillar('nlp')}
                          className={`px-2 py-0.5 rounded ${
                            selectedAnomalyPillar === 'nlp' ? 'bg-[#0984E3] text-white' : 'text-[#5A6774]'
                          }`}
                        >
                          NLP
                        </button>
                        <button
                          onClick={() => setSelectedAnomalyPillar('cv')}
                          className={`px-2 py-0.5 rounded ${
                            selectedAnomalyPillar === 'cv' ? 'bg-[#E17055] text-white' : 'text-[#5A6774]'
                          }`}
                        >
                          CV
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {selectedClaim.anomalies
                        .filter((a) => selectedAnomalyPillar === 'all' || a.pillar === selectedAnomalyPillar)
                        .map((anomaly, idx) => (
                          <div
                            key={idx}
                            className={`rounded-md border p-4 text-xs space-y-2 ${
                              anomaly.severity === 'critical'
                                ? 'border-[#C0392B]/30 bg-[#FADBD8]/30'
                                : anomaly.severity === 'high'
                                ? 'border-[#E67E22]/30 bg-[#FCF6EC]'
                                : 'border-[#E1E6EB] bg-white'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span
                                className={`font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                                  anomaly.pillar === 'gnn'
                                    ? 'bg-forest-600/15 text-forest-600'
                                    : anomaly.pillar === 'nlp'
                                    ? 'bg-[#0984E3]/15 text-[#0984E3]'
                                    : 'bg-[#E17055]/15 text-[#E17055]'
                                }`}
                              >
                                {anomaly.pillar.toUpperCase()} • {anomaly.severity}
                              </span>
                            </div>

                            <h5 className="font-serif font-bold text-[#1A1F25] text-sm">
                              {anomaly.title}
                            </h5>

                            <p className="text-[#343D47] leading-relaxed">
                              {anomaly.description}
                            </p>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Investigator Notes Form */}
                  <div className="p-5 space-y-2">
                    <label className="font-serif text-xs font-bold uppercase tracking-wider text-[#5A6774] block">
                      SIU Investigator Field Notes
                    </label>
                    <textarea
                      rows={3}
                      value={selectedClaim.investigatorNotes}
                      onChange={(e) =>
                        setInvestigatorNotes(selectedClaim.metadata.claimId, e.target.value)
                      }
                      placeholder="Add investigation findings, NOAA radar cross-checks, or referral notes..."
                      className="w-full rounded border border-[#C2CBD3] p-2.5 text-xs text-[#1A1F25] focus:border-[#2A8E58] focus:outline-none"
                    ></textarea>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center flex-1 p-12 text-center text-[#5A6774]">
                  <Eye size={36} className="mb-3 text-[#7A8894]" />
                  <p className="font-serif text-base font-semibold">No claim selected for inspection.</p>
                  <p className="text-xs mt-1 text-[#7A8894]">
                    Select any claim from the table on the left to view detailed risk breakdown and explainability findings.
                  </p>
                </div>
              )}
            </aside>
          )}

          {/* Network Graph Slide panel if toggled */}
          {state.isNetworkPanelOpen && !state.isDetailPanelOpen && (
            <aside className="w-1/2 min-w-[480px] border-l border-[#E1E6EB] bg-[#0F172A] text-white flex flex-col p-2">
              <NetworkGraphPanel />
            </aside>
          )}

        </div>
      </div>
    </div>
  );
}
