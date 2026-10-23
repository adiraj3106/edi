// AgriGuard — Shared UI Components (barrel)
// Reusable atoms: badges, tooltips, loading spinners, etc.

// Tier Badge (stub)
import type { RiskTier } from '../../types';

export function TierBadge({ tier: _tier }: { tier: RiskTier }) {
  return <span className="agriguard-tier-badge">Badge</span>;
}

// Severity Indicator (stub)
import type { AnomalySeverity } from '../../types';

export function SeverityIndicator({ severity: _severity }: { severity: AnomalySeverity }) {
  return <span className="agriguard-severity-indicator">●</span>;
}

// Pillar Icon (stub)
import type { AnomalyPillar } from '../../types';

export function PillarIcon({ pillar: _pillar }: { pillar: AnomalyPillar }) {
  return <span className="agriguard-pillar-icon">◆</span>;
}

// Score Gauge (stub)
export function ScoreGauge({ score: _score }: { score: number }) {
  return <div className="agriguard-score-gauge">Gauge</div>;
}

// Loading Spinner (stub)
export function LoadingSpinner() {
  return <div className="agriguard-loading-spinner">Loading…</div>;
}
