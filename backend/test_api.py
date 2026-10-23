"""
Verification test suite for AgriGuard FastAPI backend.
"""
import sys
import os

# Add workspace root to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_root():
    res = client.get("/")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "online"
    print("[PASS] GET / passed")

def test_list_claims():
    res = client.get("/claims")
    assert res.status_code == 200
    claims = res.json()
    assert isinstance(claims, list)
    assert len(claims) >= 2000, f"Expected 2000+ claims, got {len(claims)}"
    
    # Verify required keys & constraints
    required_keys = {
        "claim_id", "farmer_name", "assessor_name", "crop_type",
        "claimed_payout_amount", "claim_date", "risk_score", "triage_tier"
    }
    for claim in claims[:50]:  # sample check
        assert required_keys.issubset(claim.keys()), f"Missing keys in {claim}"
        assert 0.0 <= claim["risk_score"] <= 100.0
        assert claim["triage_tier"] in ["approve", "review", "investigate"]
        assert claim["claim_date"] == "2025-10-01", f"Expected placeholder claim_date '2025-10-01', got {claim['claim_date']}"
        assert "is_fraud" not in claim, "is_fraud must never be exposed"
        assert "fraud_type" not in claim, "fraud_type must never be exposed"

    # Verify diversity
    tiers = {c["triage_tier"] for c in claims}
    crops = {c["crop_type"] for c in claims}
    scores = {c["risk_score"] for c in claims}
    assert len(tiers) >= 3, "Triage tiers should include approve, review, and investigate"
    assert len(crops) >= 4, "Should have varied crop types"
    assert len(scores) >= 5, "Should have varied risk scores"
    print(f"[PASS] GET /claims passed ({len(claims)} claims loaded from CSVs, {len(crops)} crops, tiers: {tiers})")

def test_claim_detail():
    list_res = client.get("/claims")
    first_claim_id = list_res.json()[0]["claim_id"]
    
    res = client.get(f"/claims/{first_claim_id}")
    assert res.status_code == 200
    data = res.json()
    assert data["claim_id"] == first_claim_id
    assert data["claim_date"] == "2025-10-01"
    assert "is_fraud" not in data, "is_fraud must never be exposed"
    assert "explainability" in data
    exp = data["explainability"]
    assert "graph_note" in exp and len(exp["graph_note"]) > 0
    assert exp["text_note"] == "Not yet implemented", f"Expected 'Not yet implemented', got {exp['text_note']}"
    assert exp["image_note"] == "Not yet implemented", f"Expected 'Not yet implemented', got {exp['image_note']}"
    print(f"[PASS] GET /claims/{first_claim_id} passed with graph_note and 'Not yet implemented' for text/image notes")

def test_claim_detail_404():
    res = client.get("/claims/NONEXISTENT-999")
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()
    print("[PASS] GET /claims/NONEXISTENT-999 properly returns 404")

def test_claim_network():
    list_res = client.get("/claims")
    first_claim_id = list_res.json()[0]["claim_id"]

    res = client.get(f"/claims/{first_claim_id}/network")
    assert res.status_code == 200
    data = res.json()
    assert "nodes" in data and "edges" in data
    nodes = data["nodes"]
    edges = data["edges"]
    assert len(nodes) >= 4, f"Expected at least 4 nodes (claim, farmer, assessor, zone), got {len(nodes)}"
    assert len(edges) >= 3, f"Expected at least 3 edges, got {len(edges)}"

    # Check node structure
    kinds = {node["kind"] for node in nodes}
    assert "claim" in kinds, "Expected 'claim' node"
    assert "farmer" in kinds, "Expected 'farmer' node"
    assert "assessor" in kinds, "Expected 'assessor' node"
    assert "zone" in kinds or "farmland" in kinds, "Expected 'zone' node"

    # Up to 6 farmer + 6 assessor other claims -> max 13 claims total
    claim_nodes = [n for n in nodes if n["kind"] == "claim"]
    assert len(claim_nodes) <= 13, f"Expected up to 13 claims (1 main + 6 farmer + 6 assessor), got {len(claim_nodes)}"

    for node in nodes:
        assert "id" in node
        assert "label" in node
        assert "kind" in node
        assert "type" in node
        assert node["type"] in ["claim", "farmer", "assessor", "zone", "farmland"]
        assert "risk_score" in node and node["risk_score"] is not None
        assert 0.0 <= node["risk_score"] <= 100.0
        assert "is_fraud" not in node, "is_fraud must never be exposed in network nodes"
        
    # Check edge structure
    for edge in edges:
        assert "source" in edge
        assert "target" in edge
        assert "relationship" in edge
        assert "weight" in edge
        assert 0.0 <= edge["weight"] <= 1.0, f"Weight out of bounds: {edge['weight']}"
        assert "is_anomalous" in edge

    # Test graph depends on the claim
    second_claim_id = list_res.json()[1]["claim_id"]
    res2 = client.get(f"/claims/{second_claim_id}/network")
    assert res2.status_code == 200
    data2 = res2.json()
    nodes1_ids = {n["id"] for n in nodes}
    nodes2_ids = {n["id"] for n in data2["nodes"]}
    assert nodes1_ids != nodes2_ids, "Graph must depend on the selected claim"

    print(f"[PASS] GET /claims/{first_claim_id}/network passed ({len(nodes)} nodes including {len(claim_nodes)} claims, {len(edges)} edges; graphs depend on claim)")

def test_cors_headers():
    res = client.options(
        "/claims",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET"
        }
    )
    assert res.headers.get("access-control-allow-origin") in ["*", "http://localhost:5173"]
    print("[PASS] CORS preflight headers verified")

if __name__ == "__main__":
    test_root()
    test_list_claims()
    test_claim_detail()
    test_claim_detail_404()
    test_claim_network()
    test_cors_headers()
    print("\nALL TESTS PASSED SUCCESSFULLY!")
