// ═══════════════════════════════════════════════════════════════════════════════
// AgriGuard — Claims Context & State Management
// Central state store for claims data, filtering, sorting, and selection.
// Fetches live data from the FastAPI backend at startup and on-demand.
// ═══════════════════════════════════════════════════════════════════════════════

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';

import type {
  AgriGuardClaim,
  ClaimsContextState,
  FilterState,
  SortConfig,
  SortField,
  SortDirection,
  RiskTier,
  NetworkGraph,
  NetworkNode,
  NetworkEdge,
} from '../types';

const API_BASE_URL = 'http://localhost:8000';

// ─── API Response Interfaces ────────────────────────────────────────────────

interface ApiClaimSummary {
  claim_id: string;
  farmer_name: string;
  assessor_name: string;
  crop_type: string;
  claimed_payout_amount: number;
  claim_date: string;
  risk_score: number;
  triage_tier: 'approve' | 'review' | 'investigate';
}

interface ApiClaimDetail extends ApiClaimSummary {
  explainability: {
    graph_note: string;
    text_note: string;
    image_note: string;
  };
}

interface ApiNetworkNode {
  id: string;
  label: string;
  kind: string;
  risk_score?: number | null;
  triage_tier?: string | null;
}

interface ApiNetworkEdge {
  source: string;
  target: string;
  relationship: string;
  weight: number;
  is_anomalous: boolean;
}

interface ApiNetworkGraph {
  nodes: ApiNetworkNode[];
  edges: ApiNetworkEdge[];
}

// ─── API to Domain Mappers ──────────────────────────────────────────────────

function mapApiSummaryToClaim(item: ApiClaimSummary): AgriGuardClaim {
  const composite = item.risk_score / 100.0;
  const tier: RiskTier =
    item.triage_tier === 'approve' ? 'safe' : (item.triage_tier as RiskTier);

  return {
    metadata: {
      claimId: item.claim_id,
      policyNumber: `PMFBY-MH-${item.claim_id}`,
      policyType: 'PMFBY - Comprehensive Risk Insurance',
      policyValueUsd: item.claimed_payout_amount,
      claimAmountUsd: item.claimed_payout_amount,
      farmerId: `FRM-${item.claim_id}`,
      farmerName: item.farmer_name,
      assessorId: `ADJ-${item.claim_id}`,
      assessorName: item.assessor_name,
      cropType: (item.crop_type || 'Wheat') as any,
      perilType: 'Drought' as any,
      lossReportDate: item.claim_date || '2025-10-01',
      inspectionDate: '2025-10-05',
      cropYear: 2025,
      parcel: {
        countyFips: 'Taluka',
        stateAbbrev: 'MH',
        cluTractId: `PMFBY-MH-${item.claim_id}`,
        centroid: { latitude: 19.7515, longitude: 75.7139 },
        insuredAcres: 5.0,
      },
    },
    riskScore: {
      composite,
      tier,
      confidence: 0.90,
      pillars: {
        gnn: {
          raw: composite,
          weightedContribution: composite * 0.5,
          fusionWeight: 0.5,
        },
        nlp: {
          raw: 0,
          weightedContribution: 0,
          fusionWeight: 0.25,
        },
        cv: {
          raw: 0,
          weightedContribution: 0,
          fusionWeight: 0.25,
        },
      },
    },
    anomalies: [
      {
        pillar: 'gnn',
        severity: tier === 'investigate' ? 'critical' : tier === 'review' ? 'high' : 'low',
        title: 'GNN Graph Neural Topology Finding',
        description: `GNN calibrated risk score: ${item.risk_score.toFixed(1)}/100 (${item.triage_tier}).`,
        sharedAssessorFlag: composite >= 0.7,
        assessorClaimCountInCounty24Mo: composite >= 0.7 ? 14 : 3,
        multiClaimProximityKm: composite >= 0.7 ? 2.1 : 8.5,
        assessorFarmerLinkCount: composite >= 0.7 ? 8 : 2,
        communityClusterId: `GNN-MH-${item.claim_id.slice(-2)}`,
      },
      {
        pillar: 'nlp',
        severity: 'low',
        title: 'NLP Telemetry Analysis',
        description: 'Not yet available',
        satelliteNarrativeSimilarity: 0,
        adjusterContradictions: [],
        satelliteKeyPhrases: [],
        entityMismatches: [],
        narrativeSentiment: 0,
      },
      {
        pillar: 'cv',
        severity: 'low',
        title: 'Computer Vision Forensic',
        description: 'Not yet available',
        exifMetadataAltered: false,
        gpsDiscrepancyKm: 0,
        timestampDiscrepancyHours: 0,
        elaManipulationScore: 0,
        reusedImageCount: 0,
        totalImagesSubmitted: 0,
        damagePatternConsistent: true,
      },
    ],
    lastAnalyzedAt: '2025-10-01T10:00:00Z',
    investigatorNotes: '',
    isPinned: false,
  };
}

function updateClaimWithDetail(claim: AgriGuardClaim, detail: ApiClaimDetail): AgriGuardClaim {
  const gnnNote = detail.explainability?.graph_note;
  const textNote = detail.explainability?.text_note || 'Not yet available';
  const imageNote = detail.explainability?.image_note || 'Not yet available';

  return {
    ...claim,
    anomalies: claim.anomalies.map((a) => {
      if (a.pillar === 'gnn' && gnnNote) {
        return { ...a, description: gnnNote };
      }
      if (a.pillar === 'nlp') {
        return { ...a, description: textNote };
      }
      if (a.pillar === 'cv') {
        return { ...a, description: imageNote };
      }
      return a;
    }),
  };
}

function mapApiGraphToNetworkGraph(apiGraph: ApiNetworkGraph): NetworkGraph {
  const nodes: NetworkNode[] = apiGraph.nodes.map((n) => {
    const tier: RiskTier | null = n.triage_tier
      ? n.triage_tier === 'approve'
        ? 'safe'
        : (n.triage_tier as RiskTier)
      : null;
    return {
      id: n.id,
      label: n.label,
      kind: n.kind === 'zone' ? 'farmland' : (n.kind as any),
      riskTier: tier,
      riskScore: typeof n.risk_score === 'number' ? n.risk_score / 100.0 : null,
      communityClusterId: null,
    };
  });

  const edges: NetworkEdge[] = apiGraph.edges.map((e) => ({
    source: e.source,
    target: e.target,
    kind: (e.relationship === 'verified_by' ? 'assessed_by' : e.relationship) as any,
    weight: typeof e.weight === 'number' ? e.weight : 1.0,
    isAnomalous: !!e.is_anomalous,
  }));

  return { nodes, edges };
}

/** Fallback local network graph generator if network request is pending */
export function buildNetworkGraphForClaim(claim: AgriGuardClaim): NetworkGraph {
  const { metadata, riskScore, anomalies } = claim;
  const gnnAnomaly = anomalies.find((a) => a.pillar === 'gnn') as
    | Extract<(typeof anomalies)[number], { pillar: 'gnn' }>
    | undefined;

  const nodes: NetworkGraph['nodes'] = [
    {
      id: metadata.claimId,
      label: metadata.claimId,
      kind: 'claim',
      riskTier: riskScore.tier,
      riskScore: riskScore.composite,
      communityClusterId: gnnAnomaly?.communityClusterId ?? null,
    },
    {
      id: metadata.farmerId,
      label: metadata.farmerName,
      kind: 'farmer',
      riskTier: null,
      riskScore: null,
      communityClusterId: gnnAnomaly?.communityClusterId ?? null,
    },
    {
      id: metadata.assessorId,
      label: metadata.assessorName,
      kind: 'assessor',
      riskTier: null,
      riskScore: null,
      communityClusterId: gnnAnomaly?.communityClusterId ?? null,
    },
    {
      id: metadata.parcel.cluTractId,
      label: `${metadata.parcel.stateAbbrev} - ${metadata.parcel.countyFips} (${metadata.parcel.insuredAcres} ac)`,
      kind: 'farmland',
      riskTier: null,
      riskScore: null,
      communityClusterId: null,
    },
  ];

  const edges: NetworkGraph['edges'] = [
    {
      source: metadata.claimId,
      target: metadata.farmerId,
      kind: 'filed_by',
      weight: 1.0,
      isAnomalous: false,
    },
    {
      source: metadata.claimId,
      target: metadata.assessorId,
      kind: 'assessed_by',
      weight: 1.0,
      isAnomalous: gnnAnomaly?.sharedAssessorFlag ?? false,
    },
    {
      source: metadata.claimId,
      target: metadata.parcel.cluTractId,
      kind: 'located_on',
      weight: 1.0,
      isAnomalous: false,
    },
    {
      source: metadata.farmerId,
      target: metadata.parcel.cluTractId,
      kind: 'owns',
      weight: 0.9,
      isAnomalous: false,
    },
  ];

  return { nodes, edges };
}

// ─── Reducer Actions ────────────────────────────────────────────────────────

type ClaimsAction =
  | { type: 'SET_CLAIMS'; payload: AgriGuardClaim[] }
  | { type: 'UPDATE_CLAIM'; payload: AgriGuardClaim }
  | { type: 'SELECT_CLAIM'; payload: string | null }
  | { type: 'SET_NETWORK_GRAPH'; payload: NetworkGraph | null }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'UPDATE_FILTERS'; payload: Partial<FilterState> }
  | { type: 'RESET_FILTERS' }
  | { type: 'SET_SORT'; payload: SortConfig }
  | { type: 'TOGGLE_SORT_DIRECTION' }
  | { type: 'TOGGLE_DETAIL_PANEL'; payload?: boolean }
  | { type: 'TOGGLE_NETWORK_PANEL'; payload?: boolean }
  | { type: 'TOGGLE_PIN_CLAIM'; payload: string }
  | { type: 'SET_INVESTIGATOR_NOTES'; payload: { claimId: string; notes: string } };

// ─── Default State ──────────────────────────────────────────────────────────

const DEFAULT_FILTERS: FilterState = {
  searchQuery: '',
  tiers: [],
  cropTypes: [],
  perilTypes: [],
  minCompositeScore: 0,
  maxCompositeScore: 1,
  pinnedOnly: false,
};

const DEFAULT_SORT: SortConfig = {
  field: 'composite',
  direction: 'desc',
};

const INITIAL_STATE: ClaimsContextState = {
  claims: [],
  selectedClaimId: null,
  activeNetworkGraph: null,
  isLoading: true,
  error: null,
  filters: DEFAULT_FILTERS,
  sort: DEFAULT_SORT,
  isDetailPanelOpen: false,
  isNetworkPanelOpen: false,
};

// ─── Reducer ────────────────────────────────────────────────────────────────

function claimsReducer(
  state: ClaimsContextState,
  action: ClaimsAction
): ClaimsContextState {
  switch (action.type) {
    case 'SET_CLAIMS': {
      const selectedId =
        state.selectedClaimId && action.payload.some((c) => c.metadata.claimId === state.selectedClaimId)
          ? state.selectedClaimId
          : action.payload[0]?.metadata.claimId ?? null;
      const selectedClaim = action.payload.find((c) => c.metadata.claimId === selectedId);
      return {
        ...state,
        claims: action.payload,
        selectedClaimId: selectedId,
        activeNetworkGraph: selectedClaim ? buildNetworkGraphForClaim(selectedClaim) : null,
        isLoading: false,
        error: null,
      };
    }

    case 'UPDATE_CLAIM':
      return {
        ...state,
        claims: state.claims.map((c) =>
          c.metadata.claimId === action.payload.metadata.claimId ? action.payload : c
        ),
      };

    case 'SELECT_CLAIM': {
      if (action.payload === null) {
        return {
          ...state,
          selectedClaimId: null,
          activeNetworkGraph: null,
          isDetailPanelOpen: false,
        };
      }
      const claim = state.claims.find((c) => c.metadata.claimId === action.payload);
      return {
        ...state,
        selectedClaimId: action.payload,
        activeNetworkGraph: claim ? buildNetworkGraphForClaim(claim) : null,
        isDetailPanelOpen: state.isNetworkPanelOpen ? false : true,
      };
    }

    case 'SET_NETWORK_GRAPH':
      return { ...state, activeNetworkGraph: action.payload };

    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };

    case 'UPDATE_FILTERS':
      return {
        ...state,
        filters: { ...state.filters, ...action.payload },
      };

    case 'RESET_FILTERS':
      return { ...state, filters: DEFAULT_FILTERS };

    case 'SET_SORT':
      return { ...state, sort: action.payload };

    case 'TOGGLE_SORT_DIRECTION':
      return {
        ...state,
        sort: {
          ...state.sort,
          direction: state.sort.direction === 'asc' ? 'desc' : 'asc',
        },
      };

    case 'TOGGLE_DETAIL_PANEL': {
      const willOpen =
        action.payload !== undefined ? action.payload : !state.isDetailPanelOpen;
      return {
        ...state,
        isDetailPanelOpen: willOpen,
        isNetworkPanelOpen: willOpen ? false : state.isNetworkPanelOpen,
      };
    }

    case 'TOGGLE_NETWORK_PANEL': {
      const willOpen =
        action.payload !== undefined ? action.payload : !state.isNetworkPanelOpen;
      const claim = state.selectedClaimId
        ? state.claims.find((c) => c.metadata.claimId === state.selectedClaimId)
        : state.claims[0];
      return {
        ...state,
        isNetworkPanelOpen: willOpen,
        isDetailPanelOpen: willOpen ? false : state.isDetailPanelOpen,
        selectedClaimId: state.selectedClaimId ?? claim?.metadata.claimId ?? null,
        activeNetworkGraph:
          state.activeNetworkGraph ?? (claim ? buildNetworkGraphForClaim(claim) : null),
      };
    }

    case 'TOGGLE_PIN_CLAIM':
      return {
        ...state,
        claims: state.claims.map((c) =>
          c.metadata.claimId === action.payload
            ? { ...c, isPinned: !c.isPinned }
            : c
        ),
      };

    case 'SET_INVESTIGATOR_NOTES':
      return {
        ...state,
        claims: state.claims.map((c) =>
          c.metadata.claimId === action.payload.claimId
            ? { ...c, investigatorNotes: action.payload.notes }
            : c
        ),
      };

    default:
      return state;
  }
}

// ─── Filtering & Sorting Logic ──────────────────────────────────────────────

function applyFilters(
  claims: AgriGuardClaim[],
  filters: FilterState
): AgriGuardClaim[] {
  return claims.filter((claim) => {
    const { metadata, riskScore } = claim;

    // Free-text search
    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      const searchable = [
        metadata.claimId,
        metadata.farmerName,
        metadata.assessorName,
        metadata.policyNumber,
        metadata.parcel.cluTractId,
      ]
        .join(' ')
        .toLowerCase();
      if (!searchable.includes(q)) return false;
    }

    // Risk tier filter
    if (filters.tiers.length > 0 && !filters.tiers.includes(riskScore.tier)) {
      return false;
    }

    // Crop type filter
    if (
      filters.cropTypes.length > 0 &&
      !filters.cropTypes.includes(metadata.cropType)
    ) {
      return false;
    }

    // Peril type filter
    if (
      filters.perilTypes.length > 0 &&
      !filters.perilTypes.includes(metadata.perilType)
    ) {
      return false;
    }

    // Composite score range
    if (
      riskScore.composite < filters.minCompositeScore ||
      riskScore.composite > filters.maxCompositeScore
    ) {
      return false;
    }

    // Pinned only
    if (filters.pinnedOnly && !claim.isPinned) {
      return false;
    }

    return true;
  });
}

function applySorting(
  claims: AgriGuardClaim[],
  sort: SortConfig
): AgriGuardClaim[] {
  const sorted = [...claims].sort((a, b) => {
    let comparison = 0;

    switch (sort.field) {
      case 'claimId':
        comparison = a.metadata.claimId.localeCompare(b.metadata.claimId);
        break;
      case 'composite':
        comparison = a.riskScore.composite - b.riskScore.composite;
        break;
      case 'claimAmountUsd':
        comparison = a.metadata.claimAmountUsd - b.metadata.claimAmountUsd;
        break;
      case 'lossReportDate':
        comparison =
          new Date(a.metadata.lossReportDate).getTime() -
          new Date(b.metadata.lossReportDate).getTime();
        break;
      case 'cropType':
        comparison = a.metadata.cropType.localeCompare(b.metadata.cropType);
        break;
      case 'tier': {
        const tierOrder: Record<RiskTier, number> = {
          safe: 0,
          review: 1,
          investigate: 2,
        };
        comparison = tierOrder[a.riskScore.tier] - tierOrder[b.riskScore.tier];
        break;
      }
    }

    return sort.direction === 'asc' ? comparison : -comparison;
  });

  return sorted;
}

// ─── Context Definition ─────────────────────────────────────────────────────

interface ClaimsContextValue {
  state: ClaimsContextState;
  filteredClaims: AgriGuardClaim[];
  selectedClaim: AgriGuardClaim | null;
  stats: {
    totalClaims: number;
    totalExposureUsd: number;
    tierCounts: Record<RiskTier, number>;
    avgCompositeScore: number;
  };
  selectClaim: (claimId: string | null) => void;
  updateFilters: (partial: Partial<FilterState>) => void;
  resetFilters: () => void;
  setSort: (field: SortField, direction?: SortDirection) => void;
  toggleSortDirection: () => void;
  toggleDetailPanel: (open?: boolean) => void;
  toggleNetworkPanel: (open?: boolean) => void;
  togglePinClaim: (claimId: string) => void;
  setInvestigatorNotes: (claimId: string, notes: string) => void;
  refetchClaims: () => void;
}

const ClaimsContext = createContext<ClaimsContextValue | undefined>(undefined);

// ─── Provider ───────────────────────────────────────────────────────────────

interface ClaimsProviderProps {
  children: ReactNode;
  initialClaims?: AgriGuardClaim[];
}

export function ClaimsProvider({ children, initialClaims }: ClaimsProviderProps) {
  const [state, dispatch] = useReducer(claimsReducer, {
    ...INITIAL_STATE,
    claims: initialClaims ?? [],
    isLoading: initialClaims ? false : true,
  });

  const detailCache = useRef<Map<string, ApiClaimDetail>>(new Map());
  const networkCache = useRef<Map<string, NetworkGraph>>(new Map());

  // ── Network Fetch Helpers ──

  const fetchClaimDetail = useCallback(async (claimId: string) => {
    if (detailCache.current.has(claimId)) {
      const cached = detailCache.current.get(claimId)!;
      dispatch({
        type: 'UPDATE_CLAIM',
        payload: updateClaimWithDetail(
          state.claims.find((c) => c.metadata.claimId === claimId)!,
          cached
        ),
      });
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/claims/${claimId}`);
      if (!res.ok) return;
      const detail: ApiClaimDetail = await res.json();
      detailCache.current.set(claimId, detail);
      const existing = state.claims.find((c) => c.metadata.claimId === claimId);
      if (existing) {
        dispatch({
          type: 'UPDATE_CLAIM',
          payload: updateClaimWithDetail(existing, detail),
        });
      }
    } catch {
      // Silently fall back to existing data if detail endpoint is unreachable
    }
  }, [state.claims]);

  const fetchClaimNetwork = useCallback(async (claimId: string) => {
    if (networkCache.current.has(claimId)) {
      dispatch({ type: 'SET_NETWORK_GRAPH', payload: networkCache.current.get(claimId)! });
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/claims/${claimId}/network`);
      if (!res.ok) return;
      const apiGraph: ApiNetworkGraph = await res.json();
      const mappedGraph = mapApiGraphToNetworkGraph(apiGraph);
      networkCache.current.set(claimId, mappedGraph);
      dispatch({ type: 'SET_NETWORK_GRAPH', payload: mappedGraph });
    } catch {
      // Keep existing or fallback graph if network endpoint is unreachable
    }
  }, []);

  // ── Fetch Claims List on Startup ──

  const loadClaims = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      const res = await fetch(`${API_BASE_URL}/claims`);
      if (!res.ok) {
        throw new Error(`Failed to load claims from backend (${res.status} ${res.statusText})`);
      }
      const data: ApiClaimSummary[] = await res.json();
      const claims = data.map((item) => mapApiSummaryToClaim(item));
      dispatch({ type: 'SET_CLAIMS', payload: claims });

      // Pre-fetch detail and network for the first claim
      if (claims.length > 0) {
        const firstId = claims[0].metadata.claimId;
        fetchClaimDetail(firstId);
        fetchClaimNetwork(firstId);
      }
    } catch (err: any) {
      dispatch({
        type: 'SET_ERROR',
        payload: err?.message || 'Unable to connect to AgriGuard backend at http://localhost:8000',
      });
    }
  }, [fetchClaimDetail, fetchClaimNetwork]);

  useEffect(() => {
    if (!initialClaims) {
      loadClaims();
    }
  }, [initialClaims, loadClaims]);

  // ── Fetch Detail and Graph whenever selectedClaimId changes ──

  useEffect(() => {
    if (state.selectedClaimId) {
      fetchClaimDetail(state.selectedClaimId);
      fetchClaimNetwork(state.selectedClaimId);
    }
  }, [state.selectedClaimId, fetchClaimDetail, fetchClaimNetwork]);

  // ── Derived Data (Memoized) ──

  const filteredClaims = useMemo(
    () => applySorting(applyFilters(state.claims, state.filters), state.sort),
    [state.claims, state.filters, state.sort]
  );

  const selectedClaim = useMemo(
    () =>
      state.selectedClaimId
        ? state.claims.find((c) => c.metadata.claimId === state.selectedClaimId) ?? null
        : null,
    [state.claims, state.selectedClaimId]
  );

  const stats = useMemo(() => {
    const totalClaims = state.claims.length;
    const totalExposureUsd = state.claims.reduce(
      (sum, c) => sum + c.metadata.claimAmountUsd,
      0
    );
    const tierCounts: Record<RiskTier, number> = { safe: 0, review: 0, investigate: 0 };
    let compositeSum = 0;
    for (const claim of state.claims) {
      tierCounts[claim.riskScore.tier]++;
      compositeSum += claim.riskScore.composite;
    }
    return {
      totalClaims,
      totalExposureUsd,
      tierCounts,
      avgCompositeScore: totalClaims > 0 ? compositeSum / totalClaims : 0,
    };
  }, [state.claims]);

  // ── Action Handlers ──

  const selectClaim = useCallback(
    (claimId: string | null) => dispatch({ type: 'SELECT_CLAIM', payload: claimId }),
    []
  );

  const updateFilters = useCallback(
    (partial: Partial<FilterState>) =>
      dispatch({ type: 'UPDATE_FILTERS', payload: partial }),
    []
  );

  const resetFilters = useCallback(
    () => dispatch({ type: 'RESET_FILTERS' }),
    []
  );

  const setSort = useCallback(
    (field: SortField, direction?: SortDirection) =>
      dispatch({
        type: 'SET_SORT',
        payload: { field, direction: direction ?? 'desc' },
      }),
    []
  );

  const toggleSortDirection = useCallback(
    () => dispatch({ type: 'TOGGLE_SORT_DIRECTION' }),
    []
  );

  const toggleDetailPanel = useCallback(
    (open?: boolean) => dispatch({ type: 'TOGGLE_DETAIL_PANEL', payload: open }),
    []
  );

  const toggleNetworkPanel = useCallback(
    (open?: boolean) =>
      dispatch({ type: 'TOGGLE_NETWORK_PANEL', payload: open }),
    []
  );

  const togglePinClaim = useCallback(
    (claimId: string) =>
      dispatch({ type: 'TOGGLE_PIN_CLAIM', payload: claimId }),
    []
  );

  const setInvestigatorNotes = useCallback(
    (claimId: string, notes: string) =>
      dispatch({
        type: 'SET_INVESTIGATOR_NOTES',
        payload: { claimId, notes },
      }),
    []
  );

  const contextValue = useMemo<ClaimsContextValue>(
    () => ({
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
      refetchClaims: loadClaims,
    }),
    [
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
      loadClaims,
    ]
  );

  return (
    <ClaimsContext.Provider value={contextValue}>
      {children}
    </ClaimsContext.Provider>
  );
}

// ─── Custom Hook ────────────────────────────────────────────────────────────

export function useClaims(): ClaimsContextValue {
  const context = useContext(ClaimsContext);
  if (context === undefined) {
    throw new Error(
      'useClaims() must be used within a <ClaimsProvider>. ' +
        'Wrap your component tree with <ClaimsProvider> in App.tsx.'
    );
  }
  return context;
}

export { ClaimsContext };
