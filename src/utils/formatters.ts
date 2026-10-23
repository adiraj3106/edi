// ═══════════════════════════════════════════════════════════════════════════════
// AgriGuard — Utility & Formatting Helpers
// Pure functions for formatting domain values across the UI.
// ═══════════════════════════════════════════════════════════════════════════════

import type { RiskTier, AnomalySeverity, AnomalyPillar } from '../types';
import { TIER_LABELS, PILLAR_LABELS, COLORS } from '../constants';

/** Format INR currency with appropriate precision (₹ and lakh/crore grouping) */
export function formatInr(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/** Format a risk score as a percentage string (e.g., "87%") */
export function formatRiskPercent(score: number): string {
  return `${Math.round(score * 100)}%`;
}

/** Get the display label for a risk tier */
export function getTierLabel(tier: RiskTier): string {
  return TIER_LABELS[tier];
}

/** Get the semantic color for a risk tier */
export function getTierColor(tier: RiskTier): string {
  return COLORS.risk[tier];
}

/** Get the background color for a risk tier badge */
export function getTierBgColor(tier: RiskTier): string {
  return COLORS.risk[`${tier}Bg`];
}

/** Get the semantic color for an anomaly severity level */
export function getSeverityColor(severity: AnomalySeverity): string {
  return COLORS.severity[severity];
}

/** Get the display label for an anomaly pillar */
export function getPillarLabel(pillar: AnomalyPillar): string {
  return PILLAR_LABELS[pillar];
}

/** Get the pillar accent color */
export function getPillarColor(pillar: AnomalyPillar): string {
  return COLORS.pillar[pillar];
}

/** Format an ISO date string to a locale-appropriate short date */
export function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Format an ISO datetime string to a locale-appropriate datetime */
export function formatDateTime(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Truncate a string to a max length with ellipsis */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

/** Format acreage with comma separators */
export function formatAcres(acres: number): string {
  return `${new Intl.NumberFormat('en-IN').format(acres)} ac`;
}

/** Claim-to-policy ratio as a percentage */
export function claimToPolicyRatio(claimAmount: number, policyAmount: number): string {
  if (policyAmount === 0) return '—';
  return `${Math.round((claimAmount / policyAmount) * 100)}%`;
}
