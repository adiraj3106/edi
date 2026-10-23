"""
AgriGuard — XGBoost baseline + GraphSAGE training, run end-to-end.
Uses the synthetic claims/farmers/assessors/zones CSVs generated earlier.
"""
import sys
import pandas as pd
import numpy as np
import torch
import torch.nn.functional as F
from torch_geometric.data import HeteroData
from torch_geometric.nn import SAGEConv, to_hetero
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.metrics import f1_score, roc_auc_score
from xgboost import XGBClassifier

# Fixed Code:
FOLDER = sys.argv[1] if len(sys.argv) > 1 else "."

claims = pd.read_csv(f"{FOLDER}/claims.csv")
farmers = pd.read_csv(f"{FOLDER}/farmers.csv")
assessors = pd.read_csv(f"{FOLDER}/assessors.csv")
zones = pd.read_csv(f"{FOLDER}/weather_zones.csv")

print(f"Loaded: {len(claims)} claims, {len(farmers)} farmers, {len(assessors)} assessors, {len(zones)} zones")

# =========================================================
# PART 1 — XGBoost baseline (claim features only, no graph)
# =========================================================
df = claims.copy()
df['crop_type_enc'] = LabelEncoder().fit_transform(df['crop_type'])
X = df[['claimed_damage_pct', 'claimed_payout_amount', 'crop_type_enc']]
y = df['is_fraud']

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, stratify=y, random_state=42)
pos_weight = (y_train == 0).sum() / max((y_train == 1).sum(), 1)

xgb = XGBClassifier(scale_pos_weight=pos_weight, eval_metric='logloss', random_state=42)
xgb.fit(X_train, y_train)
xgb_preds = xgb.predict(X_test)
xgb_proba = xgb.predict_proba(X_test)[:, 1]

xgb_f1 = f1_score(y_test, xgb_preds)
xgb_auc = roc_auc_score(y_test, xgb_proba)
print(f"\n=== XGBoost Baseline (no graph) ===")
print(f"F1: {xgb_f1:.4f}  |  AUC: {xgb_auc:.4f}")

# =========================================================
# PART 2 — GraphSAGE (uses claim relationships)
# =========================================================
# Build index maps
farmer_idx = {fid: i for i, fid in enumerate(farmers.farmer_id)}
assessor_idx = {aid: i for i, aid in enumerate(assessors.assessor_id)}
zone_idx = {zid: i for i, zid in enumerate(zones.zone_id)}
claim_idx = {cid: i for i, cid in enumerate(claims.claim_id)}

data = HeteroData()

# ---- Node features ----
# Claim features: damage_pct, payout_amount, crop_type (encoded)
claim_feats = np.stack([
    claims['claimed_damage_pct'].values,
    claims['claimed_payout_amount'].values / 1000.0,  # scale down
    LabelEncoder().fit_transform(claims['crop_type']),
], axis=1).astype(np.float32)
claim_feats = StandardScaler().fit_transform(claim_feats)
data['claim'].x = torch.tensor(claim_feats, dtype=torch.float)
data['claim'].y = torch.tensor(claims['is_fraud'].values, dtype=torch.long)

# Farmer features: land_holding_acres
farmer_feats = farmers[['land_holding_acres']].values.astype(np.float32)
farmer_feats = StandardScaler().fit_transform(farmer_feats)
data['farmer'].x = torch.tensor(farmer_feats, dtype=torch.float)

# Assessor features: years_of_service
assessor_feats = assessors[['years_of_service']].values.astype(np.float32)
assessor_feats = StandardScaler().fit_transform(assessor_feats)
data['assessor'].x = torch.tensor(assessor_feats, dtype=torch.float)

# Zone features: severity_index
zone_feats = zones[['severity_index']].values.astype(np.float32)
data['zone'].x = torch.tensor(zone_feats, dtype=torch.float)

# ---- Edges (claim <-> farmer, claim <-> assessor, claim <-> zone) ----
c2f = torch.tensor([[claim_idx[r.claim_id], farmer_idx[r.farmer_id]] for r in claims.itertuples()]).T
c2a = torch.tensor([[claim_idx[r.claim_id], assessor_idx[r.assessor_id]] for r in claims.itertuples()]).T
c2z = torch.tensor([[claim_idx[r.claim_id], zone_idx[r.zone_id]] for r in claims.itertuples()]).T

data['claim', 'filed_by', 'farmer'].edge_index = c2f
data['claim', 'verified_by', 'assessor'].edge_index = c2a
data['claim', 'in_zone', 'zone'].edge_index = c2z

# reverse edges so message passing flows both directions
data['farmer', 'rev_filed_by', 'claim'].edge_index = c2f.flip(0)
data['assessor', 'rev_verified_by', 'claim'].edge_index = c2a.flip(0)
data['zone', 'rev_in_zone', 'claim'].edge_index = c2z.flip(0)

print(f"\n=== Graph built ===")
print(data)

# ---- Train/val/test split on claim nodes ----
n_claims = data['claim'].num_nodes
indices = np.arange(n_claims)
train_idx, test_idx = train_test_split(indices, test_size=0.3, stratify=claims['is_fraud'], random_state=42)
val_idx, test_idx = train_test_split(test_idx, test_size=0.5, stratify=claims['is_fraud'].iloc[test_idx], random_state=42)

train_mask = torch.zeros(n_claims, dtype=torch.bool); train_mask[train_idx] = True
val_mask = torch.zeros(n_claims, dtype=torch.bool); val_mask[val_idx] = True
test_mask = torch.zeros(n_claims, dtype=torch.bool); test_mask[test_idx] = True

# ---- GraphSAGE model (homogeneous conv, converted to heterogeneous) ----
class SAGE(torch.nn.Module):
    def __init__(self, hidden_channels, out_channels):
        super().__init__()
        self.conv1 = SAGEConv((-1, -1), hidden_channels)
        self.conv2 = SAGEConv((-1, -1), out_channels)

    def forward(self, x, edge_index):
        x = F.relu(self.conv1(x, edge_index))
        x = self.conv2(x, edge_index)
        return x

model = SAGE(hidden_channels=32, out_channels=2)
model = to_hetero(model, data.metadata(), aggr='sum')

# cost-sensitive class weights
class_counts = np.bincount(claims['is_fraud'].values)
class_weights = torch.tensor([1.0, class_counts[0] / max(class_counts[1], 1)], dtype=torch.float)

optimizer = torch.optim.Adam(model.parameters(), lr=0.01, weight_decay=5e-4)

print(f"\n=== Training GraphSAGE ===")
for epoch in range(1, 101):
    model.train()
    optimizer.zero_grad()
    out = model(data.x_dict, data.edge_index_dict)
    loss = F.cross_entropy(out['claim'][train_mask], data['claim'].y[train_mask], weight=class_weights)
    loss.backward()
    optimizer.step()

    if epoch % 20 == 0 or epoch == 1:
        model.eval()
        with torch.no_grad():
            out = model(data.x_dict, data.edge_index_dict)
            pred = out['claim'].argmax(dim=1)
            val_f1 = f1_score(data['claim'].y[val_mask], pred[val_mask], zero_division=0)
        print(f"Epoch {epoch:3d} | Loss {loss.item():.4f} | Val F1 {val_f1:.4f}")

# ---- Final test evaluation ----
model.eval()
with torch.no_grad():
    out = model(data.x_dict, data.edge_index_dict)
    probs = F.softmax(out['claim'], dim=1)[:, 1]
    pred = out['claim'].argmax(dim=1)

gnn_f1 = f1_score(data['claim'].y[test_mask], pred[test_mask], zero_division=0)
gnn_auc = roc_auc_score(data['claim'].y[test_mask], probs[test_mask])

print(f"\n=== GraphSAGE Test Results ===")
print(f"F1: {gnn_f1:.4f}  |  AUC: {gnn_auc:.4f}")

# =========================================================
# PART 3 — Comparison
# =========================================================
print(f"\n{'='*45}")
print(f"{'Model':<25}{'F1':<10}{'AUC':<10}")
print(f"{'-'*45}")
print(f"{'XGBoost (no graph)':<25}{xgb_f1:<10.4f}{xgb_auc:<10.4f}")
print(f"{'GraphSAGE (with graph)':<25}{gnn_f1:<10.4f}{gnn_auc:<10.4f}")
print(f"{'='*45}")

improvement = "GraphSAGE beats XGBoost" if gnn_f1 > xgb_f1 else "XGBoost still ahead — needs more data/tuning"
print(f"\nResult: {improvement}")

FOLDER = sys.argv[1] if len(sys.argv) > 1 else "."

claims = pd.read_csv(f"{FOLDER}/claims.csv")
farmers = pd.read_csv(f"{FOLDER}/farmers.csv")
assessors = pd.read_csv(f"{FOLDER}/assessors.csv")
zones = pd.read_csv(f"{FOLDER}/weather_zones.csv")
