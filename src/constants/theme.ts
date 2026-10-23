// ═══════════════════════════════════════════════════════════════════════════════
// AgriGuard — Design Tokens
// Earthy enterprise palette: deep forest green, warm wheat/amber,
// muted charcoal/slate, off-white.
// ═══════════════════════════════════════════════════════════════════════════════

/** Semantic color tokens mapped to the AgriGuard visual identity */
export const COLORS = {
  // ── Primary: Deep Forest Green ──
  forest: {
    900: '#0B2619',
    800: '#123D29',
    700: '#1A5438',
    600: '#227148',
    500: '#2A8E58',
    400: '#4DAE78',
    300: '#7ACA9B',
    200: '#A8E0BF',
    100: '#D5F0DF',
    50:  '#EBF8F0',
  },

  // ── Accent: Warm Wheat / Amber ──
  wheat: {
    900: '#5C3D0E',
    800: '#7A5213',
    700: '#996819',
    600: '#B87E1F',
    500: '#D69425',
    400: '#E0AD50',
    300: '#E8C47E',
    200: '#F0DBAC',
    100: '#F8EDDA',
    50:  '#FCF6EC',
  },

  // ── Neutral: Charcoal / Slate ──
  slate: {
    950: '#0F1215',
    900: '#1A1F25',
    800: '#272E36',
    700: '#343D47',
    600: '#414C58',
    500: '#5A6774',
    400: '#7A8894',
    300: '#9EAAB4',
    200: '#C2CBD3',
    100: '#E1E6EB',
    50:  '#F3F5F7',
  },

  // ── Surface / Background ──
  surface: {
    primary:   '#F7F5F0',  // warm off-white
    secondary: '#EFEDE7',  // slightly darker off-white
    elevated:  '#FFFFFF',  // card / panel surfaces
    dark:      '#1A1F25',  // dark mode primary
    darkElevated: '#272E36', // dark mode card
  },

  // ── Semantic: Risk Tiers ──
  risk: {
    safe:        '#2A8E58',
    safeBg:      '#D5F0DF',
    review:      '#D69425',
    reviewBg:    '#F8EDDA',
    investigate: '#C0392B',
    investigateBg: '#FADBD8',
  },

  // ── Semantic: Anomaly Severity ──
  severity: {
    low:      '#5A6774',
    medium:   '#D69425',
    high:     '#E67E22',
    critical: '#C0392B',
  },

  // ── Semantic: Anomaly Pillars ──
  pillar: {
    gnn: '#2A8E58',  // network / graph — forest green
    nlp: '#0984E3',  // text analysis — blue
    cv:  '#E17055',  // computer vision — terracotta
  },
} as const;

/** Tier-to-label mapping */
export const TIER_LABELS = {
  safe: 'Safe',
  review: 'Review',
  investigate: 'Investigate',
} as const;

/** Tier composite score thresholds */
export const TIER_THRESHOLDS = {
  safe: { min: 0.0, max: 0.39 },
  review: { min: 0.40, max: 0.69 },
  investigate: { min: 0.70, max: 1.0 },
} as const;

/** Pillar display labels */
export const PILLAR_LABELS = {
  gnn: 'Network / GNN',
  nlp: 'Text / NLP',
  cv: 'Image / CV',
} as const;
