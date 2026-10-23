// ═══════════════════════════════════════════════════════════════════════════════
// AgriGuard — Domain Types & Interfaces
// Agricultural Insurance Fraud Risk Analytics Platform
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Enumerations ────────────────────────────────────────────────────────────

/** Crop classification covering Maharashtra and Indian PMFBY crops */
export type CropType =
  | 'Wheat'
  | 'Groundnut'
  | 'Tur'
  | 'Sugarcane'
  | 'Jowar'
  | 'Cotton'
  | 'Bajra'
  | 'Gram'
  | 'Onion'
  | 'Soybean'
  | 'Winter Wheat'
  | 'Spring Wheat'
  | 'Grain Sorghum'
  | 'Corn (Maize)'
  | 'Soybeans'
  | 'Cotton (Upland)'
  | 'Rice (Long Grain)'
  | 'Canola / Rapeseed'
  | 'Sunflower'
  | 'Alfalfa Hay'
  | string;

/** Peril classifications under PMFBY */
export type PerilType =
  | 'Drought'
  | 'Excess Moisture / Flood'
  | 'Hail'
  | 'Freeze / Frost'
  | 'Wind / Derecho'
  | 'Disease (Fungal)'
  | 'Insect Infestation'
  | 'Prevented Planting'
  | 'Wildlife Damage'
  | 'Other / Unspecified'
  | string;

/** Risk tier classification — drives triage routing */
export type RiskTier = 'safe' | 'review' | 'investigate';

/** Insurance product types under PMFBY crop insurance */
export type PolicyType =
  | 'PMFBY - Comprehensive Risk Insurance'
  | 'PMFBY - Yield Protection'
  | 'PMFBY - Localized Calamities & Post-Harvest'
  | 'PMFBY - Weather Based Crop Insurance (WBCIS)'
  | string;

/** Node entity types for the fraud network graph */
export type NetworkNodeKind = 'claim' | 'farmer' | 'assessor' | 'farmland';

/** Edge relationship types for the fraud network graph */
export type NetworkEdgeKind =
  | 'filed_by'        // claim → farmer
  | 'assessed_by'     // claim → assessor
  | 'located_on'      // claim → farmland
  | 'owns'            // farmer → farmland
  | 'co_assessed'     // assessor → assessor (shared claim history)
  | 'adjacent_to';    // farmland → farmland (parcel adjacency)

/** Severity of an individual anomaly finding */
export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical';

/** Source pillar of an anomaly detection */
export type AnomalyPillar = 'gnn' | 'nlp' | 'cv';


// ─── Geographic & Temporal ──────────────────────────────────────────────────

export interface GeoCoordinate {
  /** WGS-84 latitude in decimal degrees */
  latitude: number;
  /** WGS-84 longitude in decimal degrees */
  longitude: number;
}

export interface ParcelBoundary {
  /** Taluka identifier */
  countyFips: string;
  /** District / State abbreviation (e.g. "MH") */
  stateAbbrev: string;
  /** PMFBY Land parcel identifier */
  cluTractId: string;
  /** Centroid of the insured parcel */
  centroid: GeoCoordinate;
  /** Approximate acreage of the insured parcel */
  insuredAcres: number;
}


// ─── Claim Metadata ─────────────────────────────────────────────────────────

export interface ClaimMetadata {
  /** Internal AgriGuard claim identifier (format: "AG-YYMM-XXXXX") */
  claimId: string;
  /** USDA RMA policy number */
  policyNumber: string;
  /** Type of crop insurance product */
  policyType: PolicyType;
  /** Total liability / policy value in USD */
  policyValueUsd: number;
  /** Claimed indemnity amount in USD */
  claimAmountUsd: number;
  /** Farmer / producer entity ID */
  farmerId: string;
  /** Full legal name of the insured producer */
  farmerName: string;
  /** Assigned loss-adjusting assessor ID */
  assessorId: string;
  /** Assessor full name */
  assessorName: string;
  /** Crop type under claim */
  cropType: CropType;
  /** Claimed peril / cause of loss */
  perilType: PerilType;
  /** Date the loss event was reported (ISO 8601) */
  lossReportDate: string;
  /** Date field inspection occurred (ISO 8601) */
  inspectionDate: string;
  /** Crop year (growing season) */
  cropYear: number;
  /** Parcel / farmland geographic data */
  parcel: ParcelBoundary;
}


// ─── Risk Scoring ───────────────────────────────────────────────────────────

export interface RiskPillarScore {
  /** Raw score from 0.0 to 1.0 produced by the pillar model */
  raw: number;
  /** Normalized weighted contribution to composite score (0.0–1.0) */
  weightedContribution: number;
  /** Weight applied to this pillar in the fusion model (sums to 1.0 across pillars) */
  fusionWeight: number;
}

export interface RiskScore {
  /** Composite fused risk score (0.0 – 1.0) */
  composite: number;
  /** Classification tier derived from composite thresholds:
   *  safe: 0.00–0.39 | review: 0.40–0.69 | investigate: 0.70–1.00 */
  tier: RiskTier;
  /** Confidence of the composite model (0.0 – 1.0) */
  confidence: number;
  /** Per-pillar breakdown */
  pillars: {
    gnn: RiskPillarScore;
    nlp: RiskPillarScore;
    cv: RiskPillarScore;
  };
}


// ─── Anomaly Explainability Pillars ─────────────────────────────────────────

/** GNN / Network topology anomalies */
export interface GnnAnomaly {
  pillar: 'gnn';
  severity: AnomalySeverity;
  /** Human-readable anomaly title */
  title: string;
  /** Detailed explanation of the network-level finding */
  description: string;
  /** Whether this assessor has been flagged across multiple claims */
  sharedAssessorFlag: boolean;
  /** Number of claims this assessor has also adjusted within the same county in the trailing 24 months */
  assessorClaimCountInCounty24Mo: number;
  /** Historical proximity metric: average geodesic distance (km) between this claim's parcel
   *  and other claims filed by the same farmer in the trailing 36 months */
  multiClaimProximityKm: number;
  /** Number of distinct farmers connected to this assessor in the network */
  assessorFarmerLinkCount: number;
  /** Community detection cluster ID from the GNN model (claims in the same cluster share structural similarity) */
  communityClusterId: string;
}

/** NLP / Text-mismatch anomalies */
export interface NlpAnomaly {
  pillar: 'nlp';
  severity: AnomalySeverity;
  title: string;
  description: string;
  /** Cosine similarity between satellite-derived vegetation report and adjuster narrative (0.0–1.0) */
  satelliteNarrativeSimilarity: number;
  /** Key contradicting phrases extracted from the adjuster report */
  adjusterContradictions: string[];
  /** Key phrases extracted from the satellite / remote-sensing vegetation index report */
  satelliteKeyPhrases: string[];
  /** Named-entity mismatches (e.g., peril type in narrative differs from formal claim filing) */
  entityMismatches: Array<{
    field: string;
    claimValue: string;
    narrativeValue: string;
  }>;
  /** Sentiment polarity of the adjuster narrative (-1.0 to 1.0; overly neutral or positive narratives on severe losses are flagged) */
  narrativeSentiment: number;
}

/** CV / Image-mismatch anomalies */
export interface CvAnomaly {
  pillar: 'cv';
  severity: AnomalySeverity;
  title: string;
  description: string;
  /** Whether EXIF metadata was stripped or altered on submitted crop damage photos */
  exifMetadataAltered: boolean;
  /** Discrepancy between photo EXIF GPS coordinates and the insured parcel centroid (km) */
  gpsDiscrepancyKm: number;
  /** Discrepancy between photo EXIF timestamp and the reported loss event date (hours) */
  timestampDiscrepancyHours: number;
  /** Error-Level Analysis (ELA) score indicating pixel-level manipulation likelihood (0.0–1.0) */
  elaManipulationScore: number;
  /** Number of submitted images flagged as potentially reused from a prior claim */
  reusedImageCount: number;
  /** Total images submitted for this claim */
  totalImagesSubmitted: number;
  /** Whether the damage pattern in imagery is consistent with the claimed peril type */
  damagePatternConsistent: boolean;
}

/** Union type for any single anomaly finding */
export type AnomalyFinding = GnnAnomaly | NlpAnomaly | CvAnomaly;


// ─── Fused Claim Entity ─────────────────────────────────────────────────────

/** Top-level claim entity consumed by the UI — joins metadata, scoring, and explainability */
export interface AgriGuardClaim {
  metadata: ClaimMetadata;
  riskScore: RiskScore;
  anomalies: AnomalyFinding[];
  /** ISO 8601 timestamp when the risk analysis pipeline last processed this claim */
  lastAnalyzedAt: string;
  /** Analyst-assigned investigation notes (empty if none yet) */
  investigatorNotes: string;
  /** Whether an analyst has bookmarked / pinned this claim for follow-up */
  isPinned: boolean;
}


// ─── Network Topology (Force-Directed Graph) ───────────────────────────────

export interface NetworkNode {
  /** Unique node identifier (matches claimId, farmerId, assessorId, or parcel cluTractId) */
  id: string;
  /** Display label for the node */
  label: string;
  /** Entity type */
  kind: NetworkNodeKind;
  /** Risk tier (only applicable for claim nodes; null for others) */
  riskTier: RiskTier | null;
  /** Composite risk score (only applicable for claim nodes; null for others) */
  riskScore: number | null;
  /** Grouping identifier for community coloring in the graph */
  communityClusterId: string | null;
}

export interface NetworkEdge {
  /** Source node ID */
  source: string;
  /** Target node ID */
  target: string;
  /** Relationship type */
  kind: NetworkEdgeKind;
  /** Edge weight / strength (0.0–1.0; higher = stronger connection) */
  weight: number;
  /** Whether this edge was flagged as anomalous by the GNN */
  isAnomalous: boolean;
}

export interface NetworkGraph {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
}


// ─── UI State Types ─────────────────────────────────────────────────────────

export type SortField =
  | 'claimId'
  | 'composite'
  | 'claimAmountUsd'
  | 'lossReportDate'
  | 'cropType'
  | 'tier';

export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

export interface FilterState {
  /** Free-text search across claim ID, farmer name, assessor name */
  searchQuery: string;
  /** Filter by risk tier(s); empty array = show all */
  tiers: RiskTier[];
  /** Filter by crop type(s); empty array = show all */
  cropTypes: CropType[];
  /** Filter by peril type(s); empty array = show all */
  perilTypes: PerilType[];
  /** Minimum composite risk score (0.0–1.0) */
  minCompositeScore: number;
  /** Maximum composite risk score (0.0–1.0) */
  maxCompositeScore: number;
  /** Filter to only pinned/bookmarked claims */
  pinnedOnly: boolean;
}

export interface ClaimsContextState {
  /** Full dataset of claims loaded from the API / mock */
  claims: AgriGuardClaim[];
  /** Currently selected claim ID for detail panel (null = none) */
  selectedClaimId: string | null;
  /** Network graph for the currently selected claim's neighborhood */
  activeNetworkGraph: NetworkGraph | null;
  /** Whether data is currently loading */
  isLoading: boolean;
  /** Error message from last operation (null = no error) */
  error: string | null;
  /** Active filter parameters */
  filters: FilterState;
  /** Active sort configuration */
  sort: SortConfig;
  /** Detail panel expansion state */
  isDetailPanelOpen: boolean;
  /** Network graph panel expansion state */
  isNetworkPanelOpen: boolean;
}
