"""
AgriGuard ML Fusion Scoring Engine (Stub)
═══════════════════════════════════════════════════════════════════════════════
This module serves as the boundary between the API presentation layer and
the internal machine learning pipeline (GNN + NLP + CV fusion model).

When the trained production model is ready:
1. Load your model weights / pipeline (e.g. PyTorch, ONNX, or Hugging Face) in this module.
2. Update `compute_claim_risk()` to pass the multimodal inputs (graph adjacency,
   adjuster report text, satellite imagery/photos) into the model.
3. Return the calibrated risk score (0-100), the derived triage tier, and
   the multimodal explainability notes.

The API endpoints and Pydantic schemas in `schemas.py` and `main.py` will
remain completely unchanged.
═══════════════════════════════════════════════════════════════════════════════
"""

from typing import Dict, Any, Tuple

try:
    from schemas import TriageTier, ExplainabilityNotes
except ImportError:
    from .schemas import TriageTier, ExplainabilityNotes


def derive_triage_tier(risk_score: float) -> TriageTier:
    """
    Derives the triage routing tier from calibrated risk score thresholds:
    - 0 to <40:   APPROVE (Safe / normal loss)
    - 40 to <70:  REVIEW (Requires loss-adjuster secondary sign-off)
    - 70 to 100:  INVESTIGATE (High likelihood of synthetic, padded, or fraudulent claim)
    """
    if risk_score >= 70.0:
        return TriageTier.INVESTIGATE
    elif risk_score >= 40.0:
        return TriageTier.REVIEW
    else:
        return TriageTier.APPROVE


def compute_claim_risk(claim_data: Dict[str, Any]) -> Tuple[float, TriageTier, ExplainabilityNotes]:
    """
    Internal ML scoring function stub.

    Args:
        claim_data: Dictionary containing claim metadata (crop, payout, peril, assessor, notes, etc.)

    Returns:
        Tuple of:
          - risk_score: float between 0.0 and 100.0
          - triage_tier: TriageTier ('approve', 'review', 'investigate')
          - explainability: ExplainabilityNotes (graph_note, text_note, image_note)
    """
    # If the mock record already provides a designated score, use it as baseline
    risk_score = float(claim_data.get("risk_score", 50.0))
    tier = claim_data.get("triage_tier")

    if not isinstance(tier, TriageTier):
        tier = derive_triage_tier(risk_score)

    # In stub mode, explainability notes can be provided by mock data or generated from score tier
    default_notes = claim_data.get("explainability", {})
    
    if tier == TriageTier.INVESTIGATE:
        graph_note = default_notes.get(
            "graph_note",
            "GNN flagged dense co-assessment cluster with 4 adjacent claims exhibiting identical damage timelines."
        )
        text_note = default_notes.get(
            "text_note",
            "NLP detected severe semantic mismatch: adjuster notes report total crop wash, but Sentinel-2 NDVI shows normal vegetative index."
        )
        image_note = default_notes.get(
            "image_note",
            "CV pipeline detected altered EXIF GPS metadata; submitted damage photo coordinates diverge by 42 km from parcel boundary."
        )
    elif tier == TriageTier.REVIEW:
        graph_note = default_notes.get(
            "graph_note",
            "Graph topology shows standard regional clustering with minor repeat assessor overlap."
        )
        text_note = default_notes.get(
            "text_note",
            "NLP identified partial discrepancy between reported hail severity and localized NOAA radar storm tracks."
        )
        image_note = default_notes.get(
            "image_note",
            "CV detected valid image metadata, but foliage damage pattern exhibits moderate variance with claimed insect infestation."
        )
    else:  # APPROVE
        graph_note = default_notes.get(
            "graph_note",
            "Graph connectivity is sparse and normal; no suspicious multi-claim hubs or shared assessor anomalies."
        )
        text_note = default_notes.get(
            "text_note",
            "NLP confirmed high alignment between narrative description, USDA drought monitor readings, and rainfall deficits."
        )
        image_note = default_notes.get(
            "image_note",
            "CV verified authentic on-site geotags with visual crop lodging consistent with high-speed derecho wind damage."
        )

    explainability = ExplainabilityNotes(
        graph_note=graph_note,
        text_note=text_note,
        image_note=image_note,
    )

    return risk_score, tier, explainability
