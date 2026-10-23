"""
AgriGuard Claims & Graph Data Store
Loaded at startup from Maharashtra synthetic PMFBY dataset in agriguard_gnn_build.
"""

import os
import sys
import pandas as pd
from typing import Dict, Any, List, Set, Optional

try:
    from schemas import NetworkGraph, NetworkNode, NetworkEdge
except ImportError:
    from .schemas import NetworkGraph, NetworkNode, NetworkEdge

# Resolve path to data directory
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
POSSIBLE_DIRS = [
    os.path.normpath(os.path.join(CURRENT_DIR, "..", "agriguard_gnn_build")),
    os.path.normpath(os.path.join(CURRENT_DIR, "agriguard_gnn_build")),
    os.path.normpath(os.path.join(os.getcwd(), "agriguard_gnn_build")),
    os.path.normpath(os.path.join(os.getcwd(), "..", "agriguard_gnn_build")),
]

DATA_DIR = next((d for d in POSSIBLE_DIRS if os.path.exists(os.path.join(d, "claims.csv"))), POSSIBLE_DIRS[0])

# Load CSV files at startup
claims_path = os.path.join(DATA_DIR, "claims.csv")
farmers_path = os.path.join(DATA_DIR, "farmers.csv")
assessors_path = os.path.join(DATA_DIR, "assessors.csv")
claim_scores_path = os.path.join(DATA_DIR, "claim_scores.csv")
graph_edges_path = os.path.join(DATA_DIR, "graph_edges.csv")
graph_nodes_path = os.path.join(DATA_DIR, "graph_nodes.csv")

# 1. Farmers mapping & Family group index
farmers_df = pd.read_csv(farmers_path) if os.path.exists(farmers_path) else pd.DataFrame()
farmers_dict: Dict[str, str] = (
    dict(zip(farmers_df["farmer_id"].astype(str), farmers_df["name"].astype(str)))
    if not farmers_df.empty
    else {}
)
farmer_to_family: Dict[str, str] = {}
family_to_farmers: Dict[str, List[str]] = {}
if not farmers_df.empty and "family_group_id" in farmers_df.columns:
    for _, f_row in farmers_df.iterrows():
        fid = str(f_row["farmer_id"])
        fam_val = f_row.get("family_group_id")
        if pd.notna(fam_val) and str(fam_val).strip():
            fam_id = str(fam_val).strip()
            farmer_to_family[fid] = fam_id
            family_to_farmers.setdefault(fam_id, []).append(fid)

# 2. Assessors mapping
assessors_df = pd.read_csv(assessors_path) if os.path.exists(assessors_path) else pd.DataFrame()
assessors_dict: Dict[str, str] = (
    dict(zip(assessors_df["assessor_id"].astype(str), assessors_df["name"].astype(str)))
    if not assessors_df.empty
    else {}
)

# 3. Claim scores mapping
scores_dict: Dict[str, Dict[str, Any]] = {}
if os.path.exists(claim_scores_path):
    scores_df = pd.read_csv(claim_scores_path)
    for _, s_row in scores_df.iterrows():
        cid = str(s_row["claim_id"])
        scores_dict[cid] = {
            "risk_score": float(s_row.get("risk_score", 50.0)),
            "triage_tier": str(s_row.get("triage_tier", "review")),
            "graph_note": str(s_row.get("graph_note", "Standard graph topology.")),
        }

# 4. Graph nodes and edges for network construction
graph_nodes_dict: Dict[str, Dict[str, Any]] = {}
if os.path.exists(graph_nodes_path):
    nodes_df = pd.read_csv(graph_nodes_path)
    for _, n_row in nodes_df.iterrows():
        nid = str(n_row["node_id"])
        graph_nodes_dict[nid] = {
            "type": str(n_row.get("type", "")),
            "name": str(n_row.get("name", "")),
            "event": str(n_row.get("event", "")) if pd.notna(n_row.get("event")) else "",
        }

graph_edges_list: List[Dict[str, Any]] = []
if os.path.exists(graph_edges_path):
    edges_df = pd.read_csv(graph_edges_path)
    for _, e_row in edges_df.iterrows():
        graph_edges_list.append({
            "source": str(e_row["source"]),
            "target": str(e_row["target"]),
            "weight": min(1.0, max(0.0, float(e_row.get("weight", 1.0)))),
            "relation": str(e_row.get("relation", "connected_to")),
        })

# 5. Populate MOCK_CLAIMS_RAW
MOCK_CLAIMS_RAW: List[Dict[str, Any]] = []
claims_df = pd.read_csv(claims_path) if os.path.exists(claims_path) else pd.DataFrame()

# Precompute index of claims by farmer, assessor, and zone for network lookups
claims_by_farmer: Dict[str, List[str]] = {}
claims_by_assessor: Dict[str, List[str]] = {}
claims_by_zone: Dict[str, List[str]] = {}

for _, c_row in claims_df.iterrows():
    cid = str(c_row["claim_id"])
    fid = str(c_row["farmer_id"])
    aid = str(c_row["assessor_id"])
    zid = str(c_row["zone_id"])
    crop = str(c_row["crop_type"])
    payout = float(c_row["claimed_payout_amount"])

    farmer_name = farmers_dict.get(fid, fid)
    assessor_name = assessors_dict.get(aid, aid)

    score_info = scores_dict.get(cid, {})
    risk_score = float(score_info.get("risk_score", 50.0))
    triage_tier = str(score_info.get("triage_tier", "review"))
    graph_note = str(score_info.get("graph_note", f"Claim evaluated for {farmer_name}."))

    claim_record = {
        "claim_id": cid,
        "farmer_name": farmer_name,
        "assessor_name": assessor_name,
        "crop_type": crop,
        "claimed_payout_amount": payout,
        "claim_date": "2025-10-01",  # Fixed placeholder date per specification
        "risk_score": risk_score,
        "triage_tier": triage_tier,
        "farmer_id": fid,
        "assessor_id": aid,
        "zone_id": zid,
        "explainability": {
            "graph_note": graph_note,
            "text_note": "Not yet implemented",
            "image_note": "Not yet implemented",
        },
    }
    # Note: is_fraud is NEVER included in claim_record or exposed
    MOCK_CLAIMS_RAW.append(claim_record)

    claims_by_farmer.setdefault(fid, []).append(cid)
    claims_by_assessor.setdefault(aid, []).append(cid)
    claims_by_zone.setdefault(zid, []).append(cid)

CLAIMS_MAP: Dict[str, Dict[str, Any]] = {c["claim_id"]: c for c in MOCK_CLAIMS_RAW}


def generate_claim_network(claim_data: Dict[str, Any]) -> NetworkGraph:
    """
    Builds a relationship network for the specified claim, returning the claim,
    its farmer, assessor and zone, plus up to 6 other claims by the same farmer
    or family group, and up to 6 by the same assessor, ordered by risk_score descending.
    Marks each node with its type and risk_score. Never exposes is_fraud.
    """
    claim_id = str(claim_data["claim_id"])
    farmer_id = str(claim_data.get("farmer_id", ""))
    assessor_id = str(claim_data.get("assessor_id", ""))
    zone_id = str(claim_data.get("zone_id", ""))

    # If missing from claim_data, resolve from CLAIMS_MAP
    if not (farmer_id and assessor_id and zone_id) and claim_id in CLAIMS_MAP:
        rec = CLAIMS_MAP[claim_id]
        farmer_id = farmer_id or rec.get("farmer_id", "")
        assessor_id = assessor_id or rec.get("assessor_id", "")
        zone_id = zone_id or rec.get("zone_id", "")

    # 1. Claims by the same farmer or family group (up to 6, ordered by risk_score desc)
    fam_id = farmer_to_family.get(farmer_id, "")
    related_farmer_ids = set(family_to_farmers.get(fam_id, [])) if fam_id else set()
    related_farmer_ids.add(farmer_id)

    farmer_candidate_cids: List[str] = []
    for fid in related_farmer_ids:
        for cid in claims_by_farmer.get(fid, []):
            if cid != claim_id and cid not in farmer_candidate_cids:
                farmer_candidate_cids.append(cid)

    # Order by risk_score descending
    farmer_candidate_cids.sort(
        key=lambda c: CLAIMS_MAP.get(c, {}).get("risk_score", 0.0),
        reverse=True
    )
    selected_farmer_claims = farmer_candidate_cids[:6]

    # 2. Claims by the same assessor (up to 6, ordered by risk_score desc, excluding already selected)
    assessor_candidate_cids: List[str] = []
    for cid in claims_by_assessor.get(assessor_id, []):
        if cid != claim_id and cid not in selected_farmer_claims and cid not in assessor_candidate_cids:
            assessor_candidate_cids.append(cid)

    # Order by risk_score descending
    assessor_candidate_cids.sort(
        key=lambda c: CLAIMS_MAP.get(c, {}).get("risk_score", 0.0),
        reverse=True
    )
    selected_assessor_claims = assessor_candidate_cids[:6]

    nodes: List[NetworkNode] = []

    # 1. Main claim node
    main_risk = float(claim_data.get("risk_score", 50.0))
    nodes.append(
        NetworkNode(
            id=claim_id,
            label=f"Claim {claim_id}",
            kind="claim",
            type="claim",
            risk_score=main_risk,
            triage_tier=str(claim_data.get("triage_tier", "approve")),
        )
    )

    # 2. Farmer node
    farmer_name = claim_data.get("farmer_name") or farmers_dict.get(farmer_id, farmer_id)
    farmer_all_cids = claims_by_farmer.get(farmer_id, [])
    farmer_risk = (
        round(sum(CLAIMS_MAP[c]["risk_score"] for c in farmer_all_cids) / len(farmer_all_cids), 1)
        if farmer_all_cids
        else main_risk
    )
    nodes.append(
        NetworkNode(
            id=farmer_id,
            label=farmer_name,
            kind="farmer",
            type="farmer",
            risk_score=farmer_risk,
            triage_tier=None,
        )
    )

    # 3. Assessor node
    assessor_name = claim_data.get("assessor_name") or assessors_dict.get(assessor_id, assessor_id)
    assessor_all_cids = claims_by_assessor.get(assessor_id, [])
    assessor_risk = (
        round(sum(CLAIMS_MAP[c]["risk_score"] for c in assessor_all_cids) / len(assessor_all_cids), 1)
        if assessor_all_cids
        else main_risk
    )
    nodes.append(
        NetworkNode(
            id=assessor_id,
            label=assessor_name,
            kind="assessor",
            type="assessor",
            risk_score=assessor_risk,
            triage_tier=None,
        )
    )

    # 4. Zone node
    zone_event = graph_nodes_dict.get(zone_id, {}).get("event", "")
    zone_label = f"Zone {zone_id} ({zone_event})" if zone_event else f"Zone {zone_id}"
    zone_all_cids = claims_by_zone.get(zone_id, [])
    zone_risk = (
        round(sum(CLAIMS_MAP[c]["risk_score"] for c in zone_all_cids) / len(zone_all_cids), 1)
        if zone_all_cids
        else main_risk
    )
    nodes.append(
        NetworkNode(
            id=zone_id,
            label=zone_label,
            kind="zone",
            type="zone",
            risk_score=zone_risk,
            triage_tier=None,
        )
    )

    # 5. Other claims (up to 6 by farmer/family + up to 6 by assessor)
    other_claims = selected_farmer_claims + selected_assessor_claims
    for oid in other_claims:
        odata = CLAIMS_MAP.get(oid, {})
        o_risk = float(odata.get("risk_score", 50.0))
        nodes.append(
            NetworkNode(
                id=oid,
                label=f"Claim {oid}",
                kind="claim",
                type="claim",
                risk_score=o_risk,
                triage_tier=str(odata.get("triage_tier", "approve")),
            )
        )

    # Build edges between all active nodes
    active_node_ids = {n.id for n in nodes}
    edges: List[NetworkEdge] = []
    seen_edge_keys: Set[tuple] = set()

    for e in graph_edges_list:
        src = e["source"]
        tgt = e["target"]
        if src in active_node_ids and tgt in active_node_ids:
            key = (src, tgt, e["relation"])
            rev_key = (tgt, src, e["relation"])
            if key not in seen_edge_keys and rev_key not in seen_edge_keys:
                seen_edge_keys.add(key)
                
                # Anomaly flag if connected to investigated claim
                is_anom = False
                for cid in [src, tgt]:
                    if cid in CLAIMS_MAP and CLAIMS_MAP[cid].get("triage_tier") == "investigate":
                        is_anom = True
                        break

                edges.append(
                    NetworkEdge(
                        source=src,
                        target=tgt,
                        relationship=e["relation"],
                        weight=e["weight"],
                        is_anomalous=is_anom,
                    )
                )

    # Ensure baseline direct edges for the main claim
    base_edges = [
        (farmer_id, claim_id, "filed_by"),
        (assessor_id, claim_id, "verified_by"),
        (zone_id, claim_id, "in_zone"),
    ]
    is_main_investigate = (claim_data.get("triage_tier") == "investigate")
    for s, t, r in base_edges:
        if s and t and (s, t, r) not in seen_edge_keys and (t, s, r) not in seen_edge_keys:
            seen_edge_keys.add((s, t, r))
            edges.append(
                NetworkEdge(
                    source=s,
                    target=t,
                    relationship=r,
                    weight=1.0,
                    is_anomalous=is_main_investigate,
                )
            )

    # Connect other farmer/family claims
    for oid in selected_farmer_claims:
        o_fid = CLAIMS_MAP.get(oid, {}).get("farmer_id", farmer_id)
        rel = "filed_by" if o_fid == farmer_id else "family_claim"
        key = (farmer_id, oid, rel)
        rev_key = (oid, farmer_id, rel)
        if key not in seen_edge_keys and rev_key not in seen_edge_keys:
            seen_edge_keys.add(key)
            edges.append(
                NetworkEdge(
                    source=farmer_id,
                    target=oid,
                    relationship=rel,
                    weight=0.9,
                    is_anomalous=(CLAIMS_MAP.get(oid, {}).get("triage_tier") == "investigate"),
                )
            )

    # Connect other assessor claims
    for oid in selected_assessor_claims:
        key = (assessor_id, oid, "verified_by")
        rev_key = (oid, assessor_id, "verified_by")
        if key not in seen_edge_keys and rev_key not in seen_edge_keys:
            seen_edge_keys.add(key)
            edges.append(
                NetworkEdge(
                    source=assessor_id,
                    target=oid,
                    relationship="verified_by",
                    weight=0.9,
                    is_anomalous=(CLAIMS_MAP.get(oid, {}).get("triage_tier") == "investigate"),
                )
            )

    return NetworkGraph(nodes=nodes, edges=edges)
